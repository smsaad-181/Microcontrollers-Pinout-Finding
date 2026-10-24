# Where the facts come from

Every number the engine uses is a **fact**: `{ value, unit, evidence[], status }`. Nothing is typed
into the engine itself.

## Evidence records

`catalog/evidence/<id>.yaml` describes one source document: title, publisher, revision, URL, access
date, SHA-256 of the downloaded file, and a list of **claims**, each with a locator (page, table) and a
short verbatim quote. A fact points at claims by id (`doc-id#claim-id`).

## Statuses

| Status | Meaning | Engine behaviour |
| --- | --- | --- |
| verified | Two independent reviewers checked it against the source | used |
| single-source | One source, one reviewer | used, flagged |
| interim | Taken from a related or secondary source | used, flagged |
| conflict | Sources disagree | the most restrictive value is used, flagged |
| community | Forum or experiment, no official source | shown, not trusted |
| missing | Not found in any source we could open | never guessed; result says so |

Board status: *fully verified* (every fact the engine reads is verified), *partially verified* (some
facts missing or interim), *datasheet required* (no pin map: the app returns "datasheet required").

## Two keys

A fact becomes `verified` only after a second reviewer who has not seen the first reviewer's answer
re-reads the source. In v1.0 the two keys are a research pass and a blind audit pass (both AI-assisted
with the sources open); a human maintainer is the third check at review time (see CONTRIBUTING).
The audits caught real mistakes in drafted board data, which is why the rule stays.

## Keeping sources alive

`pnpm check:links` (weekly in CI, `links.yml`) re-checks every evidence URL. Dead links open an issue
labelled `evidence-links`. A dead link does not invalidate a fact (the record keeps the file hash and
quotes) but the source needs a new URL or an archive copy.

## What we do not store

Datasheet PDFs and vendor images are never committed. Hand-downloaded files live in
`sources/manual/` (git-ignored); see its README for the list of documents we could not fetch.
