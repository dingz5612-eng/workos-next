# Operations CommandSubmission 上下文迁移计划

状态：P1 风险，合同与迁移计划已建立，尚不得声明 production-ready。

Phase 5 当前落点：

- `CanonicalOperationsApiService` 在进入 `OperationsUnitOfWork` 前解析 Definition 与 Admission。
- `CommandEnvelope.v1.payload` 携带 `actorId`、`actorRole`、`actorTenantId`、`authSource`、`deviceId`、`deviceTrustStatus`、`surface`、`reason`、`admissionDecisionRef`。
- `OperationsUnitOfWork` 继续作为唯一主写路径，不扩展 `ProjectionRuntime.Confirm`。

后续迁移顺序：

1. 运行 `infra/db/migrations/034_operations_command_submission_context.sql` 添加 nullable columns。
2. 从历史 `envelope.payload` 回填上下文字段。
3. 接入 `RuntimeDeviceSessionStorage` 产出的可信设备状态。
4. 通过 production readiness gates 后，再收紧 not-null 与 check constraint。

No-Go：

- 在上下文字段没有独立持久化和验证前，不允许把 CommandSubmission 声称为 production-ready。
- 在设备可信状态仍是 `provided_unverified` 时，不允许 high-risk production confirm。
