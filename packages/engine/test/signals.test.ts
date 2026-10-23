import type { Project } from '@pinout/schema';
import type { InterfaceKind } from '../src/catalog.js';
import { describe, expect, it } from 'vitest';
import { expandSignals, type ExpandedSignal } from '../src/signals.js';
import { realCatalog } from './helpers.js';

const { index } = realCatalog();

type Mod = Project['modules'][number];
function project(mods: Mod[], extra: Partial<Project> = {}): Project {
  return {
    board: 'esp32-devkitc-v4@V4',
    variant: 'esp32-devkitc-32e',
    wifi: true,
    modules: mods,
    locked: [],
    reserved: [],
    ...extra,
  };
}
function expand(p: Project, interfaces?: Record<string, InterfaceKind>) {
  const r = expandSignals(index, p, interfaces);
  if (r.status !== 'ok') throw new Error(`expand failed: ${r.status}`);
  return r;
}
const sig = (signals: ExpandedSignal[], id: string): ExpandedSignal => {
  const s = signals.find((x) => x.id === id);
  if (!s) throw new Error(`no signal ${id}; have ${signals.map((x) => x.id).join(', ')}`);
  return s;
};

const WORKED = project([
  { breakout: 'gy-bme280-6pin', instance: 'env' },
  { breakout: 'rfid-rc522-blue', instance: 'rfid' },
  { breakout: 'st7735s-1.8-spi-tft', instance: 'tft' },
  { breakout: 'relay-board-4ch-transistor', instance: 'relays' },
  { breakout: 'push-button', instance: 'sw1' },
]);

describe('expandSignals: worked-example project', () => {
  const { signals } = expand(WORKED);

  it('I2C lines are shared open-drain bus lines that need pull-ups', () => {
    expect(sig(signals, 'env.SDA')).toMatchObject({
      interface: 'i2c',
      peripheral: 'I2C.SDA',
      dir: 'io',
      drive: 'open-drain',
      shareable: 'bus',
      needsPull: 'up',
      maxHz: 3_400_000,
    });
    expect(sig(signals, 'env.SCL')).toMatchObject({ peripheral: 'I2C.SCL', dir: 'out' });
  });

  it('SPI device: bus lines shared, CS exclusive, IRQ as interrupt, directions seen from the MCU', () => {
    expect(sig(signals, 'rfid.SCLK')).toMatchObject({
      peripheral: 'SPI.SCK',
      dir: 'out',
      shareable: 'bus',
      maxHz: 10_000_000,
    });
    expect(sig(signals, 'rfid.MISO')).toMatchObject({
      peripheral: 'SPI.MISO',
      dir: 'in',
      shareable: 'bus',
    });
    expect(sig(signals, 'rfid.CS')).toMatchObject({
      peripheral: 'GPIO',
      dir: 'out',
      shareable: 'exclusive',
    });
    expect(sig(signals, 'rfid.IRQ')).toMatchObject({ peripheral: 'GPIO.IRQ', dir: 'in' });
    expect(sig(signals, 'rfid.RST')).toMatchObject({ peripheral: 'GPIO', dir: 'out' });
  });

  it('ST7735S clock limit comes from the minimum cycle time', () => {
    const s = sig(signals, 'tft.SCLK');
    expect(s.maxHz).toBe(15_151_515);
    expect(s.maxHzFact?.status).toBe('interim');
    expect(sig(signals, 'tft.DC')).toMatchObject({ peripheral: 'GPIO', shareable: 'exclusive' });
    // backlight pin (LED) is not an IC signal
    expect(signals.some((s2) => s2.id === 'tft.LED')).toBe(false);
  });

  it('relay inputs are loads: one signal per coil, floating at reset with unknown resting level', () => {
    const coils = signals.filter((s) => s.instance === 'relays');
    expect(coils.map((s) => s.id)).toEqual([
      'relays.COIL[1]',
      'relays.COIL[2]',
      'relays.COIL[3]',
      'relays.COIL[4]',
    ]);
    expect(coils[0]).toMatchObject({
      dir: 'out',
      actsOnLevel: true,
      restingLevelAtReset: 'float',
      restingKnown: false,
      peripheral: 'GPIO',
      shareable: 'exclusive',
    });
  });

  it('push button: input, open-drain contact floating at rest, needs a pull-up', () => {
    expect(sig(signals, 'sw1.SW')).toMatchObject({
      dir: 'in',
      drive: 'open-drain',
      restingLevelAtReset: 'float',
      restingKnown: true,
      needsPull: 'up',
      peripheral: 'GPIO',
      actsOnLevel: false,
    });
  });

  it('is deterministic and ordered by project module order', () => {
    const a = JSON.stringify(expand(WORKED));
    expect(a).toBe(JSON.stringify(expand(WORKED)));
    const order = [...new Set(expand(WORKED).signals.map((s) => s.instance))];
    expect(order).toEqual(['env', 'rfid', 'tft', 'relays', 'sw1']);
  });
});

describe('expandSignals: other devices', () => {
  it('HC-SR04: TRIG is an MCU output, ECHO an MCU input', () => {
    const { signals } = expand(project([{ breakout: 'hc-sr04-4pin', instance: 'sonar' }]));
    expect(sig(signals, 'sonar.TRIG')).toMatchObject({ dir: 'out', peripheral: 'GPIO' });
    expect(sig(signals, 'sonar.ECHO')).toMatchObject({ dir: 'in', peripheral: 'GPIO' });
  });

  it('potentiometer wiper is an ADC input', () => {
    const { signals } = expand(project([{ breakout: 'potentiometer-10k', instance: 'pot' }]));
    expect(sig(signals, 'pot.WIPER')).toMatchObject({
      dir: 'in',
      peripheral: 'ADC',
      interface: 'analog',
    });
  });

  it('SPI chosen for a 6-pin BME280 by override', () => {
    const { signals } = expand(
      project([{ breakout: 'gy-bme280-6pin', instance: 'env', interface: 'spi' }]),
    );
    expect(signals.map((s) => s.id)).toEqual(['env.SCK', 'env.MOSI', 'env.MISO', 'env.CS']);
    expect(sig(signals, 'env.MISO').miso).toEqual({ shareProven: null });
  });

  it('attaches locked pads by instance and role', () => {
    const { signals } = expand(
      project([{ breakout: 'relay-board-4ch-transistor', instance: 'relays' }], {
        locked: [{ instance: 'relays', role: 'COIL[1]', pad: 'GPIO12' }],
      }),
    );
    expect(sig(signals, 'relays.COIL[1]').lockedPad).toBe('GPIO12');
    expect(sig(signals, 'relays.COIL[2]').lockedPad).toBeUndefined();
  });

  it('reports a diagnostic and no signals for a module with no feasible interface', () => {
    const r = expand(project([{ breakout: 'gy-bme280-4pin', instance: 'env', interface: 'spi' }]));
    expect(r.signals).toEqual([]);
    expect(r.diagnostics.map((d) => d.code)).toContain('NO_INTERFACE');
  });
});
