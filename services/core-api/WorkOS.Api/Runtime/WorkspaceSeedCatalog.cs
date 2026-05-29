namespace WorkOS.Api.Runtime;

internal static class WorkspaceSeedCatalog
{
    public static IReadOnlyList<WorkspaceSeed> All() => new[]
    {
        Workspace("W-STAY-RESOURCE", "stay", "T-ROOM-CREATE", "我要创建住宿资源", "Создать ресурсы проживания",
            "房间、床位和资源启用在同一资源建档办理面完成。",
            "Комнаты, койки и активация ресурсов вместе.",
            new[]
            {
                Card("room", "ready", "房间建档卡", "Комната", new[] { "roomId", "buildingId" }, new[] { "楼栋", "房间号", "房型", "容量" }, new[] { "duplicateRoomCount" }),
                Card("bed", "notStarted", "床位建档卡", "Койка", new[] { "bedId", "roomId" }, new[] { "所属房间", "床位号", "上/下铺", "价格规则", "维护状态" }, new[] { "capacityConflictCount" }),
                Card("activate", "notStarted", "资源启用卡", "Активация", new[] { "bedId", "operatorId" }, new[] { "启用对象", "启用范围", "可分配时间", "初始可用状态", "启用备注" }, new[] { "activationDuration" })
            },
            "先创建房间，再创建床位，最后启用可分配资源。",
            "Сначала комната, затем койка, затем активация ресурса."),
        Workspace("W-STAY-CHECKIN", "stay", "T-STAY-DEPOSIT", "我要安排入住收款", "Оформить заселение и оплату",
            "从线索、预订、分床、计费、押金、收款、财务确认到经营驾驶舱形成完整宿舍闭环。",
            "Лид, бронь, койка, тариф, депозит, оплата, финансы и операционная аналитика в одном цикле.",
            new[]
            {
                Card("lead", "ready", "线索登记卡", "Лид", new[] { "leadId", "operatorId" }, new[] { "联系日期", "姓名", "电话", "需要床位", "住宿时长", "线索来源", "线索状态", "备注" }, new[] { "leadCaptureDuration", "sourceChannel" }),
                Card("booking", "notStarted", "预订确认卡", "Бронь", new[] { "bookingId", "leadId" }, new[] { "入住日期", "预订人数", "预留房间/床位", "线索状态", "备注" }, new[] { "bookingConversionDuration", "bookingConversionRate" }),
                Card("resident", "notStarted", "入住人建档卡", "Жилец", new[] { "residentId", "bookingId" }, new[] { "姓名", "电话", "入住日期", "计划退住日期", "住客状态", "备注" }, new[] { "residentRegistrationDuration" }),
                Card("bedAssign", "notStarted", "分配床位卡", "Назначение койки", new[] { "stayId", "roomId", "bedId" }, new[] { "入住人", "房间床位", "入住周期", "床位锁定备注" }, new[] { "bedAssignmentDuration", "occupancyImpact" }),
                Card("tariff", "notStarted", "计费确认卡", "Тариф", new[] { "folioId", "stayId" }, new[] { "计费方式", "单价", "天数/周数/月数", "应收金额", "押金规则" }, new[] { "chargeAmount", "folioBalance" }),
                Card("depositRequirement", "notStarted", "押金要求卡", "Требование депозита", new[] { "depositId", "folioId", "liabilityAccountId" }, new[] { "押金规则", "应收押金", "押金币种", "押金截止时间", "是否允许免押", "免押原因" }, new[] { "depositLiabilityAmount", "depositDueLeadTime" }),
                Card("payment", "notStarted", "收款登记卡", "Платеж", new[] { "paymentId", "folioId", "depositId" }, new[] { "付款人", "付款时间", "付款金额", "币种", "付款方式", "收款用途", "凭证编号", "备注" }, new[] { "paymentRecordDuration", "unconfirmedPaymentAmount" }),
                Card("finance", "notStarted", "财务到账确认卡", "Фин. подтверждение", new[] { "financeReviewId", "paymentId", "depositId" }, new[] { "支付记录", "银行/钱包渠道", "到账金额", "到账时间", "财务确认人", "匹配结果", "差异原因", "处理意见" }, new[] { "financeReviewDuration", "financeVarianceAmount" }),
                Card("checkin", "notStarted", "入住确认卡", "Подтверждение заселения", new[] { "auditTraceId", "bedId", "stayId" }, new[] { "实际入住时间", "钥匙/物品交接", "人工确认摘要" }, new[] { "totalCheckinDuration", "manualConfirmCount" }),
                Card("operatingDashboard", "notStarted", "经营驾驶舱卡", "Операционная панель", new[] { "metricsProjectionId", "folioId", "depositId" }, new[] { "复盘结论", "后续行动", "负责人", "处理状态" }, new[] { "occupancyRate", "leadBookingConversionRate", "bookingCheckinConversionRate", "depositLiabilityBalance", "unconfirmedPaymentAmount", "financeVarianceAmount", "folioBalance" })
            },
            "先把线索转预订，再分配床位、生成账本、完成押金和财务确认。",
            "Сначала лид и бронь, затем койка, фолио, депозит и финансы."),
        Workspace("W-STAY-LEAD-RESERVATION", "stay", "T-STAY-LEAD-RESERVATION", "我要管理线索预订", "Управлять лидами и бронью",
            "线索、跟进、预订、取消和转入住以合同形式并行进入宿舍运行时。",
            "Лиды, follow-up, бронь, отмена и конвертация в проживание как contract-only slice.",
            new[]
            {
                Card("leadCapture", "ready", "线索捕获卡", "Захват лида", new[] { "leadId", "operatorId" }, new[] { "联系日期", "线索姓名", "电话", "通讯方式", "需要床位数", "期望入住日期", "住宿时长", "来源渠道", "预算金额", "线索状态", "线索备注" }, new[] { "线索转预订率", "来源转化率" }),
                Card("leadFollowUp", "notStarted", "线索跟进卡", "Follow-up лида", new[] { "leadId", "operatorId" }, new[] { "线索", "跟进日期", "跟进结果", "下一次跟进时间", "线索状态", "线索备注" }, new[] { "跟进次数", "跟进滞留天数" }),
                Card("reservationCreate", "notStarted", "预订创建卡", "Создание брони", new[] { "reservationId", "leadId" }, new[] { "线索", "预订床位数", "预留房间", "预留床位", "计划入住日期", "保留截止时间", "是否需要预订押金", "预订押金金额", "预订备注" }, new[] { "未来占用床夜", "预订转入住率" }),
                Card("reservationCancel", "notStarted", "预订取消卡", "Отмена брони", new[] { "reservationId", "operatorId" }, new[] { "预订单", "取消原因", "释放床位", "取消备注" }, new[] { "取消预订数", "释放床夜" }),
                Card("reservationConvert", "notStarted", "预订转入住卡", "Конвертация брони", new[] { "reservationId", "stayId" }, new[] { "预订单", "入住单", "转入住日期", "转换备注" }, new[] { "预订转入住率", "转换耗时" })
            },
            "先确认线索，再创建预订，不允许线索直接变成住客。",
            "Сначала лид, затем бронь; лид не становится жильцом напрямую."),
        Workspace("W-STAY-LIFECYCLE", "stay", "T-STAY-LIFECYCLE", "我要管理在住生命周期", "Управлять жизненным циклом проживания",
            "住客资料、正式入住、分床、应收和续住形成独立生命周期合同。",
            "Профиль, заселение, койка, начисление и продление как отдельный контракт.",
            new[]
            {
                Card("residentProfile", "ready", "住客资料卡", "Профиль жильца", new[] { "residentId", "operatorId" }, new[] { "住客姓名", "电话", "证件类型", "证件号码", "性别", "国籍", "紧急联系人", "紧急联系电话", "住客备注" }, new[] { "住客完整度", "重复住客风险" }),
                Card("checkInBedAssign", "notStarted", "入住分床卡", "Заселение и койка", new[] { "stayId", "residentId" }, new[] { "住客", "预订单", "入住日期", "计划退住日期", "房间", "床位", "计费方式", "单价", "计费数量", "优惠金额" }, new[] { "入住占用床夜", "床位冲突数" }),
                Card("chargeAssessment", "notStarted", "应收评估卡", "Начисление", new[] { "chargeId", "stayId" }, new[] { "入住单", "应收类型", "计费开始日期", "计费结束日期", "应收金额", "应收原因", "应收备注" }, new[] { "应收总额", "欠款余额" }),
                Card("stayExtension", "notStarted", "续住调整卡", "Продление", new[] { "stayId", "operatorId" }, new[] { "入住单", "新的计划退住日期", "计费方式", "单价", "续住原因", "续住备注" }, new[] { "续住床夜", "新增应收金额" })
            },
            "正式入住必须由住客、床位和应收账本共同解释。",
            "Проживание объясняется жильцом, койкой и начислением."),
        Workspace("W-STAY-DEPOSIT-LEDGER", "stay", "T-STAY-DEPOSIT-LEDGER", "我要管理押金账本", "Управлять депозитным реестром",
            "押金评估、收取、财务确认、扣除、退款和关闭独立于普通收入。",
            "Оценка, прием, подтверждение, удержание, возврат и закрытие депозита отдельно от дохода.",
            new[]
            {
                Card("depositAssessment", "ready", "押金评估卡", "Оценка депозита", new[] { "depositId", "stayId" }, new[] { "入住单", "押金类型", "应收押金金额", "币种", "押金截止日期", "押金规则说明" }, new[] { "当前持有押金", "押金负债余额" }),
                Card("depositReceipt", "notStarted", "押金收取卡", "Прием депозита", new[] { "depositReceiptId", "depositId" }, new[] { "押金单", "付款人", "实收押金金额", "收取日期", "支付方式", "收款人", "押金凭证", "押金收款备注" }, new[] { "待确认押金金额", "押金凭证缺失数" }),
                Card("depositConfirmation", "notStarted", "押金财务确认卡", "Фин. подтверждение депозита", new[] { "financeReviewId", "depositReceiptId" }, new[] { "押金收款记录", "确认金额", "确认结果", "差异原因", "财务备注" }, new[] { "押金确认金额", "押金差异金额" }),
                Card("depositDeduction", "notStarted", "押金扣除卡", "Удержание депозита", new[] { "depositTransactionId", "depositId" }, new[] { "押金单", "扣除金额", "扣除原因", "处理意见" }, new[] { "已扣押金", "剩余持有押金" }),
                Card("depositRefundApproval", "notStarted", "押金退款审批卡", "Утверждение возврата депозита", new[] { "depositRefundApprovalId", "depositId" }, new[] { "押金单", "扣除金额", "扣除原因", "抵扣欠款金额", "应退金额", "处理意见" }, new[] { "当前持有押金", "押金退款待支付金额" }),
                Card("depositRefundPayment", "notStarted", "押金退款支付卡", "Выплата возврата депозита", new[] { "depositRefundPaymentId", "depositId" }, new[] { "押金单", "退款方式", "退款接收人", "退款凭证", "付款时间", "人工确认摘要" }, new[] { "已退押金", "押金负债余额" }),
                Card("depositClose", "notStarted", "押金关闭卡", "Закрытие депозита", new[] { "depositId", "auditTraceId" }, new[] { "押金单", "关闭结果", "人工确认摘要" }, new[] { "押金负债余额", "押金关闭耗时" })
            },
            "押金永远是负债账本，不进入普通收入。",
            "Депозит всегда обязательство, не обычный доход."),
        Workspace("W-STAY-PAYMENT-LEDGER", "stay", "T-STAY-PAYMENT-LEDGER", "我要管理普通收款账本", "Управлять платежным реестром",
            "普通收款、财务确认、分配、调整和欠款跟进与押金完全分离。",
            "Платежи, фин. подтверждение, распределение, корректировки и долги отдельно от депозитов.",
            new[]
            {
                Card("paymentReceipt", "ready", "普通收款登记卡", "Регистрация платежа", new[] { "paymentId", "stayId" }, new[] { "入住单", "付款人", "收款日期", "收款用途", "覆盖周期开始", "覆盖周期结束", "收款金额", "币种", "支付方式", "收款人", "收款凭证" }, new[] { "当前欠款余额", "待确认普通收款" }),
                Card("paymentConfirmation", "notStarted", "普通收款确认卡", "Подтверждение платежа", new[] { "financeReviewId", "paymentId" }, new[] { "收款记录", "确认金额", "确认结果", "差异原因", "财务备注" }, new[] { "已确认普通收款", "普通收款差异金额" }),
                Card("paymentAllocation", "notStarted", "收款分配卡", "Распределение платежа", new[] { "allocationId", "paymentId" }, new[] { "收款记录", "分配方式", "覆盖应收项", "分配金额", "分配备注" }, new[] { "已分配金额", "欠款余额" }),
                Card("paymentAdjustment", "notStarted", "收款调整卡", "Корректировка платежа", new[] { "paymentAdjustmentId", "paymentId" }, new[] { "收款记录", "调整金额", "调整原因", "处理意见" }, new[] { "调整后余额", "调整次数" }),
                Card("debtFollowUp", "notStarted", "欠款跟进卡", "Контроль долга", new[] { "stayId", "operatorId" }, new[] { "入住单", "欠款原因", "跟进日期", "跟进结果", "下一次跟进时间" }, new[] { "欠款余额", "逾期天数" })
            },
            "普通收款必须先确认，再分配到可解释的应收项。",
            "Обычный платеж сначала подтверждается, затем распределяется на начисления."),
        Workspace("W-STAY-CHECKOUT-SETTLEMENT", "stay", "T-STAY-CHECKOUT-SETTLEMENT", "我要办理退住结算", "Оформить расчет при выезде",
            "退住开始、查房、押金处理、最终结算、床位释放和清洁任务形成闭环。",
            "Выезд, инспекция, депозит, финальный расчет, освобождение койки и уборка.",
            new[]
            {
                Card("checkoutStart", "ready", "退住开始卡", "Начало выезда", new[] { "checkoutId", "stayId" }, new[] { "入住单", "实际退住日期", "退住原因" }, new[] { "当前余额", "持有押金" }),
                Card("roomInspection", "notStarted", "查房卡", "Инспекция комнаты", new[] { "inspectionId", "stayId" }, new[] { "入住单", "房间状态", "床位状态", "是否发现损坏", "损坏说明", "损坏扣款金额", "是否需要清洁", "查房凭证" }, new[] { "损坏数", "查房耗时" }),
                Card("depositSettlement", "notStarted", "押金结算卡", "Расчет депозита", new[] { "settlementId", "depositId" }, new[] { "押金单", "扣除金额", "抵扣欠款金额", "处理意见" }, new[] { "应退金额", "押金负债余额" }),
                Card("finalBalanceClose", "notStarted", "最终余额关闭卡", "Закрытие баланса", new[] { "settlementId", "stayId" }, new[] { "入住单", "押金扣除金额", "押金抵欠金额", "结算结果" }, new[] { "总应收", "总已收", "持有押金", "未结欠款" }),
                Card("bedRelease", "notStarted", "床位释放卡", "Освобождение койки", new[] { "bedId", "checkoutId" }, new[] { "床位", "释放床位", "释放备注" }, new[] { "释放床夜", "周转耗时" }),
                Card("postCheckoutCleaning", "notStarted", "退住后清洁卡", "Уборка после выезда", new[] { "serviceTaskId", "roomId" }, new[] { "房间", "床位", "任务类型", "目标完成日期", "处理措施" }, new[] { "待清洁任务数", "阻断床位天数" })
            },
            "退住关闭前必须解释余额、押金、查房和床位释放。",
            "Перед закрытием нужны баланс, депозит, инспекция и койка."),
        Workspace("W-STAY-SERVICE-TASK", "stay", "T-STAY-SERVICE-TASK", "我要管理清洁维修任务", "Управлять сервисными задачами",
            "清洁、维修和配置任务影响房间床位可售状态。",
            "Уборка, ремонт и комплектация влияют на доступность комнаты и койки.",
            new[]
            {
                Card("serviceTaskCreate", "ready", "服务任务创建卡", "Создание задачи", new[] { "taskId", "operatorId" }, new[] { "任务日期", "任务类型", "房间", "床位", "区域", "问题描述", "处理措施", "紧急程度", "负责人", "是否阻断可售", "目标完成日期", "任务凭证" }, new[] { "阻断床位天数", "任务创建耗时" }),
                Card("serviceTaskAssign", "notStarted", "服务任务分派卡", "Назначение задачи", new[] { "taskId", "operatorId" }, new[] { "任务", "负责人", "优先级", "目标完成日期", "分派备注" }, new[] { "待处理任务数", "超时风险" }),
                Card("serviceTaskComplete", "notStarted", "服务任务完成卡", "Завершение задачи", new[] { "taskId", "operatorId" }, new[] { "任务", "完成日期", "完成结果", "实际成本", "关联支出", "完成凭证" }, new[] { "实际成本", "任务完成耗时" }),
                Card("serviceTaskVerify", "notStarted", "服务任务验收卡", "Проверка задачи", new[] { "taskId", "managerId" }, new[] { "任务", "验收结果", "验收备注", "处理意见" }, new[] { "验收通过率", "返工次数" }),
                Card("roomReleaseAfterService", "notStarted", "服务后释放卡", "Освобождение после сервиса", new[] { "roomId", "bedId" }, new[] { "房间", "床位", "释放床位", "释放备注" }, new[] { "恢复可售床位数", "阻断恢复耗时" })
            },
            "阻断可售的任务必须显式释放房间或床位。",
            "Задача, блокирующая продажу, требует явного освобождения ресурса."),
        Workspace("W-STAY-EXPENSE-LEDGER", "finance", "T-STAY-EXPENSE-LEDGER", "我要管理宿舍支出", "Управлять расходами общежития",
            "支出可独立记录，也可关联房间、床位、任务和周期。",
            "Расходы можно вести отдельно или связать с комнатой, койкой, задачей и периодом.",
            new[]
            {
                Card("expenseRecord", "ready", "支出登记卡", "Регистрация расхода", new[] { "expenseId", "operatorId" }, new[] { "支出日期", "支出类别", "支出描述", "支出金额", "币种", "付款人", "支付方式", "关联房间", "关联床位", "关联任务", "支出凭证" }, new[] { "待审批支出", "房间成本" }),
                Card("expenseApproval", "notStarted", "支出审批卡", "Утверждение расхода", new[] { "expenseId", "reviewerId" }, new[] { "支出记录", "确认金额", "审批结果", "差异原因", "审批备注" }, new[] { "已确认支出", "待确认支出" }),
                Card("expenseLink", "notStarted", "支出关联卡", "Связь расхода", new[] { "expenseId", "linkId" }, new[] { "支出记录", "关联房间", "关联床位", "关联任务", "关联备注" }, new[] { "任务成本", "费用收入比" })
            },
            "支出不和押金退款混淆，押金退款不是经营支出。",
            "Расходы не смешиваются с возвратами депозитов."),
        Workspace("W-STAY-PERIOD-ANALYTICS", "stay", "T-STAY-PERIOD-ANALYTICS", "我要做周期经营复盘", "Провести периодический анализ",
            "10 日周期经营复盘拆成范围、指标、财务、运营诊断、行动计划和关闭。",
            "10-дневный обзор разделен на scope, метрики, финансы, диагностику, план и закрытие.",
            new[]
            {
                Card("periodScope", "ready", "周期范围卡", "Период", new[] { "periodId", "managerId" }, new[] { "年份", "周期编号", "周期开始时间", "周期结束时间", "周期说明" }, new[] { "周期名称", "周期天数" }),
                Card("periodMetricsReview", "notStarted", "周期指标复核卡", "Проверка метрик", new[] { "periodId", "managerId" }, new[] { "指标快照备注" }, new[] { "总床位数", "可售床夜", "已售床夜", "平均入住率", "入住人数", "退住人数", "新线索数", "预订数", "线索转预订率", "预订转入住率" }),
                Card("periodFinanceReview", "notStarted", "周期财务复核卡", "Финансовый обзор", new[] { "periodId", "financeReviewId" }, new[] { "财务复核结果", "财务复核备注" }, new[] { "房租收入", "其他收入", "已确认普通收款", "待确认普通收款", "周期押金收取", "周期押金退还", "周期押金扣除", "押金抵欠金额", "期末押金负债", "已确认支出", "待确认支出", "周期净现金流", "期末欠款", "财务异常数" }),
                Card("periodOperationsDiagnosis", "notStarted", "周期运营诊断卡", "Операционная диагностика", new[] { "periodId", "managerId" }, new[] { "主要问题分类", "主要问题", "根因分析", "诊断置信度" }, new[] { "阻断床位天数", "空床损失估算", "阻断损失估算", "期末未完成任务", "超时任务数", "欠款住客数" }),
                Card("periodActionPlan", "notStarted", "周期行动计划卡", "План действий", new[] { "actionPlanId", "periodId" }, new[] { "经营周期", "行动标题", "行动类型", "目标指标", "目标值", "截止日期", "负责人", "优先级", "行动状态" }, new[] { "当前值", "行动计划数量" }),
                Card("periodClose", "notStarted", "周期关闭卡", "Закрытие периода", new[] { "periodId", "managerId" }, new[] { "经营周期", "关闭结果", "管理结论", "下一周期重点" }, new[] { "指标已复核", "财务已复核", "运营已诊断", "行动计划数量", "阻断问题数量" })
            },
            "周期关闭前必须完成指标、财务、运营诊断和行动计划。",
            "Перед закрытием нужны метрики, финансы, диагностика и план действий."),
        Workspace("W-STAY-CHECKOUT", "stay", "T-STAY-CHECKOUT", "我要办理退房", "Оформить выселение",
            "退房发起、房间检查、费用结算、财务确认和释放床位在一个办理面完成。",
            "Выселение, проверка, расчет, финансы и освобождение койки вместе.",
            new[]
            {
                Card("checkoutStart", "ready", "退房发起卡", "Начало", new[] { "checkoutId", "stayOrderId" }, new[] { "退房人", "退房原因", "预计退房时间" }, new[] { "checkoutStartLeadTime" }),
                Card("roomInspection", "notStarted", "房间检查卡", "Проверка", new[] { "inspectionId", "roomId", "bedId" }, new[] { "房间状态", "物品/损坏检查", "照片证据" }, new[] { "damageCount", "inspectionDuration" }),
                Card("feeSettlement", "notStarted", "费用结算卡", "Расчет", new[] { "settlementId", "stayOrderId" }, new[] { "住宿费用", "额外费用", "押金抵扣", "应退/应补" }, new[] { "settlementDuration", "refundAmount" }),
                Card("checkoutFinance", "notStarted", "财务确认卡", "Финансы", new[] { "financeReviewId", "settlementId" }, new[] { "退款/补款确认", "财务凭证", "确认人" }, new[] { "refundDuration" }),
                Card("checkoutClose", "notStarted", "退房关闭卡", "Закрытие", new[] { "auditTraceId", "bedId" }, new[] { "释放床位", "关闭住宿单", "人工确认摘要" }, new[] { "checkoutTotalDuration" })
            },
            "先发起退房并完成房间检查。",
            "Начните выселение и проверьте комнату."),
        Workspace("W-STAY-DEPOSIT-EXCEPTION", "finance", "T-FIN-DEPOSIT", "我要处理押金异常", "Разобрать исключение депозита",
            "围绕押金异常原因、补交材料、财务复核和回到业务闭环处理。",
            "Причина, материалы, фин. проверка и возврат в процесс.",
            new[]
            {
                Card("reason", "done", "异常原因卡", "Причина", new[] { "exceptionId", "depositEvidenceId" }, new[] { "金额不一致", "凭证不清晰", "付款人不一致" }, new[] { "exceptionTypeCount" }),
                Card("resubmit", "ready", "补交材料卡", "Материалы", new[] { "depositEvidenceId", "stayOrderId" }, new[] { "新凭证", "收据编号", "补充说明" }, new[] { "resubmitDuration" }),
                Card("review", "notStarted", "财务复核卡", "Проверка", new[] { "financeReviewId", "reviewerId" }, new[] { "通过", "退回", "需人工沟通" }, new[] { "reviewDuration", "returnCount" }),
                Card("returnBusiness", "notStarted", "回到业务卡", "Возврат", new[] { "stayOrderId", "currentStage" }, new[] { "回到入住", "回到退房", "保持阻断" }, new[] { "exceptionResolutionDuration" })
            },
            "补交材料后等待财务复核。",
            "После материалов ждите фин. проверку."),
        Workspace("W-REPAIR-REQUEST", "repair", "T-AUTO-DIAGNOSE", "我要处理报修", "Обработать заявку ремонта",
            "客户车辆、报修信息、到场确认和派工入口形成报修闭环。",
            "Клиент, авто, заявка, прибытие и готовность к назначению.",
            new[]
            {
                Card("customerVehicle", "done", "客户车辆卡", "Клиент/авто", new[] { "repairCustomerId", "vehicleId" }, new[] { "客户", "车牌", "车型", "VIN", "联系方式" }, new[] { "vehicleMatchRate" }),
                Card("request", "done", "报修信息卡", "Заявка", new[] { "repairOrderId", "driverId" }, new[] { "故障描述", "车辆位置", "司机", "紧急程度" }, new[] { "requestCompleteness" }),
                Card("arrival", "ready", "到场确认卡", "Прибытие", new[] { "arrivalId", "vehicleId" }, new[] { "到场时间", "车辆状态", "接车人", "初步风险" }, new[] { "arrivalLeadTime" }),
                Card("dispatchEntry", "notStarted", "派工入口卡", "Назначение", new[] { "repairOrderId", "queueItemId" }, new[] { "是否可派工", "阻断原因", "下一步责任人" }, new[] { "dispatchReadyRate" })
            },
            "确认车辆到场后进入派工。",
            "После прибытия можно назначать диагностику."),
        Workspace("W-REPAIR-DISPATCH", "repair", "T-AUTO-DIAGNOSE", "我要安排维修", "Назначить ремонт",
            "派工、诊断、维修执行和阻断恢复在一个维修办理面中处理。",
            "Назначение, диагностика, ремонт и блокировки в одной области.",
            new[]
            {
                Card("dispatch", "ready", "派工卡", "Назначение", new[] { "technicianId", "workbayId" }, new[] { "技师", "工位", "预计开始时间", "优先级" }, new[] { "dispatchLeadTime" }),
                Card("diagnosis", "notStarted", "诊断卡", "Диагностика", new[] { "diagnosisId", "repairOrderId" }, new[] { "故障分类", "诊断结论", "所需配件", "预计费用" }, new[] { "diagnosisDuration" }),
                Card("execution", "notStarted", "维修执行卡", "Ремонт", new[] { "repairProgressId", "partsRequestId" }, new[] { "维修项目", "工时", "配件", "过程照片" }, new[] { "vehicleDowntime" }),
                Card("repairBlocker", "notStarted", "阻断卡", "Блокировка", new[] { "blockerId", "repairOrderId" }, new[] { "无技师", "缺配件", "费用待确认", "客户不同意" }, new[] { "blockerDuration" })
            },
            "先选择技师和工位，不会自动关闭维修单。",
            "Выберите механика и пост; заявка не закроется автоматически."),
        Workspace("W-REPAIR-CLOSE", "repair", "T-REPAIR-CLOSE", "我要验收关闭", "Принять и закрыть ремонт",
            "验收、费用材料、客户确认和关闭摘要形成关闭闭环。",
            "Приемка, расходы, клиент и закрытие.",
            new[]
            {
                Card("inspection", "ready", "验收卡", "Приемка", new[] { "inspectionId", "repairOrderId" }, new[] { "维修结果", "试车结果", "验收照片", "验收人" }, new[] { "inspectionDuration" }),
                Card("feeMaterial", "notStarted", "费用材料卡", "Расходы", new[] { "feeMaterialId", "repairOrderId" }, new[] { "工时费", "配件费", "其它费用", "财务材料" }, new[] { "feeMaterialDuration" }),
                Card("customerConfirm", "notStarted", "客户确认卡", "Клиент", new[] { "customerConfirmId", "driverId" }, new[] { "客户签字", "司机确认", "异议说明" }, new[] { "disputeCount" }),
                Card("close", "notStarted", "关闭卡", "Закрытие", new[] { "auditTraceId", "repairOrderId" }, new[] { "关闭摘要", "车辆恢复状态", "人工确认关闭" }, new[] { "closeDuration" })
            },
            "先完成验收，费用材料齐全后才能关闭。",
            "Сначала приемка; закрыть можно после расходов."),
        Workspace("W-REPAIR-MASTER-DATA", "repair", "T-VEHICLE-CREATE", "我要创建维修资料", "Создать ремонтные справочники",
            "客户、车辆和服务规则在同一资料建档办理面完成。",
            "Клиент, авто и правила сервиса вместе.",
            new[]
            {
                Card("customer", "ready", "客户建档卡", "Клиент", new[] { "repairCustomerId", "operatorId" }, new[] { "客户名称", "联系人", "电话", "类型" }, new[] { "customerCreationDuration" }),
                Card("vehicle", "ready", "车辆建档卡", "Авто", new[] { "vehicleId", "repairCustomerId" }, new[] { "车牌", "品牌车型", "VIN", "发动机号", "里程" }, new[] { "duplicatePlateCount", "duplicateVinCount" }),
                Card("serviceRule", "notStarted", "服务规则卡", "Правила", new[] { "serviceRuleId", "vehicleId" }, new[] { "结算方式", "常用司机", "维修优先级", "授权规则" }, new[] { "ruleCompletionRate" })
            },
            "先建客户和车辆，再补服务规则。",
            "Создайте клиента и авто, затем правила.")
    };

    private static WorkspaceSeed Workspace(string id, string domain, string taskId, string zhTitle, string ruTitle, string zhSummary, string ruSummary, IReadOnlyList<CardSeed> cards, string zhNext, string ruNext) =>
        new(id, domain, taskId, zhTitle, ruTitle, zhSummary, ruSummary, cards, zhNext, ruNext);

    private static CardSeed Card(string id, string status, string zhTitle, string ruTitle, string[] system, string[] business, string[] analytics) =>
        new(id, status, zhTitle, ruTitle, system, business, analytics);
}

internal sealed record WorkspaceSeed(
    string Id,
    string Domain,
    string TaskId,
    string ZhTitle,
    string RuTitle,
    string ZhSummary,
    string RuSummary,
    IReadOnlyList<CardSeed> Cards,
    string ZhNext,
    string RuNext);
