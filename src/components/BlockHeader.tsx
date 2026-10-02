const CHEVRON_ICON = 'M9 5l7 7-7 7';

interface BlockHeaderProps {
  /** The block's label, shown as the header text. */
  label: string;
  /** The block's full-screen month screen, opened by tapping the header. */
  onClick: () => void;
}

/**
 * A tappable Dashboard block header: the block's label with a chevron, opening
 * the block's full month screen. Shared by the plan, open-outflows and
 * savings-trend blocks so their headers stay identical; the cash-flow block,
 * whose two rows are its own navigation, renders a plain heading instead.
 */
export default function BlockHeader({ label, onClick }: BlockHeaderProps) {
  return (
    <h2>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-4 w-4 shrink-0 text-gray-400"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CHEVRON_ICON} />
        </svg>
      </button>
    </h2>
  );
}
