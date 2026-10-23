// Claim-id lookup for citations: `<doc-id>#<slug>` -> the evidence record and the quoted claim.
import type { Evidence } from '@pinout/schema';

/** Everything the UI shows for one cited claim. */
export interface Citation {
  claimId: string;
  /** False when the claim id is not in the catalog (shown as "not found", never hidden). */
  found: boolean;
  title: string;
  publisher: string;
  revision: string | null;
  url: string | null;
  locator: string;
  quote: string;
  secondary: boolean;
  accessed: string | null;
}

export type CitationLookup = (claimId: string) => Citation;

/** Only http(s) links are ever rendered (the schema already enforces this; defence in depth). */
export const isWebUrl = (u: string): boolean => /^https?:\/\//.test(u);

/** Builds a lookup over all claims of all evidence records. */
export function citationIndex(evidence: readonly Evidence[]): CitationLookup {
  const byClaim = new Map<string, Citation>();
  for (const doc of evidence) {
    for (const claim of doc.claims) {
      byClaim.set(claim.id, {
        claimId: claim.id,
        found: true,
        title: doc.title,
        publisher: doc.publisher,
        revision: doc.revision,
        url: isWebUrl(doc.url) ? doc.url : null,
        locator: claim.locator,
        quote: claim.quote,
        secondary: doc.secondary,
        accessed: doc.accessed,
      });
    }
  }
  return (claimId) =>
    byClaim.get(claimId) ?? {
      claimId,
      found: false,
      title: claimId.split('#')[0] ?? claimId,
      publisher: '',
      revision: null,
      url: null,
      locator: '',
      quote: '',
      secondary: false,
      accessed: null,
    };
}
