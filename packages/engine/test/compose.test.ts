import { describe, expect, it } from 'vitest';
import { composePinView, type ComposedPin, type ComposedView } from '../src/compose.js';
import { realCatalog } from './helpers.js';

const { index } = realCatalog();

function view(ref: string, variant: string): ComposedView {
  const r = composePinView(index, ref, variant);
  if (r.status !== 'ok') throw new Error(`compose failed: ${r.status}`);
  return r.view;
}
const pin = (v: ComposedView, label: string): ComposedPin => {
  const p = v.pins.find((x) => x.label === label);
  if (!p) throw new Error(`no pin ${label}`);
  return p;
};

const DEVKIT = 'esp32-devkitc-v4@V4';

describe('composePinView: ESP32-DevKitC V4', () => {
  const v = view(DEVKIT, 'esp32-devkitc-32e');

  it('resolves chip, module and board', () => {
    expect(v.board).toBe(DEVKIT);
    expect(v.variant).toEqual({
      id: 'esp32-devkitc-32e',
      module: 'esp32-wroom-32e',
      chip: 'esp32',
    });
    expect(v.logicVoltage.value).toBe(3.3);
  });

  it('flags the MTDI strap pad GPIO12 with provenance', () => {
    const p = pin(v, 'IO12');
    expect(p.pad).toBe('GPIO12');
    expect(p.gpio).toBe(12);
    expect(p.usable).toBe(true);
    expect(p.flags).toEqual(expect.arrayContaining(['strap', 'jtag', 'adc-radio-conflict']));
    expect(p.strap.value).not.toBe('none');
    expect(p.strap.status).not.toBe('missing');
    expect(p.strap.evidence.length).toBeGreaterThan(0);
    expect(p.adc).toMatchObject({ unit: 'ADC2', channel: 5 });
    expect(p.adc?.radioConflict.value).toBe(true);
    expect(p.jtag).toBe('MTDI');
    expect(p.evidence).toEqual([...p.evidence].sort());
  });

  it('marks GPIO34-39 input-only and keeps ADC1 radio-safe', () => {
    for (const l of ['IO34', 'IO35', 'VP', 'VN']) {
      const p = pin(v, l);
      expect(p.inputOnly.value, l).toBe(true);
      expect(p.flags).toContain('input-only');
      expect(p.adc?.unit).toBe('ADC1');
      expect(p.flags).not.toContain('adc-radio-conflict');
    }
    expect(pin(v, 'IO25').inputOnly.value).toBe(false);
    expect(pin(v, 'IO25').dac).toEqual({ channel: 1 });
  });

  it('reports ADC2 pads as radio-conflicting', () => {
    const adc2 = v.pins.filter((p) => p.adc?.unit === 'ADC2');
    expect(adc2.length).toBeGreaterThan(5);
    for (const p of adc2) expect(p.flags).toContain('adc-radio-conflict');
  });

  it('has no connector pin for flash pads GPIO6-11 and lists them as unavailable', () => {
    for (const n of [6, 7, 8, 9, 10, 11]) {
      expect(v.pins.some((p) => p.gpio === n)).toBe(false);
      const u = v.unavailablePads.find((x) => x.pad === `GPIO${String(n)}`);
      expect(u?.reason).toBe('consumed');
      expect(u?.by).toBe('flash');
      expect(u?.onConnector).toBe(false);
    }
  });

  it('keeps UART0 and boot pads usable but flagged onboard', () => {
    expect(pin(v, 'TX').flags).toContain('onboard');
    expect(pin(v, 'RX').onboard[0]?.part).toMatch(/CP2102N/);
    expect(pin(v, 'IO0').flags).toEqual(expect.arrayContaining(['onboard', 'strap']));
  });

  it('exposes IO_MUX and matrix routes with limits', () => {
    const sck = pin(v, 'IO18').carries.filter((c) => c.peripheral === 'SPI3' && c.role === 'sck');
    expect(sck.map((c) => c.routing)).toContain('iomux');
    const iomux = sck.find((c) => c.routing === 'iomux');
    expect(iomux?.maxHz?.value).toBe(80_000_000);
    const i2c = pin(v, 'IO21').carries.filter((c) => c.peripheral === 'I2C0');
    expect(i2c.some((c) => c.routing === 'matrix')).toBe(true);
    expect(
      pin(v, 'IO34').carries.some((c) => c.peripheral === 'SPI3' && c.routing === 'iomux'),
    ).toBe(false);
  });

  it('reports per-pin current from the chip electrical limits', () => {
    expect(pin(v, 'IO23').pinCurrentMaxMa.status).toBeDefined();
  });

  it('is deterministic and JSON-serializable', () => {
    const a = JSON.stringify(view(DEVKIT, 'esp32-devkitc-32e'));
    expect(a).toBe(JSON.stringify(view(DEVKIT, 'esp32-devkitc-32e')));
    expect(JSON.parse(a)).toEqual(JSON.parse(JSON.stringify(v)));
  });
});

describe('composePinView: WROVER-E vs WROOM GPIO16/17', () => {
  it('GPIO16/17 are usable on WROOM-32E and consumed (psram) on WROVER-E', () => {
    const wroom = view(DEVKIT, 'esp32-devkitc-32e');
    const wrover = view(DEVKIT, 'esp32-devkitc-ve');
    for (const [label, pad] of [
      ['IO16', 'GPIO16'],
      ['IO17', 'GPIO17'],
    ] as const) {
      expect(pin(wroom, label).usable).toBe(true);
      expect(pin(wroom, label).consumed).toBeUndefined();
      const p = pin(wrover, label);
      expect(p.pad).toBe(pad);
      expect(p.usable).toBe(false);
      expect(p.consumed?.by.value).toBe('psram');
      expect(p.consumed?.by.status).toBe('verified');
      expect(p.consumed?.by.evidence.length).toBeGreaterThan(0);
      expect(p.flags).toContain('consumed');
    }
    expect(wrover.unavailablePads.find((u) => u.pad === 'GPIO16')?.onConnector).toBe(true);
  });
});

describe('composePinView: Pico W', () => {
  const v = view('raspberry-pi-pico-w@Rev3', 'pico-w');
  it('reserves GPIO23, 24, 25 and 29 for the wireless chip', () => {
    for (const n of [23, 24, 25, 29]) {
      expect(v.pins.some((p) => p.gpio === n)).toBe(false);
      const u = v.unavailablePads.find((x) => x.pad === `GPIO${String(n)}`);
      expect(u?.reason).toBe('consumed');
      expect(u?.by).toBe('internal');
    }
    expect(v.pins.filter((p) => p.kind === 'gpio' && p.usable)).toHaveLength(26);
  });
  it('carries the RP2040 I2C0 function on GP4 via a pad function', () => {
    const gp4 = pin(v, 'GP4');
    expect(
      gp4.carries.some((c) => c.peripheral === 'I2C0' && c.role === 'sda' && c.routing === 'iomux'),
    ).toBe(true);
    expect(gp4.resetState.value).toBe('pulldown');
  });
});

describe('composePinView: D1 mini A0', () => {
  const v = view('lolin-d1-mini@V4.0.0', 'lolin-d1-mini-v4');
  it('A0 is the TOUT pad: no GPIO number, ADC unit, onboard divider', () => {
    const a0 = pin(v, 'A0');
    expect(a0.kind).toBe('gpio');
    expect(a0.pad).toBe('TOUT');
    expect(a0.gpio).toBeUndefined();
    expect(a0.usable).toBe(true);
    expect(a0.adc?.unit).toBe('ADC');
    expect(a0.onboard.some((o) => /divider/i.test(o.part))).toBe(true);
    expect(a0.flags).toContain('onboard');
    expect(a0.flags).toContain('unverified');
    expect(a0.inputOnly.value).toBeNull();
    expect(a0.inputOnly.status).toBe('missing');
  });
  it('boot-strap pads GPIO0/2/15 have unknown strap facts, flagged unverified', () => {
    for (const l of ['0', '2', '15']) {
      const p = pin(v, l);
      expect(p.flags).toContain('unverified');
      expect(p.flags).toContain('onboard');
    }
  });
});

describe('composePinView: Arduino Uno R4 Minima', () => {
  const v = view('arduino-uno-r4-minima@V1.2', 'minima');
  it('keeps both numbering systems and records the SDA/SCL alias', () => {
    const scl = pin(v, 'SCL');
    expect(scl.pad).toBe('P100');
    expect(scl.gpio).toBeUndefined();
    expect(scl.aliasOf).toBe('JANALOG:14');
    expect(pin(v, 'A5').pad).toBe('P100');
    expect(pin(v, 'A5').aliasOf).toBeUndefined();
  });
  it('D13 carries the onboard LED; A0 is an ADC14 pad', () => {
    const d13 = pin(v, 'D13');
    expect(d13.pad).toBe('P111');
    expect(d13.flags).toContain('onboard');
    expect(d13.onboard[0]?.part).toMatch(/SCK LED/);
    expect(pin(v, 'A0').adc?.unit).toBe('ADC14');
  });
  it('lists the SWD pins as onboard-used', () => {
    expect(pin(v, 'SWDIO').flags).toContain('onboard');
  });
});

describe('composePinView: variant resolution', () => {
  it('returns needs_variant with candidates for an unknown or empty variant', () => {
    for (const bad of ['', 'nope']) {
      const r = composePinView(index, DEVKIT, bad);
      expect(r).toEqual({
        status: 'needs_variant',
        candidates: ['esp32-devkitc-32e', 'esp32-devkitc-ve'],
      });
    }
  });
  it('returns an error for an unknown board', () => {
    const r = composePinView(index, 'nope@1', 'x');
    expect(r.status).toBe('error');
  });
});
