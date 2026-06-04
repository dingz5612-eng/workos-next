# Rule Authority Readme

Generated: 2026-06-04T11:02:26.491Z

Highest authority: docs/engineering/00-rule-authority.md. New work follows Definition -> OperationCase -> WorkItem -> CommandSubmission -> SliceCommandHandler -> DomainEvent / LedgerEntry -> ProcessManager -> Projection / Lens -> Mobile / PC Surface.

Current blocked state: Business Production = BLOCKED; Dormitory = L1_INTERNAL_PILOT_OBSERVATION; Dormitory L2 = BLOCKED; production_confirm = BLOCKED; Repair / Parts / HR / business-3..7 = L0 Contract Preview.

Allowed in this audit: current visible in-app Browser login, clicks, searches, route navigation, submissions that are allowed by L1 Internal Pilot, screenshots, trace, contract/gate checks, and root-cause repairs inside current OAM-CAB scope.

Forbidden: Business Production, Dormitory L2, production_confirm, page-specific business write APIs, Mobile BFF business fact writes, PC Governance direct business fact writes, ProjectionRuntime / WorkspaceCard compatibility expansion, manual GateResult, manual passed evidence, localStorage injection, DB writes to fabricate success, mocks or background browser runs as primary evidence.

Compatibility boundary: Workspace/Card prepare/confirm and ProjectionRuntime are compatibility wrappers only; Search legacy adapter remains quarantine; normal mobile runtime path must use Operations WorkItem and Operations confirm for business facts.
