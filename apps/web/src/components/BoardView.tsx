// SVG header view generated from catalog connector data (no vendor graphics). Each pin state has
// its own shape and a text legend; the pins form one tab stop and are walked with the arrow keys.
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  PIN_STATE_META,
  PIN_STATES,
  pinDescription,
  type PinState,
  type ViewConnector,
  type ViewPin,
} from '../catalog/boardView';

const ROW = 24;
const TOP = 44;
const WIDTH = 280;
const PIN_X = 40;

/** The marker for a state, centred on (0, 0). */
export function PinMarker({ state }: { state: PinState }) {
  switch (state) {
    case 'free':
      return <circle r={6} className="pm-free" />;
    case 'assigned':
      return <circle r={7} className="pm-assigned" />;
    case 'bus':
      return <path d="M0 -8 L8 0 L0 8 L-8 0 Z" className="pm-bus" />;
    case 'restricted':
      return (
        <g className="pm-restricted">
          <circle r={7} />
          <path d="M-4 -4 L4 4 M4 -4 L-4 4" />
        </g>
      );
    case 'power':
      return (
        <g className="pm-power">
          <rect x={-7} y={-7} width={14} height={14} />
          <path d="M-4 0 H4 M0 -4 V4" />
        </g>
      );
    case 'ground':
      return <path d="M-8 -6 H8 L0 7 Z" className="pm-ground" />;
    case 'analog':
      return (
        <g className="pm-analog">
          <circle r={7} />
          <path d="M-4 1 Q-2 -4 0 0 T4 -1" />
        </g>
      );
  }
}

/** Legend: every state as shape + text. */
export function PinLegend() {
  return (
    <ul className="pin-legend" aria-label="Pin states">
      {PIN_STATES.map((s) => (
        <li key={s}>
          <svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
            <PinMarker state={s} />
          </svg>{' '}
          <strong>{PIN_STATE_META[s].label}</strong>{' '}
          <span className="muted">— {PIN_STATE_META[s].hint}</span>
        </li>
      ))}
    </ul>
  );
}

const keyOf = (p: ViewPin) => `${p.connector}:${String(p.position)}`;

export function BoardView({ connectors, title }: { connectors: ViewConnector[]; title: string }) {
  const id = useId();
  const first = connectors[0]?.pins[0];
  const [active, setActive] = useState<string | null>(first ? keyOf(first) : null);
  const refs = useRef(new Map<string, SVGGElement>());
  const all = connectors.flatMap((c) => c.pins);
  const selected = all.find((p) => keyOf(p) === active) ?? first;

  const move = (to: ViewPin | undefined) => {
    if (!to) return;
    const k = keyOf(to);
    setActive(k);
    refs.current.get(k)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return;
    const ci = connectors.findIndex((c) => c.id === selected.connector);
    const col = connectors[ci];
    if (!col) return;
    const pi = col.pins.findIndex((p) => p.position === selected.position);
    let to: ViewPin | undefined;
    switch (e.key) {
      case 'ArrowDown':
        to = col.pins[Math.min(pi + 1, col.pins.length - 1)];
        break;
      case 'ArrowUp':
        to = col.pins[Math.max(pi - 1, 0)];
        break;
      case 'ArrowRight':
      case 'ArrowLeft': {
        const next = connectors[ci + (e.key === 'ArrowRight' ? 1 : -1)];
        if (next) to = next.pins[Math.min(pi, next.pins.length - 1)];
        break;
      }
      case 'Home':
        to = col.pins[0];
        break;
      case 'End':
        to = col.pins[col.pins.length - 1];
        break;
      default:
        return;
    }
    e.preventDefault();
    move(to);
  };

  if (connectors.length === 0) return <p>This board has no header data in the catalog.</p>;

  return (
    <div className="board-view">
      <p id={`${id}-help`} className="muted">
        {title}. Generated from the catalog connector data. Tab to the pins, then use the arrow keys
        to move between pins and headers.
      </p>
      <PinLegend />
      {/* Arrow keys move between pins; each pin is a focusable, labelled button. */}
      <div
        className="board-headers"
        onKeyDown={onKeyDown}
        role="group"
        aria-label={title}
        aria-describedby={`${id}-help`}
      >
        {connectors.map((c) => (
          <svg
            key={c.id}
            role="group"
            aria-labelledby={`${id}-${c.id}`}
            className="header-svg"
            width={WIDTH}
            height={TOP + c.pins.length * ROW + 8}
            viewBox={`0 0 ${String(WIDTH)} ${String(TOP + c.pins.length * ROW + 8)}`}
          >
            <text id={`${id}-${c.id}`} x={8} y={20} className="header-title">
              Header {c.id}
              {c.side ? ` (${c.side})` : ''}
            </text>
            <rect
              x={PIN_X - 14}
              y={TOP - 14}
              width={28}
              height={c.pins.length * ROW + 4}
              rx={4}
              className="header-body"
            />
            {c.pins.map((p, i) => {
              const k = keyOf(p);
              const y = TOP + i * ROW;
              const isActive = k === (selected ? keyOf(selected) : null);
              return (
                <g
                  key={k}
                  ref={(el) => {
                    if (el) refs.current.set(k, el);
                    else refs.current.delete(k);
                  }}
                  role="button"
                  tabIndex={isActive ? 0 : -1}
                  aria-label={pinDescription(p)}
                  aria-pressed={isActive}
                  className={`pin pin-${p.state}${isActive ? ' pin-active' : ''}`}
                  onFocus={() => {
                    setActive(k);
                  }}
                  onClick={() => {
                    move(p);
                  }}
                >
                  <rect
                    x={2}
                    y={y - ROW / 2}
                    width={WIDTH - 4}
                    height={ROW}
                    rx={3}
                    className="pin-hit"
                  />
                  <text x={20} y={y + 4} className="pin-pos" textAnchor="end">
                    {p.position}
                  </text>
                  <g transform={`translate(${String(PIN_X)} ${String(y)})`}>
                    <PinMarker state={p.state} />
                  </g>
                  <text x={PIN_X + 18} y={y + 4} className="pin-label">
                    {p.label}
                    {p.detail !== '' ? (
                      <tspan className="pin-detail" dx={6}>
                        {p.detail.length > 22 ? `${p.detail.slice(0, 21)}…` : p.detail}
                      </tspan>
                    ) : null}
                  </text>
                </g>
              );
            })}
          </svg>
        ))}
      </div>
      <p className="pin-selected" aria-live="polite">
        {selected ? `Selected: ${pinDescription(selected)}` : ''}
      </p>
    </div>
  );
}
