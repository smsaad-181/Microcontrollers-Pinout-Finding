import { describe, expect, it } from 'vitest';
import { isCatalogManifest, loadManifest, manifestUrl, type FetchLike } from '../src/manifest';

const valid = {
  version: '2026.10.22-1',
  date: '2026-10-22',
  sha256: 'a'.repeat(64),
  counts: { boards: 1, modules: 0 },
};

describe('isCatalogManifest', () => {
  it('accepts a valid manifest, with or without counts', () => {
    expect(isCatalogManifest(valid)).toBe(true);
    const { counts: _counts, ...noCounts } = valid;
    expect(isCatalogManifest(noCounts)).toBe(true);
    expect(isCatalogManifest({ ...valid, extra: 'ignored' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', [valid]],
    ['a string', 'manifest'],
    ['missing version', { ...valid, version: undefined }],
    ['empty version', { ...valid, version: '  ' }],
    ['numeric version', { ...valid, version: 1 }],
    ['missing date', { ...valid, date: undefined }],
    ['missing sha256', { ...valid, sha256: undefined }],
    ['counts not an object', { ...valid, counts: [1] }],
    ['non-numeric count', { ...valid, counts: { boards: '1' } }],
    ['negative count', { ...valid, counts: { boards: -1 } }],
  ])('rejects %s', (_label, value) => {
    expect(isCatalogManifest(value)).toBe(false);
  });
});

describe('manifestUrl', () => {
  it('is relative to the base path', () => {
    expect(manifestUrl('/pinout-finder/')).toBe('/pinout-finder/catalog/catalog-manifest.json');
    expect(manifestUrl('/x')).toBe('/x/catalog/catalog-manifest.json');
    expect(manifestUrl('./')).toBe('./catalog/catalog-manifest.json');
  });
});

function fakeFetch(body: string, init: ResponseInit = {}): FetchLike {
  return () => Promise.resolve(new Response(body, init));
}

describe('loadManifest', () => {
  const url = '/pinout-finder/catalog/catalog-manifest.json';

  it('returns ready for a valid manifest', async () => {
    const result = await loadManifest(
      url,
      fakeFetch(JSON.stringify(valid), { headers: { 'content-type': 'application/json' } }),
    );
    expect(result).toEqual({ status: 'ready', manifest: valid });
  });

  it('returns missing on 404', async () => {
    expect(await loadManifest(url, fakeFetch('', { status: 404 }))).toEqual({ status: 'missing' });
  });

  it('returns missing when the server falls back to HTML', async () => {
    const result = await loadManifest(
      url,
      fakeFetch('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
    );
    expect(result).toEqual({ status: 'missing' });
  });

  it('returns invalid for malformed JSON', async () => {
    expect((await loadManifest(url, fakeFetch('{not json'))).status).toBe('invalid');
  });

  it('returns invalid for the wrong shape', async () => {
    expect((await loadManifest(url, fakeFetch('{"version":1}'))).status).toBe('invalid');
  });

  it('returns error for other HTTP failures and network errors', async () => {
    expect((await loadManifest(url, fakeFetch('', { status: 500 }))).status).toBe('error');
    const failing: FetchLike = () => Promise.reject(new TypeError('offline'));
    expect((await loadManifest(url, failing)).status).toBe('error');
  });
});
