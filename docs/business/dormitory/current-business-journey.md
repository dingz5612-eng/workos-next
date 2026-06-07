# 宿舍当前业务旅程

本文是宿舍业务的人读入口，只解释当前 OAM 已生效的业务主线。机器权威仍以 `docs/scenarios/dormitory/golden-pilot.yml`、`docs/business/dormitory/value-streams.yml`、`docs/business/dormitory/workitem-catalog.yml`、`docs/business/dormitory/scenario-field-contract.yml`、`docs/business/dormitory/evidence-coverage-contract.yml` 和 `docs/business/dormitory/ledger-posting-contract.yml` 为准。

## 权威边界

- 宿舍业务只处于当前 L1 pilot，`productionAllowed` 必须保持 `false`。
- 业务写入只走 Operations Confirm 和 Unit of Work，不允许页面、Search、Projection、Lens、PC 治理面直接写业务事实。
- 财务金额、押金、收款、退款、纠错只走 Finance Truth / Money Kernel / Ledger 追加路径。
- 证据、权限、设备信任、幂等、拒绝轨迹必须能追溯到 WorkItem 和 CommandSubmission。

## 主线一：资源可售可信度

目标是让房间和床位可以被可信销售，而不是提前释放或凭页面状态释放。

流程：资源建档 -> 房态检查 -> 床位可售确认 -> 服务任务创建 -> 服务任务完成 -> 验收后恢复可售。

当前对象：`Room`、`Bed`、`RoomReadiness`、`ServiceTask`、`BedStatus`。

关键字段：`roomId`、`roomNo`、`bedId`、`bedLabels`、`readinessState`、`blockReason`、`serviceTaskId`、`resourceScope`。

闭环条件：所有床位有责任人；阻断床位必须有清洁、维修或验收证据；没有验收证据不得恢复可售。

## 主线二：线索到入住

目标是把线索、预订、入住交接和床位分配串成一条可追溯链，不让线索直接变成正式入住事实。

流程：线索跟进 -> 预订确认 -> 入住准备 -> 入住确认 -> 床位分配确认。

当前对象：`Lead`、`Reservation`、`CheckinHandoff`、`Stay`、`BedAssignment`、`Subject`。

关键字段：`leadId`、`reservationId`、`residentSubjectRef`、`stayId`、`roomId`、`bedId`、`identity-document`、`reservation-acknowledgement`、`bed-availability-proof`。

闭环条件：预订必须绑定容量；入住必须有身份和预订/床位证据；正式 `stayId` 只能由当前确认链产生。

## 主线三：在住收入

目标是让普通收款只进入普通收款和余额分配，不混入押金负债。

流程：费用生成 -> 收款登记 -> 收款确认 -> 余额投影更新。

当前对象：`Charge`、`Payment`、`PaymentAllocation`、`StayBalance`、`LedgerTransaction`。

关键字段：`stayId`、`paymentId`、`payerSubjectRef`、`receivedAmount`、`paymentMethod`、`allocationMode`、`allocatedAmount`、`payment-receipt`、`cashier-review`。

闭环条件：收款确认必须生成平衡账务交易；普通收款不得写入押金 liability；重复提交不得产生重复账务副作用。

## 主线四：押金负债

目标是把押金作为负债管理，避免被当成收入或退款被当成支出。

流程：押金评估 -> 押金收取 -> 押金确认 -> 押金扣减 -> 退款审批。

当前对象：`DepositAccount`、`DepositReceipt`、`DepositEntry`、`Refund`、`Deduction`、`LedgerTransaction`。

关键字段：`depositAccountId`、`depositReceiptId`、`requiredDepositAmount`、`refundAmount`、`amount`、`currency`、`deposit-policy`、`receipt-proof`、`refund-approval`。

闭环条件：押金确认只增加 liability；退款不得超过可退余额；扣减和退款只能追加 ledger 交易，不能更新或删除旧分录。

## 主线五：退住周转

目标是完成退住、验房、结算、扣退、清洁和恢复可售，防止未验房先释放或伪造结算金额事实。

流程：退住请求 -> 退房验房 -> 退住结算 -> 押金扣减/退款审批 -> 清洁验收 -> 资源释放。

当前对象：`CheckoutCase`、`Inspection`、`Settlement`、`CleaningTask`、`ResourceRelease`、`DepositAccount`。

关键字段：`checkoutId`、`inspectionId`、`finalBalanceAmount`、`depositAccountId`、`availableLiability`、`room-inspection`、`settlement-review`、`cleaning-checklist`。

闭环条件：必须先有验房证据；结算读取账本投影但不把页面金额当事实；清洁验收完成后才可恢复可售。

## 横切闭环

财务纠错：银行导入、匹配、差异和纠错只允许进入 Finance Case 或 Unclear Money Case，再由 `Finance.CorrectionApply` 追加 reversal 或 compensation。

周期复盘：`Dorm.PeriodReview` 只读账务和投影，形成行动计划、owner、SLA 和复盘结论，不替代生产准入。

异常拒绝：权限拒绝、幂等冲突、缺证据阻断必须产生拒绝轨迹和审计证据，不得写 DomainEvent 或 LedgerTransaction。

## 当前验收入口

- 业务场景：`docs/scenarios/dormitory/golden-pilot.yml`
- 业务旅程：`docs/business/dormitory/value-streams.yml`
- 工作项目录：`docs/business/dormitory/workitem-catalog.yml`
- 字段合同：`docs/business/dormitory/scenario-field-contract.yml`
- 场景映射：`docs/business/dormitory/canonical-scenario-map.json`
- 证据合同：`docs/business/dormitory/evidence-coverage-contract.yml`
- 账务合同：`docs/business/dormitory/ledger-posting-contract.yml`
- 领域包：`docs/business/domains/dormitory/domain-pack.yml`
- 总门禁：`scripts/oam/run-control-plane-checks.ps1`
