import { describe, expect, it } from 'vitest';
import { boardOptions, filterBoards, filterValues, headerPads } from '../src/catalog/boards';
import { citationIndex } from '../src/catalog/evidence';
import { createModuleSearch, shortPart } from '../src/catalog/search';
import { groupAction } from '../src/screens/ModulesScreen';
import { compiledCatalog } from './realCatalog';

describe('boardOptions', () => {
  const rows = boardOptions(compiledCatalog().catalog);

  it('has one row per board variant, with chip family and status', () => {
    const devkitc = rows.filter((r) => r.ref === 'esp32-devkitc-v4@V4');
    expect(devkitc.length).toBeGreaterThan(1);
    expect(devkitc.every((r) => r.family === 'ESP32' && r.chip === 'esp32')).toBe(true);
    expect(rows.every((r) => typeof r.status === 'string')).toBe(true);
  });

  it('filters by any combination of fields', () => {
    const rp = filterBoards(rows, { family: 'RP2040' });
    expect(rp.length).toBeGreaterThan(0);
    expect(rp.every((r) => r.family === 'RP2040')).toBe(true);
    expect(filterBoards(rows, { family: 'RP2040', vendor: 'Espressif Systems' })).toEqual([]);
    expect(filterBoards(rows, { family: '' })).toHaveLength(rows.length);
    expect(filterValues(rows, 'family')).toContain('ESP32-S3');
  });

  it('lists header pads once each, skipping alias pins', () => {
    const pads = headerPads(compiledCatalog().catalog, 'esp32-devkitc-v4@V4');
    const ids = pads.map((p) => p.pad);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('GPIO21');
    expect(headerPads(compiledCatalog().catalog, 'nope@1')).toEqual([]);
  });
});

describe('module search', () => {
  const search = createModuleSearch(compiledCatalog().catalog);

  it.each(['RC522', 'MFRC522', 'RFID-RC522', 'rc522'])('finds the RC522 board for %j', (q) => {
    const groups = search.search(q);
    expect(groups.flatMap((g) => g.breakouts.map((b) => b.id))).toContain('rfid-rc522-blue');
  });

  it('groups the BME280 boards and asks which one (variant prompt)', () => {
    const groups = search.search('BME280');
    const bme = groups.find((g) => g.ic === 'bme280');
    expect(bme?.breakouts.length).toBeGreaterThan(1);
    if (bme) expect(groupAction(bme)).toEqual({ kind: 'ask' });
  });

  it('asks which relay board when both match', () => {
    const relay = search.search('relay').find((g) => g.ic === 'srd-05vdc-sl-c');
    expect(relay?.breakouts.map((b) => b.id).sort()).toEqual([
      'relay-board-4ch-opto-jdvcc',
      'relay-board-4ch-transistor',
    ]);
  });

  it('adds directly when exactly one board matches', () => {
    const groups = search.search('Adafruit BME280');
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g?.breakouts.map((b) => b.id)).toEqual(['adafruit-bme280']);
    if (g) expect(groupAction(g)).toMatchObject({ kind: 'add' });
  });

  it('returns nothing for a blank query', () => {
    expect(search.search('   ')).toEqual([]);
  });

  it('shortens long part descriptions', () => {
    expect(shortPart('10 kohm potentiometer (three-terminal)')).toBe('10 kohm potentiometer');
  });
});

describe('citationIndex', () => {
  const cite = citationIndex(compiledCatalog().catalog.evidence);

  it('resolves a claim id to its document, locator, quote and URL', () => {
    const c = cite('esp32-devkitc-v4-ug#j2-1-4');
    expect(c.found).toBe(true);
    expect(c.url).toMatch(/^https:\/\//);
    expect(c.locator.length).toBeGreaterThan(0);
    expect(c.quote.length).toBeGreaterThan(0);
  });

  it('marks unknown claim ids as not found instead of hiding them', () => {
    const c = cite('nope#x');
    expect(c).toMatchObject({ found: false, url: null, title: 'nope' });
  });

  it('never yields a non-web URL', () => {
    const first = compiledCatalog().catalog.evidence[0];
    if (!first) throw new Error('catalog has no evidence');
    const bad = citationIndex([
      {
        ...first,
        id: 'bad',
        url: 'javascript:alert(1)',
        claims: [{ id: 'bad#x', locator: 'p', quote: 'q', supports: 's' }],
      },
    ]);
    expect(bad('bad#x').url).toBeNull();
  });
});
