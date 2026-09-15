import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type HelpTipProps = {
  /** Plain-English tip body (preferred prop name). */
  text?: string;
  /** Alias used by callers: tip body when `text` omitted. */
  label?: string;
  /** Accessible name for the (?) control. */
  ariaLabel?: string;
  className?: string;
};

/** Normalize dual API shapes used across the app. Exported for unit tests. */
export function normalizeHelpTipProps(props: {
  text?: string;
  label?: string;
  ariaLabel?: string;
}): { body: string; aria: string } {
  const { text, label, ariaLabel } = props;
  const body = text ?? label ?? '';
  const aria = ariaLabel ?? (text ? (label ?? 'More info') : 'More info');
  return { body, aria };
}

/** Viewport-clamp fixed tip coords. Exported for unit tests. */
export function clampHelpTipCoords(opts: {
  anchor: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  width: number;
  height: number;
  pad?: number;
  vw?: number;
  vh?: number;
}): { top: number; left: number; placement: 'top' | 'bottom' } {
  const pad = opts.pad ?? 8;
  const vw = opts.vw ?? 1280;
  const vh = opts.vh ?? 800;
  const { anchor, width, height } = opts;
  let left = anchor.left + anchor.width / 2 - width / 2;
  left = Math.max(pad, Math.min(left, Math.max(pad, vw - width - pad)));
  const spaceAbove = anchor.top - pad;
  const spaceBelow = vh - anchor.bottom - pad;
  const placement: 'top' | 'bottom' =
    spaceAbove >= height || spaceAbove >= spaceBelow ? 'top' : 'bottom';
  let top = placement === 'top' ? anchor.top - height - pad : anchor.bottom + pad;
  top = Math.max(pad, Math.min(top, Math.max(pad, vh - height - pad)));
  return { top, left, placement };
}

/**
 * Reusable (?) tooltip — plain English, keyboard-focusable, non-blocking.
 * Click sticky-open; blur closes only if not sticky; Escape clears + refocuses ?.
 * Bubble portals to document.body and clamps inside the viewport (390 + 1280).
 */
export function HelpTip({ text, label, ariaLabel, className = '' }: HelpTipProps) {
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: 'top' | 'bottom';
  } | null>(null);
  const { body, aria } = normalizeHelpTipProps({ text, label, ariaLabel });

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const place = () => {
      const btn = btnRef.current;
      const bubble = bubbleRef.current;
      if (!btn || !bubble) return;
      const anchor = btn.getBoundingClientRect();
      const width = Math.min(
        bubble.offsetWidth || 280,
        Math.max(160, window.innerWidth - 16),
      );
      const height = bubble.offsetHeight || 72;
      setCoords(
        clampHelpTipCoords({
          anchor,
          width,
          height,
          pad: 8,
          vw: window.innerWidth,
          vh: window.innerHeight,
        }),
      );
    };
    place();
    // Second pass after paint so max-width / wrap settle.
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, body]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Sticky: one Esc closes tip first (stop). Hover-only: let transport
        // capture Esc also clear loop (#48) — do not swallow.
        if (sticky) e.stopPropagation();
        e.preventDefault();
        setSticky(false);
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const el = wrapRef.current;
      const bubble = bubbleRef.current;
      const t = e.target as Node;
      if (el?.contains(t) || bubble?.contains(t)) return;
      setSticky(false);
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, sticky]);

  if (!body.trim()) return null;

  const bubbleStyle: CSSProperties | undefined = coords
    ? { top: coords.top, left: coords.left }
    : { top: -9999, left: -9999, visibility: 'hidden' };

  const bubble = open
    ? createPortal(
        <span
          ref={bubbleRef}
          id={tipId}
          role="tooltip"
          className={`help-tip-bubble help-tip-bubble--portal help-tip-bubble--${coords?.placement ?? 'top'}`}
          style={bubbleStyle}
        >
          {body}
        </span>,
        document.body,
      )
    : null;

  return (
    <span
      ref={wrapRef}
      className={`help-tip-wrap ${className}`.trim()}
      data-open={open ? 'true' : 'false'}
      data-sticky={sticky ? 'true' : 'false'}
    >
      <button
        ref={btnRef}
        type="button"
        className="help-tip-btn"
        aria-label={aria}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!sticky) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!sticky) setOpen(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSticky((s) => {
            const next = !s;
            setOpen(next || true);
            if (!next) setOpen(false);
            else setOpen(true);
            return next;
          });
        }}
      >
        ?
      </button>
      {bubble}
    </span>
  );
}

export type LabelWithTipProps = {
  tip: string;
  tipLabel?: string;
  children: ReactNode;
};

/** Label text + inline (?) tip for form rows. */
export function LabelWithTip({ tip, tipLabel = 'More info', children }: LabelWithTipProps) {
  return (
    <span className="label-with-tip">
      <span className="label-with-tip-text">{children}</span>
      <HelpTip text={tip} ariaLabel={tipLabel} />
    </span>
  );
}
