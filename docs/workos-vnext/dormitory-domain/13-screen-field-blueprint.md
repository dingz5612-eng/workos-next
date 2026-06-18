# 宿舍移动页面字段蓝图

## 设计锚点

本文件定义 `DormitoryScreenFieldBlueprint`。它把第一批 6 个 vNext 样板屏绑定到 `09-scenario-step-field-contracts.md` 的场景步骤、`11-field-key-and-option-set-contract.md` 的字段与选项集、`12-minimal-input-and-autofill-policy.md` 的少填规则，以及 `10-mobile-ui-redesign-direction.md` 的 UI 准入。

本文件不是高保真 UI，不继承现有 WorkOSNext mobile surface，也不修改当前 runtime/surface。

当前 `outputs/workos-vnext/dormitory-ui-prototype/` 是 `rejected local draft`，不得作为本蓝图的实现参考。下一版高保真原型必须重新制作，且只能消费本文件、`09`、`10`、`11`、`12` 的合同。

## 页面蓝图通用结构

每个样板屏必须按以下顺序组合：

1. 任务条：当前办理项、状态、责任角色。
2. 主对象摘要：住客/企业/住宿单/房间床位/金额依据。
3. 上游只读摘要：来源、主体解析、员工关系、财务回执、证据状态。
4. 当前输入区：仅 `editableInputs`。
5. 固定选择区：对象选择器和选项集。
6. 财务边界区：金额、币种、方向、阶段、业务对象、承接状态。
7. 证据区：必需证据、缺失/驳回/过期、补交入口。
8. 阻断与下一步：缺什么、谁处理、处理后去哪。
9. 底部动作区：唯一主按钮和必要辅助动作。

## 新原型页面范围

下一版原型只覆盖两个完整且可衔接场景，不一次性铺满 13 场景。页面必须以中文单语言展示，并按 Executive Quiet Operations 视觉方向重新制作。

| 页面 | screenKey | 主对象 | 关键要求 |
| --- | --- | --- | --- |
| 今日经营工作台 | `dormitory.today_operations_ledger` | 办理项队列/经营压力 | 显示待办、财务等待、缺证据、入住/退住、床位回流和命令入口。 |
| 命令搜索与推荐办理项 | `dormitory.command_search` | 搜索意图/对象候选 | 支持 `0906-1退房`、`0906-1结算`、`0906-1恢复`、`欧亚物流入住`、`欧亚物流押金`；搜索只读。 |
| 来源接入与主体确认 | `dormitory.external_intake_subject_confirmation` | 来源/主体候选/住宿接入 | 来源只读，主体候选确认，证据状态清楚，不手填已知主体。 |
| 房间床位选择 | `dormitory.room_bed_picker` | 住宿单/床位锁定 | 展示楼栋、楼层、床型、经营状态、押金要求、价格快照、清洁状态、可入住时间和阻断原因。 |
| 押金/收款财务承接 | `dormitory.finance_handoff_basis` | 押金申请/收款依据 | 金额、币种、业务对象、收付方向、承接状态成为主视觉；宿舍只提交依据。 |
| 入住确认 | `dormitory.checkin_confirmation` | 住宿单 | 财务回执只读，身份/交付证据清楚，实际入住时间为少量输入。 |
| 退住检查 | `dormitory.checkout_inspection` | 住宿单/房间床位 | 展示押金余额、检查项、损耗证据、恢复前置条件。 |
| 结算依据 | `dormitory.checkout_settlement_basis` | 退款/扣减/补收依据 | 区分应退、扣减、补收、责任域、证据和财务承接状态。 |
| 财务回执 | `dormitory.finance_handoff_receipt` | 财务承接回执 | 只读展示财务确认、驳回或待处理，不由宿舍域写正式财务事实。 |
| 床位恢复与资源回流 | `dormitory.bed_recovery_to_inventory` | 床位/经营状态 | 清洁、维修、检查完成后恢复可经营，并回流到房间床位选择和命令搜索。 |

## 命令搜索蓝图

| 命令 | 识别对象 | 识别意图 | 推荐办理项 | 禁止 |
| --- | --- | --- | --- | --- |
| `0906-1退房` | `B 座 0906-1` 床位、住宿单、住客 | 退住/退房 | `dormitory.checkout_inspection` | 搜索直接退住或释放床位 |
| `0906-1退住` | `B 座 0906-1` 床位、住宿单、住客 | 退住/退房 | `dormitory.checkout_inspection` | 搜索直接写退住事实 |
| `0906-1结算` | `B 座 0906-1` 住宿单与押金余额 | 结算 | `dormitory.checkout_settlement_basis` | 搜索直接生成财务事实 |
| `0906-1恢复` | `B 座 0906-1` 床位与清洁/维修状态 | 恢复经营 | `dormitory.bed_recovery_to_inventory` | 搜索直接恢复可经营 |
| `欧亚物流入住` | 企业客户与住宿接入 | 入住 | `dormitory.external_intake_subject_confirmation` 或 `dormitory.room_bed_picker` | 搜索直接创建住宿单 |
| `欧亚物流押金` | 企业客户、住宿申请、金额依据 | 押金/收款 | `dormitory.finance_handoff_basis` | 搜索直接确认收款 |

## 样板屏 1：今日待办/宿舍办理项队列

| 项 | 合同 |
| --- | --- |
| screenKey | `dormitory.work_item_queue` |
| 对应步骤 | 聚合所有 `VNextExecutionItem`，只读消费 `BusinessSummaryReadModel` |
| 主对象 | 办理项队列 |
| read | `source.ref`,`subject.ref`,`stay_order.ref`,`room.ref`,`bed.ref`,`amount.summary_readonly`,`evidence.status`,`blocked.reason`,`handoff.next_role` |
| edit | 无 |
| fixed | 筛选：`option.next_work_item_type`,`option.blocked_reason`,`option.responsibility_domain` |
| finance | `amount.summary_readonly`,`finance.handoff_status` |
| evidence | `evidence.status` |
| actions | 打开办理项、查看只读记录、查看阻断 |
| main UX | 列表优先显示业务对象、状态、缺口和下一步，不显示内部编号作为主标题 |
| language | 标题、筛选、状态、空态、阻断、下一步必须覆盖 `zh-CN`、`ru-RU`、`ky-KG` |

## 样板屏 2：外部住宿客户接入与报价

| 项 | 合同 |
| --- | --- |
| screenKey | `dormitory.external_intake_quote` |
| 对应步骤 | `lodging.inquiry_and_quote.external_source_to_intake`、`lodging.inquiry_and_quote.select_quote_room_bed` |
| 主对象 | 住宿接入/住宿申请 |
| read | `source.ref`,`source.request_summary`,`subject.candidate_summary`,`available_resource.summary` |
| edit | `stay.start_date`,`stay.period`,`guest.count`,`preference.note.optional` |
| fixed | `stay.intent_type`,`evidence.type`,`room.ref`,`bed.ref`,`price_snapshot.ref` |
| finance | `amount.value`,`currency.code`,`amount.stage`,`business_object.ref` |
| evidence | `identity_document`,`price_confirmation` |
| actions | `submit_intake_for_resolution`,`select_room_bed_candidate` |
| blocked | `missing_subject`,`missing_evidence`,`no_available_bed` |
| next | 等待主体解析、生成住宿申请或进入预订 |
| main UX | 默认少填：来源和诉求只读，主体候选只确认，偏好只是可选补充 |

## 样板屏 3：房间床位选择

| 项 | 合同 |
| --- | --- |
| screenKey | `dormitory.room_bed_picker` |
| 对应步骤 | `lodging.reservation_and_inventory_hold.hold_reservation_bed` |
| 主对象 | 住宿单/床位锁定 |
| read | `application.ref`,`subject.ref`,`available_resource.summary`,`price_snapshot.ref`,`room_bed.status` |
| edit | `reservation.note.optional` |
| fixed | `room.ref`,`bed.ref`,`hold.duration` |
| finance | `amount.stage`,`business_object.ref` |
| evidence | `price_confirmation`,`deposit_basis` |
| actions | `reserve_or_assign_bed` |
| blocked | `no_available_bed`,`missing_evidence`,`upstream_pending` |
| next | 等待财务或进入入住准备 |
| main UX | 房间/床位必须用对象选择器展示状态、价格、风险，不允许手填房号床号 |

## 样板屏 4：押金/收款财务承接

| 项 | 合同 |
| --- | --- |
| screenKey | `dormitory.finance_handoff_basis` |
| 对应步骤 | `lodging.payment_deposit_and_guarantee.prepare_deposit_basis`、`lodging.payment_deposit_and_guarantee.prepare_payment_basis` |
| 主对象 | 押金申请/收款依据 |
| read | `stay_order.ref`,`subject.ref`,`price_snapshot.ref`,`evidence.status` |
| edit | `amount.value`,`finance.note.optional` |
| fixed | `currency.code`,`payment.direction`,`deposit.type`,`finance.handoff_type`,`amount.stage` |
| finance | `amount.value`,`currency.code`,`payment.direction`,`amount.stage`,`business_object.ref`,`finance.handoff_status` |
| evidence | `deposit_basis`,`price_confirmation` |
| actions | `request_deposit_handoff`,`request_finance_handoff` |
| blocked | `missing_evidence`,`finance_pending`,`finance_rejected` |
| next | 财务办理项处理，宿舍等待回执 |
| main UX | 清楚显示“宿舍只提交金额依据，正式财务事实由财务确认” |

## 样板屏 5：入住确认

| 项 | 合同 |
| --- | --- |
| screenKey | `dormitory.checkin_confirmation` |
| 对应步骤 | `lodging.check_in_processing.verify_checkin_readiness`、`lodging.check_in_processing.confirm_checkin` |
| 主对象 | 住宿单 |
| read | `subject.ref`,`room.ref`,`bed.ref`,`finance.receipt_summary`,`evidence.status` |
| edit | `stay.actual_checkin_at`,`handover.note.optional` |
| fixed | `blocked.reason`,`handover.key_status`,`handover.access_status`,`handover.item_status` |
| finance | `finance.handoff_status`,`amount.stage` |
| evidence | `identity_document`,`checkin_handover` |
| actions | `consume_finance_receipt`,`confirm_checkin` |
| blocked | `missing_evidence`,`finance_pending`,`finance_rejected`,`permission_required` |
| next | 生成入住事件，床位变为 occupied |
| main UX | 先做就绪检查，再确认入住；不可把等待财务的状态显示成可入住 |

## 样板屏 6：退住结算/退款扣减

| 项 | 合同 |
| --- | --- |
| screenKey | `dormitory.checkout_refund_settlement` |
| 对应步骤 | `lodging.checkout_and_settlement.submit_checkout_settlement`、`lodging.cancel_noshow_refund_intake.prepare_cancel_or_noshow_refund_basis` |
| 主对象 | 退住结算依据/退款依据 |
| read | `stay_order.ref`,`inspection.summary`,`damage.summary`,`cancel_or_noshow.record`,`finance.summary` |
| edit | `amount.value`,`settlement.note.optional`,`refund.note.optional` |
| fixed | `settlement.type`,`responsibility.domain`,`refund.type`,`deduction.type`,`currency.code`,`payment.direction`,`cancel.handling_type`,`noshow.handling_type` |
| finance | `amount.value`,`currency.code`,`payment.direction`,`amount.stage`,`business_object.ref`,`finance.handoff_status` |
| evidence | `room_inspection`,`bed_inspection`,`damage_photo`,`cancellation_request`,`noshow_contact_record` |
| actions | `submit_checkout_settlement`,`prepare_cancel_refund_basis`,`prepare_noshow_refund_basis` |
| blocked | `missing_evidence`,`finance_pending`,`upstream_pending` |
| next | 财务承接或关闭无需财务，之后释放床位 |
| main UX | 退款、扣减、补收必须区分，财务确认前不得显示“已退款” |

## 三语言页面规则

- 页面标题、分组标题、字段 label、按钮、状态、错误、空态、证据和下一步都通过语言 key 渲染。
- 俄语和吉语较长 label 可以缩短，但不能省略金额、币种、证据状态和阻断原因。
- 底部主按钮必须保留完整可读含义；长错误进入阻断区，不覆盖按钮。

## 高保真准入

样板屏进入高保真前必须通过：

- `09`：对应步骤和 `fieldKeyGroups` 已存在。
- `11`：所有字段和选项有稳定 value 与三语言 label。
- `12`：所有输入都符合少填和自动带出策略。
- `08`：主按钮来自合法动作。
- `04`：财务边界明确。
- `07`：验收合同不产生当前 OAM GO 或发布结论。

不通过情况：

- 高保真新增合同外字段。
- 视觉稿把对象选择器画成手填输入框。
- 视觉稿只显示内部编号、技术 key 或旧中文状态。
- 页面把搜索、报表、看板做成写入口。
- 视觉稿混淆宿舍金额依据和正式财务事实。
