# PR Contract Rules

The pull request template is a machine-enforced contract, not an optional
review aid. `scripts/check-pr-contract.mjs` validates pull request bodies during
`pull_request` CI runs and fails the build when required governance fields are
left as placeholders.

## Required Fields

Every pull request must fill these sections:

- `Summary`
- `MR Contract`
- `Fact Ownership`
- `API Boundary`
- `Idempotency`
- `Evidence`
- `Ledger`
- `Process / Blocker`
- `Projection / Lens`
- `Mobile`
- `PC`
- `Migration / Release`
- `Tests`
- `No-Go`

The `MR Contract` section must provide `MR`, `Slice`, `Runtime Layer`, `Owner`,
`Contract file`, `GateResult required`, and `Rollback / compensation
instruction`.

The `Tests` section must provide backend, frontend, and migration/runtime test
coverage. `N/A` is allowed only with a reason, for example
`N/A - no frontend files changed`.

The `No-Go` section must provide `P0 risks`, `P1 risks`, and `P2 risks`, and the
statement `No P0 blocker is hidden, skipped, renamed, or downgraded` must be
checked.

## Changed File Checks

The checker also consumes changed files:

- `apps/mobile/**` requires `Relevant frontend tests`.
- `infra/db/migrations/**` requires migration or runtime contract tests.
- API route, OpenAPI, or generated runtime path changes require the
  `API Boundary` checklist to be checked.
- Runtime, slice, migration, or fact ownership changes require the
  `Fact Ownership` checklist to be checked.

## Failure Policy

The check is a hard CI gate. It must not run with `continue-on-error`, must not
skip bot-created pull requests, and must not be replaced by the template alone.
