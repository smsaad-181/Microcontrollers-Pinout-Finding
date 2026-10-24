import { describe, expect, it } from 'vitest';
import { engineHandle } from '../src/single/engineHandle';
import { inlineHtml, singleFileCsp } from '../src/singleFile';
import { createEngineHost } from '../src/worker/engineHost';
import { compiledCatalog } from './realCatalog';

/** A worker that never answers; `fail()` fires the `error` event a blocked worker would fire. */
class DeadWorker extends EventTarget {
  terminated = false;
  postMessage(): void {
    // never answers
  }
  terminate(): void {
    this.terminated = true;
  }
  fail(): void {
    this.dispatchEvent(new Event('error'));
  }
}

const local = () => createEngineHost(() => 0);

describe('single-file engine handle', () => {
  it('runs on the main thread when the worker constructor throws', async () => {
    const { catalog, sha256 } = compiledCatalog();
    const h = engineHandle(() => {
      throw new Error('blocked');
    }, local);
    await h.init(catalog, sha256);
    expect(await h.lockRoles('gy-bme280-6pin')).toContain('SDA');
  });

  it('falls back to the main thread when the worker fails before init answers', async () => {
    const { catalog, sha256 } = compiledCatalog();
    const dead = new DeadWorker();
    const h = engineHandle(() => dead as unknown as Worker, local);
    const ready = h.init(catalog, sha256);
    dead.fail();
    await ready;
    expect(dead.terminated).toBe(true);
    expect(await h.lockRoles('gy-bme280-6pin')).toContain('SDA');
  });
});

describe('inlineHtml', () => {
  const page = [
    '<!doctype html><html><head><meta charset="UTF-8" />',
    '<script type="module" crossorigin src="./assets/index-a.js"></script>',
    '<link rel="stylesheet" crossorigin href="./assets/index-b.css">',
    '</head><body><a href="#/board">x</a></body></html>',
  ].join('');
  const files = new Map([
    ['assets/index-a.js', 'const s = "</script>"; const u = `src="${"x"}"`;'],
    ['assets/index-b.css', 'body{color:red}'],
  ]);

  it('inlines the script and stylesheet and allows exactly them in the CSP', () => {
    const out = inlineHtml(page, files);
    expect(out).not.toContain('assets/');
    expect(out).toContain('<style>body{color:red}</style>');
    expect(out).toContain('const s = "<\\/script>"');
    const js = 'const s = "<\\/script>"; const u = `src="${"x"}"`;';
    expect(out).toContain(singleFileCsp([js], ['body{color:red}']));
    expect(out).toContain("connect-src 'none'");
  });

  it('refuses a page that would still load a file', () => {
    const bad = page.replace('</body>', '<img src="./logo.png"></body>');
    expect(() => inlineHtml(bad, files)).toThrow(/external reference left: .\/logo.png/);
  });

  it('refuses a bundle file it does not have', () => {
    expect(() => inlineHtml(page, new Map())).toThrow(/not in the bundle/);
  });
});
