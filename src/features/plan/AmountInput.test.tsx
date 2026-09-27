import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import AmountInput from './AmountInput';

/** A controlled host that mirrors how the plan screen holds the committed amount. */
function Harness({ initial = 0, external = 500 }: { initial?: number; external?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <AmountInput id="amount" label="Valor" value={value} onCommit={setValue} />
      <span data-testid="committed">{value}</span>
      <button type="button" onClick={() => setValue(external)}>
        Externo
      </button>
    </>
  );
}

describe('AmountInput', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
  });

  it('commits a pt-BR comma decimal as the user types', async () => {
    // Given an empty amount field
    render(<Harness />);
    const user = userEvent.setup();

    // When I type a comma decimal
    await user.type(screen.getByLabelText('Valor'), '2,5');

    // Then the committed amount is the decimal, not a misread number
    expect(screen.getByTestId('committed')).toHaveTextContent('2.5');
  });

  it('treats a blank field left on blur as zero', async () => {
    // Given a field showing an existing amount of 250
    render(<Harness initial={250} />);
    const user = userEvent.setup();

    // When I clear it and leave the field
    await user.clear(screen.getByLabelText('Valor'));
    await user.tab();

    // Then the committed amount is zero, not the old 250
    expect(screen.getByTestId('committed')).toHaveTextContent('0');
  });

  it('drops unparseable text on blur, falling back to the committed amount', async () => {
    // Given a field showing an existing amount of 250
    render(<Harness initial={250} />);
    const user = userEvent.setup();

    // When I type nonsense and leave the field
    await user.type(screen.getByLabelText('Valor'), 'abc');
    await user.tab();

    // Then the nonsense never commits and the field shows the real amount again
    expect(screen.getByTestId('committed')).toHaveTextContent('250');
    expect(screen.getByLabelText('Valor')).toHaveValue('250');
  });

  it('adopts an outside change such as a month switch, in the active locale', async () => {
    // Given a field showing zero
    render(<Harness external={2.5} />);
    const user = userEvent.setup();
    expect(screen.getByLabelText('Valor')).toHaveValue('');

    // When the amount changes from outside the field
    await user.click(screen.getByRole('button', { name: 'Externo' }));

    // Then it shows the new amount with the pt-BR comma, and no thousands grouping
    expect(screen.getByLabelText('Valor')).toHaveValue('2,5');
  });
});
