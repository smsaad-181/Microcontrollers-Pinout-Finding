import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App placeholder', () => {
  it('renders the product name', () => {
    expect(renderToString(<App />)).toContain('Pinout Finder');
  });
});
