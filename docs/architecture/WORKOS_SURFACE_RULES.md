# WorkOS Runtime Surface Rules

Runtime surfaces are the user-facing entry points that expose the same runtime
projection, queue, search, Lens, and learning catalog. They must not fork into
separate demo or page-specific source models.

## Runtime Surfaces

The following mobile views are runtime surfaces:

- Home
- Workbench
- Search
- Learning
- Workspace
- Me

All runtime surfaces must consume the same runtime projection and Lens source.
After a slice is added or upgraded, it must appear consistently across surfaces
or declare an explicit hidden/no-queue reason.

## Source Rules

1. Home must not hardcode business workspace IDs.
2. Workbench must not use `demoQueue` as the online default source.
3. `demoQueue` is allowed only as an offline, development, or test fallback and
   must be visibly marked as such.
4. Queue items must carry `workspaceId` and `cardId` directly. The frontend must
   not infer `workspaceId` from task IDs.
5. Search fallback must not point to deprecated workspace IDs.
6. Learning may generate coaching copy locally, but its catalog source must be
   runtime workspaces or a learning Lens.
7. Workspace open actions must use runtime `workspaceId` and may preselect a
   runtime `cardId`.
8. Me / personal stats must be derived from runtime queue, blockers, searches,
   behavior events, or shown as unavailable. Demo values are not online stats.

## RuntimeSurfacePolicy

Each production slice must have surface visibility derived from runtime metadata
or explicit policy. The minimal policy shape is:

```json
{
  "domainGroup": "Accommodation",
  "home": {
    "visible": true,
    "priority": 90,
    "section": "accommodation-operations"
  },
  "workbench": {
    "visible": true,
    "queueRule": "ready_or_blocked_cards"
  },
  "search": {
    "visible": true,
    "keywords": ["deposit", "押金", "депозит"]
  },
  "learning": {
    "visible": true
  },
  "lenses": ["deposit-liability"]
}
```

If explicit policy is absent, the first implementation may derive defaults from
workspace domain, title, cards, current card status, and known Lens catalog.

## Slice Admission

New production slices must satisfy surface coverage:

- Home visible or explicit hidden reason.
- Workbench visible or explicit no-queue reason.
- Search visible.
- Learning visible.
- Workspace openable.

These checks must be automated through frontend tests and architecture guard
rules. Manual insertion of a few workspace IDs is not acceptable coverage.

