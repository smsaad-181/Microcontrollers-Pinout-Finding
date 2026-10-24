import { describe, expect, it } from 'vitest';
import { boardView, BUS_ROLES, pinDescription, type ViewPin } from '../src/catalog/boardView';
import { csvCell, resultCsv } from '../src/results/csv';
import { createEngineHost } from '../src/worker/engineHost';
import { compiledCatalog } from './realCatalog';

const BOARD = 'esp32-devkitc-v4@V4';
const VARIANT = 'esp32-devkitc-32e';

const workedExample = {
  board: BOARD,
  variant: VARIANT,
  wifi: true,
  modules: [
    { breakout: 'gy-bme280-6pin', instance: 'env' },
    { breakout: 'rfid-rc522-blue', instance: 'rfid' },
    { breakout: 'st7735s-1.8-spi-tft', instance: 'tft' },
    { breakout: 'relay-board-4ch-transistor', instance: 'relays' },
    { breakout: 'push-button', instance: 'sw1' },
  ],
  locked: [],
  reserved: [],
};

function solved() {
  const { catalog, sha256 } = compiledCatalog();
  const h = createEngineHost(() => performance.now());
  h.init(catalog, sha256);
  return h.solve(workedExample);
}

const pins = (v: ReturnType<typeof boardView>): ViewPin[] => (v ?? []).flatMap((c) => c.pins);

describe('board header view data', () => {
  const { catalog } = compiledCatalog();

  it('is null for an unknown board', () => {
    expect(
      boardView(catalog, 'nope@1', 'x', { reserved: [], connections: [], locked: [] }),
    ).toBeNull();
  });

  it('lists every connector pin in position order with power, ground and control states', () => {
    const view = boardView(catalog, BOARD, VARIANT, { reserved: [], connections: [], locked: [] });
    const board = catalog.boards.find((b) => `${b.id}@${b.revision}` === BOARD);
    expect(view?.map((c) => c.id)).toEqual(board?.connectors.map((c) => c.id));
    expect(pins(view)).toHaveLength(board?.connectors.reduce((n, c) => n + c.pins.length, 0) ?? -1);
    for (const c of view ?? []) {
      const positions = c.pins.map((p) => p.position);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
    const all = pins(view);
    expect(all.filter((p) => p.kind === 'power').every((p) => p.state === 'power')).toBe(true);
    expect(all.filter((p) => p.kind === 'ground').every((p) => p.state === 'ground')).toBe(true);
    expect(all.some((p) => p.state === 'free')).toBe(true);
    expect(all.find((p) => p.label === 'EN')).toMatchObject({ state: 'restricted' });
    expect(all.find((p) => p.label === 'CLK')).toMatchObject({
      state: 'restricted',
      detail: 'not connected',
    });
  });

  it('restricts pads used inside the module', () => {
    const patched = {
      ...catalog,
      modules: catalog.modules.map((m) =>
        m.id === 'esp32-wroom-32e'
          ? {
              ...m,
              consumed: {
                ...m.consumed,
                GPIO4: { value: 'psram' as const, status: 'verified' as const, evidence: [] },
              },
            }
          : m,
      ),
    };
    const view = boardView(patched, BOARD, VARIANT, { reserved: [], connections: [], locked: [] });
    expect(pins(view).find((p) => p.pad === 'GPIO4')).toMatchObject({
      state: 'restricted',
      detail: 'used inside the module (psram)',
    });
  });

  it('marks reserved, existing and locked pins before a result exists', () => {
    const view = boardView(catalog, BOARD, VARIANT, {
      reserved: ['GPIO4'],
      connections: [{ pad: 'GPIO2', note: 'LED' }],
      locked: [{ instance: 'pot', role: 'WIPER', pad: 'GPIO32' }],
    });
    const byPad = (pad: string) => pins(view).find((p) => p.pad === pad);
    expect(byPad('GPIO4')).toMatchObject({ state: 'restricted', detail: 'reserved by you' });
    expect(byPad('GPIO2')).toMatchObject({
      state: 'restricted',
      detail: 'existing connection: LED',
    });
    expect(byPad('GPIO32')).toMatchObject({ state: 'assigned', detail: 'pot.WIPER (locked)' });
  });

  it('shows the engine assignments, with I²C and SPI pins as bus pins', () => {
    const { outcome } = solved();
    const rec = outcome.recommendation;
    expect(rec.status).toBe('ok');
    const view = boardView(catalog, BOARD, VARIANT, {
      reserved: [],
      connections: [],
      locked: [],
      rec,
    });
    const all = pins(view);
    for (const a of rec.assignments) {
      const p = all.find((x) => x.pad === a.pad);
      expect(p?.detail).toContain(`${a.instance}.${a.role}`);
      const kind = rec.interfaces[a.instance]?.kind;
      if ((kind === 'i2c' || kind === 'spi') && BUS_ROLES.has(a.role)) expect(p?.state).toBe('bus');
    }
    expect(all.some((p) => p.state === 'assigned')).toBe(true);
    // A chip select is per module, not a shared bus line.
    expect(all.find((p) => p.detail === 'rfid.CS')?.state).toBe('assigned');
    const env = all.find((p) => p.detail.includes('env.SDA'));
    expect(env && pinDescription(env)).toMatch(/^J\d pin \d+, .*Bus, .*env\.SDA/);
  });
});

describe('CSV export', () => {
  it('escapes quotes, commas and newlines and defuses formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell(-5)).toBe('-5');
  });

  it('has one row per assignment with all three pin names and the catalog version', () => {
    const { outcome, pinLabels } = solved();
    const rec = outcome.recommendation;
    const lines = resultCsv(rec, pinLabels).trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Module,Signal,Module pin,Chip GPIO,Chip pad,Board label,Header,Header position,Wiring,Warnings on this pin',
    );
    const first = rec.assignments[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(lines[1]).toContain(`${first.instance},${first.role},`);
    expect(lines[1]).toContain(
      `,${String(first.gpio)},${first.pad},${first.label},${first.connector},${String(first.position)},`,
    );
    expect(lines.slice(1, 1 + rec.assignments.length)).toHaveLength(rec.assignments.length);
    expect(lines.at(-2)).toContain(rec.catalog_version);
  });
});
