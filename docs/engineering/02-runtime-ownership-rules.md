# Runtime Ownership Rules

Every business fact has one owning runtime slice. Other slices may read,
reference, request work, or create a WorkItem, but they must not directly write
another owner's facts.

## Core Rules

- Mobile BFF never writes business facts.
- PC Governance, Reconciliation, and Correction endpoints never use direct SQL
  to mutate business facts outside their classified governance or append-only
  correction paths.
- Process managers create WorkItems or CrossSliceRequest events; they do not
  directly write DepositEntry, BedStatus, LedgerEntry, or Payment facts.
- Corrections are append-only. Old ledger entries are not edited in place.
- Facts, allowed writers, forbidden writers, readers, requesters, invariants,
  correction paths, and projection owners are declared in
  `docs/rules/v5.5/fact-ownership.yml`.

## Enforcement

Run:

```powershell
node scripts/check-fact-ownership.mjs
```

The check is blocking for missing facts, missing owners, missing writer
contracts, and missing P0 invariants. Later source scanners must use this
registry as the rule source rather than embedding one-off ownership lists.
