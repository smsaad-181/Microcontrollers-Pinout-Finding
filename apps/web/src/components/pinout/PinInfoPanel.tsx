// "Pin information" panel: everything the catalog says about the selected pin.
import type { CitationLookup } from '../../catalog/evidence';
import { PIN_STATE_META, pinDescription } from '../../catalog/boardView';
import { Citations } from '../common';
import { pinTitle, type PinoutPin } from './model';
import '../../pinout.css';

const KIND_TEXT: Record<PinoutPin['kind'], string> = {
  power: 'Power',
  ground: 'Ground',
  gpio: 'GPIO',
  reset: 'Reset',
  nc: 'Not connected',
  'analog-ref': 'Analog reference',
  enable: 'Enable',
  boot: 'Boot',
  analog: 'Analog',
};

export function PinInfoPanel({ pin, cite }: { pin: PinoutPin | undefined; cite: CitationLookup }) {
  if (!pin) return <section className="pg-info" aria-label="Pin information" />;
  const rows: [string, string][] = [
    ['Board label', pin.label],
    ['GPIO', pin.gpio === null ? 'none' : `GPIO${String(pin.gpio)}`],
    ['Header position', `${pin.connector} pin ${String(pin.position)}`],
    ['Kind', KIND_TEXT[pin.kind]],
    ['State', PIN_STATE_META[pin.state].label],
    ['Assigned signal', pin.assigned.length > 0 ? pin.assigned.join(', ') : 'none'],
  ];
  if (pin.pad !== null && pin.gpio === null) rows.splice(2, 0, ['Chip pad', pin.pad]);
  for (const f of pin.facts) rows.push([f.name, f.value]);
  return (
    <section className="pg-info" aria-label="Pin information">
      <h3 className="pg-info-title">
        Pin information: <span>{pinTitle(pin)}</span>
      </h3>
      <p className="pin-selected" aria-live="polite">
        {`Selected: ${pinDescription(pin)}`}
      </p>
      <dl className="pg-info-list">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <h4>Functions available</h4>
      {pin.functions.length > 0 ? (
        <ul className="pg-fn-list">
          {pin.functions.map((f) => (
            <li key={f.fn} className={`pg-fn pg-fn-${f.kind}`}>
              {f.text}
              <span className="muted"> ({f.routing})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {pin.hasPad
            ? 'The catalog lists no functions for this pad.'
            : 'No chip pad data in the catalog for this pin.'}
        </p>
      )}
      {pin.warnings.length > 0 ? (
        <>
          <h4>Warnings</h4>
          <ul className="pg-warn">
            {pin.warnings.map((w) => (
              <li key={w}>
                <span aria-hidden="true">! </span>
                {w}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Citations ids={pin.evidence} cite={cite} summary="Evidence for this pad" />
    </section>
  );
}
