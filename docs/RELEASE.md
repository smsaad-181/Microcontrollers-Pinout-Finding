# Release v1.0.0: checklist for the owner

## Known gaps (not blocking)

- The DOIT 30/36-pin boards have no pin map ("datasheet required"). ESP32-S3-Mini is not in the catalog (no official source found).
- No board is *fully verified* yet: 20 are partially verified. The Waveshare ESP32-S3-Pico VBUS "5 V" fact is marked verified but the cited image only labels the pin VBUS; re-check it.
- NodeMCU-32S and LOLIN32 rest on secondary copies of the schematic. The two `wiki.wemos.cc` links
  (evidence `lolin32-sch-v1.0.0`, `lolin32-wiki`) are dead; the facts keep their file hashes and need
  a new URL or archive copy.
- DHT11 facts are `interim` until the Aosong datasheet is added (see `sources/manual/README.md`).
- Product photos are shop images used with credit; replace with your own or openly licensed photos
  if you want a clean licence story.
- Minor items: `docs/validation/phase-2b/phase-validator.md` and `phase-3/phase-validator.md`.

## Steps

1. Run `docs/validation/phase-5/bench-procedure.md` and fill `bench.md`.
2. Merge the `phase-5` branch into `main` and push.
3. GitHub: Settings -> Pages -> Source: GitHub Actions. Branch protection for `main`: require status
   checks and Code Owners review.
4. In `.github/workflows/deploy.yml` replace `workflow_dispatch: {}` under `on:` with
   `push: { branches: [main] }` plus `workflow_dispatch: {}`, commit and push.
5. Check the live site: pick a board, add modules, get a result, open a share link in a private window.
6. Tag: `git tag -a v1.0.0 -m "v1.0.0" && git push origin v1.0.0`, then create the GitHub release from
   `CHANGELOG.md`.

## Frozen catalog and old share links

The catalog is published as `apps/web/public/catalog/<hash>.json`; a share link pins the hash it was
made with. When the catalog changes, keep the old hash files in the deployed site (do not clear
`public/catalog/` on deploy) so old links still open the catalog they were made with.
