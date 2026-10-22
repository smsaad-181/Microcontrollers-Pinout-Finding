// Build-only Vite plugin that adds the Content-Security-Policy <meta> tag to index.html.
import type { Plugin } from 'vite';
import { CONTENT_SECURITY_POLICY } from './csp';

const CHARSET = /<meta charset="UTF-8"\s*\/?>/i;

/**
 * Inserts the CSP meta tag right after `<meta charset>`, before any script or stylesheet it governs.
 * Throws when the anchor is missing, so a changed index.html can never ship without the policy.
 */
export function injectCsp(html: string): string {
  if (!CHARSET.test(html)) throw new Error('index.html: <meta charset="UTF-8"> not found');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
  return html.replace(CHARSET, (m) => `${m}\n    ${meta}`);
}

/**
 * The CSP meta tag is injected only into the production build: the dev server relies on an inline
 * React Refresh preamble script and JS-injected <style> tags, which this policy (correctly) blocks.
 */
export function cspMeta(): Plugin {
  return {
    name: 'pinout-csp-meta',
    apply: 'build',
    transformIndexHtml: injectCsp,
  };
}
