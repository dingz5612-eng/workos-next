# 宿舍操作手册

> 派生自 docs/business/domains/dormitory/dormitory-operating-kernel.json，不得作为第二权威。

## 两个角色

- 宿舍经办人：录入、办理、补证、执行。
- 宿舍负责人：审批、财务确认、纠错、周期复盘、例外放行。

## 操作原则

系统自动带入上游已确认字段并锁定；当前环节只补缺失字段、证据和原因。金额事实只由 finance-gate / Money Kernel 生成。周期复盘只读业务事实、财务事实、证据事实和 Lens 快照，只生成行动计划或异常处理。

## 当前 WorkItem

- Dorm.RoomSetupConfirm：房间建档确认，宿舍经办人，无账务影响
- Dorm.BedSetupConfirm：床位建档确认，宿舍经办人，无账务影响
- Dorm.RatePlanConfirm：价格方案确认，宿舍负责人，无账务影响
- Dorm.ResourceReadinessConfirm：资源可售确认，宿舍经办人，无账务影响
- Dorm.OperationResourceSelect：选择已基础就绪房源，宿舍经办人，无账务影响
- Dorm.OperationInspectionConfirm：运营检查确认，宿舍经办人，无账务影响
- Dorm.OperationStatusDraft：运营状态草稿，宿舍经办人，无账务影响
- Dorm.OperationStatusChangeConfirm：运营状态变更确认，宿舍经办人，无账务影响
- Dorm.OperationBlockerUpdate：日常状态维护，宿舍经办人，无账务影响
- Dorm.OperationRestoreConfirm：恢复运营确认，宿舍经办人，无账务影响
- Dorm.LeadCapture：线索录入，宿舍经办人，无账务影响
- Dorm.ReservationConfirm：预订确认，宿舍负责人，无账务影响
- Dorm.CheckinConfirm：入住确认，宿舍经办人，无账务影响
- Dorm.PaymentConfirm：普通收款确认，宿舍负责人，通过 finance-gate 生成平衡普通收款分配
- Dorm.DepositConfirm：押金确认，宿舍负责人，通过 finance-gate 生成押金负债或结算账务；押金不是收入
- Dorm.ServiceTaskCreate：服务任务创建，宿舍经办人，无账务影响
- Dorm.ServiceTaskAssign：服务任务派工，宿舍负责人，无账务影响
- Dorm.ServiceTaskComplete：服务任务完成，宿舍经办人，无账务影响
- Dorm.ServiceTaskVerify：服务任务验收，宿舍负责人，无账务影响
- Finance.ExpenseRecord：支出凭证登记，宿舍经办人，支出必须有依据和审批，通过 finance-gate 进入成本统计
- Finance.ExpenseApprove：支出审批，宿舍负责人，支出必须有依据和审批，通过 finance-gate 进入成本统计
- Finance.ExpenseLink：支出关联，宿舍负责人，支出必须有依据和审批，通过 finance-gate 进入成本统计
- Dorm.RoomInspectionConfirm：退住验房确认，宿舍经办人，无账务影响
- Dorm.CheckoutSettlementApprove：退住结算审批，宿舍负责人，通过 finance-gate 形成追加式账务事实
- Dorm.StayExtendApprove：续住审批，宿舍负责人，无账务影响
- Dorm.BedTransferApprove：换床审批，宿舍负责人，无账务影响
- Dorm.ReservationCancelClose：预订取消关闭，宿舍经办人，无账务影响
- Dorm.ReservationNoShowClose：预订未到关闭，宿舍经办人，无账务影响
- Finance.ChargeAdjustmentApprove：费用调整审批，宿舍负责人，通过 finance-gate 形成追加式账务事实
- Finance.DebtFollowUp：欠费跟进，宿舍经办人，无账务影响
- Dorm.AccessCredentialIssue：门禁凭证发放，宿舍经办人，无账务影响
- Dorm.AccessCredentialRevoke：门禁凭证回收，宿舍经办人，无账务影响
- Dorm.IncidentRecord：事件记录，宿舍经办人，无账务影响
- Dorm.PeriodReview：周期复盘，宿舍负责人，只读业务事实、财务事实、证据事实和 Lens，不写账
- Dorm.PeriodActionPlanExecute：周期行动计划执行，宿舍经办人，无账务影响
- Dorm.ExceptionResolve：异常处理，宿舍负责人，无账务影响
- Finance.CorrectionApply：财务纠错申请，宿舍负责人，通过 finance-gate 生成追加纠错或反转，不原地修改旧分录
