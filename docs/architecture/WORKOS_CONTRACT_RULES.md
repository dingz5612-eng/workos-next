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
