import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../config/i18n';
import i18n from '../config/i18n';
import { undoListenerMiddleware } from '../store/middleware/undoListener';
import undoReducer, { UNDO_TTL_MS, type UndoEntry } from '../store/undoSlice';
import UndoToast from './UndoToast';

function entry(overrides: Partial<UndoEntry> = {}): UndoEntry {
  return {
    id: 'undo-1',
    createdAt: Date.now(),
    bulk: null,
    count: 1,
    steps: [],
    ...overrides,
  };
}

function renderToast(undoEntry: UndoEntry | null = entry()) {
  const store = configureStore({
    reducer: { undo: undoReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(undoListenerMiddleware.middleware),
    preloadedState: { undo: { entry: undoEntry, applying: false } },
  });

  render(
    <Provider store={store}>
      <UndoToast />
    </Provider>
  );

  return store;
}

describe('UndoToast', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers undo for the change that just landed', () => {
    // Given a change just saved
    renderToast();

    // Then the toast says what happened and offers the undo
    expect(screen.getByText('Alterado')).toBeInTheDocument();

    // When the household taps Desfazer
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    // Then the toast goes away
    expect(screen.queryByText('Alterado')).not.toBeInTheDocument();
  });

  it('names a bulk replicate by its count', () => {
    // Given a replicated set of three outflows
    renderToast(entry({ bulk: 'outflows', count: 3 }));

    // Then the toast explains the whole batch
    expect(screen.getByText('3 saídas replicadas')).toBeInTheDocument();
  });

  it('disappears after its window', () => {
    // Given a toast at rest
    renderToast();

    // When six seconds pass
    act(() => {
      vi.advanceTimersByTime(UNDO_TTL_MS + 1);
    });

    // Then the undo is gone
    expect(screen.queryByText('Alterado')).not.toBeInTheDocument();
  });

  it('waits while the pointer rests on it', () => {
    // Given a toast the household is pointing at
    renderToast();
    const toast = screen.getByText('Alterado').parentElement!;
    fireEvent.mouseEnter(toast);

    // When well past the window
    act(() => {
      vi.advanceTimersByTime(UNDO_TTL_MS * 2);
    });

    // Then it is still there to be tapped
    expect(screen.getByText('Alterado')).toBeInTheDocument();

    // When the pointer leaves
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(UNDO_TTL_MS + 1);
    });

    // Then it expires from that moment
    expect(screen.queryByText('Alterado')).not.toBeInTheDocument();
  });
});
