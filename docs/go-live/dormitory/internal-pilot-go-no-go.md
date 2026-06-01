# Dormitory Internal Pilot Go/No-Go

- status: GO_FOR_INTERNAL_PILOT
- internalPilotAllowed: true
- productionAllowed: false
- dormitoryStatus: L1 Internal Pilot
- dormitoryL2ProductionAllowed: false
- Repair / Parts / HR: L0 Contract Preview

## Owners
- 内测负责人: Dormitory Operations Owner
- 技术负责人: Runtime Owner
- 财务负责人: finance
- 运营负责人: Dormitory Operations Owner
- 值守负责人: Support Owner
- Release owner: releaseOwner

## 中文结论
宿舍可以进入 L1 Internal Pilot 内测观察窗口；宿舍不允许 L2 Production；Repair / Parts / HR 不允许 production。

## Evidence Refs
- docs/go-live/dormitory/internal-pilot-scope.yml
- artifacts/go-live/dormitory/pilot-scope-result.json
- docs/go-live/dormitory/master-data.yml
- artifacts/go-live/dormitory/master-data-readiness.json
- artifacts/go-live/dormitory/b-stage-gate-result.json
- artifacts/go-live/dormitory/evidence-policy-result.json
- artifacts/go-live/dormitory/finance-daily-close-result.json
- artifacts/go-live/dormitory/runtime-surface-alignment-result.json
- artifacts/go-live/dormitory/internal-pilot-run-result.json
- artifacts/go-live/dormitory/rollback-drill-result.json
- artifacts/go-live/dormitory/training-signoff-result.json
- artifacts/rt4/evidence-graph.json
- docs/business/business-line-registry.json
- docs/business/experience-contract.yml
- apps/mobile/src/__tests__/DormitoryWorkItemNativePilot.test.js
- artifacts/go-live/dormitory/dorm-int-experience-contract-report.json

## No-Go Items
- none

## Observation Window
- observationDuration: 7 days
- dailyReviewTime: 18:00 Asia/Shanghai
- P0 stop conditions:
  - money mismatch red
  - duplicate ledger entry
  - bed double occupancy
  - evidence leak
  - unable to rollback
  - Finance Daily Close failed
  - BStageGate red
  - P0 invariant failed
- P1 hold conditions:
  - projection lag > threshold
  - evidence upload failure > threshold
  - 422 blocked rate abnormal
  - finance case backlog > threshold
  - SLA overdue > threshold
- L1 to L2 upgrade criteria:
  - 7 days no P0
  - SLA >= target
  - finance daily close 100%
  - evidence missing rate below threshold
  - users trained and signed
  - BStageGate remains green
  - no Red ShadowCompareReport
  - no unresolved P0 invariant
