import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import incomeReducer from '../../store/incomeSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import settingsReducer from '../../store/settingsSlice';
import type { IncomeEntry } from '../../types';
import IncomeEditor from './IncomeEditor';

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      writeIncome: vi.fn(),
    },
  };
});

const JUNE = '2026-06';

function incomeEntry(
  overrides: Partial<IncomeEntry> & Pick<IncomeEntry, 'month' | 'amount'>
): IncomeEntry {
  return { id: `${overrides.month}-${overrides.source ?? overrides.amount}`, ...overrides };
}

/**
 * Renders the full-screen income editor with a real store and the real debounced
 * sync middleware — only the sheets boundary is mocked, so a save or delete is
 * verified all the way to the write-back call. The month list is a stub so the
 * post-submit navigation is observable.
 */
function renderEditor(initialPath: string, items: IncomeEntry[] = []) {
  const store = configureStore({
    reducer: {
      income: incomeReducer,
      settings: settingsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      income: { items },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/income/new/:month" element={<IncomeEditor />} />
          <Route path="/income/edit/:id" element={<IncomeEditor />} />
          <Route path="/income/:month" element={<p>Lista de renda</p>} />
          <Route path="/income" element={<p>Renda</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

/** Wait out the debounced sync and assert some income write-back satisfies `matches`. */
async function expectIncomeWritten(matches: (written: IncomeEntry[]) => boolean) {
  await waitFor(
    () => {
      const snapshots = vi
        .mocked(googleSheetsService.writeIncome)
        .mock.calls.map(([, written]) => written);
      expect(snapshots.some(matches)).toBe(true);
    },
    { timeout: 2500 }
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
});

describe('Income editor', () => {
  it('creates an entry with a source note for the routed month, then returns to the list', async () => {
    // Given the editor is open to add income to June
    renderEditor(`/income/new/${JUNE}`);
    const user = userEvent.setup();

    // When I type the amount and its source and save
    await user.type(screen.getByLabelText('Valor da renda'), '12000');
    await user.type(screen.getByLabelText('Fonte (opcional)'), 'Salário');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de renda')).toBeInTheDocument();

    // And the new entry is written for the routed month with its note
    await expectIncomeWritten((written) =>
      written.some(
        (entry) => entry.month === JUNE && entry.amount === 12000 && entry.source === 'Salário'
      )
    );
  });

  it('creates an amount-only entry, leaving the source undefined', async () => {
    // Given the editor is open to add income to June
    renderEditor(`/income/new/${JUNE}`);
    const user = userEvent.setup();

    // When I save an amount without a source
    await user.type(screen.getByLabelText('Valor da renda'), '800');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the entry is recorded without a source
    await expectIncomeWritten((written) => {
      const june = written.filter((entry) => entry.month === JUNE);
      return june.length === 1 && june[0].amount === 800 && june[0].source === undefined;
    });
  });

  it('prefills the existing entry, saves the edit and returns to its month', async () => {
    // Given June has a 12.000 salary
    renderEditor(`/income/edit/${JUNE}-Salário`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
    ]);
    const user = userEvent.setup();

    // Then the form arrives prefilled
    expect(screen.getByLabelText('Valor da renda')).toHaveValue('12000');
    expect(screen.getByLabelText('Fonte (opcional)')).toHaveValue('Salário');

    // When I change the amount and note and save
    await user.clear(screen.getByLabelText('Valor da renda'));
    await user.type(screen.getByLabelText('Valor da renda'), '12500');
    await user.clear(screen.getByLabelText('Fonte (opcional)'));
    await user.type(screen.getByLabelText('Fonte (opcional)'), 'Salário líquido');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de renda')).toBeInTheDocument();

    // And the income tab carries the edit, keeping the same id
    await expectIncomeWritten((written) =>
      written.some(
        (entry) =>
          entry.id === `${JUNE}-Salário` &&
          entry.amount === 12500 &&
          entry.source === 'Salário líquido'
      )
    );
  });

  it('only removes the entry after the confirmation modal is confirmed', async () => {
    // Given June has a salary and an extra and I am editing the salary
    renderEditor(`/income/edit/${JUNE}-Salário`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
      incomeEntry({ month: JUNE, amount: 500, source: 'Freela' }),
    ]);
    const user = userEvent.setup();

    // When I tap Remove, the entry is not gone yet — a confirmation appears
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    const dialog = screen.getByRole('dialog', { name: 'Remover renda?' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();

    // When I confirm
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));

    // Then June's list is shown again
    expect(screen.getByText('Lista de renda')).toBeInTheDocument();

    // And the income tab is written back without the removed entry
    await expectIncomeWritten(
      (written) =>
        written.some((entry) => entry.source === 'Freela') &&
        !written.some((entry) => entry.source === 'Salário')
    );
  });

  it('cancels the confirmation modal without deleting anything', async () => {
    // Given I am editing a June salary
    const store = renderEditor(`/income/edit/${JUNE}-Salário`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
    ]);
    const user = userEvent.setup();

    // When I open the confirmation and cancel it
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Remover renda?' })).getByRole('button', {
        name: 'Cancelar',
      })
    );

    // Then the modal is gone, the entry is still in the store, and no write happens
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().income.items.some((entry) => entry.source === 'Salário')).toBe(true);
    expect(googleSheetsService.writeIncome).not.toHaveBeenCalled();
  });

  it('returns to the month list with the header back button', async () => {
    // Given the editor is open to add income to June
    renderEditor(`/income/new/${JUNE}`);
    const user = userEvent.setup();

    // When I tap back
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    // Then I am back on June's list without saving
    expect(screen.getByText('Lista de renda')).toBeInTheDocument();
  });

  it('sends an unknown edit id back to the income root', () => {
    // Given an income id that is not in the store
    renderEditor(`/income/edit/does-not-exist`, []);

    // When the editor renders
    // Then it redirects to the income root
    expect(screen.getByText('Renda')).toBeInTheDocument();
  });
});
