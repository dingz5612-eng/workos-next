# Next Runtime Hardening

This document records the remaining architecture gaps and the mandatory direction for future slices.

## Current Gaps

- Business fields are still mostly projection-level fields. Room, bed, deposit, finance confirmation, repair station, technician, and vehicle need real aggregate roots and database tables.
- Frontend rendering has started to split, but `main.js` is still the composition shell. New API, operation runtime, coach, and workspace behavior must live in focused modules.
- Bilingual local terminology is still partly hard-coded in the PWA. Future terms must come from the projection/i18n contract.
- C# DTO records and JavaScript projections can drift unless every shape is validated against a shared schema and OpenAPI contract.

## Required Business Slices

Every new slice must be implemented as a production slice:

- `Accommodation.ResourceSetup`
- `Accommodation.CheckIn`
- `Accommodation.CheckOut`
- `Finance.DepositException`
- `Repair.Dispatch`
- `Repair.Close`

Each slice owns:

- Commands
- Policies
- Events
- Projector rules
- Tests
- Aggregate persistence tables when the slice creates or mutates real business objects

## Contract Direction

Projection shape must converge on:

- `docs/contracts/projection-contract.schema.json`
- `docs/contracts/workos-runtime.openapi.json`
- Generated TypeScript types
- C# DTO validation

The PWA must consume projection contracts and runtime APIs. It must not invent local page-only DTOs for business behavior.

## Priority Rules

P0:

- Restrict CORS by configuration.
- Separate dev and production configuration.
- Authenticate users with backend-issued sessions and password verification.
- Keep `main.js` as a composition shell and move API, operation, workspace, and coach logic into modules.

P1:

- Keep confirmation policy outside `ProjectionRuntime`.
- Keep migrations in `infra/db/migrations/*.sql`.
- Add OpenAPI and projection JSON Schema before expanding more cards.
- Promote projection fields into real aggregate roots when a business object becomes writable.

## Slice Gate

A slice is not complete until:

- It has at least one command, one policy, one audit event, one projector rule, and one automated test.
- Its write path is idempotent.
- Its actor identity comes from session token.
- Its database changes are in migration files.
- Its projection response validates against the shared schema.
