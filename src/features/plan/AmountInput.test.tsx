import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import AmountInput from './AmountInput';

/** A controlled host that mirrors how the plan screen holds the committed amount. */
function Harness({
  initial = 0,
  external = 500,
  autoValue,
  autoLabel,
  masked = false,
}: {
  initial?: number;
  external?: number;
  autoValue?: number;
  autoLabel?: string;
  masked?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <AmountInput
        id="amount"
        label="Valor"
        value={value}
        onCommit={setValue}
        autoValue={autoValue}
        autoLabel={autoLabel}
        masked={masked}
      />
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

  it('blanks a typed zero even with no automatic hint, so the field always reads as state does', async () => {
    // Given a plain amount field (a card check-in) with nothing recorded
    render(<Harness />);
    const user = userEvent.setup();

    // When I type an explicit zero and leave the field
    await user.type(screen.getByLabelText('Valor'), '0');
    await user.tab();

    // Then the field is empty — the same way a recorded zero renders from state
    expect(screen.getByTestId('committed')).toHaveTextContent('0');
    expect(screen.getByLabelText('Valor')).toHaveValue('');
  });

  // The automatic Remaining Estimate fallback: an empty field still reads a
  // value, shown muted so the household can see what the projection is using.
  describe('with an automatic value', () => {
    it('hints the automatic value muted while the field holds none of its own', () => {
      // Given a bucket whose field is empty but whose cap implies a value
      render(<Harness autoValue={1000} autoLabel="Valor automático" />);

      // Then the field is still empty, offering the value as a muted hint, and
      // the accessible name says the value is the automatic one
      const field = screen.getByLabelText('Valor automático');
      expect(field).toHaveValue('');
      expect(field).toHaveAttribute('placeholder', '1000');
      expect(field).toHaveClass('placeholder:italic');
    });

    it('replaces the automatic value as soon as I type my own', async () => {
      // Given an empty field hinting an automatic 1000
      render(<Harness autoValue={1000} />);
      const user = userEvent.setup();

      // When I type my own estimate
      await user.type(screen.getByLabelText('Valor'), '250');

      // Then my number is committed and the muted hint is gone
      expect(screen.getByTestId('committed')).toHaveTextContent('250');
      expect(screen.getByLabelText('Valor')).not.toHaveClass('placeholder:italic');
    });

    it('hands the field back to the automatic value when I clear it', async () => {
      // Given a field holding my own estimate
      render(<Harness initial={250} autoValue={1000} />);
      const user = userEvent.setup();

      // When I clear it and leave the field
      await user.clear(screen.getByLabelText('Valor'));
      await user.tab();

      // Then nothing is committed and the automatic hint is back
      expect(screen.getByTestId('committed')).toHaveTextContent('0');
      expect(screen.getByLabelText('Valor')).toHaveAttribute('placeholder', '1000');
    });

    it('shows no hint while the field holds an amount of its own', () => {
      // Given a bucket the household has estimated itself
      render(<Harness initial={250} autoValue={1000} />);

      // Then the field reads my number, with no muted hint competing with it
      expect(screen.getByLabelText('Valor')).toHaveValue('250');
      expect(screen.getByLabelText('Valor')).toHaveAttribute('placeholder', '0');
    });

    it('reads a typed zero as empty where the field has no value of its own', async () => {
      // Given a field hinting an automatic value and holding no amount of its own
      render(<Harness autoValue={1000} />);
      const user = userEvent.setup();

      // When I type an explicit zero
      await user.type(screen.getByLabelText('Valor'), '0');
      await user.tab();

      // Then the field is empty again and the automatic hint shows through,
      // rather than a bare 0 reading as a recorded "nothing more"
      expect(screen.getByLabelText('Valor')).toHaveValue('');
      expect(screen.getByLabelText('Valor')).toHaveAttribute('placeholder', '1000');
    });

    it('masks the automatic value too, so Privacy Mode never leaks it', () => {
      // Given Privacy Mode is on for a field hinting an automatic 1000
      render(<Harness autoValue={1000} masked />);

      // Then neither the value nor the hint shows the real amount
      const field = screen.getByLabelText(/Valor/);
      expect(field).toHaveValue('R$ ••••');
      expect(field).toHaveAttribute('placeholder', 'R$ ••••');
    });
  });
});
