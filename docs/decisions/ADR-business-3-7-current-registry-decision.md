# ADR: Business 3-7 Current Registry Decision

Status: Accepted for current OAM NO_GO closure.

The current registry does not use business-3, business-4, business-5, business-6, or business-7 as active maturity values. Those values are retired labels and may appear only in this decision record, the business-line level authority file, and the definition compatibility fence.

The active L1 machine value is `L1_INTERNAL_PILOT`. Its display text is localized in `docs/business/admission/business-line-levels.yml`.

`ResolveByWorkspaceCard` and `FindBySourceCardId` are compatibility-only read and migration helpers. They are not allowed in the confirm path, command identity, truth owner resolution, finance ledger source, or production admission decision.

This ADR does not open Business Production, Dormitory L2, or production confirm. The final state remains `NO_GO` and `nextStageAllowed=false`.
