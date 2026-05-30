## Summary

-

## Rule Authority

- [ ] 已阅读 `docs/engineering/00-rule-authority.md`。
- [ ] 本 PR 符合 V5.5 batch dependency，没有越过未完成的前置批次。
- [ ] WON-18 当前 CI 与 V5.4 Control Plane Guards 为 green，或本 PR 只修复 gate 阻塞。
- [ ] 新设计沿 Operations Runtime axis：Definition -> OperationCase -> WorkItem -> CommandSubmission -> SliceCommandHandler -> DomainEvent / LedgerEntry -> Projection / Lens。
- [ ] 未把 Workspace/Card prepare 或 confirm 作为新业务扩展主路径。

## API Boundary

- [ ] 是否新增业务写 API？
- [ ] 是否仍走 Operations Confirm？
- [ ] 如果触碰 Workspace/Card prepare 或 confirm，是否只作为 compatibility layer？
- [ ] Mobile BFF 是否写业务事实？如果是，这是 P0 No-Go。
- [ ] 是否新增 page-specific business write API？如果是，这是 P0 No-Go。

## Control Plane / Shadow

- [ ] 是否影响 Control Plane？
- [ ] 是否影响 Shadow Namespace？
- [ ] 是否新增 GateResult / InvariantCheck？
- [ ] GateResult 是否机器生成？
- [ ] 是否有 rollback 或 compensating instruction？
- [ ] 是否有 No-Go evidence mapping？

## Validation

- [ ] `node scripts/check-api-boundaries.mjs --self-test`
- [ ] `node scripts/check-api-boundaries.mjs`
- [ ] Relevant backend/frontend tests
- [ ] Relevant migration or runtime contract tests
