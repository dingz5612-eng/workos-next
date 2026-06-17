import { bedLayoutForCount, labelForBedType, normalizeBedTypePattern } from "./controls/bedLabelControls.js";
import { optionsForField } from "./controls/fieldControls.js";
import { defaultBedTypeForCount, generatedFieldLabel, generatedFieldOrderForCard, isBedSetupCardId } from "./capabilityProjection.js";

const operationFieldAliases = {
  "楼栋": "buildingName",
  "楼栋/地点": "buildingName",
  "楼栋/区域": "buildingContextRef",
  "buildingId": "buildingName",
  "房间号": "roomNo",
  "房型": "roomType",
  "房间类型": "roomType",
  "容量": "capacity",
  "床位数": "bedCount",
  "capacity": "capacity",
  "楼层": "floor",
  "bedId": "bedId",
  "bedNo": "bedNo",
  "bedLabel": "bedLabel",
  "bedLabels": "bedLabels",
  "性别策略": "genderPolicy",
  "家具状态": "furnitureStatus",
  "技术状态": "technicalState",
  "房间备注": "roomNote",
  "所属房间": "roomRef",
  "房间": "roomRef",
  "关联房间": "roomRef",
  "床位": "bedId",
  "关联床位": "bedId",
  "床位号": "bedNo",
  "床位标签": "bedLabels",
  "床位标签清单": "bedLabels",
  "将生成的床位": "bedLabels",
  "床位布局": "bedLayout",
  "床铺生成方式": "bedType",
  "床型模板": "bedType",
  "上/下铺": "bedType",
  "床位类型": "bedType",
  "初始床位状态": "bedStatus",
  "床位状态": "bedStatus",
  "阻断原因": "blockedReason",
  "价格规则": "ratePlanId",
  "每床日价": "dailyRatePerBed",
  "每床周价": "weeklyRatePerBed",
  "每床月价": "monthlyRatePerBed",
  "币种": "currency",
  "生效日期": "effectiveFrom",
  "价格备注": "rateNote",
  "可售状态": "availabilityStatus",
  "就绪状态": "readinessState",
  "紧急程度": "urgency",
  "负责人": "ownerName",
  "是否阻断可售": "blocksAvailability",
  "任务": "taskId",
  "关联任务": "taskId",
  "服务范围": "resourceScope",
  "阻断范围": "resourceScope",
  "释放范围": "resourceScope",
  "阻断开始时间": "blockStartAt",
  "预计恢复时间": "expectedReleaseAt",
  "恢复可售时间": "releaseAvailableAt",
  "准备备注": "readinessNote",
  "阻断备注": "blockNote",
  "释放备注": "releaseNote",
  "通讯方式": "contactChannel",
  "期望入住日期": "expectedCheckInDate",
  "预算金额": "budgetAmount",
  "来源渠道": "leadSource",
  "线索来源": "leadSource",
  "线索状态": "leadStatus",
  "线索备注": "leadNote",
  "备注": "note",
  "跟进日期": "followUpDate",
  "跟进结果": "followUpResult",
  "下一次跟进时间": "nextFollowUpAt",
  "是否需要预订押金": "reservationDepositRequired",
  "预订押金金额": "reservationDepositAmount",
  "预订后动作": "reservationNextAction",
  "预订备注": "reservationNote",
  "预订人数": "reservedBedCount",
  "预订床位数": "reservedBedCount",
  "预留房间": "reservedRoomId",
  "预留床位": "reservedBedIds",
  "预留房间/床位": "reservedBedIds",
  "预订单": "reservationId",
  "预订单号": "reservationId",
  "取消原因": "cancelReason",
  "取消备注": "cancelNote",
  "入住日期": "checkInDate",
  "计划入住日期": "plannedCheckInDate",
  "计划退住日期": "plannedCheckOutDate",
  "新的计划退住日期": "plannedCheckOutDate",
  "保留截止时间": "reservationHoldUntil",
  "转入住日期": "convertedAt",
  "转换备注": "conversionNote",
  "实际入住时间": "checkInDate",
  "钥匙物品交接": "handoverStatus",
  "钥匙/物品交接": "handoverStatus",
  "住客状态": "residentStatus",
  "住客备注": "residentNote",
  "住客": "residentId",
  "入住人": "residentId",
  "住客姓名": "residentName",
  "证件类型": "identityType",
  "证件号码": "identityNo",
  "性别": "gender",
  "国籍": "nationality",
  "紧急联系人": "emergencyContactName",
  "紧急联系电话": "emergencyContactPhone",
  "房间床位": "roomBed",
  "入住周期": "stayPeriod",
  "床位锁定备注": "bedLockNote",
  "计费方式": "tariffType",
  "单价": "unitRate",
  "计费数量": "tariffQuantity",
  "天数/周数/月数": "tariffQuantity",
  "应收金额": "amount",
  "应收备注": "chargeNote",
  "续住原因": "extensionReason",
  "续住备注": "extensionNote",
  "押金截止日期": "depositDueAt",
  "押金截止时间": "depositDueAt",
  "押金类型": "depositType",
  "押金规则": "depositPolicyName",
  "应收押金": "requiredDepositAmount",
  "应收押金金额": "requiredDepositAmount",
  "押金币种": "currency",
  "押金规则说明": "depositPolicyNote",
  "是否允许免押": "depositWaiverAllowed",
  "免押原因": "depositWaiverReason",
  "押金单": "depositId",
  "押金收款记录": "depositReceiptId",
  "付款人": "payerName",
  "实收押金金额": "receivedAmount",
  "收取日期": "receivedDate",
  "支付方式": "paymentMethod",
  "收款人": "receivedBy",
  "押金凭证": "depositEvidenceId",
  "确认金额": "confirmedAmount",
  "确认结果": "confirmationResult",
  "匹配结果": "matchResult",
  "差异原因": "differenceReason",
  "扣除金额": "deductionAmount",
  "扣除原因": "deductionReason",
  "抵扣欠款金额": "applyToBalanceAmount",
  "应退金额": "refundAmount",
  "退款金额": "refundAmount",
  "退款方式": "refundMethod",
  "退款接收人": "refundReceiver",
  "退款凭证": "refundEvidenceId",
  "付款时间": "paymentTime",
  "人工确认摘要": "manualConfirmSummary",
  "押金收款备注": "depositReceiptNote",
  "关闭结果": "closeResult",
  "入住单": "stayId",
  "收款记录": "paymentId",
  "收款日期": "receivedDate",
  "收款用途": "paymentPurpose",
  "收款金额": "paymentAmount",
  "付款金额": "paymentAmount",
  "付款方式": "paymentMethod",
  "凭证编号": "evidenceNo",
  "收款凭证": "paymentEvidenceId",
  "覆盖周期开始": "coverageStart",
  "覆盖周期结束": "coverageEnd",
  "到账时间": "confirmedAt",
  "到账金额": "confirmedAmount",
  "财务确认人": "financeReviewer",
  "财务备注": "financeNote",
  "支付记录": "paymentId",
  "银行/钱包渠道": "paymentChannel",
  "处理意见": "handlingOpinion",
  "分配方式": "allocationMode",
  "分配金额": "allocatedAmount",
  "覆盖应收项": "coveredChargeIds",
  "分配备注": "allocationNote",
  "调整金额": "adjustmentAmount",
  "调整原因": "adjustmentReason",
  "欠款原因": "debtReason",
  "退房人": "checkoutPerson",
  "退房原因": "checkoutReason",
  "预计退房时间": "plannedCheckOutAt",
  "实际退住日期": "actualCheckOutDate",
  "退住原因": "checkoutReason",
  "是否发现损坏": "damageFound",
  "损坏说明": "damageDescription",
  "物品/损坏检查": "damageInspection",
  "物品损坏检查": "damageInspection",
  "照片证据": "photoEvidenceId",
  "查房凭证": "inspectionEvidenceId",
  "住宿费用": "stayFeeAmount",
  "额外费用": "extraFeeAmount",
  "押金抵扣": "depositDeductionAmount",
  "押金扣除金额": "depositDeductionAmount",
  "押金抵欠金额": "depositApplyToBalanceAmount",
  "结算结果": "settlementResult",
  "最终余额": "finalBalanceAmount",
  "应退/应补": "refundOrSupplementAmount",
  "应退应补": "refundOrSupplementAmount",
  "退款/补款确认": "refundOrSupplementConfirmation",
  "退款补款确认": "refundOrSupplementConfirmation",
  "财务凭证": "financeEvidenceId",
  "确认人": "confirmer",
  "释放床位": "releaseBed",
  "关闭住宿单": "closeStayOrder",
  "任务日期": "taskDate",
  "任务类型": "taskType",
  "区域": "area",
  "问题描述": "issueDescription",
  "处理措施": "resolutionAction",
  "目标完成日期": "targetCompletionDate",
  "任务凭证": "taskEvidenceId",
  "优先级": "priority",
  "分派备注": "assignmentNote",
  "复盘结论": "reviewConclusion",
  "后续行动": "nextAction",
  "处理状态": "processingStatus",
  "完成日期": "completedAt",
  "完成时间": "completedAt",
  "完成结果": "completionResult",
  "关联支出": "expenseId",
  "完成凭证": "completionEvidenceId",
  "实际成本": "actualCostAmount",
  "验收结果": "verificationResult",
  "审批结果": "approvalResult",
  "验收备注": "verificationNote",
  "支出记录": "expenseId",
  "支出日期": "expenseDate",
  "支出类别": "expenseCategory",
  "支出描述": "expenseDescription",
  "支出金额": "expenseAmount",
  "支出凭证": "expenseEvidenceId",
  "审批备注": "approvalNote",
  "关联备注": "linkNote",
  "优惠金额": "discountAmount",
  "应收类型": "chargeType",
  "计费开始日期": "periodStart",
  "计费结束日期": "periodEnd",
  "应收原因": "chargeReason",
  "当前余额": "currentBalance",
  "持有押金": "heldAmount",
  "房间状态": "roomCondition",
  "床位检查情况": "bedCondition",
  "损坏扣款金额": "damageChargeAmount",
  "是否需要清洁": "cleaningRequired",
  "年份": "periodYear",
  "周期编号": "periodNo",
  "周期开始时间": "periodStartAt",
  "周期结束时间": "periodEndAt",
  "周期说明": "periodDescription",
  "经营周期": "periodId",
  "指标快照备注": "metricsSnapshotNote",
  "财务复核结果": "financeReviewResult",
  "财务复核备注": "financeReviewNote",
  "主要问题分类": "primaryIssueCategory",
  "主要问题": "primaryIssue",
  "根因分析": "rootCauseAnalysis",
  "诊断置信度": "diagnosisConfidence",
  "行动标题": "actionTitle",
  "行动类型": "actionType",
  "目标指标": "targetMetric",
  "目标值": "targetValue",
  "截止日期": "dueAt",
  "行动状态": "actionStatus",
  "行动计划": "actionPlanId",
  "完成备注": "completionNote",
  "管理结论": "managementConclusion",
  "下一周期重点": "nextPeriodFocus",
  "指标已复核": "metricsReviewed",
  "财务已复核": "financeReviewed",
  "运营已诊断": "operationsDiagnosed",
  "行动计划已提交": "actionPlanCommitted",
  "行动计划已跳过": "actionPlanSkipped",
  "无阻断不变量": "noBlockingInvariantViolation",
  "业务签署完成": "businessSignoffCompleted",
  "行动计划数量": "actionPlanCount",
  "阻断问题数量": "blockingIssueCount",
  "阻断不变量数量": "blockingInvariantViolationCount",
  "线索姓名": "leadName",
  "客户姓名": "residentName",
  "姓名": "guestName",
  "客户": "residentName",
  "电话": "phone",
  "手机号": "phone",
  "联系方式": "phone",
  "住宿时长": "stayDurationText",
  "需要床位": "requestedBedCount",
  "需要床位数": "requestedBedCount",
  "联系日期": "contactDate",
  "线索": "leadId"
};

const taskValueAliases = {
  buildingName: ["building_name", "building", "buildingId", "building_id", "楼栋", "楼栋/地点"],
  roomRef: ["roomRef", "room_ref", "roomId", "room_id", "roomLabel", "room_label", "roomDisplay", "room_display", "所属房间", "房间", "关联房间"],
  roomId: ["room_id", "roomRef", "room_ref", "roomLabel", "room_label", "roomDisplay", "room_display", "所属房间", "房间", "关联房间"],
  roomNo: ["room_no", "roomNumber", "room_number", "房间号"],
  roomType: ["room_type", "房型", "房间类型"],
  bedCount: ["bed_count", "capacity", "容量", "床位数", "需要床位"],
  capacity: ["bedCount", "bed_count", "容量", "床位数"],
  buildingContextRef: ["building_context_ref", "buildingContext", "buildingName", "楼栋", "楼栋/区域"],
  roomRemark: ["room_remark", "roomNote", "房间备注"],
  genderPolicy: ["gender_policy", "性别策略"],
  bedId: ["bed_id", "bedLabel", "bed_label", "bedNo", "bed_no", "床位", "关联床位", "床位号"],
  bedLabels: ["bed_labels", "bedLabel", "bed_label", "bedNo", "bed_no", "床位标签", "床位编号", "将生成的床位"],
  bedType: ["bed_type", "bunkType", "bunk_type", "床铺类型", "床位类型", "床型模板", "上/下铺", "床铺生成方式"],
  bedRemark: ["bed_remark", "床位备注"],
  specialNotes: ["special_notes", "特殊说明"],
  bedEnabledStatus: ["bed_enabled_status", "床位启用状态", "启用状态"],
  bedTypeBatchSetting: ["bed_type_batch_setting", "床型批量设置"],
  basicCheckResult: ["basic_check_result", "基础检查结果"],
  cleaningBasicCheckResult: ["cleaning_basic_check_result", "保洁基础检查结果", "保洁检查结果"],
  facilityBasicCheckResult: ["facility_basic_check_result", "设施基础检查结果", "设施检查结果"],
  safetyBasicCheckResult: ["safety_basic_check_result", "安全基础检查结果", "安全检查结果"],
  readinessState: ["basicReadinessConclusion", "basic_readiness_conclusion", "基础就绪结论", "基础检查结论"],
  basicReadinessRemark: ["basic_readiness_remark", "检查备注", "基础就绪备注"],
  residentName: ["resident_name", "customerName", "customer_name", "contactName", "contact_name", "guestName", "guest_name", "leadName", "lead_name", "name", "姓名", "线索姓名", "客户姓名", "客户"],
  leadName: ["lead_name", "线索姓名"],
  guestName: ["guest_name", "姓名"],
  phone: ["residentPhone", "resident_phone", "customerPhone", "customer_phone", "contactPhone", "contact_phone", "mobile", "telephone", "tel", "电话", "手机号", "联系方式"],
  stayPeriod: ["stay_period", "入住周期", "住宿时长"],
  stayDurationText: ["stay_duration_text", "住宿时长"],
  requestedBedCount: ["requested_bed_count", "需要床位", "需要床位数"],
  contactChannel: ["contact_channel", "通讯方式"],
  expectedCheckInDate: ["expected_check_in_date", "期望入住日期"],
  checkInDate: ["check_in_date", "入住日期", "实际入住时间"],
  plannedCheckInDate: ["planned_check_in_date", "计划入住日期"],
  plannedCheckOutDate: ["planned_check_out_date", "计划退住日期", "新的计划退住日期"],
  leadSource: ["lead_source", "线索来源", "来源渠道"],
  budgetAmount: ["budget_amount", "预算金额"],
  leadStatus: ["lead_status", "线索状态"],
  leadNote: ["lead_note", "线索备注"],
  note: ["note", "备注"],
  reservationId: ["reservation_id", "预订单", "预订单号"],
  reservedBedCount: ["reserved_bed_count", "预订人数", "预订床位数"],
  reservedRoomId: ["reserved_room_id", "预留房间"],
  reservedBedIds: ["reserved_bed_ids", "预留床位", "预留房间/床位"],
  reservationHoldUntil: ["reservation_hold_until", "保留截止时间"],
  reservationNextAction: ["reservation_next_action", "预订后动作"],
  ratePlan: ["rate_plan", "价格方案", "计费方案"],
  dailyRatePerBed: ["daily_rate_per_bed", "每床日价", "日租价格"],
  weeklyRatePerBed: ["weekly_rate_per_bed", "每床周价", "周租价格"],
  monthlyRatePerBed: ["monthly_rate_per_bed", "每床月价", "月租价格"],
  currency: ["币种"],
  effectiveFrom: ["effective_from", "生效日期", "生效时间"],
  furnitureStatus: ["furniture_status", "家具状态"],
  technicalState: ["technical_state", "技术状态"],
  availabilityStatus: ["availability_status", "可售状态", "可用状态"],
  resourceScope: ["resource_scope", "服务范围", "资源范围", "启用范围", "阻断范围", "释放范围"],
  blockedReason: ["blocked_reason", "阻断原因"],
  blockStartAt: ["block_start_at", "阻断开始时间"],
  expectedReleaseAt: ["expected_release_at", "预计恢复时间", "预计释放时间"],
  releaseAvailableAt: ["release_available_at", "恢复可售时间"],
  releaseReason: ["release_reason", "释放原因"],
  taskDate: ["task_date", "任务日期"],
  taskType: ["task_type", "任务类型"],
  issueDescription: ["issue_description", "问题描述"],
  priority: ["优先级"],
  urgency: ["紧急程度"],
  ownerName: ["owner_name", "负责人"],
  targetCompletionDate: ["target_completion_date", "目标完成日期"],
  assignmentNote: ["assignment_note", "分派备注"],
  completedAt: ["completed_at", "完成日期", "完成时间"],
  completionResult: ["completion_result", "完成结果"],
  actualCostAmount: ["actual_cost_amount", "actualCost", "actual_cost", "实际成本"],
  verificationResult: ["verification_result", "approvalResult", "approval_result", "验收结果"],
  approvalResult: ["approval_result", "审批结果"],
  verificationNote: ["verification_note", "验收备注"],
  handlingOpinion: ["handling_opinion", "处理意见"],
  paymentAmount: ["payment_amount", "付款金额", "收款金额"],
  receivedAmount: ["received_amount", "收到金额", "实收押金金额", "收款金额"],
  confirmedAmount: ["confirmed_amount", "确认金额"],
  paymentMethod: ["payment_method", "付款方式", "支付方式"],
  payerName: ["payer_name", "付款人"],
  receivedDate: ["received_date", "收款日期", "收取日期"],
  paymentTime: ["payment_time", "付款时间"],
  confirmationResult: ["confirmation_result", "确认结果"],
  matchResult: ["match_result", "匹配结果"],
  differenceReason: ["difference_reason", "varianceReason", "variance_reason", "差异原因"],
  financeNote: ["finance_note", "财务备注"],
  depositType: ["deposit_type", "depositRule", "deposit_rule", "押金类型"],
  depositPolicyName: ["deposit_policy_name", "押金规则"],
  depositPolicyNote: ["deposit_policy_note", "押金规则说明"],
  depositReceiptId: ["deposit_receipt_id", "押金收款记录"],
  depositEvidenceId: ["deposit_evidence_id", "paymentEvidenceId", "押金凭证"],
  requiredDepositAmount: ["required_deposit_amount", "应收押金", "应收押金金额"],
  depositDueAt: ["deposit_due_at", "押金截止时间", "押金截止日期"],
  paymentEvidenceId: ["payment_evidence_id", "收款凭证", "押金凭证"],
  evidenceNo: ["evidence_no", "凭证编号"],
  paymentChannel: ["payment_channel", "银行/钱包渠道"],
  roomCondition: ["room_condition", "房间状态"],
  bedCondition: ["bed_condition", "inspectionBedCondition", "inspection_bed_condition", "床位检查情况"],
  settlementResult: ["settlement_result", "结算结果"],
  closeResult: ["close_result", "关闭结果"],
  releaseBed: ["release_bed", "releaseScope", "释放床位"],
  identityType: ["identity_type", "证件类型"],
  identityNo: ["identity_no", "证件号码"],
  gender: ["性别"],
  nationality: ["国籍"],
  residentId: ["resident_id", "住客", "入住人"],
  roomBed: ["room_bed", "房间床位"],
  chargeType: ["charge_type", "应收类型"],
  periodStart: ["period_start", "计费开始日期"],
  periodEnd: ["period_end", "计费结束日期"],
  chargeReason: ["charge_reason", "应收原因"],
  discountAmount: ["discount_amount", "优惠金额"],
  expenseId: ["expense_id", "支出记录", "关联支出"],
  expenseDate: ["expense_date", "支出日期"],
  expenseCategory: ["expense_category", "支出类别"],
  expenseDescription: ["expense_description", "支出描述"],
  expenseAmount: ["expense_amount", "支出金额"],
  expenseEvidenceId: ["expense_evidence_id", "支出凭证"],
  approvalNote: ["approval_note", "审批备注"],
  linkNote: ["link_note", "关联备注"],
  contactDate: ["contact_date", "联系日期"],
  leadId: ["lead_id", "线索"],
  followUpDate: ["follow_up_date", "跟进日期"],
  followUpResult: ["follow_up_result", "跟进结果"],
  nextFollowUpAt: ["next_follow_up_at", "下一次跟进时间"]
};

const taskLabelAliases = Object.entries(taskValueAliases).reduce((current, [fieldId, aliases]) => {
  current[fieldId] = fieldId;
  for (const alias of aliases) current[alias] = fieldId;
  return current;
}, { ...operationFieldAliases });
taskLabelAliases.bedCount = "bedCount";
taskLabelAliases["床位数"] = "bedCount";
taskLabelAliases.capacity = "bedCount";
taskLabelAliases["容量"] = "bedCount";
taskLabelAliases.note = "note";
taskLabelAliases["备注"] = "note";
taskLabelAliases.paymentTime = "paymentTime";
taskLabelAliases["付款时间"] = "paymentTime";
taskLabelAliases.closeResult = "closeResult";
taskLabelAliases["关闭结果"] = "closeResult";

const taskFallbackLabels = {
  "zh-CN": {
    buildingName: "楼栋",
    buildingContextRef: "楼栋/区域",
    roomRef: "所属房间",
    roomId: "房间",
    roomNo: "房间号",
    roomType: "房型",
    bedCount: "床位数",
    capacity: "床位数",
    roomRemark: "房间备注",
    genderPolicy: "性别策略",
    bedId: "床位",
    bedLabels: "将生成的床位",
    bedType: "床铺生成方式",
    bedRemark: "床位备注",
    specialNotes: "特殊说明",
    bedEnabledStatus: "床位启用状态",
    bedTypeBatchSetting: "床型批量设置",
    basicCheckResult: "基础检查结果",
    cleaningBasicCheckResult: "保洁检查结果",
    facilityBasicCheckResult: "设施检查结果",
    safetyBasicCheckResult: "安全检查结果",
    readinessState: "基础检查结论",
    basicReadinessRemark: "检查备注",
    residentName: "客户",
    leadName: "线索姓名",
    guestName: "姓名",
    phone: "电话",
    requestedBedCount: "需要床位数",
    stayPeriod: "住宿周期",
    stayDurationText: "住宿时长",
    contactChannel: "通讯方式",
    expectedCheckInDate: "期望入住日期",
    checkInDate: "入住日期",
    plannedCheckInDate: "计划入住日期",
    plannedCheckOutDate: "计划退住日期",
    leadSource: "来源渠道",
    budgetAmount: "预算金额",
    leadStatus: "线索状态",
    leadNote: "线索备注",
    reservationId: "预订单",
    reservedBedCount: "预订床位数",
    reservationNextAction: "预订后动作",
    residentId: "住客",
    depositType: "押金类型",
    depositPolicyName: "押金规则",
    depositReceiptId: "押金收款记录",
    differenceReason: "差异原因",
    ownerName: "负责人",
    urgency: "紧急程度",
    actualCostAmount: "实际成本",
    verificationResult: "验收结果",
    expenseId: "支出记录",
    expenseAmount: "支出金额"
  },
  "ru-RU": {
    buildingName: "Корпус",
    buildingContextRef: "Корпус/зона",
    roomRef: "Комната",
    roomId: "Комната",
    roomNo: "Номер комнаты",
    roomType: "Тип комнаты",
    bedCount: "Количество коек",
    capacity: "Количество коек",
    roomRemark: "Примечание к комнате",
    bedId: "Койка",
    bedLabels: "Будут созданы койки",
    bedType: "Как создать койки",
    bedRemark: "Примечание к койке",
    specialNotes: "Особые заметки",
    bedEnabledStatus: "Статус койки",
    bedTypeBatchSetting: "Пакетная настройка типа",
    basicCheckResult: "Результат проверки",
    cleaningBasicCheckResult: "Проверка уборки",
    facilityBasicCheckResult: "Проверка оборудования",
    safetyBasicCheckResult: "Проверка безопасности",
    readinessState: "Итог проверки",
    basicReadinessRemark: "Комментарий",
    residentName: "Клиент",
    leadName: "Имя лида",
    guestName: "Имя",
    phone: "Телефон",
    requestedBedCount: "Нужно мест",
    stayPeriod: "Период",
    stayDurationText: "Срок проживания",
    contactChannel: "Канал связи",
    expectedCheckInDate: "Ожидаемый заезд",
    leadSource: "Источник",
    budgetAmount: "Бюджет",
    leadStatus: "Статус лида",
    leadNote: "Примечание"
  },
  "ky-KG": {
    buildingName: "Имарат",
    buildingContextRef: "Имарат/аймак",
    roomRef: "Бөлмө",
    roomId: "Бөлмө",
    roomNo: "Бөлмө номери",
    roomType: "Бөлмө түрү",
    bedCount: "Койка саны",
    capacity: "Койка саны",
    roomRemark: "Бөлмө эскертүүсү",
    bedId: "Койка",
    bedLabels: "Түзүлө турган койкалар",
    bedType: "Койка түзүү жолу",
    bedRemark: "Койка эскертүүсү",
    specialNotes: "Өзгөчө эскертүү",
    bedEnabledStatus: "Койка абалы",
    bedTypeBatchSetting: "Койка түрүн топтом орнотуу",
    basicCheckResult: "Текшерүү жыйынтыгы",
    cleaningBasicCheckResult: "Тазалык текшерүүсү",
    facilityBasicCheckResult: "Жабдуу текшерүүсү",
    safetyBasicCheckResult: "Коопсуздук текшерүүсү",
    readinessState: "Текшерүү жыйынтыгы",
    basicReadinessRemark: "Эскертүү",
    residentName: "Кардар",
    leadName: "Лид аты",
    guestName: "Аты",
    phone: "Телефон",
    requestedBedCount: "Керек койка саны",
    stayPeriod: "Мөөнөт",
    stayDurationText: "Жашоо мөөнөтү",
    contactChannel: "Байланыш каналы",
    expectedCheckInDate: "Күтүлгөн кирүү күнү",
    leadSource: "Булак",
    budgetAmount: "Бюджет",
    leadStatus: "Лид статусу",
    leadNote: "Эскертүү"
  }
};

const preferredFieldsByCard = {
  roomSetup: ["buildingName", "roomNo", "roomType", "bedCount", "capacity", "genderPolicy"],
  bedSetup: ["bedLabels", "bedType", "bedCount"],
  rateSetup: ["ratePlan", "dailyRatePerBed", "weeklyRatePerBed", "monthlyRatePerBed", "effectiveFrom"],
  roomReadiness: ["furnitureStatus", "technicalState", "availabilityStatus", "readinessNote"],
  roomBlock: ["resourceScope", "bedId", "blockedReason", "blockStartAt", "expectedReleaseAt"],
  roomRelease: ["resourceScope", "releaseAvailableAt", "releaseReason"],
  lead: ["guestName", "phone", "requestedBedCount", "stayDurationText"],
  leadCapture: ["leadName", "phone", "requestedBedCount", "stayDurationText"],
  leadFollowUp: ["leadId", "followUpDate", "followUpResult", "nextFollowUpAt"],
  reservationCreate: ["reservedBedCount", "reservedRoomId", "reservedBedIds", "plannedCheckInDate", "reservationHoldUntil", "reservationNextAction"],
  booking: ["checkInDate", "reservedBedCount", "reservedBedIds", "leadStatus"],
  resident: ["guestName", "phone", "checkInDate", "plannedCheckOutDate"],
  residentProfile: ["residentName", "phone", "identityType", "identityNo"],
  checkInBedAssign: ["residentId", "roomId", "bedId", "checkInDate"],
  chargeAssessment: ["chargeType", "periodStart", "periodEnd", "amount"],
  bedAssign: ["roomId", "bedId", "stayPeriod"],
  tariff: ["tariffType", "unitRate", "tariffQuantity", "amount"],
  depositRequirement: ["depositPolicyName", "requiredDepositAmount", "depositDueAt"],
  depositAssessment: ["depositType", "requiredDepositAmount", "depositDueAt"],
  depositReceipt: ["receivedAmount", "paymentMethod", "payerName", "receivedDate"],
  depositConfirmation: ["confirmedAmount", "confirmationResult", "differenceReason"],
  paymentReceipt: ["paymentAmount", "paymentMethod", "payerName", "receivedDate"],
  paymentConfirmation: ["confirmedAmount", "confirmationResult", "differenceReason"],
  serviceTaskCreate: ["taskDate", "taskType", "resourceScope", "roomId", "bedId", "issueDescription"],
  serviceTaskAssign: ["ownerName", "priority", "targetCompletionDate"],
  serviceTaskComplete: ["completedAt", "completionResult", "actualCostAmount"],
  serviceTaskVerify: ["verificationResult", "verificationNote", "handlingOpinion"],
  checkoutStart: ["residentName", "phone", "expectedCheckoutAt", "checkoutReason"],
  roomInspection: ["roomCondition", "damageInspection", "photoEvidenceId"],
  depositSettlement: ["depositId", "deductionAmount", "applyToBalanceAmount", "handlingOpinion"],
  finalBalanceClose: ["depositDeductionAmount", "depositApplyToBalanceAmount", "finalBalanceAmount", "settlementResult"],
  bedRelease: ["releaseBed", "releaseAvailableAt", "releaseNote"],
  postCheckoutCleaning: ["taskType", "targetCompletionDate", "resolutionAction"],
  expenseRecord: ["expenseDate", "expenseCategory", "expenseAmount", "paymentMethod"],
  expenseApproval: ["expenseId", "confirmedAmount", "approvalResult"],
  periodActionPlan: ["actionTitle", "actionType", "targetMetric", "dueAt"],
  periodActionPlanComplete: ["actionPlanId", "completedAt", "completionResult"],
  periodClose: ["managementConclusion", "settlementResult", "nextPeriodFocus"]
};

export function operationFieldId(field = {}) {
  const rawId = String(field.fieldId || field.id || "").trim();
  if (operationFieldAliases[rawId]) return operationFieldAliases[rawId];
  if (rawId && !hasCjk(rawId)) return rawId;
  return operationFieldAliases[field.label?.["zh-CN"]] || rawId || "";
}

export function canonicalTaskFieldId(field = {}) {
  const candidates = [
    field.id,
    field.label?.["zh-CN"],
    field.label?.["ru-RU"],
    field.label?.["ky-KG"]
  ].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim();
    if (taskLabelAliases[normalized]) return taskLabelAliases[normalized];
  }
  return String(field.id || "").trim();
}

export function taskFieldForId(card, fieldId, ctx) {
  const found = (card?.fields?.business || []).find((field) => canonicalTaskFieldId(field) === fieldId);
  return found || syntheticTaskField(fieldId, ctx);
}

export function syntheticTaskField(fieldId, ctx = {}) {
  const generatedLabel = generatedFieldLabel(fieldId, ctx.state?.lang || "zh-CN");
  return {
    id: fieldId,
    label: {
      "zh-CN": taskFallbackLabels["zh-CN"][fieldId] || generatedFieldLabel(fieldId, "zh-CN") || fieldId,
      "ru-RU": taskFallbackLabels["ru-RU"][fieldId] || generatedFieldLabel(fieldId, "ru-RU") || taskFallbackLabels["zh-CN"][fieldId] || fieldId,
      "ky-KG": taskFallbackLabels["ky-KG"][fieldId] || generatedFieldLabel(fieldId, "ky-KG") || taskFallbackLabels["zh-CN"][fieldId] || fieldId
    },
    ui: fieldId === "bedType" ? { control: "select", optionSet: "bunkType", defaultValue: "whole" } : {},
    generatedLabel
  };
}

export function taskValueByFieldId(values = {}, fieldId = "", field = null, ctx = {}) {
  const aliases = taskFieldAliases(fieldId, field, ctx);
  for (const alias of aliases) {
    const value = values?.[alias];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function taskFieldAliases(fieldId, field, ctx) {
  const labels = [
    field?.label?.["zh-CN"],
    field?.label?.["ru-RU"],
    field?.label?.["ky-KG"],
    localizedFieldText(field?.label, ctx),
    field?.id
  ].filter(Boolean);
  return unique([fieldId, ...(taskValueAliases[fieldId] || []), ...labels]);
}

export function taskDisplayLabel(field, fieldId, card, ctx) {
  const generated = generatedFieldLabel(fieldId, ctx.state?.lang || "zh-CN");
  if (isBedSetupCardId(card?.id) && fieldId === "bedType") return ctx.tr?.("bedTypeTemplateLabel") || taskFallbackLabels["zh-CN"].bedType;
  if (isBedSetupCardId(card?.id) && fieldId === "bedLabels") return ctx.tr?.("bedLayoutPreviewLabel") || taskFallbackLabels["zh-CN"].bedLabels;
  if (fieldId === "capacity") return taskFallbackLabels[ctx.state?.lang]?.bedCount || taskFallbackLabels["zh-CN"].bedCount;
  return localizedFieldText(field?.label, ctx) || taskFallbackLabels[ctx.state?.lang]?.[fieldId] || taskFallbackLabels["zh-CN"][fieldId] || generated || fieldId;
}

export function taskDisplayValue(field, fieldId, value, ctx) {
  if (fieldId === "bedType") return bedPatternDisplay(value, ctx);
  const option = optionsForField(field, ctx.state?.lang || "zh-CN").find((entry) => String(entry.value) === String(value));
  return option ? option.label : localizedFieldText(value, ctx);
}

export function bedLayoutPreviewValue(count, pattern, ctx) {
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return bedLayoutForCount(parsed, pattern || defaultBedTypeForCount(parsed), ctx.state?.lang || "zh-CN")
    .map((entry) => `${entry.label} · ${entry.typeLabel || labelForBedType(entry.type, ctx.state?.lang || "zh-CN")}`)
    .join(" / ");
}

export function preferredTaskFieldIds(cardId = "") {
  const generatedOrder = generatedFieldOrderForCard(cardId);
  return generatedOrder.length ? generatedOrder : preferredFieldsByCard[cardId] || [];
}

export function isLowValueTaskField(field, ctx) {
  const fieldId = canonicalTaskFieldId(field);
  const label = localizedFieldText(field?.label, ctx);
  return /note|remark|evidence|photo|凭证|证据|照片|备注|说明|材料|trace|audit/i.test(`${fieldId} ${label}`);
}

export function localizedFieldText(value, ctx = {}) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (ctx.tx) return ctx.tx(value);
  const lang = ctx.state?.lang || "zh-CN";
  return value[lang] || value["zh-CN"] || value["ru-RU"] || value["ky-KG"] || value.label || value.title || "";
}

function bedPatternDisplay(value, ctx) {
  const normalized = normalizeBedTypePattern(value);
  const labels = {
    "zh-CN": { bunk_pair: "上下铺：两上两下", upper: "全部上铺", lower: "全部下铺", whole: "全部平铺" },
    "ru-RU": { bunk_pair: "две верхние и две нижние", upper: "все верхние", lower: "все нижние", whole: "обычные койки" },
    "ky-KG": { bunk_pair: "эки үстүңкү, эки астыңкы", upper: "баары үстүңкү", lower: "баары астыңкы", whole: "жалгыз койкалар" }
  };
  return labels[ctx.state?.lang]?.[normalized] || labels["zh-CN"][normalized] || String(value || "");
}

function unique(values = []) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function hasCjk(value = "") {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}
