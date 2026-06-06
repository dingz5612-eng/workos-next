# OAM Business Operating Input Audit

## Scope

The external project control, design, and truth ownership matrix documents are treated as design input only. They do not create a second rule authority and do not add production capability by themselves.

## Accepted Into Current OAM

- Shared governance owns Subject, Vehicle, SubjectRelationship, SubjectVehicleRelationship, shared receipts, and profile read models.
- Accommodation owns dormitory Room, Bed, AccommodationOrder, stay lifecycle, checkout, and service task business objects under admitted Operations Confirm.
- Finance Gate and Money Kernel own AmountBasis review, FinancialFact, LedgerTransaction, and LedgerEntry; business domains cannot directly commit finance truth.
- EvidenceObject is an evidence trust object; OCR output is suggestion-only and must be explicitly adopted before any business field write.
- DashboardSummary, Profile, Search, BI, and Lens are read-side objects, not fact sources.
- Management Cockpit provides overview, routing, decision context, and ControlPlaneCommand trace only.

## Not Admitted

- No business production opening.
- No production confirm.
- No page-specific business write API.
- No lead reservation creation of formal stay facts.
- No management cockpit direct business or finance write.
- No shared receipt replacing AdmissionDecision or finance truth.
- No unowned business lines, future placeholders, empty service shells, or template-only packages.

## Current Stage 6 Changes

- Business operating objects are now declared in `docs/business/truth-owner-registry.yml`.
- Business line admission now removes empty unowned business-line entries.
- Generic domain template files are removed; only current executable contracts and concrete domain packs remain.
- Dormitory domain pack now separates owned accommodation facts from requested finance, evidence, shared governance, and read-side objects.
