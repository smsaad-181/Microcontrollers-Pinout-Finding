// Engine behaviours added for the golden fixtures (task 2b.9), one focused test each.
import { describe, expect, it } from 'vitest';
import type { Project } from '@pinout/schema';
import { solve, solveDetailed } from '../src/solver.js';
import { realCatalog } from './helpers.js';

const { index } = realCatalog();
const base = (over: Partial<Project>): Project => ({
  board: 'esp32-devkitc-v4@V4',
  variant: 'esp32-devkitc-32e',
  wifi: true,
  modules: [],
  locked: [],
  reserved: [],
  ...over,
});
const d1 = (over: Partial<Project>): Project =>
  base({ board: 'lolin-d1-mini@V4.0.0', variant: 'lolin-d1-mini-v4', wifi: false, ...over });
const find = (r: ReturnType<typeof solve>, code: string) => r.warnings.find((w) => w.code === code);

describe('IRQ is optional wiring', () => {
  it('leaves an interrupt output unconnected unless the user locks a pad', () => {
    const p = base({ modules: [{ breakout: 'rfid-rc522-blue', instance: 'rfid' }] });
    expect(solve(index, p).assignments.some((a) => a.role === 'IRQ')).toBe(false);
    const locked = solve(index, {
      ...p,
      locked: [{ instance: 'rfid', role: 'IRQ', pad: 'GPIO36' }],
    });
    expect(locked.assignments.find((a) => a.role === 'IRQ')?.pad).toBe('GPIO36');
  });
});

describe('errata, strap facts and loads', () => {
  it('reports GPIO-3.11 as a Caution without a tier-1 cost', () => {
    const r = solve(
      index,
      base({
        modules: [{ breakout: 'push-button', instance: 'sw' }],
        locked: [{ instance: 'sw', role: 'SW', pad: 'GPIO36' }],
      }),
    );
    expect(find(r, 'ERRATUM_GPIO_3_11')?.level).toBe('caution');
    expect(r.score[0]).toBe(0);
  });
  it('counts an undocumented strap behaviour as a risk (ESP8266 GPIO0/2/15)', () => {
    const r = solve(
      index,
      d1({
        modules: [{ breakout: 'push-button', instance: 'sw' }],
        locked: [{ instance: 'sw', role: 'SW', pad: 'GPIO0' }],
      }),
    );
    expect(r.score[0]).toBe(1);
    expect(find(r, 'STRAP_FACT_MISSING')?.level).toBe('caution');
  });
  it('asks for an external pull-up on GPIO16 (pull-down only) and says so as Info', () => {
    const r = solve(
      index,
      d1({
        modules: [{ breakout: 'push-button', instance: 'sw' }],
        locked: [{ instance: 'sw', role: 'SW', pad: 'GPIO16' }],
      }),
    );
    expect(find(r, 'NO_INTERNAL_PULL_UP_ON_GPIO16')?.level).toBe('info');
    expect(r.required_parts.find((p) => p.role === 'pull-up')?.pads).toEqual(['GPIO16']);
  });
  it('gives a floating relay input a pull-down and no tier-1 cost', () => {
    const r = solve(
      index,
      base({
        modules: [{ breakout: 'relay-board-4ch-transistor', instance: 'relays' }],
        locked: [{ instance: 'relays', role: 'COIL[1]', pad: 'GPIO25' }],
      }),
    );
    expect(find(r, 'FLOATING_AT_RESET_LOAD')?.level).toBe('warning');
    expect(r.required_parts.find((p) => p.role === 'pull-down')?.pads).toContain('GPIO25');
    expect(r.score[0]).toBe(0);
  });
});

describe('modules, buses and addresses', () => {
  const oled = (): Project =>
    d1({ modules: [{ breakout: 'ssd1306-128x64-i2c-4pin', instance: 'oled' }] });
  it('does not take UART1 for the USB bridge just because its pads carry other onboard parts', () => {
    expect(solve(index, oled()).status).toBe('ok');
  });
  it('reports the I2C clock ceiling of the ESP8266 software bus', () => {
    expect(solveDetailed(index, oled()).details?.maxHz.oled).toBe(100000);
  });
  it('MISO sharing: Info for one reader beside a write-only device', () => {
    const r = solve(
      index,
      base({
        modules: [
          { breakout: 'rfid-rc522-blue', instance: 'rfid' },
          { breakout: 'st7735s-1.8-spi-tft', instance: 'tft' },
        ],
      }),
    );
    expect(find(r, 'MISO_SHARE_UNPROVEN')?.level).toBe('info');
  });
  it('ADDR tied to SDA gets the timing note', () => {
    const r = solve(
      index,
      base({
        modules: [
          {
            breakout: 'ads1115-breakout',
            instance: 'adc',
            interface: 'i2c',
            address_strap: 'ADDR=SDA',
          },
        ],
      }),
    );
    expect(find(r, 'I2C_ADDRESS_SDA_STRAP_TIMING')?.level).toBe('info');
  });
  it('a board that pulls SDO up reads as 0x77 by default', () => {
    const o = solveDetailed(
      index,
      base({ modules: [{ breakout: 'adafruit-bme280', instance: 'env', interface: 'i2c' }] }),
    );
    expect(o.details?.i2c[0]?.address).toBe(0x77);
  });
  it('two selectable modules separated by a strap are decided by rule 5 even under an override', () => {
    const r = solve(
      index,
      base({
        modules: [
          { breakout: 'gy-bme280-6pin', instance: 'env1', interface: 'i2c' },
          { breakout: 'gy-bme280-6pin', instance: 'env2', interface: 'i2c' },
        ],
      }),
    );
    expect(r.interfaces.env1?.decided_by_rule).toBe(5);
  });
  it('recommends a separate coil supply while the 5 V budget cannot be proven', () => {
    const r = solve(
      index,
      base({ modules: [{ breakout: 'relay-board-4ch-opto-jdvcc', instance: 'relays' }] }),
    );
    expect(r.required_parts.some((p) => p.role === 'jd-vcc')).toBe(true);
  });
  it('a level-shifter fact in conflict gives a Caution', () => {
    const r = solve(
      index,
      base({ modules: [{ breakout: 'adafruit-bme280', instance: 'env', interface: 'i2c' }] }),
    );
    expect(find(r, 'LEVEL_SHIFTER_CONFLICT_RELIED')?.level).toBe('caution');
  });
});
