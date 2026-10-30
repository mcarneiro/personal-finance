import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearUndoEntry, undoRequested, UNDO_TTL_MS } from '../store/undoSlice';

/**
 * The single undo slot's only surface (ADR-0014). It sits above the bottom nav
 * on every route, survives navigation, and disappears after its window — or
 * when a newer change replaces it. Hovering or focusing it pauses the clock so
 * a keyboard or slow tap can still reach the action.
 */
export default function UndoToast() {
  const entry = useAppSelector((state) => state.undo?.entry ?? null);
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const remaining = useRef(UNDO_TTL_MS);

  // A new entry starts a fresh window from the moment the change landed, so a
  // route change during the 6 seconds does not restart or shorten it.
  useEffect(() => {
    setDeadline(entry ? entry.createdAt + UNDO_TTL_MS : null);
    setPaused(false);
  }, [entry]);

  useEffect(() => {
    if (!entry || deadline === null || paused) return;
    const timer = window.setTimeout(
      () => dispatch(clearUndoEntry()),
      Math.max(0, deadline - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [entry, deadline, paused, dispatch]);

  if (!entry) return null;

  const label = entry.bulk ? `undo.bulk_${entry.bulk}` : 'undo.single';

  const pause = () => {
    if (paused || deadline === null) return;
    remaining.current = Math.max(0, deadline - Date.now());
    setPaused(true);
  };

  const resume = () => {
    if (!paused) return;
    setDeadline(Date.now() + remaining.current);
    setPaused(false);
  };

  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 flex h-12 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-full bg-gray-900 pl-4 pr-1 text-sm text-white shadow-lg"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <span role="status" aria-live="polite" className="truncate">
        {t(label, { count: entry.count })}
      </span>
      <span aria-hidden="true" className="text-gray-500">
        ·
      </span>
      <button
        type="button"
        onClick={() => dispatch(undoRequested())}
        className="flex h-11 shrink-0 items-center rounded-full px-3 font-semibold text-amber-300 transition-colors hover:bg-white/10 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {t('undo.action')}
      </button>
    </div>
  );
}
