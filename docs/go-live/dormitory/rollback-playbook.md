# Dormitory Internal Pilot Rollback Playbook

## Boundary

Rollback is an L1 Internal Pilot safety action. It does not delete business facts, ledger entries, evidence objects, command submissions, or rejection traces.

## Supported Actions

1. `pause_dormitory_pilot`: set the pilot hold reason and stop new confirm attempts.
2. `disable_money_confirm`: block deposit receive, ordinary payment confirm, and money correction commands.
3. `disable_refund_approve`: block refund approval and refund payment commands.
4. `switch_slice_to_adapter_primary`: route new reads through the adapter-primary path while preserving official facts.
5. `freeze_high_risk_workitem_types`: freeze WorkItem types that can affect bed occupancy, money, evidence, or cutover state.
6. `append_compensation`: add a compensation instruction instead of mutating old ledger entries.
7. `create_corrective_workitem`: create a tracked WorkItem for the owner and SLA.

## Invariants

- Domain events are append-only.
- Ledger entries are append-only.
- Compensation is append-only.
- Release Control must show the hold reason.
- Mobile users must see `业务暂停/请联系经理`.
- Repair, Parts, and HR remain `L0 Contract Preview`.
