// Content-Security-Policy for the static site. GitHub Pages cannot send headers, so this is emitted
// as <meta http-equiv="Content-Security-Policy"> by the build-only plugin in vite.config.ts.
// `frame-ancestors` is ignored in a meta tag, so it is omitted.
/** The Content-Security-Policy string inserted as a meta tag into the built page. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');
