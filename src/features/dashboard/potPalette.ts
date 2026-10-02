/**
 * The colour contract for the stacked savings trend and every later per-pot
 * view (the ticket-03 month readout reuses it): a fixed 8-colour palette
 * assigned by a pot's index in the active registry and cycling past eight, so a
 * pot keeps its colour across columns and months while the registry order holds.
 * The index is the registry index returned by `potTrendSeries`.
 */
export const POT_PALETTE = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-indigo-500',
];

/**
 * The palette class for the pot at registry index `index`, cycling past eight.
 * The single place the palette's modulo indexing lives, so a pot's stacked
 * segment and the readout swatch can never drift apart.
 */
export function potPaletteClass(index: number): string {
  return POT_PALETTE[index % POT_PALETTE.length];
}
