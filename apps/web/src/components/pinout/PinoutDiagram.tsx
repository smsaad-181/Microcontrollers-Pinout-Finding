// SVG pinout diagram: a board body with the header pins on both edges, each pin joined by a short
// leader line to labelled pills (label, assigned signal, functions from the catalog). Drawn from
// catalog data only. Pins are one tab stop; arrow keys walk the pins like the plain header view.
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { pinDescription } from '../../catalog/boardView';
import { PinMarker } from '../BoardView';
import {
  columnOf,
  matchesFilter,
  pinPills,
  textWidth,
  type Pill,
  type PillKind,
  type PinGroup,
  type PinoutConnector,
  type PinoutPin,
} from './model';
import '../../pinout.css';

const ROW = 30;
const PILL_H = 22;
const GAP = 6;
const LEADER = 16;
const BOARD_W = 150;
const TITLE_H = 22;
const TOP = 16;
const FONT = 13;

/** Small shape drawn at the start of a pill, so a pill's kind is never colour alone. */
function PillIcon({ kind }: { kind: PillKind }) {
  switch (kind) {
    case 'label':
      return <circle r={4} className="pi-stroke" />;
    case 'i2c':
      return <path d="M-5 -2.5 H5 M-5 2.5 H5" className="pi-stroke" />;
    case 'spi':
      return <path d="M-5 -4 L0 0 L-5 4 M0 -4 L5 0 L0 4" className="pi-stroke" />;
    case 'uart':
      return <path d="M-5 0 H5 M-2 -3 L-5 0 L-2 3 M2 -3 L5 0 L2 3" className="pi-stroke" />;
    case 'analog':
      return <path d="M-5 1 Q-3 -5 0 0 T5 -1" className="pi-stroke" />;
    case 'power':
      return <path d="M-4 0 H4 M0 -4 V4" className="pi-stroke" />;
    case 'ground':
      return <path d="M-5 -3 H5 L0 4 Z" className="pi-fill" />;
    case 'strap':
      return <path d="M-3 5 V-5 M-3 -5 H4 L1 -2 L4 1 H-3" className="pi-stroke" />;
    case 'restricted':
      return <path d="M-4 -4 L4 4 M4 -4 L-4 4" className="pi-stroke" />;
    case 'assigned':
      return <path d="M-5 0 L-1 4 L5 -4" className="pi-stroke" />;
    case 'other':
      return <rect x={-3} y={-3} width={6} height={6} className="pi-fill" />;
    case 'more':
      return null;
  }
}

const iconSpace = (k: PillKind) => (k === 'more' ? 0 : 18);
const pillWidth = (p: Pill) => 12 + iconSpace(p.kind) + textWidth(p.text, FONT);

interface Placed {
  pin: PinoutPin;
  y: number;
  side: 'left' | 'right';
  pills: { pill: Pill; x: number; w: number }[];
  /** Horizontal extent of the row (hit area) in absolute coordinates, set after the board x is known. */
  reach: number;
}

interface Layout {
  width: number;
  height: number;
  boardX: number;
  boardH: number;
  rows: Placed[];
  titles: { id: string; side: 'left' | 'right'; y: number; text: string }[];
}

export function layoutPinout(connectors: readonly PinoutConnector[]): Layout {
  const stacks = { left: [] as PinoutConnector[], right: [] as PinoutConnector[] };
  connectors.forEach((c, i) => stacks[columnOf(c, i)].push(c));
  const rows: Placed[] = [];
  const titles: Layout['titles'] = [];
  let heights = { left: TOP, right: TOP };
  for (const side of ['left', 'right'] as const) {
    let y = TOP;
    for (const c of stacks[side]) {
      titles.push({
        id: c.id,
        side,
        y: y + 14,
        text: c.side && c.side !== c.id ? `${c.id} ${c.side}` : c.id,
      });
      y += TITLE_H;
      for (const pin of c.pins) {
        rows.push({ pin, y: y + ROW / 2, side, pills: [], reach: 0 });
        y += ROW;
      }
      y += 8;
    }
    heights = { ...heights, [side]: y };
  }
  const boardH = Math.max(heights.left, heights.right, 220);
  // Widest pill chain per side decides how far the board sits from the edges.
  const span = { left: 0, right: 0 };
  for (const r of rows) {
    let x = LEADER;
    r.pills = pinPills(r.pin).map((pill) => {
      const w = pillWidth(pill);
      const at = x;
      x += w + GAP;
      return { pill, x: at, w };
    });
    r.reach = x;
    span[r.side] = Math.max(span[r.side], x);
  }
  const boardX = span.left + 12;
  const width = boardX + BOARD_W + span.right + 16;
  return { width, height: boardH + TOP, boardX, boardH, rows, titles };
}

export interface PinoutDiagramProps {
  connectors: PinoutConnector[];
  title: string;
  /** Short label for the chip block drawn on the board (chip family or module). */
  chipLabel?: string | undefined;
  active: string | null;
  onActive: (key: string) => void;
  filter: ReadonlySet<PinGroup>;
}

export function PinoutDiagram({
  connectors,
  title,
  chipLabel,
  active,
  onActive,
  filter,
}: PinoutDiagramProps) {
  const refs = useRef(new Map<string, SVGGElement>());
  const scroller = useRef<HTMLDivElement>(null);
  // On a phone the diagram is wider than the screen: start with the board in view.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
  }, [connectors]);
  const lay = layoutPinout(connectors);
  const first = connectors[0]?.pins[0];
  const activeKey = active ?? first?.key ?? null;

  const move = (to: PinoutPin | undefined) => {
    if (!to) return;
    onActive(to.key);
    refs.current.get(to.key)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const selected = connectors.flatMap((c) => c.pins).find((p) => p.key === activeKey);
    if (!selected) return;
    const ci = connectors.findIndex((c) => c.id === selected.connector);
    const col = connectors[ci];
    if (!col) return;
    const pi = col.pins.findIndex((p) => p.position === selected.position);
    let to: PinoutPin | undefined;
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

  const { boardX, boardH } = lay;
  const filtering = filter.size > 0;
  const edge = (side: 'left' | 'right') => (side === 'left' ? boardX : boardX + BOARD_W);
  const chipX = boardX + BOARD_W / 2;

  return (
    <div className="pinout-scroll" ref={scroller}>
      {/* Arrow keys move between pins; each pin is a focusable, labelled button. */}
      <div
        className="board-headers pinout-keys"
        onKeyDown={onKeyDown}
        role="group"
        aria-label={title}
      >
        <svg
          className="pinout-svg"
          viewBox={`0 0 ${String(lay.width)} ${String(lay.height)}`}
          style={{
            width: '100%',
            minWidth: `${String(Math.round(lay.width * 0.7))}px`,
            maxWidth: `${String(lay.width)}px`,
          }}
          role="group"
          aria-label={`${title} (diagram)`}
        >
          <rect
            x={boardX}
            y={TOP / 2}
            width={BOARD_W}
            height={boardH}
            rx={18}
            className="pinout-board"
          />
          <rect x={chipX - 38} y={TOP + 40} width={76} height={76} rx={6} className="pinout-chip" />
          {chipLabel ? (
            <text x={chipX} y={TOP + 82} textAnchor="middle" className="pinout-chip-text">
              {chipLabel.length > 11 ? `${chipLabel.slice(0, 10)}…` : chipLabel}
            </text>
          ) : null}
          {lay.titles.map((t) => (
            <text
              key={`${t.side}-${t.id}`}
              x={t.side === 'left' ? boardX + 12 : boardX + BOARD_W - 12}
              y={t.y}
              textAnchor={t.side === 'left' ? 'start' : 'end'}
              className="pinout-conn-title"
              aria-hidden="true"
            >
              {t.text}
            </text>
          ))}
          {lay.rows.map((r) => {
            const p = r.pin;
            const isActive = p.key === activeKey;
            const dim = filtering && !matchesFilter(p, filter);
            const dir = r.side === 'left' ? -1 : 1;
            const px = edge(r.side);
            const x0 = r.side === 'left' ? px - r.reach : px - 12;
            return (
              <g
                key={p.key}
                ref={(el) => {
                  if (el) refs.current.set(p.key, el);
                  else refs.current.delete(p.key);
                }}
                role="button"
                tabIndex={isActive ? 0 : -1}
                aria-label={`${r.pills.map((q) => q.pill.text).join(' ')}. ${pinDescription(p)}`}
                aria-pressed={isActive}
                className={`pin pin-${p.state}${isActive ? ' pin-active' : ''}${dim ? ' pin-dim' : ''}${p.assigned.length > 0 ? ' pin-used' : ''}`}
                onFocus={() => {
                  onActive(p.key);
                }}
                onClick={() => {
                  move(p);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    move(p);
                  }
                }}
              >
                <rect
                  x={x0}
                  y={r.y - ROW / 2 + 1}
                  width={r.reach + 12}
                  height={ROW - 2}
                  rx={6}
                  className="pin-hit"
                />
                <line x1={px} x2={px + dir * LEADER} y1={r.y} y2={r.y} className="pinout-leader" />
                <g transform={`translate(${String(px)} ${String(r.y)})`}>
                  <PinMarker state={p.state} />
                </g>
                <g aria-hidden="true" className="pin-text">
                  {r.pills.map(({ pill, x, w }, i) => {
                    const left = r.side === 'left' ? px - x - w : px + x;
                    return (
                      <g
                        key={`${pill.kind}-${pill.text}-${String(i)}`}
                        transform={`translate(${String(left)} ${String(r.y - PILL_H / 2)})`}
                        className={`pp pp-${pill.kind}`}
                      >
                        <rect
                          width={w}
                          height={PILL_H}
                          rx={pill.kind === 'ground' ? 3 : 11}
                          className="pp-bg"
                        />
                        {pill.kind === 'more' ? null : (
                          <g transform={`translate(11 ${String(PILL_H / 2)})`}>
                            <PillIcon kind={pill.kind} />
                          </g>
                        )}
                        <text
                          x={pill.kind === 'more' ? w / 2 : 11 + iconSpace(pill.kind) - 2}
                          y={PILL_H / 2 + 4.5}
                          textAnchor={pill.kind === 'more' ? 'middle' : 'start'}
                          className="pp-text"
                        >
                          {`${pill.text} `}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
