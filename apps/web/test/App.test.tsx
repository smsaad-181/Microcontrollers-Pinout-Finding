import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App, CatalogStatus } from '../src/App';
import {
  Citations,
  LevelBadge,
  StatusBadge,
  StepNav,
  stepNeeds,
  stepState,
} from '../src/components/common';
import { footerSpec } from '../src/components/StepFooter';
import { citationIndex } from '../src/catalog/evidence';

describe('App shell', () => {
  it('renders the product name, one h1 inside main, and the step navigation', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Pinout Finder');
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<main[\s>]/);
    expect(html).toContain('href="#/"');
    for (const s of ['board', 'modules', 'constraints', 'results'])
      expect(html).toContain(`href="#/${s}"`);
    expect(html).toContain('Skip to content');
  });

  it('shows the loading state before the manifest arrives', () => {
    expect(renderToString(<App />)).toContain('Loading catalog information');
  });
});

describe('badges', () => {
  it('board status shows text, not colour alone', () => {
    const html = renderToString(<StatusBadge status="partially-verified" />);
    expect(html).toContain('Partially verified');
    expect(html).toContain('aria-hidden="true"');
  });

  it.each([
    ['critical', 'Critical'],
    ['warning', 'Warning'],
    ['caution', 'Caution'],
    ['info', 'Info'],
  ] as const)('warning level %s has a text label and an icon', (level, label) => {
    const html = renderToString(<LevelBadge level={level} />);
    expect(html).toContain(label);
    expect(html).toContain('level-icon');
  });

  it('marks the current step', () => {
    const none = { board: false, modules: 0, rules: false };
    expect(renderToString(<StepNav current="modules" progress={none} />)).toMatch(
      /href="#\/modules" aria-current="step"/,
    );
  });

  it('shows done steps with a check mark and says why Get pins is not ready', () => {
    const progress = { board: true, modules: 0, rules: false };
    const html = renderToString(<StepNav current="modules" progress={progress} />);
    expect(html).toContain('✓');
    expect(html).toContain('Needs at least one part');
    expect(stepState('board', 'modules', progress)).toBe('done');
    expect(stepNeeds('results', { board: false, modules: 2, rules: false })).toMatch(/board/);
    expect(stepNeeds('results', { board: true, modules: 1, rules: false })).toBeNull();
  });

  it('footer says what is missing', () => {
    expect(footerSpec('board', { board: false, modules: 0 }).missing).toBe(
      'Pick a board to continue.',
    );
    expect(footerSpec('board', { board: true, modules: 0 }).missing).toBeNull();
    expect(footerSpec('modules', { board: true, modules: 0 }).missing).toMatch(/at least one part/);
    expect(footerSpec('constraints', { board: true, modules: 1 }).missing).toBeNull();
  });
});

describe('Citations', () => {
  it('links a claim to its evidence URL and shows unknown ids', () => {
    const cite = citationIndex([
      {
        id: 'doc',
        title: 'Doc title',
        publisher: 'P',
        doc_number: null,
        revision: '1.0',
        revision_date: null,
        url: 'https://example.com/doc.pdf',
        url_original: null,
        accessed: '2026-01-01',
        sha256: null,
        kind: 'datasheet',
        secondary: false,
        manual: false,
        claims: [{ id: 'doc#a', locator: 'Table 1', quote: 'quoted words', supports: 's' }],
      },
    ]);
    const html = renderToString(<Citations ids={['doc#a', 'missing#b']} cite={cite} />);
    expect(html).toContain('href="https://example.com/doc.pdf"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Doc title, rev. 1.0');
    expect(html).toContain('Table 1');
    expect(html).toContain('Source record not found');
  });
});

describe('CatalogStatus', () => {
  it('shows the manifest version and counts', () => {
    const html = renderToString(
      <CatalogStatus
        state={{
          status: 'ready',
          manifest: {
            version: '2026.10.22-1',
            date: '2026-10-22',
            sha256: 'ab',
            counts: { boards: 3 },
          },
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
