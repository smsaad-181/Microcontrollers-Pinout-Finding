import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  catalogFileName,
  catalogUrl,
  clearCatalogCache,
  loadCatalog,
  type Digest,
} from '../src/catalog/loadCatalog';
import type { CatalogManifest, FetchLike } from '../src/manifest';

const digest: Digest = (t) => Promise.resolve(createHash('sha256').update(t, 'utf8').digest('hex'));
const body = JSON.stringify({
  version: 'abc123',
  format: 1,
  boards: [],
  breakouts: [],
  chips: [],
  evidence: [],
  ics: [],
  modules: [],
});
const sha = createHash('sha256').update(body, 'utf8').digest('hex');
const manifest: CatalogManifest = {
  version: 'abc123',
  date: '2026-01-01',
  sha256: sha,
  file: 'abc123.json',
};

const ok = (text: string) => new Response(text, { status: 200 });

describe('catalog file name and URL', () => {
  it('uses the manifest file, or <version>.json, and rejects paths', () => {
    expect(catalogFileName(manifest)).toBe('abc123.json');
    const { file: _file, ...noFile } = manifest;
    expect(catalogFileName(noFile)).toBe('abc123.json');
    expect(catalogFileName({ ...manifest, file: '../x.json' })).toBeNull();
    expect(catalogFileName({ ...manifest, file: 'a/b.json' })).toBeNull();
    expect(catalogFileName({ ...manifest, file: 'https://evil.example/x.json' })).toBeNull();
    expect(catalogUrl('/Microcontrollers-Pinout-Finding/', 'a.json')).toBe(
      '/Microcontrollers-Pinout-Finding/catalog/a.json',
    );
    expect(catalogUrl('/base', 'a.json')).toBe('/base/catalog/a.json');
  });
});

describe('loadCatalog', () => {
  beforeEach(() => {
    clearCatalogCache();
  });

  it('loads, verifies the hash and caches by hash', async () => {
    const fetchFn = vi.fn<FetchLike>(() => Promise.resolve(ok(body)));
    const r = await loadCatalog('/b/', manifest, fetchFn, digest);
    expect(r).toMatchObject({ status: 'ready', sha256: sha });
    await loadCatalog('/b/', manifest, fetchFn, digest);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('/b/catalog/abc123.json');
  });

  it('rejects a file whose hash does not match, and does not cache the failure', async () => {
    const fetchFn = vi.fn<FetchLike>(() => Promise.resolve(ok(`${body} `)));
    const r = await loadCatalog('/b/', manifest, fetchFn, digest);
    expect(r).toMatchObject({ status: 'error', message: expect.stringMatching(/hash/) as unknown });
    await loadCatalog('/b/', manifest, fetchFn, digest);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['HTTP error', () => Promise.resolve(new Response('', { status: 404 })), /HTTP 404/],
    ['network error', () => Promise.reject(new Error('offline')), /Network/],
  ])('reports a %s', async (_name, impl, msg) => {
    const r = await loadCatalog('/b/', manifest, vi.fn<FetchLike>(impl), digest);
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.message).toMatch(msg);
  });

  it('rejects content with the wrong shape or version', async () => {
    const other = JSON.stringify({ version: 'zzz', boards: [] });
    const m = { ...manifest, sha256: createHash('sha256').update(other).digest('hex') };
    const r = await loadCatalog('/b/', m, () => Promise.resolve(ok(other)), digest);
    expect(r.status).toBe('error');
  });

  it('reports a failing digest', async () => {
    const r = await loadCatalog(
      '/b/',
      manifest,
      () => Promise.resolve(ok(body)),
      () => Promise.reject(new Error('no crypto')),
    );
    expect(r).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/WebCrypto/) as unknown,
    });
  });
});
