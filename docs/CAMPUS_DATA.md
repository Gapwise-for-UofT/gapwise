# Campus data and documentation boundaries

Canonical public University of Toronto campus facts, geometry, provenance, and data-maintenance guidance live in [`GapwiseHQ/data`](https://github.com/GapwiseHQ/data). The compatibility snapshot and reviewed routing graph mirrored by this repository currently cover UTM.

Public human-readable data documentation lives at **https://docs.gapwise.ca/data/**. The currently published raw UTM distribution lives at **https://data.gapwise.ca/datasets/utm/latest/**.

This repository intentionally retains only:

- the validated runtime compatibility snapshot under `src/data/utm`;
- deterministic routing, gap-planning, map, API, and SDK behavior;
- consumer-side tests and integration contracts;
- the transitional data-maintenance adapters that are still coupled to core routing types.

Do not add new source-of-truth campus facts or public data documentation here. Change canonical campus facts in `GapwiseHQ/data`, run the consumer sync once, and change released public documentation in `docs`.

The runtime app does **not** fetch `data.gapwise.ca` or GitHub on student requests. The snapshot is pinned and tested at build time for reliability.

## Consumer sync

After a canonical data PR is merged, the consumer update is intentionally one command:

```bash
bun run campus-data:sync
```

This now mirrors both `src/data/utm` **and** `public/data/utm-campus-v1.json`. The corresponding check command verifies both surfaces:

```bash
bun run campus-data:check
```

Do not manually copy individual entrance, graph, audit, or public-snapshot files between repositories.
