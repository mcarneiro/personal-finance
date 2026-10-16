import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { withPrivacyMode } from '../../test/privacy';
import { cashFlowBar, type CashFlowSlice } from '../../utils/cashFlowBar';
import CashFlowCard from './CashFlowCard';

interface CardOptions {
  month?: string;
  income?: number;
  outflows?: number;
  net?: number;
  slices?: CashFlowSlice[];
  label?: string;
  showHeading?: boolean;
  showOverCaption?: boolean;
  children?: ReactNode;
}

/**
 * Renders the shared cash-flow card on its own — it is pure presentation, so it
 * needs no store and no Sheets boundary — with the two month screens it links to.
 * With no explicit `slices` it draws one confirmed Payment covering the whole
 * outflows, which is the common single-kind month.
 */
function renderCard(options: CardOptions = {}) {
  const income = options.income ?? 12000;
  const outflows = options.outflows ?? 3000;
  const month = options.month ?? '2026-06';
  const slices =
    options.slices ??
    (outflows !== 0
      ? [{ kind: 'payment' as const, confirmed: true, amount: outflows, share: 1 }]
      : []);

  render(
    withPrivacyMode(
      <MemoryRouter initialEntries={[`/outflows/${month}`]}>
        <Routes>
          <Route
            path="/outflows/:month"
            element={
              <CashFlowCard
                month={month}
                income={income}
                outflows={outflows}
                net={options.net ?? income - outflows}
                bar={cashFlowBar(income, outflows)}
                slices={slices}
                label={options.label ?? 'Renda e saídas'}
                showHeading={options.showHeading}
                showOverCaption={options.showOverCaption}
              >
                {options.children}
              </CashFlowCard>
            }
          />
          <Route path="/income/:month" element={<p>Tela da renda</p>} />
        </Routes>
      </MemoryRouter>
    )
  );
}

/** The bar itself, addressed by whichever label it carries. */
function bar(): HTMLElement {
  return screen.getByRole('progressbar', { name: /Total das saídas/ });
}

/** The fill container inside the bar, for asserting the fill's width. */
function fill(): HTMLElement {
  return bar().firstElementChild as HTMLElement;
}

/** The coloured slice elements inside the fill, left to right. */
function sliceEls(): HTMLElement[] {
  return Array.from(fill().children) as HTMLElement[];
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('pt-BR');
});

describe('CashFlowCard', () => {
  it('shows the income and outflows totals, the bar and the account net', () => {
    // Given 12.000 of income and 3.000 of outflows
    renderCard({ label: 'Resumo do mês' });

    // When the card renders
    // Then each number is present, with a bar a quarter full and green
    expect(screen.getByText('Total da renda')).toBeInTheDocument();
    expect(screen.getByText('Total das saídas')).toBeInTheDocument();
    expect(screen.getByText('Saldo da conta')).toBeInTheDocument();
    expect(screen.getByText(/12\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/3\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/9\.000,00/)).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuenow', '25');
    expect(sliceEls()[0]).toHaveClass('bg-green-500');
  });

  it('names the region with its label and draws a heading only when asked', () => {
    // Given the card with a visible heading
    renderCard({ label: 'Renda e saídas', showHeading: true });

    // Then the region is named and the heading shows
    expect(screen.getByRole('region', { name: 'Renda e saídas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Renda e saídas' })).toBeInTheDocument();
  });

  it('omits the heading when the caller passes none', () => {
    // Given the same card on the Outflows page, which supplies no heading
    renderCard({ label: 'Resumo do mês' });

    // Then the region is still named but nothing is drawn as a heading
    expect(screen.getByRole('region', { name: 'Resumo do mês' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Resumo do mês' })).queryAllByRole('heading')
    ).toHaveLength(0);
  });

  it('shows the over-income caption only when asked, and only when over income', () => {
    // Given a month whose outflows pass its income
    renderCard({ outflows: 13200, showOverCaption: true });

    // Then the caption names the overage under a full, red bar
    expect(screen.getByText(/1\.200,00 acima da renda/)).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuenow', '100');
    expect(sliceEls()[0]).toHaveClass('bg-red-600');
  });

  it('leaves the over-income caption out when the caller does not ask for it', () => {
    // Given an over-income month on the Outflows page
    renderCard({ outflows: 13200, label: 'Resumo do mês' });

    // Then the bar is over but the caption — which would link to the page you are on — is absent
    expect(screen.queryByText(/acima da renda/)).not.toBeInTheDocument();
    expect(sliceEls()[0]).toHaveClass('bg-red-600');
  });

  it('sits its children below the numbers', () => {
    // Given the card carrying the Outflows page's replicate affordance
    renderCard({
      label: 'Resumo do mês',
      children: <button type="button">Replicar saídas do mês anterior</button>,
    });

    // Then the child follows the Account Net row in document order
    const net = screen.getByText('Saldo da conta');
    const child = screen.getByRole('button', { name: 'Replicar saídas do mês anterior' });
    expect(net.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws the composition slices left to right, each at its share of the total', () => {
    // Given a month of 1.000: 500 confirmed Payment, 250 unconfirmed Payment
    // and 250 confirmed Investment
    renderCard({
      income: 2000,
      outflows: 1000,
      slices: [
        { kind: 'payment', confirmed: true, amount: 500, share: 0.5 },
        { kind: 'payment', confirmed: false, amount: 250, share: 0.25 },
        { kind: 'investment', confirmed: true, amount: 250, share: 0.25 },
      ],
    });

    // Then three slices render in order, each a Payment green (lighter when
    // unconfirmed) then an Investment blue, sized by its share
    const els = sliceEls();
    expect(els).toHaveLength(3);
    expect(els[0]).toHaveClass('bg-green-500');
    expect(els[1]).toHaveClass('bg-green-300');
    expect(els[2]).toHaveClass('bg-blue-600');
    expect(els[0]).toHaveStyle({ width: '50%' });
    expect(els[1]).toHaveStyle({ width: '25%' });
    expect(els[2]).toHaveStyle({ width: '25%' });
  });

  it('keeps the fill at Outflows / Income while the slices fill that fill', () => {
    // Given 1.000 of outflows against 4.000 of income
    renderCard({
      income: 4000,
      outflows: 1000,
      slices: [
        { kind: 'payment', confirmed: true, amount: 500, share: 0.5 },
        { kind: 'investment', confirmed: true, amount: 500, share: 0.5 },
      ],
    });

    // Then the fill is a quarter wide and the two slices split it
    expect(fill()).toHaveStyle({ width: '25%' });
    expect(sliceEls()).toHaveLength(2);
    expect(sliceEls()[0]).toHaveStyle({ width: '50%' });
    expect(sliceEls()[1]).toHaveStyle({ width: '50%' });
  });

  it('draws an all-Payment month in the bar green, lighter when unconfirmed', () => {
    // Given only Payments, one confirmed and one not
    renderCard({
      outflows: 1000,
      slices: [
        { kind: 'payment', confirmed: true, amount: 750, share: 0.75 },
        { kind: 'payment', confirmed: false, amount: 250, share: 0.25 },
      ],
    });

    // Then both slices are Payment green, the unconfirmed one a lighter tint
    expect(sliceEls()[0]).toHaveClass('bg-green-500');
    expect(sliceEls()[1]).toHaveClass('bg-green-300');
  });

  it('draws an all-Investment month blue, lighter when unconfirmed', () => {
    // Given only Investments, one confirmed and one not
    renderCard({
      outflows: 1000,
      slices: [
        { kind: 'investment', confirmed: true, amount: 600, share: 0.6 },
        { kind: 'investment', confirmed: false, amount: 400, share: 0.4 },
      ],
    });

    // Then both slices are Investment blue, the unconfirmed one a lighter tint
    expect(sliceEls()[0]).toHaveClass('bg-blue-600');
    expect(sliceEls()[1]).toHaveClass('bg-blue-300');
  });

  it('draws an unconfirmed-only month in the lighter tint alone', () => {
    // Given one unconfirmed Payment and nothing else
    renderCard({
      outflows: 1000,
      slices: [{ kind: 'payment', confirmed: false, amount: 1000, share: 1 }],
    });

    // Then the single slice is the lighter green
    expect(sliceEls()).toHaveLength(1);
    expect(sliceEls()[0]).toHaveClass('bg-green-300');
  });

  it('turns the Payment slices red when the month is over income', () => {
    // Given outflows past the income, mixing a Payment and an Investment
    renderCard({
      income: 1000,
      outflows: 1200,
      showOverCaption: true,
      slices: [
        { kind: 'payment', confirmed: true, amount: 600, share: 0.5 },
        { kind: 'investment', confirmed: true, amount: 600, share: 0.5 },
      ],
    });

    // Then the Payment is red and the Investment keeps its blue
    expect(bar()).toHaveAttribute('aria-valuenow', '100');
    expect(sliceEls()[0]).toHaveClass('bg-red-600');
    expect(sliceEls()[1]).toHaveClass('bg-blue-600');
  });

  it('describes the composition in the bar label', () => {
    // Given a month split evenly between a confirmed Payment and an
    // unconfirmed Investment
    renderCard({
      outflows: 1000,
      slices: [
        { kind: 'payment', confirmed: true, amount: 500, share: 0.5 },
        { kind: 'investment', confirmed: false, amount: 500, share: 0.5 },
      ],
    });

    // Then the bar's accessible name spells out the kind and state of each slice
    expect(
      screen.getByRole('progressbar', {
        name: 'Total das saídas: pagamentos confirmados 50%, investimentos não confirmados 50%',
      })
    ).toBeInTheDocument();
    // And no legend is drawn on screen
    expect(screen.queryByText(/pagamentos confirmados/)).not.toBeInTheDocument();
  });

  it('falls back to the plain total label when there is no composition', () => {
    // Given a month with income but no outflows
    renderCard({ income: 12000, outflows: 0, slices: [] });

    // Then the bar is empty and keeps the plain label
    expect(screen.getByRole('progressbar', { name: 'Total das saídas' })).toBeInTheDocument();
    expect(sliceEls()).toHaveLength(0);
  });

  it('opens the month income screen from the income row', async () => {
    // Given the card showing a month's income
    const user = userEvent.setup();
    renderCard({ label: 'Resumo do mês' });

    // When I tap the income row
    await user.click(screen.getByRole('button', { name: 'Ver renda do mês' }));

    // Then the Income screen for that month opens
    expect(screen.getByText('Tela da renda')).toBeInTheDocument();
  });
});
