import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App, CatalogStatus } from '../src/App';

describe('App placeholder', () => {
  it('renders the product name and one h1 inside main', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Pinout Finder');
    expect(html).toContain('coming soon');
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<main[\s>]/);
    expect(html).toContain('href="#/"');
  });

  it('shows the loading state before the manifest arrives', () => {
    expect(renderToString(<App />)).toContain('Loading catalog information');
  });
});

describe('CatalogStatus', () => {
  it('shows the manifest version and counts', () => {
    const html = renderToString(
      <CatalogStatus
        state={{
          status: 'ready',
          manifest: { version: '2026.10.22-1', date: '2026-10-22', sha256: 'ab', counts: { boards: 3 } },
        }}
      />,
    );
    expect(html).toContain('2026.10.22-1');
    expect(html).toContain('boards');
  });

  it('says the catalog is not built yet when missing', () => {
    expect(renderToString(<CatalogStatus state={{ status: 'missing' }} />)).toContain(
      'Catalog not built yet',
    );
  });
});
