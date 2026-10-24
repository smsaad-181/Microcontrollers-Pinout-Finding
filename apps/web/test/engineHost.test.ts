import { describe, expect, it } from 'vitest';
import { createEngineHost } from '../src/worker/engineHost';
import { compiledCatalog } from './realCatalog';

// Project of golden fixture devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches (catalog/fixtures).
const workedExample = {
  board: 'esp32-devkitc-v4@V4',
  variant: 'esp32-devkitc-32e',
  wifi: true,
  modules: [
    { breakout: 'gy-bme280-6pin', instance: 'env' },
    { breakout: 'rfid-rc522-blue', instance: 'rfid' },
    { breakout: 'st7735s-1.8-spi-tft', instance: 'tft' },
    { breakout: 'relay-board-4ch-transistor', instance: 'relays' },
    { breakout: 'push-button', instance: 'sw1' },
    { breakout: 'push-button', instance: 'sw2' },
    { breakout: 'push-button', instance: 'sw3' },
    { breakout: 'push-button', instance: 'sw4' },
  ],
  locked: [],
  reserved: [],
};

function host() {
  const { catalog, sha256 } = compiledCatalog();
  const h = createEngineHost(() => performance.now());
  h.init(catalog, sha256);
  return { h, sha256, version: catalog.version };
}

describe('engine host (worker side)', () => {
  it('throws before init', () => {
    expect(() => createEngineHost(() => 0).solve(workedExample)).toThrow(/catalog not loaded/);
  });

  it('solves the worked example with the fixture bus pins and records the catalog hash', () => {
    const { h, sha256, version } = host();
    const { outcome, pinLabels, elapsedMs } = h.solve(workedExample);
    const rec = outcome.recommendation;
    expect(rec.status).toBe('ok');
    expect(rec.catalog_sha256).toBe(sha256);
    expect(rec.catalog_version).toBe(version);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
    const pad = (inst: string, role: string) =>
      rec.assignments.find((a) => a.instance === inst && a.role === role)?.pad;
    // fixture: bus.SCK GPIO18, bus.MOSI GPIO23, bus.MISO GPIO19 (shared by rfid and tft)
    expect(pad('tft', 'SCK') ?? pad('tft', 'SCLK')).toBe('GPIO18');
    // breakout pin labels come from catalog wiring, with the engine's indexed role names
    expect(pinLabels['relays.COIL[1]']).toBe('Pin 1');
    expect(pinLabels['relays.COIL[4]']).toBe('Pin 4');
    expect(pinLabels['sw1.SW']).toBe('Terminal A');
  });

  it('lists lockable roles over every exposed interface', () => {
    const { h } = host();
    expect(h.lockRoles('relay-board-4ch-transistor')).toEqual([
      'COIL[1]',
      'COIL[2]',
      'COIL[3]',
      'COIL[4]',
    ]);
    expect(h.lockRoles('gy-bme280-6pin')).toEqual(expect.arrayContaining(['SDA', 'SCL', 'CS']));
    expect(h.lockRoles('no-such-breakout')).toEqual([]);
  });

  it('returns ranked relaxations for an unsatisfiable lock', () => {
    const { h } = host();
    const rec = h.solve({
      board: 'esp32-devkitc-v4@V4',
      variant: 'esp32-devkitc-32e',
      wifi: true,
      modules: [{ breakout: 'potentiometer-10k', instance: 'pot' }],
      locked: [{ instance: 'pot', role: 'WIPER', pad: 'GPIO25' }],
      reserved: [],
    }).outcome.recommendation;
    expect(rec.status).toBe('unsat');
    expect(rec.unsat?.relaxations[0]).toBe('unlock:pot.WIPER');
  });
});
