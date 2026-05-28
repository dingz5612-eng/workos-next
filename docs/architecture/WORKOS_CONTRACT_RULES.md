# WorkOS Contract Rules

Projection and API shape are executable contracts.

## Required Contract Files

```text
docs/contracts/projection-contract.schema.json
docs/contracts/workos-runtime.openapi.json
```

CI must verify that these files exist and are parseable.

Runtime contract tests must verify:

- Projection envelope has `projection`, `version`, `languages`, `sourceOfTruth`, `workspaces`, and `events`.
- Every workspace card has fields, evidence, checks, events, transitions, and confirmation policy.
- Confirm OpenAPI requires `X-WorkOS-Actor-Token`.
- Confirm request requires `language`, `idempotencyKey`, `fieldValues`, and `evidenceIds`.

## Drift Prevention

- Minimal API endpoint changes must update OpenAPI in the same commit.
- Projection DTO changes must update schema in the same commit.
- Frontend type generation should be added before expanding large workflows.
- C# DTO validation should be added before exposing production clients.

## Bilingual Contract

Product-facing labels must include Chinese and Russian.

Local hard-coded term dictionaries are temporary bridges only. New terminology should come from projection/i18n contracts.

## Generated Client Direction

Contracts must gradually replace hand-maintained DTOs and wording maps.

Before adding more large production slices, add or preserve a path for:

- OpenAPI-based frontend API client generation.
- Projection schema validation in runtime contract tests.
- TypeScript projection DTO generation.
- C# DTO validation against the projection contract.
- i18n term generation from projection/field metadata.

The frontend must not keep inventing local names for backend fields, events,
policies, or blockers when those names can be part of the contract.
