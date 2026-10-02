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
import outflowsReducer from '../../store/outflowsSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import pendingReducer from '../../store/pendingSlice';
import payersReducer from '../../store/payersSlice';
import settingsReducer from '../../store/settingsSlice';
import { writtenChanges, writtenRecords } from '../../test/pendingWrites';
import type { Bank, Outflow, Payer } from '../../types';
import OutflowEditor from './OutflowEditor';

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

function outflow(overrides: Partial<Outflow> & Pick<Outflow, 'month' | 'name' | 'amount'>): Outflow {
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
 * Renders the full-screen outflow editor with a real store and the real debounced
 * sync middleware — only the sheets boundary is mocked, so a save or delete is
 * verified all the way to the write-back call. The month list is a stub so the
 * post-submit navigation is observable.
 */
function renderEditor(
  initialPath: string,
  outflows: Outflow[] = [],
  payers: Payer[] = PAYERS,
  banks: Bank[] = BANKS
) {
  const store = configureStore({
    reducer: {
      outflows: outflowsReducer,
      payers: payersReducer,
      banks: banksReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      outflows: { items: outflows },
      payers: { items: payers },
      banks: { items: banks },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/outflows/new/:month" element={<OutflowEditor />} />
          <Route path="/outflows/edit/:id" element={<OutflowEditor />} />
          <Route path="/outflows/:month" element={<p>Lista de saídas</p>} />
          <Route path="/outflows" element={<p>Saídas</p>} />
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

/** Wait out the debounced sync and assert the outflows written satisfy `matches`. */
async function expectOutflowsWritten(matches: (written: Outflow[]) => boolean) {
  await waitFor(
    () => {
      const written = writtenRecords(googleSheetsService, 'outflows');
      expect(matches(written)).toBe(true);
    },
    { timeout: 2500 }
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
});

describe('Outflow editor', () => {
  it('creates a outflow for the routed month, open, then returns to the list', async () => {
    // Given the editor is open to add a outflow to June
    renderEditor(`/outflows/new/${JUNE}`);
    const user = userEvent.setup();

    // When I fill the four required fields and save
    await user.type(screen.getByLabelText('Nome da saída'), 'Luz');
    await user.type(screen.getByLabelText('Valor da saída'), '150');
    await choosePayerAndBank(user, 'payer-guta', 'bank-itau');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de saídas')).toBeInTheDocument();

    // And the new outflow is written for the routed month, unpaid, with its references
    await expectOutflowsWritten((written) =>
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

  it('saves a new outflow as not final by default', async () => {
    // Given the editor is open to add a outflow to June
    renderEditor(`/outflows/new/${JUNE}`);
    const user = userEvent.setup();

    // When I fill the required fields without ticking the final-value box
    await user.type(screen.getByLabelText('Nome da saída'), 'Luz');
    await user.type(screen.getByLabelText('Valor da saída'), '150');
    await choosePayerAndBank(user);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the new outflow is written as awaiting a final value
    await expectOutflowsWritten((written) =>
      written.some((entry) => entry.month === JUNE && entry.name === 'Luz' && !entry.isFinal)
    );
  });

  it('saves a new outflow as final when the final-value box is ticked', async () => {
    // Given the editor is open to add a outflow to June
    renderEditor(`/outflows/new/${JUNE}`);
    const user = userEvent.setup();

    // When I fill the required fields and tick the final-value box
    await user.type(screen.getByLabelText('Nome da saída'), 'Luz');
    await user.type(screen.getByLabelText('Valor da saída'), '150');
    await choosePayerAndBank(user);
    await user.click(screen.getByLabelText('Valor final'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the new outflow is written with its value confirmed
    await expectOutflowsWritten((written) =>
      written.some((entry) => entry.month === JUNE && entry.name === 'Luz' && entry.isFinal)
    );
  });

  it('prefills the existing final value and clears it on save', async () => {
    // Given June has a outflow whose value is confirmed
    renderEditor(`/outflows/edit/${JUNE}-Luz`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150, isFinal: true }),
    ]);
    const user = userEvent.setup();

    // Then the final-value box arrives ticked
    expect(screen.getByLabelText('Valor final')).toBeChecked();

    // When I untick it and save
    await user.click(screen.getByLabelText('Valor final'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the outflow is written back as awaiting a final value, same id
    await expectOutflowsWritten((written) =>
      written.some((entry) => entry.id === `${JUNE}-Luz` && !entry.isFinal)
    );
  });

  it('prefills the existing outflow, saves the edit and returns to its month', async () => {
    // Given June has a outflow of 150 paid by Marcelo from Nubank
    renderEditor(`/outflows/edit/${JUNE}-Luz`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
    ]);
    const user = userEvent.setup();

    // Then the form arrives prefilled
    expect(screen.getByLabelText('Nome da saída')).toHaveValue('Luz');
    expect(screen.getByLabelText('Valor da saída')).toHaveValue('150');
    expect(screen.getByLabelText('Responsável')).toHaveValue('payer-marcelo');
    expect(screen.getByLabelText('Banco')).toHaveValue('bank-nubank');

    // When I change name, amount, payer and bank and save
    await user.clear(screen.getByLabelText('Nome da saída'));
    await user.type(screen.getByLabelText('Nome da saída'), 'Energia elétrica');
    await user.clear(screen.getByLabelText('Valor da saída'));
    await user.type(screen.getByLabelText('Valor da saída'), '175');
    await choosePayerAndBank(user, 'payer-guta', 'bank-itau');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de saídas')).toBeInTheDocument();

    // And the outflows tab carries the edit, keeping the same id and paid status
    await expectOutflowsWritten((written) =>
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

  it('only removes the outflow after the confirmation modal is confirmed', async () => {
    // Given June has two outflows and I am editing one
    renderEditor(`/outflows/edit/${JUNE}-Internet`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Internet', amount: 110 }),
    ]);
    const user = userEvent.setup();

    // When I tap Remove, the outflow is not gone yet — a confirmation appears
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    const dialog = screen.getByRole('dialog', { name: 'Remover saída?' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();

    // When I confirm
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de saídas')).toBeInTheDocument();

    // And the removed outflow's row is blanked (a delete Pending Change), with no
    // other record rewritten
    await waitFor(
      () => {
        expect(writtenChanges(googleSheetsService, 'outflows')).toContainEqual({
          type: 'delete',
          id: `${JUNE}-Internet`,
        });
        expect(writtenRecords(googleSheetsService, 'outflows')).toEqual([]);
      },
      { timeout: 2500 }
    );
  });

  it('cancels the confirmation modal without deleting anything', async () => {
    // Given I am editing a June outflow
    const store = renderEditor(`/outflows/edit/${JUNE}-Luz`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
    ]);
    const user = userEvent.setup();

    // When I open the confirmation and cancel it
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Remover saída?' })).getByRole('button', {
        name: 'Cancelar',
      })
    );

    // Then the modal is gone, the outflow is still in the store, and no write happens
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().outflows.items.some((entry) => entry.name === 'Luz')).toBe(true);
    expect(googleSheetsService.writePendingChanges).not.toHaveBeenCalled();
  });

  it('returns to the month list with the header back button', async () => {
    // Given the editor is open to add a outflow to June
    renderEditor(`/outflows/new/${JUNE}`);
    const user = userEvent.setup();

    // When I tap back
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    // Then I am back on June's list without saving
    expect(screen.getByText('Lista de saídas')).toBeInTheDocument();
  });

  it('highlights the registry guidance and shortcuts to Settings instead of an unusable form', async () => {
    // Given no payers and no banks are registered
    renderEditor(`/outflows/new/${JUNE}`, [], [], []);
    const user = userEvent.setup();

    // When the editor renders
    // Then the guidance sits in a highlighted callout, with no form or remove action
    expect(
      screen.getByText('Cadastre ao menos um responsável e um banco em Ajustes para adicionar saídas.')
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveClass('bg-amber-50');
    expect(screen.queryByLabelText('Nome da saída')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();

    // When I tap the callout's shortcut
    await user.click(screen.getByRole('button', { name: 'Ir para Ajustes' }));

    // Then the Settings page opens
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('sends an unknown edit id back to the outflows root', () => {
    // Given a outflow id that is not in the store
    renderEditor(`/outflows/edit/does-not-exist`, []);

    // When the editor renders
    // Then it redirects to the outflows root
    expect(screen.getByText('Saídas')).toBeInTheDocument();
  });
});
