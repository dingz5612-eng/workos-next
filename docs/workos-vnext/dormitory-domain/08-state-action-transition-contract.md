# 宿舍状态动作转移合同

## 设计锚点

本文件定义 `DormitoryStateActionTransition`，是宿舍经营域状态机和合法动作的硬合同。所有状态写入必须经 `VNextExecutionItem`/WorkItem 和提交确认；`legalActions` 只能渲染为按钮、菜单或流程动作，禁止作为用户表单字段。

本文件不修改当前 OAM Source Authority、generated、runtime、surface 或 tests。

## 通用字段

每条转移必须包含：

- `currentStatus`：当前稳定状态 value。
- `legalAction`：合法动作 value。
- `ownerRole`：责任角色。
- `requiredReadContext`：动作前必须展示的只读上下文。
- `requiredEvidence`：必需证据或可为空的原因。
- `editableInputs`：本动作真正可写的输入。
- `fixedSelections`：必须通过对象选择或权威选项集选择的内容。
- `financialContext`：金额、币种、收付方向、业务对象和财务承接状态。
- `nextStatus`：提交确认后的下一状态。
- `failureRoute`：不满足条件时去哪里补。
- `auditEvent`：审计事件 value。
- `languageKeys`：三语言标题、按钮、状态、错误、下一步 key。

## 全局禁止

- 页面不得从状态详情、搜索结果、报表或驾驶舱直接改状态。
- 未列入本文件的状态动作默认为禁止。
- 动作不得进入 `editableInputs`。
- 宿舍域不得把财务回执状态改写为自有财务事实。
- 缺少主体锚点、业务对象、金额币种、必需证据或目标资源时不得提交。

## 住宿申请转移

| currentStatus | legalAction | ownerRole | requiredEvidence | editableInputs | fixedSelections | nextStatus | failureRoute | auditEvent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `draft` | `submit_intake_for_resolution` | 一线经办人 | 来源摘要、初始诉求 | 住宿类型、预计入住日期、预计周期、人数 | 目标业务域、证据类型 | `awaiting_subject_resolution` | 回来源卡补诉求或证据 | `dormitory.application.intake_submitted` |
| `awaiting_subject_resolution` | `confirm_subject_binding` | 治理岗/一线经办人 | 主体候选、匹配依据 | 无 | 主体、联系人、员工关系摘要 | `awaiting_evidence` | 回共享治理处理重复或冲突 | `dormitory.application.subject_bound` |
| `awaiting_evidence` | `confirm_required_evidence` | 一线经办人 | 身份、申请、企业授权或内部审批 | 证据说明 | 证据类型、证据状态 | `ready_for_room_bed_selection` | 等待客户/员工/企业补证 | `dormitory.application.evidence_confirmed` |
| `ready_for_room_bed_selection` | `select_room_bed_candidate` | 一线经办人 | 可用房间床位摘要、价格快照 | 入住偏好说明 | 房间、床位、价格快照 | `submitted` | 进入资源处理办理项 | `dormitory.application.resource_selected` |
| `submitted` | `accept_application` | 主管/一线经办人 | 主体、证据、资源、金额依据摘要 | 受理备注 | 接受原因 | `accepted` | 回对应缺口办理项 | `dormitory.application.accepted` |
| `submitted` | `reject_application` | 主管 | 主体、证据、资源、风险摘要 | 拒绝说明 | 拒绝原因 | `rejected` | 回待补项或关闭 | `dormitory.application.rejected` |
| `accepted` | `convert_to_stay_order` | 一线经办人 | 住宿申请、房间床位、价格快照 | 无 | 住宿单类型 | `converted_to_stay_order` | 回申请修正 | `dormitory.application.converted_to_stay_order` |
| `blocked` | `resolve_application_blocker` | 责任域角色 | 阻断原因、责任域 | 补充说明 | 阻断处理结果 | 上一合法状态 | 回责任域继续处理 | `dormitory.application.blocker_resolved` |

## 住宿单转移

| currentStatus | legalAction | ownerRole | requiredEvidence | editableInputs | fixedSelections | financialContext | nextStatus | failureRoute | auditEvent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pending_confirmation` | `reserve_or_assign_bed` | 一线经办人 | 住宿申请、主体、可用床位 | 入住备注 | 房间、床位 | 价格快照只读 | `reserved_or_assigned` | 回资源候选 | `dormitory.stay_order.bed_assigned` |
| `reserved_or_assigned` | `request_finance_handoff` | 一线经办人 | 价格快照、押金/费用依据、证据 | 金额依据说明 | 币种、收付方向、金额阶段 | 金额依据待承接 | `awaiting_finance` | 回金额依据修正 | `dormitory.stay_order.finance_handoff_requested` |
| `awaiting_finance` | `consume_finance_receipt` | 财务人员/系统回执 | 财务结果摘要 | 无 | 财务承接结果 | 财务只读回执 | `ready_for_checkin` | 财务驳回则转修正 | `dormitory.stay_order.finance_receipt_consumed` |
| `ready_for_checkin` | `confirm_checkin` | 一线经办人 | 身份/协议、房间床位、财务摘要 | 交付备注、实际入住时间 | 钥匙/门禁/物品交付状态 | 财务摘要只读 | `in_stay` | 回身份、证据、财务或资源办理项 | `dormitory.stay_order.checked_in` |
| `in_stay` | `start_renewal` | 一线经办人 | 当前住宿、床位、余额/押金摘要 | 续住周期、续住说明 | 续住价格快照 | 续住费用依据 | `renewal_pending` | 回财务或资源评估 | `dormitory.stay_order.renewal_started` |
| `in_stay` | `start_room_bed_change` | 一线经办人/主管 | 当前住宿、目标资源候选 | 换房原因 | 目标房间、目标床位 | 差额依据 | `change_pending` | 回资源处理 | `dormitory.stay_order.change_started` |
| `in_stay` | `start_checkout` | 一线经办人 | 当前住宿、押金/余额摘要 | 预计退住时间、退住原因 | 退住类型 | 退住结算依据待生成 | `checkout_pending` | 回在住管理 | `dormitory.stay_order.checkout_started` |
| `reserved_or_assigned` | `start_reservation_cancel` | 一线经办人/主管 | 预订、主体、床位锁定、费用/押金摘要 | 取消原因 | 取消类型、责任归因 | 退款/扣减可能性 | `cancel_pending` | 回主体、证据或财务摘要补齐 | `dormitory.stay_order.cancel_started` |
| `reserved_or_assigned` | `mark_noshow` | 一线经办人/主管 | 预订、约定入住时间、联系记录 | 未到店说明 | 未到店类型、责任归因 | 退款/扣减可能性 | `noshow_pending` | 回联系记录或证据补齐 | `dormitory.stay_order.noshow_marked` |
| `renewal_pending` | `confirm_renewal` | 一线经办人/财务回执后 | 续住费用依据、财务摘要 | 无 | 续住确认结果 | 财务摘要只读 | `in_stay` | 回续住依据修正 | `dormitory.stay_order.renewed` |
| `change_pending` | `confirm_room_bed_change` | 一线经办人 | 原床位检查、目标床位、差额处理 | 交接备注 | 原床位处理结果、目标床位 | 财务摘要或无需财务原因 | `in_stay` | 回床位检查或财务承接 | `dormitory.stay_order.room_bed_changed` |
| `checkout_pending` | `submit_checkout_settlement` | 一线经办人 | 房间床位检查、损耗证据 | 检查说明 | 结算类型、责任归因 | 退款/扣减/应收依据 | `settlement_pending` | 回检查、维修或证据 | `dormitory.stay_order.checkout_settlement_submitted` |
| `cancel_pending` | `prepare_cancel_refund_basis` | 一线经办人 | 取消原因、已承接金额、押金摘要 | 退款/扣减说明 | 取消处理类型、退款/扣减类型 | 退款/扣减依据 | `refund_basis_ready` | 回取消证据或财务摘要补齐 | `dormitory.stay_order.cancel_refund_basis_prepared` |
| `noshow_pending` | `prepare_noshow_refund_basis` | 一线经办人 | 未到店记录、联系记录、已承接金额 | 未到店处理说明 | 未到店处理类型、退款/扣减类型 | 退款/扣减依据 | `refund_basis_ready` | 回联系记录或财务摘要补齐 | `dormitory.stay_order.noshow_refund_basis_prepared` |
| `refund_basis_ready` | `request_cancel_refund_handoff` | 一线经办人 | 退款/扣减依据、主体、业务对象、证据 | 财务备注 | 财务承接类型 | 退款/扣减依据待承接 | `awaiting_finance` | 回退款依据修正 | `dormitory.stay_order.cancel_refund_handoff_requested` |
| `refund_basis_ready` | `close_without_finance` | 主管 | 无需财务原因、床位释放规则 | 关闭备注 | 关闭原因、床位处理 | 无财务承接原因 | `cancel_closed` | 回主管或财务判断 | `dormitory.stay_order.cancel_closed_without_finance` |
| `settlement_pending` | `close_after_finance` | 财务人员/一线经办人 | 财务结果摘要、资源恢复状态 | 关闭备注 | 关闭原因 | 财务只读回执 | `closed` | 回财务或资源恢复 | `dormitory.stay_order.closed` |
| `cancel_closed` | `release_cancelled_bed` | 一线经办人/宿舍运营 | 取消关闭记录、床位锁定记录 | 释放备注 | 床位处理结果 | 无 | `closed` | 回床位检查或资源处理 | `dormitory.stay_order.cancel_bed_released` |
| `closed` | `start_correction` | 治理/审计岗/主管 | 原事实、修正原因、证据 | 修正说明 | 修正类型 | 财务影响声明 | `correction_pending` | 回权限或证据补充 | `dormitory.stay_order.correction_started` |

## 房间与床位转移

| object | currentStatus | legalAction | ownerRole | requiredEvidence | fixedSelections | nextStatus | failureRoute | auditEvent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 房间 | `draft` | `complete_room_basic_setup` | 宿舍运营 | 房间基础资料 | 楼栋、房型、可经营属性 | `ready_for_bed_setup` | 回房源建档 | `dormitory.room.basic_setup_completed` |
| 房间 | `ready_for_bed_setup` | `confirm_room_operational_ready` | 宿舍运营/主管 | 床位配置、检查记录 | 房间运营状态 | `operational_ready` | 回床位配置 | `dormitory.room.operational_ready` |
| 房间 | `operational_ready` | `mark_room_out_of_service` | 宿舍运营/主管 | 停售原因、风险说明 | 停售原因 | `out_of_service` | 回主管审批 | `dormitory.room.out_of_service_marked` |
| 房间 | `cleaning` | `confirm_room_cleaned` | 房务/宿舍运营 | 清洁完成摘要 | 检查结果 | `operational_ready` | 回清洁办理项 | `dormitory.room.cleaned` |
| 房间 | `maintenance` | `consume_maintenance_recovery` | 宿舍运营 | 维修域恢复摘要 | 宿舍检查结果 | `operational_ready` | 回维修域或宿舍检查 | `dormitory.room.maintenance_recovered` |
| 床位 | `draft` | `complete_bed_basic_setup` | 宿舍运营 | 房间基础资料、床位资料 | 床型、可经营属性 | `available` | 回床位建档 | `dormitory.bed.basic_setup_completed` |
| 床位 | `available` | `hold_bed` | 一线经办人 | 住宿申请或住宿单 | 床位、锁定时长 | `held` | 回资源候选 | `dormitory.bed.held` |
| 床位 | `held` | `assign_bed` | 一线经办人 | 主体、住宿单 | 床位分配结果 | `assigned` | 回主体或资源处理 | `dormitory.bed.assigned` |
| 床位 | `assigned` | `mark_bed_occupied` | 一线经办人 | 入住确认 | 交付状态 | `occupied` | 回入住办理项 | `dormitory.bed.occupied` |
| 床位 | `occupied` | `start_bed_checkout_inspection` | 一线经办人 | 退住申请 | 检查类型 | `checkout_inspection` | 回退住办理项 | `dormitory.bed.checkout_inspection_started` |
| 床位 | `checkout_inspection` | `route_bed_after_checkout` | 一线经办人 | 检查结果、损耗证据 | `available`/`cleaning`/`maintenance` | 目标状态 | 回证据或维修域 | `dormitory.bed.routed_after_checkout` |
| 床位 | `cleaning` | `confirm_bed_cleaned` | 房务/宿舍运营 | 清洁摘要 | 检查结果 | `available_after_recovery` | 回清洁办理项 | `dormitory.bed.cleaned` |
| 床位 | `maintenance` | `consume_bed_maintenance_recovery` | 宿舍运营 | 维修恢复摘要 | 宿舍检查结果 | `available_after_recovery` | 回维修域或检查 | `dormitory.bed.maintenance_recovered` |
| 床位 | `available_after_recovery` | `release_bed_to_available` | 宿舍运营/主管 | 恢复检查记录 | 释放原因 | `available` | 回恢复办理项 | `dormitory.bed.released_to_available` |

## 金额依据、押金、退款与扣减转移

| object | currentStatus | legalAction | ownerRole | requiredEvidence | editableInputs | fixedSelections | nextStatus | failureRoute | auditEvent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 金额依据 | `basis_draft` | `prepare_amount_basis` | 一线经办人 | 价格快照、周期、业务对象 | 金额说明 | 币种、收付方向、阶段语义 | `basis_ready` | 回价格或对象补齐 | `dormitory.amount_basis.prepared` |
| 金额依据 | `basis_ready` | `request_finance_handoff` | 一线经办人 | 金额、币种、业务对象、证据 | 财务备注 | 财务承接类型 | `finance_handoff_requested` | 回金额依据修正 | `dormitory.amount_basis.finance_requested` |
| 金额依据 | `finance_handoff_requested` | `mark_finance_processing` | 财务人员 | 承接包 | 无 | 财务处理状态 | `finance_processing` | 回宿舍补材料 | `dormitory.amount_basis.finance_processing` |
| 金额依据 | `finance_processing` | `consume_finance_confirmed` | 财务人员/系统回执 | 财务确认摘要 | 无 | 财务结果 | `finance_confirmed_readonly` | 财务驳回 | `dormitory.amount_basis.finance_confirmed` |
| 金额依据 | `finance_processing` | `consume_finance_rejected` | 财务人员/系统回执 | 驳回原因 | 无 | 驳回原因 | `finance_rejected` | 回宿舍修正办理项 | `dormitory.amount_basis.finance_rejected` |
| 金额依据 | `finance_rejected` | `correct_amount_basis` | 一线经办人/主管 | 驳回原因、原依据 | 修正说明 | 修正类型 | `correction_required` | 回财务或上游证据 | `dormitory.amount_basis.correction_required` |
| 押金申请 | `basis_ready` | `request_deposit_handoff` | 一线经办人 | 住宿单、押金金额、币种、证据 | 押金说明 | 押金类型、收付方向 | `finance_handoff_requested` | 回住宿单或金额依据 | `dormitory.deposit.handoff_requested` |
| 退款/扣减依据 | `basis_ready` | `request_refund_or_deduction_handoff` | 一线经办人 | 退住检查、证据、业务对象 | 退款/扣减说明 | 退款或扣减类型 | `finance_handoff_requested` | 回退住检查或维修责任 | `dormitory.refund_deduction.handoff_requested` |
| 取消退款依据 | `basis_ready` | `request_cancel_refund_handoff` | 一线经办人 | 取消/未到店记录、证据、业务对象 | 取消退款说明 | 取消类型、退款类型 | `finance_handoff_requested` | 回取消或未到店办理项 | `dormitory.cancel_refund.handoff_requested` |

## 取消、未到店与退款状态

取消和未到店不是退住的子状态，也不是异常修正的兜底状态。它们发生在入住前或预订锁定后，必须保留独立业务锚点和床位释放审计。

```text
reserved_or_assigned
-> cancel_pending | noshow_pending
-> refund_basis_ready
-> finance_handoff_requested | cancel_closed
-> finance_confirmed_readonly
-> closed
```

边界：

- `cancel_pending` 只说明取消正在处理，不释放床位、不形成退款事实。
- `noshow_pending` 必须有约定入住时间、联系记录或未到店说明。
- `refund_basis_ready` 是宿舍金额依据，不是正式退款事实。
- 财务确认前不得显示“已退款”。
- 无需财务时必须记录 `close_without_finance` 原因和床位处理。

## 清洁维修协同转移

| currentStatus | legalAction | ownerRole | requiredEvidence | editableInputs | fixedSelections | nextStatus | failureRoute | auditEvent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `service_required` | `assign_service_task` | 宿舍运营/主管 | 房间床位检查、问题说明 | 服务备注 | 服务类型、责任域 | `assigned` | 回检查补证 | `dormitory.service.assigned` |
| `assigned` | `start_service_work` | 房务/维修域 | 服务任务 | 无 | 开始结果 | `in_progress` | 回责任域 | `dormitory.service.started` |
| `in_progress` | `complete_service_domain_work` | 房务/维修域 | 完成摘要、材料 | 完成说明 | 完成结果 | `completed_by_service_domain` | 回服务任务 | `dormitory.service.domain_completed` |
| `completed_by_service_domain` | `start_dormitory_inspection` | 宿舍运营 | 服务完成摘要 | 检查说明 | 检查类型 | `dormitory_inspection_pending` | 回服务域补材料 | `dormitory.service.inspection_started` |
| `dormitory_inspection_pending` | `restore_to_available` | 宿舍运营/主管 | 宿舍检查通过 | 恢复说明 | 恢复对象 | `restored_to_available` | 回清洁/维修继续处理 | `dormitory.service.restored_to_available` |
| 任一服务状态 | `block_service_recovery` | 主管 | 阻断原因 | 阻断说明 | 阻断原因 | `blocked` | 回责任域 | `dormitory.service.blocked` |

## 只读动作与管理拍板入口

只读查看和管理拍板不是搜索、报表或驾驶舱直接写事实的例外。它们只能打开只读详情、形成 `ManagementDecisionRecord`，或回到责任域继续办理。

| currentStatus | legalAction | ownerRole | requiredEvidence | editableInputs | fixedSelections | nextStatus | failureRoute | auditEvent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `readonly_summary` | `view_detail` | 有权限用户 | 只读摘要、审计引用 | 无 | 分析口径 | `readonly_summary` | 无权限则回权限申请 | `dormitory.read_model.detail_viewed` |
| `management_review` | `create_management_decision_record` | 管理层 | 分析摘要、风险证据、责任域 | 拍板说明 | 责任域、后续办理项类型 | `decision_recorded` | 回分析或责任域补依据 | `dormitory.management.decision_recorded` |

## 三语言与审计

每个 `legalAction` 必须有：

- `actionKey.zh-CN`
- `actionKey.ru-RU`
- `actionKey.ky-KG`
- `blockedReasonKey`
- `nextStepKey`

审计事件必须记录原状态、新状态、办理项、责任角色、证据引用、财务摘要引用和语言无关 action/status value。
