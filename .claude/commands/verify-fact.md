---
description: Re-verify one catalog fact (or all facts of one entity) against its authentic sources.
argument-hint: <fact path or entity id>
---

Use `hardware-fact-auditor` in blind mode on `$ARGUMENTS`: give it only the entity/fact path and the
evidence ids, let it re-derive from the sources, then compare with the catalog value. Report match /
mismatch / could-not-verify with citations. If mismatched, propose the catalog change (do not apply it
without the user's OK) and the fixtures it affects.
