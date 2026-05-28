import "./styles.css";

const i18n = {
  "zh-CN": {
    app: "WorkOSNext",
    subtitle: "移动端业务操作系统",
    home: "首页",
    search: "搜索",
    workbench: "工作台",
    me: "我的",
    zh: "中文",
    ru: "Русский",
    role: "运营经办人",
    start: "开始使用",
    skip: "跳过",
    guideTitle: "先看判断，再办任务",
    guideBody: "每天先看首页的判断；知道要找什么就直接搜索；系统派给你的事进工作台；自己的记录、提醒和反馈放在我的。",
    todayMode: "首页：看全局优先级和每个业务最急的一件事",
    intentMode: "搜索：用人、房间、车牌或动作直接进入业务",
    queueMode: "工作台：只处理系统分配给你的被动任务",
    personalMode: "我的：管理笔记、提醒、统计、语言和反馈",
    globalCommand: "全局指挥",
    globalCommandTitle: "今天先清两个阻断",
    globalReason: "住宿押金阻断入住，维修未诊断会影响车辆复运。",
    globalImpact: "先补押金材料，再派维修诊断；两条线都不会自动执行关键动作。",
    homeSearch: "熟悉系统？直接搜索",
    businessFocus: "业务局部闭环",
    scenarioFocus: "今日关键场景",
    objectCreation: "对象建档",
    businessHandling: "业务办理",
    exceptionHandling: "异常处理",
    stayCheckinFlow: "入住办理闭环",
    stayCheckoutFlow: "退房办理闭环",
    stayDepositExceptionFlow: "押金异常闭环",
    roomCreationFlow: "创建房间闭环",
    bedCreationFlow: "创建床位闭环",
    repairOrderFlow: "报修维修闭环",
    repairDispatchFlow: "派工诊断闭环",
    repairCloseFlow: "验收关闭闭环",
    repairCustomerFlow: "维修客户建档闭环",
    vehicleCreationFlow: "车辆资料建档闭环",
    businessFields: "业务字段",
    noCriticalBlocker: "当前没有新的系统阻断，但关键动作仍需要人工确认。",
    confirmationDraft: "确认前请核对对象、金额、责任人、证据和影响范围。",
    flowStage: "流程阶段",
    evidence: "证据",
    policy: "人工确认边界",
    todayCard: "今日指挥卡",
    nowDo: "现在最该处理",
    reason: "原因",
    impact: "影响",
    nextUrgent: "下一件紧急任务",
    enterTask: "进入任务",
    open: "查看",
    continue: "继续处理",
    activeSearch: "主动办理",
    searchPlaceholder: "输入人、房间、车牌或业务动作",
    bestNext: "最佳下一步",
    runnableTasks: "可办理任务",
    relatedObjects: "相关对象",
    helpExplain: "帮助解释",
    scenarios: "业务场景",
    stay: "住宿",
    repair: "维修",
    finance: "财务",
    checkin: "办理入住",
    depositBlocked: "押金未通过",
    createStay: "创建住宿单",
    createRoom: "创建房间",
    createBed: "创建床位",
    createResident: "创建入住人",
    checkout: "办理退房",
    createRepair: "创建维修单",
    createRepairCustomer: "创建维修客户",
    createVehicle: "创建车辆资料",
    assignRepair: "维修派工",
    repairInspect: "维修验收",
    confirmPayment: "确认收款",
    returnEvidence: "退回凭证",
    queueTitle: "被动任务队列",
    filterMore: "展开",
    filterLess: "收起",
    sort: "排序",
    smartSort: "智能推荐",
    dueSort: "截止时间",
    filter: "筛选",
    advancedFilter: "高级筛选",
    all: "全部",
    mine: "待我处理",
    confirm: "待确认",
    blocked: "异常",
    soon: "即将到期",
    waiting: "等待他人",
    notes: "笔记",
    reminders: "提醒",
    feedback: "反馈",
    tutorial: "教程",
    learningCenter: "学习中心",
    learningCenterBody: "你卡在哪一步？搜索业务词或点击闭环阶段，系统只展开这一阶段的字段、判断、证据、确认和下一步。",
    scenarioCoach: "场景教练",
    coachSearchPlaceholder: "搜索押金、报修、车辆到场、谁确认、缺什么材料",
    coachPerspective: "学习视角",
    coachNoMatch: "没有匹配的场景阶段，换一个业务词或动作词试试。",
    coachAll: "全部",
    coachHowTo: "怎么办理",
    coachFields: "需要字段",
    coachException: "异常阻断",
    coachConfirm: "人工确认",
    coachNext: "下一步",
    coachAi: "AI 边界",
    stageWhat: "这一步做什么",
    stageFields: "需要填写什么",
    stageJudgement: "系统会检查什么",
    stageEvidence: "需要什么证据",
    stageConfirm: "谁来确认",
    stageAfter: "完成后进入什么状态",
    stageNext: "下一步是什么",
    enterRelatedTask: "进入相关任务",
    openRelatedObject: "打开相关对象",
    coachHowToUse: "搜索后会直接高亮并展开相关闭环阶段；不再把知识拆成脱离业务的结果列表。",
    intentWorkspace: "意图办理面",
    cardFields: "字段分层",
    systemFields: "系统字段",
    analyticsFields: "统计分析字段",
    cardOperation: "办理操作",
    cardAction: "当前动作",
    cardInput: "操作输入",
    searchableSelect: "可搜索选择",
    cardEvidence: "提交证据",
    cardConfirm: "人工确认",
    cardNext: "完成后",
    saveDraft: "保存草稿",
    submitForReview: "提交处理",
    blockers: "阻断",
    nextBestAction: "最佳下一步",
    openWorkspace: "进入办理面",
    notStarted: "未开始",
    ready: "可办理",
    inProgress: "处理中",
    done: "已完成",
    quickStart: "快速上手",
    sceneLearning: "场景学习",
    roleLearning: "角色与边界",
    currentCapability: "当前系统能力",
    aiCanDo: "AI 可以解释、推荐、总结和生成草稿。",
    aiCannotDo: "AI 不能自动确认、扣费、退款、核销或关闭终态。",
    stats: "统计",
    permission: "权限范围",
    commonSearch: "常用搜索",
    savedFilter: "常用筛选",
    noteTitle: "业务笔记",
    reminderTitle: "时间提醒",
    feedbackTitle: "页面反馈",
    noteBody: "记录和业务对象有关的非正式信息，可设置时间提醒。",
    reminderBody: "提醒可以来自笔记，也可以来自任务截止时间。",
    feedbackBody: "反馈会自动带上页面、角色、语言和当前业务上下文。",
    actionBoundary: "关键动作需要人工确认，AI 只能解释、推荐和生成草稿。",
    depositTask: "补交押金材料",
    repairTask: "安排技师诊断",
    financeTask: "确认押金收款",
    stayObject: "张三的住宿单",
    repairObject: "Toyota Camry 发动机异响",
    financeObject: "押金收款确认",
    depositProblem: "押金 3000 KGS 财务未通过，不能办理入住。",
    repairProblem: "车辆已到场，等待维修主管安排技师诊断。",
    financeProblem: "住宿经办人已补交材料，等待财务人工确认。",
    whyMe: "为什么给我",
    ifDelay: "不处理会怎样",
    operation: "操作区",
    guidance: "下一步 / 提示 / 帮助",
    confirmAction: "确认办理",
    finish: "确认完成",
    evidenceDone: "已记录操作证据"
  },
  "ru-RU": {
    app: "WorkOSNext",
    subtitle: "Мобильная бизнес ОС",
    home: "Главная",
    search: "Поиск",
    workbench: "Работа",
    me: "Мой",
    zh: "中文",
    ru: "Русский",
    role: "Операционный сотрудник",
    start: "Начать",
    skip: "Пропустить",
    guideTitle: "Сначала решение, затем задача",
    guideBody: "Сначала смотрите решение на главной; если знаете, что нужно, ищите напрямую; назначенные задачи открывайте в работе; свои заметки и напоминания держите в моем разделе.",
    todayMode: "Главная: общий приоритет и срочная задача по каждому бизнесу",
    intentMode: "Поиск: вход по человеку, комнате, номеру авто или действию",
    queueMode: "Работа: пассивные задачи, назначенные системой",
    personalMode: "Мой: заметки, напоминания, статистика, язык и отзыв",
    globalCommand: "Общее решение",
    globalCommandTitle: "Сегодня снять две блокировки",
    globalReason: "Депозит блокирует заселение, ремонт без диагностики задержит возврат авто.",
    globalImpact: "Сначала депозит, затем диагностика; критические действия не выполняются автоматически.",
    homeSearch: "Знаете задачу? Ищите сразу",
    businessFocus: "Бизнес-циклы",
    scenarioFocus: "Срочные сценарии",
    objectCreation: "Создание объектов",
    businessHandling: "Бизнес-процесс",
    exceptionHandling: "Исключения",
    stayCheckinFlow: "Цикл заселения",
    stayCheckoutFlow: "Цикл выселения",
    stayDepositExceptionFlow: "Исключение депозита",
    roomCreationFlow: "Создание комнаты",
    bedCreationFlow: "Создание койки",
    repairOrderFlow: "Цикл ремонта",
    repairDispatchFlow: "Диагностика",
    repairCloseFlow: "Приемка и закрытие",
    repairCustomerFlow: "Клиент ремонта",
    vehicleCreationFlow: "Карточка авто",
    businessFields: "Бизнес-поля",
    noCriticalBlocker: "Новых системных блокировок нет, но критическое действие все равно подтверждает человек.",
    confirmationDraft: "Перед подтверждением проверьте объект, сумму, ответственного, доказательства и влияние.",
    flowStage: "Этап",
    evidence: "Доказательство",
    policy: "Граница ручного подтверждения",
    todayCard: "Командная карточка",
    nowDo: "Сейчас важно",
    reason: "Причина",
    impact: "Влияние",
    nextUrgent: "Следующая срочная задача",
    enterTask: "Задача",
    open: "Открыть",
    continue: "Продолжить",
    activeSearch: "Активное действие",
    searchPlaceholder: "Гость, комната, номер авто или действие",
    bestNext: "Лучший следующий шаг",
    runnableTasks: "Доступные задачи",
    relatedObjects: "Связанные объекты",
    helpExplain: "Объяснение",
    scenarios: "Сценарии",
    stay: "Проживание",
    repair: "Ремонт",
    finance: "Финансы",
    checkin: "Заселение",
    depositBlocked: "Депозит не прошел",
    createStay: "Создать ордер",
    createRoom: "Создать комнату",
    createBed: "Создать койку",
    createResident: "Создать жильца",
    checkout: "Выселение",
    createRepair: "Создать ремонт",
    createRepairCustomer: "Создать клиента",
    createVehicle: "Создать авто",
    assignRepair: "Назначить ремонт",
    repairInspect: "Приемка ремонта",
    confirmPayment: "Подтвердить оплату",
    returnEvidence: "Вернуть документ",
    queueTitle: "Пассивная очередь",
    filterMore: "Еще",
    filterLess: "Скрыть",
    sort: "Сортировка",
    smartSort: "Умно",
    dueSort: "Срок",
    filter: "Фильтр",
    advancedFilter: "Фильтры",
    all: "Все",
    mine: "Мои",
    confirm: "Подтвердить",
    blocked: "Блок",
    soon: "Скоро",
    waiting: "Ждем",
    notes: "Заметки",
    reminders: "Напоминания",
    feedback: "Отзыв",
    tutorial: "Обучение",
    learningCenter: "Учебный центр",
    learningCenterBody: "Где вы застряли? Ищите бизнес-термин или выберите этап, система покажет поля, проверки, доказательства, подтверждение и следующий шаг.",
    scenarioCoach: "Тренер сценариев",
    coachSearchPlaceholder: "Депозит, заявка, прибытие авто, кто подтверждает, какие материалы",
    coachPerspective: "Фокус обучения",
    coachNoMatch: "Подходящий этап не найден. Попробуйте другой бизнес-термин или действие.",
    coachAll: "Все",
    coachHowTo: "Как выполнить",
    coachFields: "Поля",
    coachException: "Блокировки",
    coachConfirm: "Подтверждение",
    coachNext: "Следующий шаг",
    coachAi: "Граница AI",
    stageWhat: "Что сделать",
    stageFields: "Какие поля нужны",
    stageJudgement: "Что проверит система",
    stageEvidence: "Какие доказательства нужны",
    stageConfirm: "Кто подтверждает",
    stageAfter: "Состояние после шага",
    stageNext: "Следующий шаг",
    enterRelatedTask: "Открыть задачу",
    openRelatedObject: "Открыть объект",
    coachHowToUse: "Поиск сразу подсвечивает и раскрывает этап сценария; знания не отделены от бизнес-действия.",
    intentWorkspace: "Рабочая область намерения",
    cardFields: "Слои полей",
    systemFields: "Системные поля",
    analyticsFields: "Поля аналитики",
    cardOperation: "Операция",
    cardAction: "Текущее действие",
    cardInput: "Ввод",
    searchableSelect: "Поиск и выбор",
    cardEvidence: "Доказательство",
    cardConfirm: "Ручное подтверждение",
    cardNext: "После выполнения",
    saveDraft: "Сохранить",
    submitForReview: "Отправить",
    blockers: "Блокировки",
    nextBestAction: "Лучшее следующее действие",
    openWorkspace: "Открыть область",
    notStarted: "Не начато",
    ready: "Готово",
    inProgress: "В работе",
    done: "Готово",
    quickStart: "Быстрый старт",
    sceneLearning: "Сценарии",
    roleLearning: "Роли и границы",
    currentCapability: "Текущие возможности",
    aiCanDo: "AI объясняет, рекомендует, резюмирует и готовит черновики.",
    aiCannotDo: "AI не подтверждает, не списывает, не возвращает деньги и не закрывает финальные статусы.",
    stats: "Статистика",
    permission: "Права",
    commonSearch: "Частый поиск",
    savedFilter: "Фильтр",
    noteTitle: "Бизнес-заметки",
    reminderTitle: "Напоминания",
    feedbackTitle: "Отзыв по странице",
    noteBody: "Неформальные заметки по объекту можно связать с напоминанием.",
    reminderBody: "Напоминания приходят из заметок и сроков задач.",
    feedbackBody: "Отзыв автоматически включает страницу, роль, язык и контекст.",
    actionBoundary: "Критические действия подтверждает человек. AI только объясняет, рекомендует и готовит черновики.",
    depositTask: "Дополнить депозит",
    repairTask: "Назначить диагностику",
    financeTask: "Подтвердить депозит",
    stayObject: "Ордер проживания Чжана",
    repairObject: "Toyota Camry: шум двигателя",
    financeObject: "Подтверждение депозита",
    depositProblem: "Депозит 3000 KGS не прошел фин. проверку, заселение недоступно.",
    repairProblem: "Авто прибыло, руководитель должен назначить диагностику.",
    financeProblem: "Материалы дополнены, требуется ручная проверка финансов.",
    whyMe: "Почему мне",
    ifDelay: "Если задержать",
    operation: "Операция",
    guidance: "Следующий шаг / помощь",
    confirmAction: "Подтвердить",
    finish: "Завершить",
    evidenceDone: "Аудит записан"
  }
};

const tasks = [
  {
    id: "T-STAY-DEPOSIT",
    objectId: "SO-20260528-001",
    domain: "stay",
    flow: "stayCheckin",
    title: "depositTask",
    object: "stayObject",
    problem: "depositProblem",
    due: "18:00",
    badges: ["mine", "blocked"],
    priority: 99,
    why: { "zh-CN": "你负责住宿材料补交，财务确认前不能入住。", "ru-RU": "Вы отвечаете за материалы; без финансов заселение недоступно." },
    delay: { "zh-CN": "张三无法入住，A301-02 会停留在锁定状态。", "ru-RU": "Чжан не заселится, койка A301-02 останется заблокированной." },
    next: { "zh-CN": "补交付款截图和收据编号，再等待财务确认。", "ru-RU": "Добавьте чек и номер квитанции, затем ждите финансы." }
  },
  {
    id: "T-AUTO-DIAGNOSE",
    objectId: "AR-20260528-004",
    domain: "repair",
    flow: "repairDispatch",
    title: "repairTask",
    object: "repairObject",
    problem: "repairProblem",
    due: "17:30",
    badges: ["mine", "soon"],
    priority: 93,
    why: { "zh-CN": "你负责维修派工，车辆到场后必须先诊断。", "ru-RU": "Вы назначаете ремонт; после прибытия нужна диагностика." },
    delay: { "zh-CN": "车辆继续停运，后续配件和费用无法估算。", "ru-RU": "Авто простаивает, детали и стоимость нельзя оценить." },
    next: { "zh-CN": "选择技师和到场时间，不会自动关闭维修单。", "ru-RU": "Выберите механика и время, заявка не закроется автоматически." }
  },
  {
    id: "T-FIN-DEPOSIT",
    objectId: "FIN-20260528-009",
    domain: "finance",
    flow: "stayDepositException",
    title: "financeTask",
    object: "financeObject",
    problem: "financeProblem",
    due: "明天 12:00",
    badges: ["confirm", "waiting"],
    priority: 86,
    why: { "zh-CN": "你是财务确认人，需要人工核对收款证据。", "ru-RU": "Вы финансовый проверяющий, нужна ручная проверка." },
    delay: { "zh-CN": "住宿经办人无法继续办理入住。", "ru-RU": "Оператор проживания не сможет продолжить заселение." },
    next: { "zh-CN": "核对凭证后确认或退回，AI 不可自动通过。", "ru-RU": "Проверьте и подтвердите или верните; AI не проходит автоматически." }
  },
  {
    id: "T-STAY-CHECKOUT",
    objectId: "SO-20260520-003",
    domain: "stay",
    flow: "stayCheckout",
    title: "checkout",
    object: "stayObject",
    problem: "办理退房前需要核对房间检查、费用和押金退款材料。",
    due: "今天 19:00",
    badges: ["mine", "soon"],
    priority: 90,
    why: { "zh-CN": "你负责住宿单退房材料，财务结算前需要先完成业务核对。", "ru-RU": "Вы готовите материалы выселения перед фин. расчетом." },
    delay: { "zh-CN": "床位不能释放，押金退款和费用结算都会延迟。", "ru-RU": "Койка не освободится, возврат депозита задержится." },
    next: { "zh-CN": "核对房间检查、费用明细和退款材料后提交确认。", "ru-RU": "Проверьте комнату, расходы и возврат депозита." }
  },
  {
    id: "T-ROOM-CREATE",
    objectId: "ROOM-DRAFT-A302",
    domain: "stay",
    flow: "roomCreation",
    title: "createRoom",
    object: "createRoom",
    problem: "A302 不存在，需先创建房间再创建床位。",
    due: "建档",
    badges: ["mine"],
    priority: 78,
    why: { "zh-CN": "搜索到的房间不存在，后续床位和住宿单都依赖房间档案。", "ru-RU": "Комнаты нет, койки и ордер зависят от карточки комнаты." },
    delay: { "zh-CN": "无法创建床位，也无法为入住申请选择房间。", "ru-RU": "Нельзя создать койку и выбрать комнату для заселения." },
    next: { "zh-CN": "录入楼栋、房间号、房型、容量并校验重复。", "ru-RU": "Введите корпус, номер, тип, вместимость и проверьте дубликаты." }
  },
  {
    id: "T-BED-CREATE",
    objectId: "BED-DRAFT-A302-01",
    domain: "stay",
    flow: "bedCreation",
    title: "createBed",
    object: "createBed",
    problem: "A302 已建房间，但缺少可分配床位。",
    due: "建档",
    badges: ["mine"],
    priority: 76,
    why: { "zh-CN": "床位是住宿单分配的最小对象，必须先建档并通过容量校验。", "ru-RU": "Койка - минимальный объект назначения, нужна проверка вместимости." },
    delay: { "zh-CN": "入住申请无法进入创建住宿单。", "ru-RU": "Заявка не сможет перейти к ордеру." },
    next: { "zh-CN": "选择房间，录入床位号、床位类型、价格和检查状态。", "ru-RU": "Выберите комнату, номер койки, тип, цену и статус проверки." }
  },
  {
    id: "T-VEHICLE-CREATE",
    objectId: "VEH-DRAFT-01KG999",
    domain: "repair",
    flow: "vehicleCreation",
    title: "createVehicle",
    object: "createVehicle",
    problem: "车牌 01KG999XYZ 未建档，不能创建维修单。",
    due: "建档",
    badges: ["mine"],
    priority: 80,
    why: { "zh-CN": "维修单必须绑定客户和车辆资料，避免后续费用、历史和验收找不到对象。", "ru-RU": "Ремонт должен быть связан с клиентом и авто." },
    delay: { "zh-CN": "无法报修、派工或沉淀维修历史。", "ru-RU": "Нельзя создать ремонт и историю обслуживания." },
    next: { "zh-CN": "选择客户，录入车牌、品牌车型、VIN、发动机号和里程。", "ru-RU": "Выберите клиента, введите номер, модель, VIN, двигатель и пробег." }
  },
  {
    id: "T-REPAIR-CLOSE",
    objectId: "AR-20260527-002",
    domain: "repair",
    flow: "repairClose",
    title: "repairInspect",
    object: "repairObject",
    problem: "维修已完成，等待验收、费用材料和关闭确认。",
    due: "明天 10:00",
    badges: ["confirm", "waiting"],
    priority: 84,
    why: { "zh-CN": "你是验收确认人，关闭维修单前必须确认结果和费用材料。", "ru-RU": "Вы подтверждаете приемку перед закрытием." },
    delay: { "zh-CN": "车辆不能恢复可用，费用材料无法进入财务。", "ru-RU": "Авто не станет доступным, расходы не уйдут в финансы." },
    next: { "zh-CN": "核对维修照片、验收结论、材料费用后人工关闭。", "ru-RU": "Проверьте фото, приемку, материалы и закройте вручную." }
  }
];

const intentWorkspaces = [
  workspaceModel("W-STAY-CHECKIN", "stay", "T-STAY-DEPOSIT",
    { "zh-CN": "我要安排入住", "ru-RU": "Оформить заселение" },
    { "zh-CN": "一件事内完成申请、住宿单、押金、财务和入住确认。", "ru-RU": "Заявка, ордер, депозит, финансы и заселение в одной области." },
    [
      cardModel("application", "done", "申请卡", "Заявка", ["applicationId", "residentId", "approverId"], ["入住人", "入住原因", "预计入住/退房", "审批意见"], ["approvalLeadTime", "approvalReturnCount"]),
      cardModel("stayOrder", "ready", "住宿单卡", "Ордер", ["stayOrderId", "roomId", "bedId"], ["已审批申请", "房间床位", "入住周期", "押金/费用规则"], ["bedLockDuration", "assignmentDuration"]),
      cardModel("deposit", "blocked", "押金卡", "Депозит", ["depositEvidenceId", "stayOrderId"], ["押金金额", "币种", "付款方式", "凭证编号"], ["depositSubmitDuration", "depositReturnCount"]),
      cardModel("finance", "notStarted", "财务卡", "Финансы", ["financeReviewId", "depositEvidenceId"], ["到账状态", "确认金额", "退回原因", "财务确认人"], ["financeReviewDuration", "financePassRate"]),
      cardModel("checkin", "notStarted", "入住确认卡", "Подтверждение", ["auditTraceId", "bedId", "stayOrderId"], ["实际入住时间", "钥匙/物品交接", "人工确认摘要"], ["totalCheckinDuration", "manualConfirmCount"])
    ],
    { "zh-CN": "补齐押金材料，创建住宿单和选床在同一张住宿单卡内完成。", "ru-RU": "Дополните депозит; ордер и койка оформляются в одной карточке." }),
  workspaceModel("W-STAY-CHECKOUT", "stay", "T-STAY-CHECKOUT",
    { "zh-CN": "我要办理退房", "ru-RU": "Оформить выселение" },
    { "zh-CN": "退房发起、房间检查、费用结算、财务确认和释放床位在一个办理面完成。", "ru-RU": "Выселение, проверка, расчет, финансы и освобождение койки вместе." },
    [
      cardModel("checkoutStart", "ready", "退房发起卡", "Начало", ["checkoutId", "stayOrderId"], ["退房人", "退房原因", "预计退房时间"], ["checkoutStartLeadTime"]),
      cardModel("roomInspection", "notStarted", "房间检查卡", "Проверка", ["inspectionId", "roomId", "bedId"], ["房间状态", "物品/损坏检查", "照片证据"], ["damageCount", "inspectionDuration"]),
      cardModel("feeSettlement", "notStarted", "费用结算卡", "Расчет", ["settlementId", "stayOrderId"], ["住宿费用", "额外费用", "押金抵扣", "应退/应补"], ["settlementDuration", "refundAmount"]),
      cardModel("checkoutFinance", "notStarted", "财务确认卡", "Финансы", ["financeReviewId", "settlementId"], ["退款/补款确认", "财务凭证", "确认人"], ["refundDuration"]),
      cardModel("checkoutClose", "notStarted", "退房关闭卡", "Закрытие", ["auditTraceId", "bedId"], ["释放床位", "关闭住宿单", "人工确认摘要"], ["checkoutTotalDuration"])
    ],
    { "zh-CN": "先发起退房并完成房间检查。", "ru-RU": "Начните выселение и проверьте комнату." }),
  workspaceModel("W-STAY-DEPOSIT-EXCEPTION", "finance", "T-FIN-DEPOSIT",
    { "zh-CN": "我要处理押金异常", "ru-RU": "Разобрать исключение депозита" },
    { "zh-CN": "围绕押金异常原因、补交材料、财务复核和回到业务闭环处理。", "ru-RU": "Причина, материалы, фин. проверка и возврат в процесс." },
    [
      cardModel("reason", "done", "异常原因卡", "Причина", ["exceptionId", "depositEvidenceId"], ["金额不一致", "凭证不清晰", "付款人不一致"], ["exceptionTypeCount"]),
      cardModel("resubmit", "ready", "补交材料卡", "Материалы", ["depositEvidenceId", "stayOrderId"], ["新凭证", "收据编号", "补充说明"], ["resubmitDuration"]),
      cardModel("review", "notStarted", "财务复核卡", "Проверка", ["financeReviewId", "reviewerId"], ["通过", "退回", "需人工沟通"], ["reviewDuration", "returnCount"]),
      cardModel("returnBusiness", "notStarted", "回到业务卡", "Возврат", ["stayOrderId", "currentStage"], ["回到入住", "回到退房", "保持阻断"], ["exceptionResolutionDuration"])
    ],
    { "zh-CN": "补交材料后等待财务复核。", "ru-RU": "После материалов ждите фин. проверку." }),
  workspaceModel("W-STAY-RESOURCE", "stay", "T-ROOM-CREATE",
    { "zh-CN": "我要创建住宿资源", "ru-RU": "Создать ресурсы проживания" },
    { "zh-CN": "房间、床位和资源启用在同一资源建档办理面完成。", "ru-RU": "Комнаты, койки и активация ресурсов вместе." },
    [
      cardModel("room", "ready", "房间建档卡", "Комната", ["roomId", "buildingId"], ["楼栋", "房间号", "房型", "容量"], ["duplicateRoomCount"]),
      cardModel("bed", "notStarted", "床位建档卡", "Койка", ["bedId", "roomId"], ["床位号", "上/下铺", "价格规则", "检查状态"], ["capacityConflictCount"]),
      cardModel("activate", "notStarted", "资源启用卡", "Активация", ["bedId", "operatorId"], ["可用状态", "维护状态", "锁定原因"], ["activationDuration"])
    ],
    { "zh-CN": "先创建房间，再在同一办理面继续创建床位。", "ru-RU": "Сначала комната, затем койки в этой же области." }),
  workspaceModel("W-REPAIR-REQUEST", "repair", "T-AUTO-DIAGNOSE",
    { "zh-CN": "我要处理报修", "ru-RU": "Обработать заявку ремонта" },
    { "zh-CN": "客户车辆、报修信息、到场确认和派工入口形成报修闭环。", "ru-RU": "Клиент, авто, заявка, прибытие и готовность к назначению." },
    [
      cardModel("customerVehicle", "done", "客户车辆卡", "Клиент/авто", ["repairCustomerId", "vehicleId"], ["客户", "车牌", "车型", "VIN", "联系方式"], ["vehicleMatchRate"]),
      cardModel("request", "done", "报修信息卡", "Заявка", ["repairOrderId", "driverId"], ["故障描述", "车辆位置", "司机", "紧急程度"], ["requestCompleteness"]),
      cardModel("arrival", "ready", "到场确认卡", "Прибытие", ["arrivalId", "vehicleId"], ["到场时间", "车辆状态", "接车人", "初步风险"], ["arrivalLeadTime"]),
      cardModel("dispatchEntry", "notStarted", "派工入口卡", "Назначение", ["repairOrderId", "queueItemId"], ["是否可派工", "阻断原因", "下一步责任人"], ["dispatchReadyRate"])
    ],
    { "zh-CN": "确认车辆到场后进入派工。", "ru-RU": "После прибытия можно назначать диагностику." }),
  workspaceModel("W-REPAIR-DISPATCH", "repair", "T-AUTO-DIAGNOSE",
    { "zh-CN": "我要安排维修", "ru-RU": "Назначить ремонт" },
    { "zh-CN": "派工、诊断、维修执行和阻断恢复在一个维修办理面中处理。", "ru-RU": "Назначение, диагностика, ремонт и блокировки в одной области." },
    [
      cardModel("dispatch", "ready", "派工卡", "Назначение", ["technicianId", "workbayId"], ["技师", "工位", "预计开始时间", "优先级"], ["dispatchLeadTime"]),
      cardModel("diagnosis", "notStarted", "诊断卡", "Диагностика", ["diagnosisId", "repairOrderId"], ["故障分类", "诊断结论", "所需配件", "预计费用"], ["diagnosisDuration"]),
      cardModel("execution", "notStarted", "维修执行卡", "Ремонт", ["repairProgressId", "partsRequestId"], ["维修项目", "工时", "配件", "过程照片"], ["vehicleDowntime"]),
      cardModel("repairBlocker", "notStarted", "阻断卡", "Блокировка", ["blockerId", "repairOrderId"], ["无技师", "缺配件", "费用待确认", "客户不同意"], ["blockerDuration"])
    ],
    { "zh-CN": "先选择技师和工位，不会自动关闭维修单。", "ru-RU": "Выберите механика и пост; заявка не закроется автоматически." }),
  workspaceModel("W-REPAIR-CLOSE", "repair", "T-REPAIR-CLOSE",
    { "zh-CN": "我要验收关闭", "ru-RU": "Принять и закрыть ремонт" },
    { "zh-CN": "验收、费用材料、客户确认和关闭摘要形成关闭闭环。", "ru-RU": "Приемка, расходы, клиент и закрытие." },
    [
      cardModel("inspection", "ready", "验收卡", "Приемка", ["inspectionId", "repairOrderId"], ["维修结果", "试车结果", "验收照片", "验收人"], ["inspectionDuration"]),
      cardModel("feeMaterial", "notStarted", "费用材料卡", "Расходы", ["feeMaterialId", "repairOrderId"], ["工时费", "配件费", "其它费用", "财务材料"], ["feeMaterialDuration"]),
      cardModel("customerConfirm", "notStarted", "客户确认卡", "Клиент", ["customerConfirmId", "driverId"], ["客户签字", "司机确认", "异议说明"], ["disputeCount"]),
      cardModel("close", "notStarted", "关闭卡", "Закрытие", ["auditTraceId", "repairOrderId"], ["关闭摘要", "车辆恢复状态", "人工确认关闭"], ["closeDuration"])
    ],
    { "zh-CN": "先完成验收，费用材料齐全后才能关闭。", "ru-RU": "Сначала приемка; закрыть можно после расходов." }),
  workspaceModel("W-REPAIR-MASTER-DATA", "repair", "T-VEHICLE-CREATE",
    { "zh-CN": "我要创建维修资料", "ru-RU": "Создать ремонтные справочники" },
    { "zh-CN": "客户、车辆和服务规则在同一资料建档办理面完成。", "ru-RU": "Клиент, авто и правила сервиса вместе." },
    [
      cardModel("customer", "ready", "客户建档卡", "Клиент", ["repairCustomerId", "operatorId"], ["客户名称", "联系人", "电话", "类型"], ["customerCreationDuration"]),
      cardModel("vehicle", "ready", "车辆建档卡", "Авто", ["vehicleId", "repairCustomerId"], ["车牌", "品牌车型", "VIN", "发动机号", "里程"], ["duplicatePlateCount", "duplicateVinCount"]),
      cardModel("serviceRule", "notStarted", "服务规则卡", "Правила", ["serviceRuleId", "vehicleId"], ["结算方式", "常用司机", "维修优先级", "授权规则"], ["ruleCompletionRate"])
    ],
    { "zh-CN": "先建客户和车辆，再补服务规则。", "ru-RU": "Создайте клиента и авто, затем правила." })
];

const taskWorkspaceMap = {
  "T-STAY-DEPOSIT": "W-STAY-CHECKIN",
  "T-FIN-DEPOSIT": "W-STAY-DEPOSIT-EXCEPTION",
  "T-STAY-CHECKOUT": "W-STAY-CHECKOUT",
  "T-ROOM-CREATE": "W-STAY-RESOURCE",
  "T-BED-CREATE": "W-STAY-RESOURCE",
  "T-AUTO-DIAGNOSE": "W-REPAIR-DISPATCH",
  "T-REPAIR-CLOSE": "W-REPAIR-CLOSE",
  "T-VEHICLE-CREATE": "W-REPAIR-MASTER-DATA"
};

const state = {
  lang: localStorage.getItem("workosnext.lang") || "zh-CN",
  view: localStorage.getItem("workosnext.onboarded") ? "home" : "onboarding",
  selectedTask: "T-STAY-DEPOSIT",
  selectedWorkspace: "W-STAY-CHECKIN",
  selectedCardIndex: -1,
  query: "",
  filterOpen: false,
  advancedOpen: false,
  queueDomain: "all",
  queueBadge: "mine",
  learningQuery: "",
  learningDomain: "all",
  learningType: "coachAll",
  coachFlow: "",
  coachStage: 0,
  sort: "smartSort"
};

const params = new URLSearchParams(window.location.search);
if (params.has("lang")) {
  state.lang = params.get("lang");
}
if (params.has("view")) {
  state.view = params.get("view");
}
if (params.has("task")) {
  state.selectedTask = params.get("task");
  state.selectedWorkspace = workspaceIdForTask(state.selectedTask);
}
if (params.has("workspace")) {
  state.selectedWorkspace = params.get("workspace");
}
if (params.has("q")) {
  state.query = params.get("q");
  state.learningQuery = params.get("q");
}
if (state.view === "task" || state.view === "object") {
  state.view = "workspace";
}

function tr(key) {
  return i18n[state.lang][key] || key;
}

function tx(value) {
  return typeof value === "string" ? value : value[state.lang] || value["zh-CN"];
}

function task() {
  return tasks.find((item) => item.id === state.selectedTask) || tasks[0];
}

function workspace() {
  return intentWorkspaces.find((item) => item.id === state.selectedWorkspace) || intentWorkspaces[0];
}

function workspaceIdForTask(taskId) {
  return taskWorkspaceMap[taskId] || intentWorkspaces.find((item) => item.taskId === taskId)?.id || "W-STAY-CHECKIN";
}

function workspaceModel(id, domain, taskId, title, summary, cards, next) {
  return { id, domain, taskId, title, summary, cards, next, blockers: cards.filter((card) => card.status === "blocked") };
}

function cardModel(id, status, zhTitle, ruTitle, system, business, analytics) {
  return {
    id,
    status,
    title: { "zh-CN": zhTitle, "ru-RU": ruTitle },
    fields: { system, business, analytics },
    evidence: business.slice(0, 2),
    checks: business.slice(-2),
    confirmation: status === "done" ? "done" : "confirm"
  };
}

function localList(items) {
  return items.map(localTerm).join(" · ");
}

function localTerm(value) {
  if (state.lang === "zh-CN") return value;
  const terms = {
    "入住人": "Гость",
    "入住原因": "Причина",
    "预计入住/退房": "План въезда/выезда",
    "审批意见": "Решение",
    "已审批申请": "Одобренная заявка",
    "房间床位": "Комната/койка",
    "入住周期": "Период",
    "押金/费用规则": "Депозит/тариф",
    "押金金额": "Сумма депозита",
    "币种": "Валюта",
    "付款方式": "Способ оплаты",
    "凭证编号": "Номер документа",
    "到账状态": "Статус оплаты",
    "确认金额": "Подтвержденная сумма",
    "退回原因": "Причина возврата",
    "财务确认人": "Фин. проверяющий",
    "实际入住时间": "Фактическое заселение",
    "钥匙/物品交接": "Ключи/имущество",
    "人工确认摘要": "Ручное подтверждение",
    "退房人": "Гость",
    "退房原因": "Причина выезда",
    "预计退房时间": "План выезда",
    "房间状态": "Состояние комнаты",
    "物品/损坏检查": "Имущество/повреждения",
    "照片证据": "Фото",
    "住宿费用": "Стоимость проживания",
    "额外费用": "Доп. расходы",
    "押金抵扣": "Зачет депозита",
    "应退/应补": "Возврат/доплата",
    "退款/补款确认": "Возврат/доплата",
    "财务凭证": "Фин. документ",
    "确认人": "Подтвердил",
    "释放床位": "Освободить койку",
    "关闭住宿单": "Закрыть ордер",
    "金额不一致": "Сумма не совпадает",
    "凭证不清晰": "Документ нечеткий",
    "付款人不一致": "Плательщик не совпадает",
    "新凭证": "Новый документ",
    "收据编号": "Номер квитанции",
    "补充说明": "Комментарий",
    "通过": "Принять",
    "退回": "Вернуть",
    "需人工沟通": "Нужно вручную",
    "回到入住": "Вернуть к заселению",
    "回到退房": "Вернуть к выселению",
    "保持阻断": "Оставить блокировку",
    "楼栋": "Корпус",
    "房间号": "Номер комнаты",
    "房型": "Тип комнаты",
    "容量": "Вместимость",
    "床位号": "Номер койки",
    "上/下铺": "Верх/низ",
    "价格规则": "Тариф",
    "检查状态": "Проверка",
    "可用状态": "Доступность",
    "维护状态": "Ремонтный статус",
    "锁定原因": "Причина блокировки",
    "客户": "Клиент",
    "车牌": "Номер авто",
    "车型": "Модель",
    "联系方式": "Контакт",
    "故障描述": "Описание неисправности",
    "车辆位置": "Место авто",
    "司机": "Водитель",
    "紧急程度": "Срочность",
    "到场时间": "Время прибытия",
    "车辆状态": "Состояние авто",
    "接车人": "Принял авто",
    "初步风险": "Первичный риск",
    "是否可派工": "Можно назначить",
    "阻断原因": "Причина блокировки",
    "下一步责任人": "Ответственный",
    "技师": "Механик",
    "工位": "Пост",
    "预计开始时间": "План начала",
    "优先级": "Приоритет",
    "故障分类": "Категория",
    "诊断结论": "Диагноз",
    "所需配件": "Нужные детали",
    "预计费用": "Плановая стоимость",
    "维修项目": "Работы",
    "工时": "Нормочасы",
    "配件": "Детали",
    "过程照片": "Фото процесса",
    "无技师": "Нет механика",
    "缺配件": "Нет деталей",
    "费用待确认": "Стоимость ждет подтверждения",
    "客户不同意": "Клиент не согласен",
    "维修结果": "Результат ремонта",
    "试车结果": "Тест-драйв",
    "验收照片": "Фото приемки",
    "验收人": "Приемщик",
    "工时费": "Работа",
    "配件费": "Детали",
    "其它费用": "Прочие расходы",
    "财务材料": "Фин. материалы",
    "客户签字": "Подпись клиента",
    "司机确认": "Подтверждение водителя",
    "异议说明": "Спор",
    "关闭摘要": "Итог закрытия",
    "车辆恢复状态": "Статус авто",
    "人工确认关闭": "Ручное закрытие",
    "客户名称": "Клиент",
    "联系人": "Контакт",
    "电话": "Телефон",
    "类型": "Тип",
    "品牌车型": "Марка/модель",
    "发动机号": "Номер двигателя",
    "里程": "Пробег",
    "结算方式": "Расчет",
    "常用司机": "Водитель",
    "维修优先级": "Приоритет ремонта",
    "授权规则": "Правила доступа"
  };
  return terms[value] || value;
}

function setView(view) {
  state.view = view;
  render(true);
}

function setLang(lang) {
  state.lang = lang;
  localStorage.setItem("workosnext.lang", lang);
  render();
}

function onboard() {
  localStorage.setItem("workosnext.onboarded", "1");
  setView("home");
}

function shell(content) {
  return `
    <main class="app-shell view-${state.view}">
      <header class="topbar">
        <div><strong>${tr("app")}</strong><span>${tr("subtitle")}</span></div>
        <select id="language" aria-label="${tr("language")}">
          <option value="zh-CN" ${state.lang === "zh-CN" ? "selected" : ""}>${tr("zh")}</option>
          <option value="ru-RU" ${state.lang === "ru-RU" ? "selected" : ""}>${tr("ru")}</option>
        </select>
      </header>
      ${content}
      ${feedbackButton()}
      ${state.view !== "onboarding" ? bottomNav() : ""}
    </main>
  `;
}

function bottomNav() {
  return `<nav class="bottom-nav">
    ${nav("home", "home")}
    ${nav("search", "search")}
    ${nav("workbench", "workbench")}
    ${nav("me", "me")}
  </nav>`;
}

function nav(view, key) {
  return `<button data-view="${view}" class="${state.view === view ? "active" : ""}">${tr(key)}</button>`;
}

function feedbackButton() {
  return state.view === "onboarding" ? "" : `<button class="feedback-fab" data-view="feedback">${tr("feedback")}</button>`;
}

function onboardingView() {
  return shell(`
    <section class="onboarding">
      <span>${tr("guideTitle")}</span>
      <h1>${tr("app")}</h1>
      <p>${tr("guideBody")}</p>
      <div class="mode-list">
        ${modeCard("home", "todayMode")}
        ${modeCard("search", "intentMode")}
        ${modeCard("workbench", "queueMode")}
        ${modeCard("me", "personalMode")}
      </div>
      <button id="start">${tr("start")}</button>
      <button class="ghost" id="skip">${tr("skip")}</button>
    </section>
  `);
}

function modeCard(view, key) {
  return `<article><b>${tr(key)}</b></article>`;
}

function homeView() {
  return shell(`
    <section class="command-card">
      <span>${tr("globalCommand")}</span>
      <h1>${tr("globalCommandTitle")}</h1>
      <dl>
        <dt>${tr("reason")}</dt><dd>${tr("globalReason")}</dd>
        <dt>${tr("impact")}</dt><dd>${tr("globalImpact")}</dd>
      </dl>
      <button data-view="workbench">${tr("workbench")}</button>
    </section>
    <section class="home-search">
      <span>${tr("homeSearch")}</span>
      <div class="search-line">
        <input id="query" value="${state.query}" placeholder="${tr("searchPlaceholder")}" />
        <button id="searchNow">${tr("search")}</button>
      </div>
    </section>
    <section class="metric-grid">
      ${metric("7", "mine")}
      ${metric("2", "blocked")}
      ${metric("3", "confirm")}
    </section>
    <section class="business-focus">
      <h2>${tr("scenarioFocus")}</h2>
      ${workspaceCard(intentWorkspaces.find((item) => item.id === "W-STAY-CHECKIN"))}
      ${workspaceCard(intentWorkspaces.find((item) => item.id === "W-REPAIR-REQUEST"))}
      ${workspaceCard(intentWorkspaces.find((item) => item.id === "W-STAY-CHECKOUT"))}
      ${workspaceCard(intentWorkspaces.find((item) => item.id === "W-REPAIR-DISPATCH"))}
    </section>
  `);
}

function searchView() {
  const results = searchWorkspaceResults();
  return shell(`
    <section class="page-title">
      <span>${tr("activeSearch")}</span>
      <h1>${tr("intentMode")}</h1>
    </section>
    <section class="search-box">
      <div class="search-line">
        <input id="query" value="${state.query}" placeholder="${tr("searchPlaceholder")}" />
        <button id="searchNow">${tr("search")}</button>
      </div>
    </section>
    ${state.query ? searchResultBlocks(results) : scenarioBlocks()}
  `);
}

function scenarioBlocks() {
  return `<section class="scenario-list">
    <h2>${tr("scenarios")}</h2>
    ${scenario("stay", intentWorkspaces.filter((item) => item.domain === "stay"))}
    ${scenario("repair", intentWorkspaces.filter((item) => item.domain === "repair"))}
    ${scenario("finance", intentWorkspaces.filter((item) => item.domain === "finance"))}
  </section>`;
}

function scenario(domain, workspaces) {
  return `<article class="scenario-card ${domain}">
    <h3>${tr(domain)}</h3>
    <div>${workspaces.length ? workspaces.map((item) => `<button data-workspace="${item.id}">${tx(item.title)}</button>`).join("") : `<button data-workspace="W-STAY-DEPOSIT-EXCEPTION">${tr("confirmPayment")}</button>`}</div>
  </article>`;
}

function searchResultBlocks(results) {
  const first = results[0] || intentWorkspaces[0];
  return `
    <section class="result-focus">
      <span>${tr("bestNext")}</span>
      ${workspaceCard(first)}
    </section>
    <section class="compact-section">
      <h2>${tr("intentWorkspace")}</h2>
      ${results.map(workspaceCard).join("")}
    </section>
    <section class="help-card">
      <span>${tr("helpExplain")}</span>
      <p>${tx(first.summary)} ${tx(first.next)}</p>
    </section>`;
}

function searchWorkspaceResults() {
  const q = normalize(state.query);
  if (!q) return [];
  const found = intentWorkspaces.filter((item) => normalize(workspaceSearchText(item)).includes(q));
  if (found.length) return found;
  if (q.includes("房间") || q.includes("床位") || q.includes("комнат") || q.includes("койк")) return [intentWorkspaces.find((item) => item.id === "W-STAY-RESOURCE")];
  if (q.includes("车辆") || q.includes("车牌") || q.includes("vin") || q.includes("авто")) return [intentWorkspaces.find((item) => item.id === "W-REPAIR-MASTER-DATA")];
  if (q.includes("退房") || q.includes("высел")) return [intentWorkspaces.find((item) => item.id === "W-STAY-CHECKOUT")];
  if (q.includes("报修")) return [intentWorkspaces.find((item) => item.id === "W-REPAIR-REQUEST")];
  if (q.includes("维修") || q.includes("派工") || q.includes("ремонт") || q.includes("toyota")) return [intentWorkspaces.find((item) => item.id === "W-REPAIR-DISPATCH")];
  if (q.includes("押金") || q.includes("депозит")) return [intentWorkspaces.find((item) => item.id === "W-STAY-CHECKIN"), intentWorkspaces.find((item) => item.id === "W-STAY-DEPOSIT-EXCEPTION")];
  return intentWorkspaces;
}

function workspaceSearchText(item) {
  return [
    item.id,
    tr(item.domain),
    tx(item.title),
    tx(item.summary),
    tx(item.next),
    item.cards.map(cardSearchText).join(" ")
  ].join(" ");
}

function cardSearchText(card) {
  return [
    card.id,
    tx(card.title),
    localList(card.fields.business),
    localList(card.evidence),
    localList(card.checks),
    localList(card.fields.system),
    localList(card.fields.analytics)
  ].join(" ");
}

function workbenchView() {
  const list = queueTasks();
  return shell(`
    <section class="queue-head">
      <span>${tr("queueTitle")}</span>
      <h1>${tr("workbench")}</h1>
      <strong>${list.length}</strong>
    </section>
    <section class="queue-filter">
      <div class="filter-row">${domainFilters()}</div>
      <div class="filter-row ${state.filterOpen ? "expanded" : "collapsed"}">${badgeFilters()}</div>
      <button class="link-button" id="toggleFilters">${tr(state.filterOpen ? "filterLess" : "filterMore")}</button>
    </section>
    <section class="queue-toolbar">
      <label>${tr("sort")}<select id="sort"><option value="smartSort">${tr("smartSort")}</option><option value="dueSort">${tr("dueSort")}</option></select></label>
      <button id="advanced">${tr("filter")}</button>
    </section>
    <section class="task-stack">${list.map(taskCard).join("")}</section>
    ${state.advancedOpen ? advancedSheet() : ""}
  `);
}

function domainFilters() {
  return ["all", "stay", "repair", "finance"].map((key) => filterPill("queueDomain", key, countDomain(key))).join("");
}

function badgeFilters() {
  return ["mine", "confirm", "blocked", "soon", "waiting"].map((key) => filterPill("queueBadge", key, countBadge(key))).join("");
}

function filterPill(field, key, count) {
  const active = state[field] === key;
  return `<button class="pill ${active ? "active" : ""}" data-filter-field="${field}" data-filter-value="${key}">${tr(key)}<b>${count}</b></button>`;
}

function countDomain(key) {
  return key === "all" ? tasks.length : tasks.filter((item) => item.domain === key).length;
}

function countBadge(key) {
  return tasks.filter((item) => item.badges.includes(key)).length;
}

function queueTasks() {
  return tasks
    .filter((item) => state.queueDomain === "all" || item.domain === state.queueDomain)
    .filter((item) => item.badges.includes(state.queueBadge))
    .sort((a, b) => state.sort === "dueSort" ? a.due.localeCompare(b.due) : b.priority - a.priority);
}

function advancedSheet() {
  return `<section class="sheet">
    <div class="sheet-head"><h2>${tr("advancedFilter")}</h2><button id="closeAdvanced">×</button></div>
    <div class="sheet-grid">
      <button>${tr("role")}</button>
      <button>${tr("stay")}</button>
      <button>${tr("repair")}</button>
      <button>${tr("blocked")}</button>
      <button>${tr("confirm")}</button>
      <button>${tr("soon")}</button>
    </div>
  </section>`;
}

function meView() {
  return shell(`
    <section class="profile-card">
      <span>${tr("role")}</span>
      <h1>${tr("personalMode")}</h1>
      <p>${tr("permission")}: ${tr("stay")} · ${tr("repair")} · ${tr("finance")}</p>
    </section>
    <section class="metric-grid">${metric("11", "stats")}${metric("2", "blocked")}${metric("18m", "smartSort")}</section>
    <section class="personal-grid">
      ${personal("notes", "noteTitle", "noteBody")}
      ${personal("reminders", "reminderTitle", "reminderBody")}
      ${personal("learning", "learningCenter", "learningCenterBody")}
      ${personal("feedback", "feedbackTitle", "feedbackBody")}
    </section>
    <section class="compact-section">
      <h2>${tr(commonLabel())}</h2>
      <p>${tr("commonSearch")}: ${tr("depositBlocked")} · Toyota Camry · A301</p>
      <p>${tr("savedFilter")}: ${tr("repair")} + ${tr("mine")} + ${tr("soon")}</p>
    </section>
  `);
}

function commonLabel() {
  return "stats";
}

function personal(view, title, body) {
  return `<button class="personal-card" data-view="${view}"><strong>${tr(title)}</strong><span>${tr(body)}</span></button>`;
}

function learningView() {
  const coachEntries = scenarioCoachEntries();
  return shell(`
    <section class="profile-card">
      <span>${tr("me")}</span>
      <h1>${tr("scenarioCoach")}</h1>
      <p>${tr("learningCenterBody")}</p>
    </section>
    <section class="knowledge-search">
      <span>${tr("coachHowToUse")}</span>
      <div class="search-line">
        <input id="learningQuery" value="${state.learningQuery}" placeholder="${tr("coachSearchPlaceholder")}" />
        <button id="learningSearch">${tr("search")}</button>
      </div>
      <div class="filter-row">${learningDomainFilters()}</div>
      <span>${tr("coachPerspective")}</span>
      <div class="filter-row">${learningTypeFilters()}</div>
    </section>
    <section class="compact-section">
      <h2>${tr("sceneLearning")}</h2>
      ${coachEntries.length ? coachEntries.map(learningScenarioCard).join("") : `<p>${tr("coachNoMatch")}</p>`}
    </section>
    <section class="compact-section">
      <h2>${tr("quickStart")}</h2>
      <div class="mode-list light">
        ${modeCard("home", "todayMode")}
        ${modeCard("search", "intentMode")}
        ${modeCard("workbench", "queueMode")}
        ${modeCard("me", "personalMode")}
      </div>
    </section>
    <section class="help-card">
      <span>${tr("roleLearning")}</span>
      <p>${tr("permission")}: ${tr("stay")} · ${tr("repair")} · ${tr("finance")}</p>
      <p>${tr("aiCanDo")}</p>
      <p>${tr("aiCannotDo")}</p>
    </section>
  `);
}

function learningDomainFilters() {
  return ["all", "stay", "repair", "finance"].map((key) => {
    const active = state.learningDomain === key ? "active" : "";
    return `<button class="pill ${active}" data-learning-domain="${key}">${tr(key)}</button>`;
  }).join("");
}

function learningTypeFilters() {
  return ["coachAll", "coachHowTo", "coachFields", "coachException", "coachConfirm", "coachNext", "coachAi"].map((key) => {
    const active = state.learningType === key ? "active" : "";
    return `<button class="pill ${active}" data-learning-type="${key}">${tr(key)}</button>`;
  }).join("");
}

function scenarioCoachEntries() {
  const query = normalize(state.learningQuery);
  return intentWorkspaces
    .filter((item) => learningDomainMatch(item))
    .filter((item) => !query || normalize(workspaceSearchText(item)).includes(query));
}

function learningDomainMatch(item) {
  if (state.learningDomain === "all") return true;
  return item.domain === state.learningDomain;
}

function normalize(value) {
  return String(value || "").toLocaleLowerCase();
}

function learningScenarioCard(item) {
  const activeStage = activeCoachStage(item);
  const card = item.cards[activeStage] || item.cards[0];
  return `<article class="learning-card">
    <span>${tr(item.domain)}</span>
    <strong>${tx(item.title)}</strong>
    <p>${tx(item.summary)}</p>
    <div class="coach-stages">${item.cards.map((entry, index) => `<button class="${index === activeStage ? "active" : ""} ${entry.status}" data-coach-flow="${item.id}" data-coach-stage="${index}">${tx(entry.title)}</button>`).join("")}</div>
    <div class="stage-coach">
      <span>${tr("cardOperation")}</span>
      <h3>${tx(card.title)}</h3>
      ${coachDetailSections(item, card)}
      <div class="coach-actions">
        <button data-workspace="${item.id}">${tr("openWorkspace")}</button>
        <button data-workspace="${item.id}">${tr("openRelatedObject")}</button>
      </div>
    </div>
  </article>`;
}

function activeCoachStage(item) {
  if (state.coachFlow === item.id) return Number(state.coachStage) || 0;
  const query = normalize(state.learningQuery);
  if (!query) return preferredCoachCardIndex(item);
  const matched = item.cards.findIndex((card) => normalize(cardSearchText(card)).includes(query));
  if (matched >= 0) return matched;
  return preferredCoachCardIndex(item);
}

function preferredCoachCardIndex(item) {
  const index = item.cards.findIndex((card) => ["ready", "blocked", "inProgress"].includes(card.status));
  return index >= 0 ? index : 0;
}

function coachDetailSections(item, card) {
  const sections = [
    coachDetail("coachHowTo", "stageWhat", cardPurpose(card)),
    coachDetail("coachFields", "stageFields", cardFieldGuidance(card)),
    coachDetail("coachException", "stageJudgement", cardJudgement(card)),
    coachDetail("coachConfirm", "stageEvidence", localList(card.evidence)),
    coachDetail("coachConfirm", "stageConfirm", cardConfirmation(card)),
    coachDetail("coachNext", "stageAfter", cardAfterState(card)),
    coachDetail("coachNext", "stageNext", `${nextCardTitle(card, item)} · ${tx(item.next)}`),
    coachDetail("coachAi", "coachAi", `${tr("aiCanDo")} ${tr("aiCannotDo")}`)
  ];
  return sections.filter((section) => state.learningType === "coachAll" || section.type === state.learningType).map((section) => section.html).join("");
}

function coachDetail(type, titleKey, body) {
  return {
    type,
    html: `<section><b>${tr(titleKey)}</b><p>${body}</p></section>`
  };
}

function cardPurpose(card) {
  const fields = card.fields.business.map(localTerm).join(state.lang === "zh-CN" ? "、" : ", ");
  return state.lang === "zh-CN"
    ? `围绕“${tx(card.title)}”完成当前任务卡。先选系统候选项，再补充必要业务字段：${fields}。`
    : `На карточке "${tx(card.title)}" сначала выбирайте системные варианты, затем заполните нужные поля: ${fields}.`;
}

function cardFieldGuidance(card) {
  const hints = card.fields.business.map((field) => {
    if (field.includes("房间") || field.includes("床位") || field.includes("Комната") || field.includes("койка")) {
      return `${localTerm(field)}: ${tr("searchableSelect")}`;
    }
    if (field.includes("预计") || field.includes("周期") || field.includes("План") || field.includes("Период")) {
      return `${localTerm(field)}: ${state.lang === "zh-CN" ? "下拉选择" : "выбор из списка"}`;
    }
    if (field.includes("技师") || field.includes("工位") || field.includes("付款") || field.includes("币种")) {
      return `${localTerm(field)}: ${state.lang === "zh-CN" ? "下拉选择" : "выбор из списка"}`;
    }
    return localTerm(field);
  });
  return hints.join(" · ");
}

function cardJudgement(card) {
  const checks = localList(card.checks);
  if (state.lang === "zh-CN") {
    return `系统会检查 ${checks}，并确认材料完整、权限满足、关键动作已人工确认。`;
  }
  return `Система проверит: ${checks}; также полноту материалов, право доступа и ручное подтверждение.`;
}

function cardConfirmation(card) {
  if (card.status === "done") return tr("done");
  return state.lang === "zh-CN" ? "关键动作需要人工确认，AI 只能生成草稿和解释原因。" : "Ключевое действие требует ручного подтверждения; AI только готовит черновик и объяснение.";
}

function cardAfterState(card) {
  return state.lang === "zh-CN"
    ? `${tx(card.title)}完成后，系统会更新工作区状态并把下一张任务卡推到前面。`
    : `После карточки "${tx(card.title)}" система обновит рабочую область и выведет следующую карточку.`;
}

function workspaceView() {
  const item = workspace();
  const defaultIndex = item.cards.findIndex((card) => ["ready", "blocked", "inProgress"].includes(card.status));
  const activeIndex = Number.isInteger(state.selectedCardIndex) && state.selectedCardIndex >= 0 ? state.selectedCardIndex : defaultIndex;
  const activeCard = item.cards[activeIndex >= 0 ? activeIndex : 0] || item.cards[0];
  return shell(`
    <section class="workspace-page ${item.domain}">
      <span>${tr("intentWorkspace")} · ${tr(item.domain)}</span>
      <h1>${tx(item.title)}</h1>
      <p>${tx(item.summary)}</p>
    </section>
    <section class="workspace-control">
      <div class="card-tabs">${item.cards.map((card, index) => `<button class="${card.id === activeCard.id ? "active" : ""} ${card.status}" data-card-index="${index}">${tx(card.title)}</button>`).join("")}</div>
      ${workspaceCardPanel(activeCard, item, true)}
    </section>
    <div class="sticky-action"><button data-view="confirmPage">${tr("confirmAction")}</button></div>
  `);
}

function workspaceCard(item) {
  if (!item) return "";
  const activeCard = item.cards.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || item.cards[0];
  return `<article class="workspace-card ${item.domain}">
    <div class="loop-head">
      <div><span>${tr(item.domain)} · ${tr("intentWorkspace")}</span><strong>${tx(item.title)}</strong></div>
      <button data-workspace="${item.id}">${tr("openWorkspace")}</button>
    </div>
    <p>${tx(item.summary)}</p>
    <div class="workspace-card-strip">${item.cards.map((card) => `<span class="${card.status}">${tx(card.title)}</span>`).join("")}</div>
    <div class="loop-meta">
      <span>${tx(activeCard.title)} · ${tr(activeCard.status)}</span>
      <span>${tr("nextBestAction")}: ${tx(item.next)}</span>
    </div>
  </article>`;
}

function workspaceCardPanel(card, item, expanded = false) {
  return `<article class="intent-card ${card.status} ${expanded ? "expanded" : ""}">
    ${expanded || ["ready", "blocked", "inProgress"].includes(card.status) ? cardOperation(card, item) : ""}
  </article>`;
}

function cardOperation(card, item) {
  const disabled = card.status === "blocked" ? "disabled" : "";
  return `<div class="card-operation">
    <span>${tr("cardOperation")}</span>
    <h3>${tx(card.title)}</h3>
    <section>
      <b>${tr("cardAction")}</b>
      <p>${operationActionText(card, item)}</p>
    </section>
    <section>
      <b>${tr("cardInput")}</b>
      <div class="operation-inputs">
        ${operationInputFields(card).map((field) => operationControl(field, disabled)).join("")}
      </div>
    </section>
    <section>
      <b>${tr("cardEvidence")}</b>
      <div class="evidence-row">
        ${card.evidence.map((field) => `<button ${disabled}>${localTerm(field)}</button>`).join("")}
      </div>
    </section>
    <section>
      <b>${tr("cardConfirm")}</b>
      <p>${card.status === "blocked" ? tx(item.next) : tr("confirmationDraft")}</p>
    </section>
    <section>
      <b>${tr("cardNext")}</b>
      <p>${nextCardTitle(card, item)}</p>
    </section>
    <section>
      <b>${tr("nextBestAction")}</b>
      <p>${tx(item.next)}</p>
    </section>
    <section>
      <b>${tr("blockers")}</b>
      <p>${item.blockers.length ? item.blockers.map((entry) => tx(entry.title)).join(" · ") : tr("noCriticalBlocker")}</p>
    </section>
    <div class="operation-actions">
      <button class="secondary" ${disabled}>${tr("saveDraft")}</button>
      <button ${disabled}>${tr("submitForReview")}</button>
    </div>
  </div>`;
}

function operationActionText(card, item) {
  if (card.status === "blocked") return tx(item.next);
  return state.lang === "zh-CN"
    ? `处理“${tx(card.title)}”，提交前系统会校验字段、证据和人工确认边界。`
    : `Обработайте "${tx(card.title)}"; перед отправкой система проверит поля, доказательства и подтверждение.`;
}

function operationInputFields(card) {
  const priority = card.fields.business.filter((field) => !["备注", "补充说明", "异议说明"].includes(field));
  return priority;
}

function operationControl(field, disabled) {
  if (field.includes("房间") || field.includes("床位")) {
    return `<label class="search-select"><span>${localTerm(field)} · ${tr("searchableSelect")}</span><input list="roomBedOptions" value="${operationValue(field)}" ${disabled} /><datalist id="roomBedOptions"><option value="A301 / A301-02"><option value="A302 / A302-01"><option value="B201 / B201-03"></datalist></label>`;
  }
  if (field.includes("预计入住") || field.includes("入住周期") || field.includes("预计退房") || field.includes("预计开始")) {
    return `<label><span>${localTerm(field)}</span><select ${disabled}><option>${operationValue(field)}</option><option>今天 18:00</option><option>明天 10:00</option><option>本周内</option></select></label>`;
  }
  if (field.includes("付款方式")) {
    return `<label><span>${localTerm(field)}</span><select ${disabled}><option>现金</option><option>银行转账</option><option>POS</option></select></label>`;
  }
  if (field.includes("币种")) {
    return `<label><span>${localTerm(field)}</span><select ${disabled}><option>KGS</option><option>RUB</option><option>USD</option></select></label>`;
  }
  if (field.includes("技师")) {
    return `<label><span>${localTerm(field)}</span><select ${disabled}><option>Алексей Смирнов</option><option>Иван Орлов</option><option>维修主管分配</option></select></label>`;
  }
  if (field.includes("工位")) {
    return `<label><span>${localTerm(field)}</span><select ${disabled}><option>2 号位</option><option>1 号位</option><option>等待空位</option></select></label>`;
  }
  return `<label><span>${localTerm(field)}</span><input value="${operationValue(field)}" ${disabled} /></label>`;
}

function operationValue(field) {
  const samples = {
    "入住人": "张三",
    "房间床位": "A301 / A301-02",
    "入住周期": "2026-05-28 至 2026-06-28",
    "押金金额": "3000 KGS",
    "付款方式": "现金 / 转账",
    "凭证编号": "DEP-009",
    "技师": "Алексей Смирнов",
    "工位": "2 号位",
    "预计开始时间": "2026-05-28 16:30",
    "到场时间": "2026-05-28 15:40",
    "车辆状态": "已到场，待诊断",
    "接车人": "维修主管"
  };
  return samples[field] || localTerm(field);
}

function nextCardTitle(card, item) {
  const index = item.cards.findIndex((entry) => entry.id === card.id);
  const next = item.cards[index + 1];
  return next ? tx(next.title) : tr("finish");
}

function simpleView(titleKey, bodyKey) {
  return shell(`
    <section class="profile-card">
      <span>${tr("me")}</span>
      <h1>${tr(titleKey)}</h1>
      <p>${tr(bodyKey)}</p>
    </section>
    <section class="compact-section">
      <label><span>${tr(titleKey)}</span><input value="${tr(task().object)}" /></label>
      <label><span>${tr("reminders")}</span><input value="2026-05-28 18:00" /></label>
    </section>
  `);
}

function confirmPageView() {
  const item = task();
  return shell(`
    <section class="confirm-panel">
      <span>${tr("confirmAction")}</span>
      <h1>${tr(item.title)}</h1>
      <p>${tr("actionBoundary")}</p>
      <button id="finish">${tr("finish")}</button>
    </section>
  `);
}

function resultView() {
  return shell(`<section class="confirm-panel"><span>Audit</span><h1>${tr("evidenceDone")}</h1><p>${tr("actionBoundary")}</p><button data-view="workbench">${tr("workbench")}</button></section>`);
}

function taskCard(item) {
  const itemWorkspace = intentWorkspaces.find((entry) => entry.id === workspaceIdForTask(item.id)) || intentWorkspaces[0];
  const activeCard = itemWorkspace.cards.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || itemWorkspace.cards[0];
  return `<article class="task-card">
    <div><span>${tr(item.domain)} · ${tr(item.badges[0])} · ${item.due}</span><strong>${tx(itemWorkspace.title)}</strong><p>${tx(activeCard.title)} · ${tr(activeCard.status)}</p><p>${tr("whyMe")}: ${tx(item.why)}</p></div>
    <button data-workspace="${itemWorkspace.id}">${tr("openWorkspace")}</button>
  </article>`;
}

function metric(value, label) {
  return `<article><span>${tr(label)}</span><strong>${value}</strong></article>`;
}

function render(scrollTop = false) {
  const views = {
    onboarding: onboardingView,
    home: homeView,
    search: searchView,
    workbench: workbenchView,
    me: meView,
    workspace: workspaceView,
    notes: () => simpleView("noteTitle", "noteBody"),
    reminders: () => simpleView("reminderTitle", "reminderBody"),
    learning: learningView,
    feedback: () => simpleView("feedbackTitle", "feedbackBody"),
    confirmPage: confirmPageView,
    result: resultView
  };
  document.documentElement.lang = state.lang;
  document.querySelector("#app").innerHTML = views[state.view]();
  bind();
  if (scrollTop) window.scrollTo({ top: 0, left: 0 });
}

function bind() {
  document.querySelector("#language")?.addEventListener("change", (event) => setLang(event.target.value));
  document.querySelector("#start")?.addEventListener("click", onboard);
  document.querySelector("#skip")?.addEventListener("click", onboard);
  document.querySelectorAll("[data-view]").forEach((node) => node.addEventListener("click", () => setView(node.dataset.view)));
  document.querySelectorAll("[data-workspace]").forEach((node) => node.addEventListener("click", () => {
    state.selectedWorkspace = node.dataset.workspace;
    state.selectedCardIndex = -1;
    const linked = intentWorkspaces.find((entry) => entry.id === state.selectedWorkspace);
    state.selectedTask = linked?.taskId || state.selectedTask;
    setView("workspace");
  }));
  document.querySelectorAll("[data-card-index]").forEach((node) => node.addEventListener("click", () => {
    state.selectedCardIndex = Number(node.dataset.cardIndex) || 0;
    render(true);
  }));
  document.querySelector("#query")?.addEventListener("input", (event) => {
    state.query = event.target.value;
  });
  document.querySelector("#searchNow")?.addEventListener("click", () => {
    state.query = document.querySelector("#query")?.value || "";
    state.view = "search";
    render(true);
  });
  document.querySelector("#learningQuery")?.addEventListener("input", (event) => {
    state.learningQuery = event.target.value;
  });
  document.querySelector("#learningSearch")?.addEventListener("click", () => {
    state.learningQuery = document.querySelector("#learningQuery")?.value || "";
    render(true);
  });
  document.querySelectorAll("[data-learning-domain]").forEach((node) => node.addEventListener("click", () => {
    state.learningDomain = node.dataset.learningDomain;
    render();
  }));
  document.querySelectorAll("[data-learning-type]").forEach((node) => node.addEventListener("click", () => {
    state.learningType = node.dataset.learningType;
    render();
  }));
  document.querySelectorAll("[data-coach-flow]").forEach((node) => node.addEventListener("click", () => {
    state.coachFlow = node.dataset.coachFlow;
    state.coachStage = Number(node.dataset.coachStage) || 0;
    render();
  }));
  document.querySelectorAll("[data-filter-field]").forEach((node) => node.addEventListener("click", () => {
    state[node.dataset.filterField] = node.dataset.filterValue;
    render();
  }));
  document.querySelector("#toggleFilters")?.addEventListener("click", () => {
    state.filterOpen = !state.filterOpen;
    render();
  });
  document.querySelector("#advanced")?.addEventListener("click", () => {
    state.advancedOpen = true;
    render();
  });
  document.querySelector("#closeAdvanced")?.addEventListener("click", () => {
    state.advancedOpen = false;
    render();
  });
  document.querySelector("#sort")?.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
  document.querySelector("#finish")?.addEventListener("click", () => setView("result"));
}

render();
