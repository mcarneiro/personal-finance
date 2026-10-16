import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { withPrivacyMode } from '../../test/privacy';
import { cashFlowBar } from '../../utils/cashFlowBar';
import CashFlowCard from './CashFlowCard';

interface CardOptions {
  month?: string;
  income?: number;
  outflows?: number;
  net?: number;
  label?: string;
  showHeading?: boolean;
  showOverCaption?: boolean;
  children?: ReactNode;
}

/**
 * Renders the shared cash-flow card on its own — it is pure presentation, so it
 * needs no store and no Sheets boundary — with the two month screens it links to.
 */
function renderCard(options: CardOptions = {}) {
  const income = options.income ?? 12000;
  const outflows = options.outflows ?? 3000;
  const month = options.month ?? '2026-06';

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

/** The card's coloured bar fill, for asserting the over/under colour binding. */
function fill(): HTMLElement {
  const bar = screen.getByRole('progressbar', { name: 'Total das saídas' });
  return bar.firstElementChild as HTMLElement;
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
    expect(screen.getByRole('progressbar', { name: 'Total das saídas' })).toHaveAttribute(
      'aria-valuenow',
      '25'
    );
    expect(fill()).toHaveClass('bg-green-500');
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
    expect(screen.getByRole('progressbar', { name: 'Total das saídas' })).toHaveAttribute(
      'aria-valuenow',
      '100'
    );
    expect(fill()).toHaveClass('bg-red-600');
  });

  it('leaves the over-income caption out when the caller does not ask for it', () => {
    // Given an over-income month on the Outflows page
    renderCard({ outflows: 13200, label: 'Resumo do mês' });

    // Then the bar is over but the caption — which would link to the page you are on — is absent
    expect(screen.queryByText(/acima da renda/)).not.toBeInTheDocument();
    expect(fill()).toHaveClass('bg-red-600');
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
