import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import pendingReducer from '../../store/pendingSlice';
import planReducer from '../../store/planSlice';
import settingsReducer from '../../store/settingsSlice';
import { writtenChanges, writtenRecords } from '../../test/pendingWrites';
import type { PlanItem } from '../../types';
import BucketEditor from './BucketEditor';

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

function planItem(
  overrides: Partial<PlanItem> & Pick<PlanItem, 'month' | 'name' | 'amount'>
): PlanItem {
  return { id: `${overrides.month}-${overrides.name}`, remainingEstimate: 0, ...overrides };
}

/**
 * Renders the full-screen bucket editor with a real store and the real debounced
 * sync middleware — only the sheets boundary is mocked. The plan list is a stub
 * so the post-submit navigation is observable.
 */
function renderEditor(initialPath: string, items: PlanItem[] = []) {
  const store = configureStore({
    reducer: {
      plan: planReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      plan: { items, cardSpending: [] },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/plan/new/:month" element={<BucketEditor />} />
          <Route path="/plan/edit/:id" element={<BucketEditor />} />
          <Route path="/plan/:month" element={<p>Lista do plano</p>} />
          <Route path="/plan" element={<p>Plano</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

/** Wait out the debounced sync and assert the plan written satisfies `matches`. */
async function expectPlanWritten(matches: (written: PlanItem[]) => boolean) {
  await waitFor(
    () => {
      const written = writtenRecords(googleSheetsService, 'plan');
      expect(matches(written)).toBe(true);
    },
    { timeout: 2500 }
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR');
  vi.clearAllMocks();
});

describe('Bucket editor', () => {
  it('creates a spending bucket for the routed month at zero estimate, then returns to the plan', async () => {
    // Given the editor is open to add a bucket to June
    renderEditor(`/plan/new/${JUNE}`);
    const user = userEvent.setup();

    // When I set a name and cap and save
    await user.type(screen.getByLabelText('Nome do teto'), 'Pets');
    await user.type(screen.getByLabelText('Limite do teto'), '300');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then June's plan is shown again
    expect(screen.getByText('Lista do plano')).toBeInTheDocument();

    // And the new bucket is written for the routed month at zero estimate
    await expectPlanWritten((written) =>
      written.some(
        (entry) =>
          entry.month === JUNE &&
          entry.name === 'Pets' &&
          entry.amount === 300 &&
          entry.remainingEstimate === 0
      )
    );
  });

  it('prefills the existing bucket, saves name and cap, and returns to the plan', async () => {
    // Given June's plan has a 110 Internet bucket with a 40 estimate
    renderEditor(`/plan/edit/${JUNE}-Internet`, [
      planItem({ month: JUNE, name: 'Internet', amount: 110, remainingEstimate: 40 }),
    ]);
    const user = userEvent.setup();

    // Then the form arrives prefilled with the name and cap
    expect(screen.getByLabelText('Nome do teto')).toHaveValue('Internet');
    expect(screen.getByLabelText('Limite do teto')).toHaveValue('110');

    // When I change the name and cap and save
    await user.clear(screen.getByLabelText('Nome do teto'));
    await user.type(screen.getByLabelText('Nome do teto'), 'Internet fibra');
    await user.clear(screen.getByLabelText('Limite do teto'));
    await user.type(screen.getByLabelText('Limite do teto'), '120');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then June's plan is shown again
    expect(screen.getByText('Lista do plano')).toBeInTheDocument();

    // And the plan tab carries the edit with the same id, keeping the estimate
    await expectPlanWritten((written) =>
      written.some(
        (entry) =>
          entry.id === `${JUNE}-Internet` &&
          entry.name === 'Internet fibra' &&
          entry.amount === 120 &&
          entry.remainingEstimate === 40
      )
    );
  });

  it('only removes the bucket after the confirmation modal is confirmed', async () => {
    // Given June's plan has an Internet and a Gym bucket
    renderEditor(`/plan/edit/${JUNE}-Internet`, [
      planItem({ month: JUNE, name: 'Internet', amount: 110 }),
      planItem({ month: JUNE, name: 'Gym', amount: 200 }),
    ]);
    const user = userEvent.setup();

    // When I tap Remove, a confirmation appears instead of an immediate delete
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    const dialog = screen.getByRole('dialog', { name: 'Remover teto de gastos?' });
    expect(dialog).toBeInTheDocument();

    // When I confirm
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));

    // Then June's plan is shown again
    expect(screen.getByText('Lista do plano')).toBeInTheDocument();

    // And the removed bucket's row is blanked, with no other record rewritten
    await waitFor(
      () => {
        expect(writtenChanges(googleSheetsService, 'plan')).toContainEqual({
          type: 'delete',
          id: `${JUNE}-Internet`,
        });
        expect(writtenRecords(googleSheetsService, 'plan')).toEqual([]);
      },
      { timeout: 2500 }
    );
  });

  it('returns to the plan with the header back button', async () => {
    // Given the editor is open to add a bucket to June
    renderEditor(`/plan/new/${JUNE}`);
    const user = userEvent.setup();

    // When I tap back
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    // Then I am back on June's plan without saving
    expect(screen.getByText('Lista do plano')).toBeInTheDocument();
  });

  it('sends an unknown edit id back to the plan root', () => {
    // Given a bucket id that is not in the store
    renderEditor(`/plan/edit/does-not-exist`, []);

    // When the editor renders
    // Then it redirects to the plan root
    expect(screen.getByText('Plano')).toBeInTheDocument();
  });
});
