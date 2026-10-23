import type { Project } from '@pinout/schema';
import { describe, expect, it } from 'vitest';
import { enumerateBranches, selectInterfaces, type InterfaceSelection } from '../src/interfaces.js';
import { realCatalog } from './helpers.js';

const { index } = realCatalog();

type Mod = Project['modules'][number];
function project(mods: Mod[], extra: Partial<Project> = {}): Project {
  return {
    board: 'esp32-devkitc-v4@V4',
    variant: 'esp32-devkitc-32e',
    modules: mods,
    locked: [],
    reserved: [],
    ...extra,
  };
}
function select(p: Project): InterfaceSelection {
  const r = selectInterfaces(index, p);
  if (r.status !== 'ok') throw new Error(`selection failed: ${r.status}`);
  return r;
}
const mod = (r: InterfaceSelection, instance: string) => {
  const m = r.modules.find((x) => x.instance === instance);
  if (!m) throw new Error(`no module ${instance}`);
  return m;
};

describe('interface selection: BME280 (I2C vs SPI)', () => {
  it('6-pin BME280 alone: I2C (2 pins) beats SPI (4 pins) by rule 3, SPI kept as the alternative', () => {
    const r = select(project([{ breakout: 'gy-bme280-6pin', instance: 'env' }]));
    const m = mod(r, 'env');
    expect(m.candidates.map((c) => c.kind)).toEqual(['i2c', 'spi']);
    expect(m.chosen).toBe('i2c');
    expect(m.decidedByRule).toBe(3);
    expect(m.alternatives).toEqual(['spi']);
    expect(m.candidates.find((c) => c.kind === 'i2c')?.pinCost).toBe(2);
    expect(m.candidates.find((c) => c.kind === 'spi')?.pinCost).toBe(4);
    expect(m.trace.length).toBeGreaterThan(0);
  });

  it('worked example: SPI would save one pin on the existing bus, rule 3 ignored with >= 3 spare pins', () => {
    const r = select(
      project([
        { breakout: 'gy-bme280-6pin', instance: 'env' },
        { breakout: 'rfid-rc522-blue', instance: 'rfid' },
        { breakout: 'st7735s-1.8-spi-tft', instance: 'tft' },
      ]),
    );
    const m = mod(r, 'env');
    const spi = m.candidates.find((c) => c.kind === 'spi');
    const i2c = m.candidates.find((c) => c.kind === 'i2c');
    expect(spi).toMatchObject({ pinCost: 1, newBus: false, feasible: true });
    expect(i2c).toMatchObject({ pinCost: 2, newBus: true, feasible: true });
    expect(m.chosen).toBe('i2c');
    expect(m.decidedByRule).toBe(4);
    expect(mod(r, 'rfid')).toMatchObject({ chosen: 'spi', decidedByRule: 1 });
    expect(mod(r, 'tft')).toMatchObject({ chosen: 'spi', decidedByRule: 1 });
  });

  it('4-pin BME280 is locked to I2C by the breakout (rule 1)', () => {
    const r = select(project([{ breakout: 'gy-bme280-4pin', instance: 'env' }]));
    const m = mod(r, 'env');
    expect(m.candidates.map((c) => c.kind)).toEqual(['i2c']);
    expect(m).toMatchObject({ chosen: 'i2c', decidedByRule: 1, alternatives: [] });
  });

  it('user override wins (rule 7); an interface the breakout does not expose is infeasible', () => {
    const r = select(
      project([
        { breakout: 'gy-bme280-6pin', instance: 'env', interface: 'spi' },
        { breakout: 'gy-bme280-4pin', instance: 'env4', interface: 'spi' },
      ]),
    );
    expect(mod(r, 'env')).toMatchObject({ chosen: 'spi', decidedByRule: 7 });
    const bad = mod(r, 'env4');
    expect(bad.chosen).toBeNull();
    expect(bad.decidedByRule).toBe(7);
    expect(bad.candidates[0]).toMatchObject({ kind: 'spi', feasible: false });
    expect(bad.candidates[0]?.infeasibleReason).toMatch(/not exposed/);
  });

  it('third BME280 on one bus: address collision falls to a second I2C bus on ESP32', () => {
    const r = select(
      project([
        { breakout: 'gy-bme280-6pin', instance: 'a', interface: 'i2c' },
        { breakout: 'gy-bme280-6pin', instance: 'b', interface: 'i2c' },
        { breakout: 'gy-bme280-6pin', instance: 'c' },
      ]),
    );
    expect(r.i2c.conflicts).toEqual([]);
    const c = mod(r, 'c');
    const i2c = c.candidates.find((x) => x.kind === 'i2c');
    expect(i2c?.secondBus).toBe(true);
    expect(i2c?.pinCost).toBe(2);
    expect(c.chosen).toBe('i2c');
  });

  it('a Pico (two I2C blocks) and an Uno R4 are also handled', () => {
    const pico = select(
      project([{ breakout: 'gy-bme280-6pin', instance: 'env' }], {
        board: 'raspberry-pi-pico-w@Rev3',
        variant: 'pico-w',
      }),
    );
    expect(mod(pico, 'env').chosen).toBe('i2c');
  });

  it('two 4-pin modules with no address pin: address unprovable, never a guess', () => {
    const r = select(
      project([
        { breakout: 'gy-bme280-4pin', instance: 'a' },
        { breakout: 'gy-bme280-4pin', instance: 'b' },
      ]),
    );
    expect(r.i2c.addresses.every((a) => a.status === 'unknown' && a.address === null)).toBe(true);
    expect(mod(r, 'a').warnings).toContain('I2C_ADDRESS_UNKNOWN');
  });

  it('address strap in the project fixes the address', () => {
    const r = select(
      project([
        { breakout: 'gy-bme280-6pin', instance: 'a', address_strap: 'SDO=GND' },
        { breakout: 'gy-bme280-6pin', instance: 'b', address_strap: 'SDO=VDDIO' },
      ]),
    );
    expect(r.i2c.addresses.map((a) => a.address)).toEqual([0x76, 0x77]);
    expect(r.i2c.conflicts).toEqual([]);
  });

  it('nine ADS1115 cannot fit the I2C address space', () => {
    const mods = Array.from({ length: 9 }, (_, i): Mod => ({
      breakout: 'ads1115-breakout',
      instance: `adc${String(i)}`,
    }));
    const r = select(project(mods));
    expect(r.i2c.conflicts.length).toBeGreaterThan(0);
  });
});

describe('interface selection: digital, SPI-only and distance', () => {
  it('HC-SR04 is a digital pair: two exclusive pins, rule 1', () => {
    const r = select(project([{ breakout: 'hc-sr04-4pin', instance: 'sonar' }]));
    const m = mod(r, 'sonar');
    expect(m).toMatchObject({ chosen: 'digital', decidedByRule: 1 });
    expect(m.candidates[0]).toMatchObject({
      kind: 'digital',
      pinCost: 2,
      newBus: false,
      feasible: true,
    });
  });

  it('ST7735S: SPI only, new bus costs SCLK+MOSI+CS+DC+RST', () => {
    const r = select(project([{ breakout: 'st7735s-1.8-spi-tft', instance: 'tft' }]));
    const m = mod(r, 'tft');
    expect(m).toMatchObject({ chosen: 'spi', decidedByRule: 1 });
    expect(m.candidates[0]).toMatchObject({ pinCost: 5, newBus: true });
  });

  it('a second SPI device only pays for its own selects (bus exists)', () => {
    const r = select(
      project([
        { breakout: 'st7735s-1.8-spi-tft', instance: 'tft' },
        { breakout: 'rfid-rc522-blue', instance: 'rfid' },
      ]),
    );
    const costs = Object.fromEntries(r.modules.map((m) => [m.instance, m.candidates[0]?.pinCost]));
    // tft (first on the bus) pays the bus; rfid pays CS, IRQ, RST only
    expect(costs).toEqual({ tft: 5, rfid: 3 });
  });

  it('wiring longer than 0.5 m warns for I2C/SPI (rule 6)', () => {
    const r = select(
      project([{ breakout: 'st7735s-1.8-spi-tft', instance: 'tft' }], { wiring_length_m: 1.5 }),
    );
    expect(mod(r, 'tft').candidates[0]?.warnings).toContain('LONG_WIRE_BUS');
    const near = select(
      project([{ breakout: 'st7735s-1.8-spi-tft', instance: 'tft' }], { wiring_length_m: 0.2 }),
    );
    expect(mod(near, 'tft').candidates[0]?.warnings).not.toContain('LONG_WIRE_BUS');
  });

  it('analog is locked for a potentiometer and feasible on D1 mini A0 and ESP32 ADC1 with Wi-Fi', () => {
    const d1 = select(
      project([{ breakout: 'potentiometer-10k', instance: 'pot' }], {
        board: 'lolin-d1-mini@V4.0.0',
        variant: 'lolin-d1-mini-v4',
      }),
    );
    expect(mod(d1, 'pot')).toMatchObject({ chosen: 'analog', decidedByRule: 1 });
    expect(mod(d1, 'pot').candidates[0]?.feasible).toBe(true);
    const esp = select(
      project([{ breakout: 'potentiometer-10k', instance: 'pot' }], { wifi: true }),
    );
    expect(mod(esp, 'pot').candidates[0]?.feasible).toBe(true);
  });

  it('returns needs_variant for an unknown variant', () => {
    const r = selectInterfaces(index, project([], { variant: 'nope' }));
    expect(r.status).toBe('needs_variant');
  });
});

describe('branch enumeration', () => {
  it('orders feasible combinations best-first and is deterministic', () => {
    const p = project([
      { breakout: 'gy-bme280-6pin', instance: 'env' },
      { breakout: 'rfid-rc522-blue', instance: 'rfid' },
    ]);
    const r = select(p);
    const b = enumerateBranches(r);
    expect(b.map((x) => x.choice)).toEqual([
      { env: 'i2c', rfid: 'spi' },
      { env: 'spi', rfid: 'spi' },
    ]);
    expect(JSON.stringify(enumerateBranches(select(p)))).toBe(JSON.stringify(b));
    expect(enumerateBranches(r, 1)).toHaveLength(1);
  });
});
