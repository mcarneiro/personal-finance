import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import banksReducer from '../../store/banksSlice';
import billsReducer from '../../store/billsSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import pendingReducer from '../../store/pendingSlice';
import payersReducer from '../../store/payersSlice';
import settingsReducer from '../../store/settingsSlice';
import { writtenChanges, writtenRecords } from '../../test/pendingWrites';
import type { Bank, Bill, Payer } from '../../types';
import BillEditor from './BillEditor';

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      writePendingChanges: vi.fn(),
    },
  };
});

const JUNE = '2026-06';

const PAYERS: Payer[] = [
  { id: 'payer-marcelo', name: 'Marcelo' },
  { id: 'payer-guta', name: 'Guta' },
];
const BANKS: Bank[] = [
  { id: 'bank-itau', name: 'Itaú' },
  { id: 'bank-nubank', name: 'Nubank' },
];

function bill(overrides: Partial<Bill> & Pick<Bill, 'month' | 'name' | 'amount'>): Bill {
  return {
    id: `${overrides.month}-${overrides.name}`,
    isPaid: false,
    isFinal: true,
    payerId: 'payer-marcelo',
    bankId: 'bank-nubank',
    ...overrides,
  };
}

/**
 * Renders the full-screen bill editor with a real store and the real debounced
 * sync middleware — only the sheets boundary is mocked, so a save or delete is
 * verified all the way to the write-back call. The month list is a stub so the
 * post-submit navigation is observable.
 */
function renderEditor(
  initialPath: string,
  bills: Bill[] = [],
  payers: Payer[] = PAYERS,
  banks: Bank[] = BANKS
) {
  const store = configureStore({
    reducer: {
      bills: billsReducer,
      payers: payersReducer,
      banks: banksReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      bills: { items: bills },
      payers: { items: payers },
      banks: { items: banks },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/bills/new/:month" element={<BillEditor />} />
          <Route path="/bills/edit/:id" element={<BillEditor />} />
          <Route path="/bills/:month" element={<p>Lista de contas</p>} />
          <Route path="/bills" element={<p>Contas</p>} />
          <Route path="/settings" element={<p>Ajustes</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

async function choosePayerAndBank(
  user: ReturnType<typeof userEvent.setup>,
  payerId = 'payer-marcelo',
  bankId = 'bank-nubank'
) {
  await user.selectOptions(screen.getByLabelText('Responsável'), payerId);
  await user.selectOptions(screen.getByLabelText('Banco'), bankId);
}

/** Wait out the debounced sync and assert the bills written satisfy `matches`. */
async function expectBillsWritten(matches: (written: Bill[]) => boolean) {
  await waitFor(
    () => {
      const written = writtenRecords(googleSheetsService, 'bills');
      expect(matches(written)).toBe(true);
    },
    { timeout: 2500 }
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
});

describe('Bill editor', () => {
  it('creates a bill for the routed month, open, then returns to the list', async () => {
    // Given the editor is open to add a bill to June
    renderEditor(`/bills/new/${JUNE}`);
    const user = userEvent.setup();

    // When I fill the four required fields and save
    await user.type(screen.getByLabelText('Nome da conta'), 'Luz');
    await user.type(screen.getByLabelText('Valor da conta'), '150');
    await choosePayerAndBank(user, 'payer-guta', 'bank-itau');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de contas')).toBeInTheDocument();

    // And the new bill is written for the routed month, unpaid, with its references
    await expectBillsWritten((written) =>
      written.some(
        (entry) =>
          entry.month === JUNE &&
          entry.name === 'Luz' &&
          entry.amount === 150 &&
          entry.payerId === 'payer-guta' &&
          entry.bankId === 'bank-itau' &&
          !entry.isPaid
      )
    );
  });

  it('saves a new bill as not final by default', async () => {
    // Given the editor is open to add a bill to June
    renderEditor(`/bills/new/${JUNE}`);
    const user = userEvent.setup();

    // When I fill the required fields without ticking the final-value box
    await user.type(screen.getByLabelText('Nome da conta'), 'Luz');
    await user.type(screen.getByLabelText('Valor da conta'), '150');
    await choosePayerAndBank(user);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the new bill is written as awaiting a final value
    await expectBillsWritten((written) =>
      written.some((entry) => entry.month === JUNE && entry.name === 'Luz' && !entry.isFinal)
    );
  });

  it('saves a new bill as final when the final-value box is ticked', async () => {
    // Given the editor is open to add a bill to June
    renderEditor(`/bills/new/${JUNE}`);
    const user = userEvent.setup();

    // When I fill the required fields and tick the final-value box
    await user.type(screen.getByLabelText('Nome da conta'), 'Luz');
    await user.type(screen.getByLabelText('Valor da conta'), '150');
    await choosePayerAndBank(user);
    await user.click(screen.getByLabelText('Valor final'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the new bill is written with its value confirmed
    await expectBillsWritten((written) =>
      written.some((entry) => entry.month === JUNE && entry.name === 'Luz' && entry.isFinal)
    );
  });

  it('prefills the existing final value and clears it on save', async () => {
    // Given June has a bill whose value is confirmed
    renderEditor(`/bills/edit/${JUNE}-Luz`, [
      bill({ month: JUNE, name: 'Luz', amount: 150, isFinal: true }),
    ]);
    const user = userEvent.setup();

    // Then the final-value box arrives ticked
    expect(screen.getByLabelText('Valor final')).toBeChecked();

    // When I untick it and save
    await user.click(screen.getByLabelText('Valor final'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the bill is written back as awaiting a final value, same id
    await expectBillsWritten((written) =>
      written.some((entry) => entry.id === `${JUNE}-Luz` && !entry.isFinal)
    );
  });

  it('prefills the existing bill, saves the edit and returns to its month', async () => {
    // Given June has a bill of 150 paid by Marcelo from Nubank
    renderEditor(`/bills/edit/${JUNE}-Luz`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
    ]);
    const user = userEvent.setup();

    // Then the form arrives prefilled
    expect(screen.getByLabelText('Nome da conta')).toHaveValue('Luz');
    expect(screen.getByLabelText('Valor da conta')).toHaveValue('150');
    expect(screen.getByLabelText('Responsável')).toHaveValue('payer-marcelo');
    expect(screen.getByLabelText('Banco')).toHaveValue('bank-nubank');

    // When I change name, amount, payer and bank and save
    await user.clear(screen.getByLabelText('Nome da conta'));
    await user.type(screen.getByLabelText('Nome da conta'), 'Energia elétrica');
    await user.clear(screen.getByLabelText('Valor da conta'));
    await user.type(screen.getByLabelText('Valor da conta'), '175');
    await choosePayerAndBank(user, 'payer-guta', 'bank-itau');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de contas')).toBeInTheDocument();

    // And the bills tab carries the edit, keeping the same id and paid status
    await expectBillsWritten((written) =>
      written.some(
        (entry) =>
          entry.id === `${JUNE}-Luz` &&
          entry.name === 'Energia elétrica' &&
          entry.amount === 175 &&
          entry.payerId === 'payer-guta' &&
          entry.bankId === 'bank-itau' &&
          !entry.isPaid
      )
    );
  });

  it('only removes the bill after the confirmation modal is confirmed', async () => {
    // Given June has two bills and I am editing one
    renderEditor(`/bills/edit/${JUNE}-Internet`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Internet', amount: 110 }),
    ]);
    const user = userEvent.setup();

    // When I tap Remove, the bill is not gone yet — a confirmation appears
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    const dialog = screen.getByRole('dialog', { name: 'Remover conta?' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();

    // When I confirm
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de contas')).toBeInTheDocument();

    // And the removed bill's row is blanked (a delete Pending Change), with no
    // other record rewritten
    await waitFor(
      () => {
        expect(writtenChanges(googleSheetsService, 'bills')).toContainEqual({
          type: 'delete',
          id: `${JUNE}-Internet`,
        });
        expect(writtenRecords(googleSheetsService, 'bills')).toEqual([]);
      },
      { timeout: 2500 }
    );
  });

  it('cancels the confirmation modal without deleting anything', async () => {
    // Given I am editing a June bill
    const store = renderEditor(`/bills/edit/${JUNE}-Luz`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
    ]);
    const user = userEvent.setup();

    // When I open the confirmation and cancel it
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Remover conta?' })).getByRole('button', {
        name: 'Cancelar',
      })
    );

    // Then the modal is gone, the bill is still in the store, and no write happens
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().bills.items.some((entry) => entry.name === 'Luz')).toBe(true);
    expect(googleSheetsService.writePendingChanges).not.toHaveBeenCalled();
  });

  it('returns to the month list with the header back button', async () => {
    // Given the editor is open to add a bill to June
    renderEditor(`/bills/new/${JUNE}`);
    const user = userEvent.setup();

    // When I tap back
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    // Then I am back on June's list without saving
    expect(screen.getByText('Lista de contas')).toBeInTheDocument();
  });

  it('highlights the registry guidance and shortcuts to Settings instead of an unusable form', async () => {
    // Given no payers and no banks are registered
    renderEditor(`/bills/new/${JUNE}`, [], [], []);
    const user = userEvent.setup();

    // When the editor renders
    // Then the guidance sits in a highlighted callout, with no form or remove action
    expect(
      screen.getByText('Cadastre ao menos um responsável e um banco em Ajustes para adicionar contas.')
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveClass('bg-amber-50');
    expect(screen.queryByLabelText('Nome da conta')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();

    // When I tap the callout's shortcut
    await user.click(screen.getByRole('button', { name: 'Ir para Ajustes' }));

    // Then the Settings page opens
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('sends an unknown edit id back to the bills root', () => {
    // Given a bill id that is not in the store
    renderEditor(`/bills/edit/does-not-exist`, []);

    // When the editor renders
    // Then it redirects to the bills root
    expect(screen.getByText('Contas')).toBeInTheDocument();
  });
});
