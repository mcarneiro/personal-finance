import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import savingsReducer from '../../store/savingsSlice';
import { withPrivacyMode } from '../../test/privacy';
import type { SavingsBalance, SavingsPot } from '../../types';
import SavingsTrend from './SavingsTrend';

const JUNE = '2026-06';
const MAY = '2026-05';
// Mid-June: the current month is 2026-06.
const NOW = new Date(2026, 5, 15, 12, 0, 0);

const EMERGENCY: SavingsPot = { id: 'pot-emergency', name: 'Emergência' };
const RETIREMENT: SavingsPot = { id: 'pot-retirement', name: 'Aposentadoria' };

function balance(month: string, potId: string, amount: number): SavingsBalance {
  return { id: `${month}-${potId}`, month, potId, balance: amount };
}

/** Renders the trend block on its own, over a real savings slice. */
function renderTrend(pots: SavingsPot[] = [], balances: SavingsBalance[] = []) {
  const store = configureStore({
    reducer: { savings: savingsReducer },
    preloadedState: { savings: { items: pots, balances } },
  });

  render(
    withPrivacyMode(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<SavingsTrend now={NOW} />} />
            <Route path="/savings/:month" element={<p>Tela das poupanças</p>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    )
  );

  return store;
}

/** The 12 columns, oldest first. */
function columns(): HTMLElement[] {
  return screen.getAllByTestId('trend-column');
}

/** The accessible name of every column, oldest first. */
function columnNames(): string[] {
  return columns().map((column) => column.getAttribute('aria-label') ?? '');
}

/** The readout group, once a column has been tapped. */
function readout(): HTMLElement {
  return screen.getByTestId('readout');
}

/** The one palette class of a swatch or segment, for comparing the two. */
function paletteClass(element: HTMLElement): string | undefined {
  return element.className.split(' ').find((name) => name.startsWith('bg-'));
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR');
});

describe('SavingsTrend — presence', () => {
  it('hides when the household has no active pots', () => {
    // Given an empty pot registry
    renderTrend([], []);

    // Then the section is absent, the way the plan block hides with no plan
    expect(
      screen.queryByRole('region', { name: 'Evolução das poupanças' })
    ).not.toBeInTheDocument();
  });

  it('hides when pots exist but no balance is recorded anywhere in the window', () => {
    // Given an active pot with no recorded balances
    renderTrend([EMERGENCY], []);

    // Then nothing is fabricated for an empty household
    expect(
      screen.queryByRole('region', { name: 'Evolução das poupanças' })
    ).not.toBeInTheDocument();
  });

  it('shows once any month in the window has a record', () => {
    // Given a pot recorded in one month inside the 12-month window
    renderTrend([EMERGENCY], [balance(MAY, EMERGENCY.id, 9000)]);

    // Then the section appears
    expect(screen.getByRole('region', { name: 'Evolução das poupanças' })).toBeInTheDocument();
  });
});

describe('SavingsTrend — columns', () => {
  it('renders 12 columns, oldest first, ending with the current month', () => {
    // Given a pot with records in the window
    renderTrend([EMERGENCY], [balance(JUNE, EMERGENCY.id, 10000)]);

    // Then there are 12 columns and the last is the current month
    const names = columnNames();
    expect(names).toHaveLength(12);
    expect(names[0]).toMatch(/jul/);
    expect(names[0]).toContain('2025');
    expect(names[11]).toMatch(/jun/);
    expect(names[11]).toContain('2026');
  });

  it('scales column heights zero-based against the window maximum', () => {
    // Given 5.000 in one month and 10.000 in the current month
    renderTrend(
      [EMERGENCY],
      [balance('2026-01', EMERGENCY.id, 5000), balance(JUNE, EMERGENCY.id, 10000)]
    );

    // Then the tallest column is 100% and the smaller is a half
    const cols = columns();
    expect(cols[11].querySelector('[data-column-fill]')).toHaveStyle({ height: '100%' });
    // 2026-01 is window index 6 (12-month window ending 2026-06)
    expect(cols[6].querySelector('[data-column-fill]')).toHaveStyle({ height: '50%' });
  });

  it('gives a pot the same colour across columns and months', () => {
    // Given two pots recorded across a month boundary
    renderTrend(
      [EMERGENCY, RETIREMENT],
      [
        balance(MAY, EMERGENCY.id, 1000),
        balance(MAY, RETIREMENT.id, 2000),
        balance(JUNE, EMERGENCY.id, 1500),
        balance(JUNE, RETIREMENT.id, 2500),
      ]
    );

    // Then each pot's segment uses its registry-index palette colour everywhere
    const cols = columns();
    const may = cols[10];
    const june = cols[11];
    const maySegments = within(may).getAllByTestId('trend-segment');
    const juneSegments = within(june).getAllByTestId('trend-segment');
    expect(maySegments[0]).toHaveClass('bg-sky-500');
    expect(maySegments[1]).toHaveClass('bg-emerald-500');
    expect(juneSegments[0]).toHaveClass('bg-sky-500');
    expect(juneSegments[1]).toHaveClass('bg-emerald-500');
  });

  it('renders a carried-forward month at the same height as its source month', () => {
    // Given 10.000 recorded in May and nothing in June
    renderTrend([EMERGENCY], [balance(MAY, EMERGENCY.id, 10000)]);

    // Then May and June (carried) are both 100%
    const cols = columns();
    expect(cols[10].querySelector('[data-column-fill]')).toHaveStyle({ height: '100%' });
    expect(cols[11].querySelector('[data-column-fill]')).toHaveStyle({ height: '100%' });
  });

  it('omits a retired pot and stacks to the current Total Saved', () => {
    // Given a retired pot with a lucky row and an active pot recorded in June
    renderTrend(
      [EMERGENCY],
      [balance(JUNE, 'pot-retired', 99999), balance(JUNE, EMERGENCY.id, 10000)]
    );

    // Then the current column has one segment and its label names the Total Saved
    const june = columns()[11];
    expect(within(june).getAllByTestId('trend-segment')).toHaveLength(1);
    expect(june.getAttribute('aria-label')).toContain('10.000,00');
  });
});

describe('SavingsTrend — labels and navigation', () => {
  it('labels each column with its month and total', () => {
    // Given a pot recorded in June
    renderTrend([EMERGENCY], [balance(JUNE, EMERGENCY.id, 10000)]);

    // Then the last column's label names June and the total
    const last = columns()[11];
    expect(last.getAttribute('aria-label')).toMatch(/jun/);
    expect(last.getAttribute('aria-label')).toContain('10.000,00');
    // And the short label under the column reads "jun."
    expect(screen.getByText('jun.')).toBeInTheDocument();
  });

  it('navigates to the current month from the block header only', async () => {
    // Given a pot recorded in the window
    const user = userEvent.setup();
    renderTrend([EMERGENCY], [balance(JUNE, EMERGENCY.id, 10000)]);

    // When I tap the block header
    await user.click(screen.getByRole('button', { name: 'Evolução das poupanças' }));

    // Then the Savings screen opens at the current month
    expect(screen.getByText('Tela das poupanças')).toBeInTheDocument();
  });
});

describe('SavingsTrend — month readout', () => {
  it('exposes every column as a button with its month, total and expanded state', () => {
    // Given a pot recorded in June
    renderTrend([EMERGENCY], [balance(JUNE, EMERGENCY.id, 10000)]);

    // Then there are 12 real buttons, all collapsed, each named for its month
    const cols = columns();
    expect(cols).toHaveLength(12);
    for (const column of cols) {
      expect(column).toHaveAttribute('aria-expanded', 'false');
    }
    expect(cols[11].tagName).toBe('BUTTON');
    expect(cols[11].getAttribute('aria-label')).toMatch(/junho de 2026/);
    expect(cols[11].getAttribute('aria-label')).toContain('10.000,00');
  });

  it('renders no readout until a column is tapped', () => {
    // Given the default (untapped) chart
    renderTrend([EMERGENCY], [balance(JUNE, EMERGENCY.id, 10000)]);

    // Then nothing is selected, exactly as ticket 02 left it
    expect(screen.queryByTestId('readout')).not.toBeInTheDocument();
  });

  it('opens a readout with the month name and Total Saved when a column is tapped', async () => {
    // Given May 9.000 and June 10.000
    const user = userEvent.setup();
    renderTrend(
      [EMERGENCY],
      [balance(MAY, EMERGENCY.id, 9000), balance(JUNE, EMERGENCY.id, 10000)]
    );

    // When I tap the June column
    await user.click(columns()[11]);

    // Then the readout names June and headlines its Total Saved
    const detail = readout();
    expect(detail).toHaveAccessibleName('Detalhes de junho de 2026');
    expect(within(detail).getByRole('heading', { name: 'junho de 2026' })).toBeInTheDocument();
    expect(within(detail).getByText('Total guardado')).toBeInTheDocument();
    expect(within(detail).getByTestId('readout-total')).toHaveTextContent('R$ 10.000,00');
    expect(columns()[11]).toHaveAttribute('aria-expanded', 'true');
    expect(columns()[11]).toHaveAttribute('aria-controls', 'savings-trend-readout');
  });

  it('lists one row per active pot in registry order with matching swatch colours', async () => {
    // Given two pots recorded in June
    const user = userEvent.setup();
    renderTrend(
      [EMERGENCY, RETIREMENT],
      [balance(JUNE, EMERGENCY.id, 1000), balance(JUNE, RETIREMENT.id, 2000)]
    );

    // When I tap the June column
    await user.click(columns()[11]);

    // Then each pot lists its name and carried balance, in registry order
    const rows = within(readout()).getAllByTestId('readout-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Emergência');
    expect(rows[0]).toHaveTextContent('R$ 1.000,00');
    expect(rows[1]).toHaveTextContent('Aposentadoria');
    expect(rows[1]).toHaveTextContent('R$ 2.000,00');

    // And the swatches reuse the same palette index as the column segments
    const segments = within(columns()[11]).getAllByTestId('trend-segment');
    const swatches = within(readout()).getAllByTestId('readout-swatch');
    expect(paletteClass(swatches[0])).toBe('bg-sky-500');
    expect(paletteClass(swatches[1])).toBe('bg-emerald-500');
    expect(paletteClass(swatches[0])).toBe(paletteClass(segments[0]));
    expect(paletteClass(swatches[1])).toBe(paletteClass(segments[1]));
  });

  it('lists a zero-balance pot muted rather than omitting it', async () => {
    // Given only Emergency recorded in June, so Retirement carries 0
    const user = userEvent.setup();
    renderTrend([EMERGENCY, RETIREMENT], [balance(JUNE, EMERGENCY.id, 10000)]);

    // When I tap the June column
    await user.click(columns()[11]);

    // Then both pots list, and the zero one is muted
    const rows = within(readout()).getAllByTestId('readout-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByTestId('readout-value')).not.toHaveClass('text-gray-400');
    const retirementValue = within(rows[1]).getByTestId('readout-value');
    expect(retirementValue).toHaveTextContent('R$ 0,00');
    expect(retirementValue).toHaveClass('text-gray-400');
  });

  it('closes the readout when the same column is tapped again', async () => {
    // Given an open readout
    const user = userEvent.setup();
    renderTrend([EMERGENCY], [balance(JUNE, EMERGENCY.id, 10000)]);
    await user.click(columns()[11]);
    expect(readout()).toBeInTheDocument();

    // When I tap June again
    await user.click(columns()[11]);

    // Then the readout closes and the column is collapsed
    expect(screen.queryByTestId('readout')).not.toBeInTheDocument();
    expect(columns()[11]).toHaveAttribute('aria-expanded', 'false');
  });

  it('replaces the readout when another column is tapped', async () => {
    // Given May 9.000 and June 10.000
    const user = userEvent.setup();
    renderTrend(
      [EMERGENCY],
      [balance(MAY, EMERGENCY.id, 9000), balance(JUNE, EMERGENCY.id, 10000)]
    );

    // When I tap May, then June
    await user.click(columns()[10]);
    expect(within(readout()).getByRole('heading', { name: 'maio de 2026' })).toBeInTheDocument();
    expect(within(readout()).getByTestId('readout-total')).toHaveTextContent('R$ 9.000,00');
    await user.click(columns()[11]);

    // Then the readout swapped to June and May is collapsed again
    expect(within(readout()).getByRole('heading', { name: 'junho de 2026' })).toBeInTheDocument();
    expect(columns()[10]).toHaveAttribute('aria-expanded', 'false');
    expect(columns()[11]).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the readout from the keyboard without navigating', async () => {
    // Given a pot recorded in June
    const user = userEvent.setup();
    renderTrend([EMERGENCY], [balance(JUNE, EMERGENCY.id, 10000)]);

    // When I focus the June column and press Enter
    columns()[11].focus();
    await user.keyboard('{Enter}');

    // Then the readout opens and the Dashboard never leaves
    expect(readout()).toBeInTheDocument();
    expect(screen.queryByText('Tela das poupanças')).not.toBeInTheDocument();
  });

  it('never navigates when a column is tapped with the pointer', async () => {
    // Given a pot recorded in June, on the Dashboard
    const user = userEvent.setup();
    renderTrend([EMERGENCY], [balance(JUNE, EMERGENCY.id, 10000)]);

    // When I pointer-tap the June column
    await user.click(columns()[11]);

    // Then the readout opens in place; the Dashboard stays put
    expect(readout()).toBeInTheDocument();
    expect(screen.queryByText('Tela das poupanças')).not.toBeInTheDocument();
  });
});
