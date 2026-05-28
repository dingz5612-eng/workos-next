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
    fieldModel: "后端字段模型",
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
    fieldModel: "Поля для backend",
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

const scenarioFlows = {
  stayCheckin: {
    category: "businessHandling",
    label: "stayCheckinFlow",
    taskId: "T-STAY-DEPOSIT",
    stages: {
      "zh-CN": ["申请审批", "选择房间床位", "创建住宿单", "押金材料", "财务确认", "办理入住"],
      "ru-RU": ["Заявка", "Комната/койка", "Ордер", "Депозит", "Финансы", "Заселение"]
    },
    fields: [
      ["住宿单号", "SO-20260528-001", "Ордер", "SO-20260528-001"],
      ["入住人", "张三", "Гость", "Чжан Сан"],
      ["房间/床位", "A301 / A301-02 下铺", "Комната/койка", "A301 / A301-02"],
      ["押金凭证", "DEP-009 · 3000 KGS", "Депозит", "DEP-009 · 3000 KGS"]
    ],
    evidence: { "zh-CN": "付款截图、收据编号、财务确认记录", "ru-RU": "Чек, номер квитанции, фин. подтверждение" },
    policy: { "zh-CN": "押金确认、入住确认必须人工确认。", "ru-RU": "Депозит и заселение подтверждает человек." }
  },
  stayCheckout: {
    category: "businessHandling",
    label: "stayCheckoutFlow",
    taskId: "T-STAY-CHECKOUT",
    stages: {
      "zh-CN": ["发起退房", "房间检查", "费用核对", "财务确认", "释放床位", "关闭住宿单"],
      "ru-RU": ["Выселение", "Проверка", "Расходы", "Финансы", "Освободить", "Закрыть"]
    },
    fields: [
      ["住宿单号", "SO-20260520-003", "Ордер", "SO-20260520-003"],
      ["退房人", "张三", "Гость", "Чжан Сан"],
      ["检查结果", "待检查", "Проверка", "Ожидает"],
      ["费用状态", "待核对", "Расходы", "Ожидает"]
    ],
    evidence: { "zh-CN": "房间检查记录、费用明细、退款确认", "ru-RU": "Проверка комнаты, расходы, возврат" },
    policy: { "zh-CN": "退房关闭和押金退款必须人工确认。", "ru-RU": "Закрытие и возврат подтверждает человек." }
  },
  stayDepositException: {
    category: "exceptionHandling",
    label: "stayDepositExceptionFlow",
    taskId: "T-FIN-DEPOSIT",
    stages: {
      "zh-CN": ["发现异常", "定位住宿单", "补交材料", "财务复核", "回到入住"],
      "ru-RU": ["Ошибка", "Найти ордер", "Дополнить", "Финансы", "Вернуть"]
    },
    fields: [
      ["凭证号", "DEP-009", "Документ", "DEP-009"],
      ["异常类型", "金额/凭证待核", "Тип", "Сумма/чек"],
      ["金额", "3000 KGS", "Сумма", "3000 KGS"],
      ["复核人", "财务经办人", "Проверка", "Финансы"]
    ],
    evidence: { "zh-CN": "原凭证、补交凭证、退回原因、复核结果", "ru-RU": "Исходный чек, новый чек, причина, результат" },
    policy: { "zh-CN": "异常通过或退回必须由财务人工确认。", "ru-RU": "Принять или вернуть может только финансы." }
  },
  roomCreation: {
    category: "objectCreation",
    label: "roomCreationFlow",
    taskId: "T-ROOM-CREATE",
    stages: {
      "zh-CN": ["录入楼栋", "录入房间号", "房型容量", "重复校验", "创建房间", "创建床位"],
      "ru-RU": ["Корпус", "Номер", "Тип/места", "Дубликат", "Создать", "Койки"]
    },
    fields: [
      ["楼栋/区域", "宿舍 A 栋", "Корпус", "A"],
      ["房间号", "A302", "Комната", "A302"],
      ["房型/容量", "四人间 / 4", "Тип/места", "4 места"],
      ["重复校验", "未重复", "Дубликат", "Нет"]
    ],
    evidence: { "zh-CN": "建档人、建档时间、重复校验结果", "ru-RU": "Автор, время, проверка дублей" },
    policy: { "zh-CN": "房间建档需要住宿管理员权限。", "ru-RU": "Создание комнаты требует права администратора." }
  },
  bedCreation: {
    category: "objectCreation",
    label: "bedCreationFlow",
    taskId: "T-BED-CREATE",
    stages: {
      "zh-CN": ["选择房间", "录入床位号", "床位类型", "价格/检查", "容量校验", "创建床位"],
      "ru-RU": ["Комната", "Номер койки", "Тип", "Цена/проверка", "Места", "Создать"]
    },
    fields: [
      ["房间", "A302", "Комната", "A302"],
      ["床位号", "A302-01", "Койка", "A302-01"],
      ["床位类型", "下铺", "Тип", "Нижняя"],
      ["检查状态", "待检查", "Проверка", "Ожидает"]
    ],
    evidence: { "zh-CN": "房间容量校验、床位编号校验、检查状态", "ru-RU": "Проверка мест, номера койки и статуса" },
    policy: { "zh-CN": "超过容量或未选房间时不能创建床位。", "ru-RU": "Нельзя создать без комнаты или сверх вместимости." }
  },
  repairDispatch: {
    category: "businessHandling",
    label: "repairDispatchFlow",
    taskId: "T-AUTO-DIAGNOSE",
    stages: {
      "zh-CN": ["报修", "车辆到场", "派工诊断", "维修执行", "验收", "费用材料", "关闭"],
      "ru-RU": ["Заявка", "Прибыло", "Диагностика", "Ремонт", "Приемка", "Расходы", "Закрытие"]
    },
    fields: [
      ["维修单号", "AR-20260528-004", "Заявка", "AR-20260528-004"],
      ["车辆", "Toyota Camry · 01KG123ABC", "Авто", "Toyota Camry · 01KG123ABC"],
      ["司机", "Иван Петров", "Водитель", "Иван Петров"],
      ["诊断技师", "Алексей Смирнов · 16:30", "Механик", "Алексей Смирнов · 16:30"]
    ],
    evidence: { "zh-CN": "诊断记录、维修照片、验收签字、费用材料", "ru-RU": "Диагностика, фото ремонта, приемка, расходы" },
    policy: { "zh-CN": "维修完成、费用确认、关闭维修单必须人工确认。", "ru-RU": "Завершение, расходы и закрытие подтверждает человек." }
  },
  repairClose: {
    category: "businessHandling",
    label: "repairCloseFlow",
    taskId: "T-REPAIR-CLOSE",
    stages: {
      "zh-CN": ["提交验收", "负责人检查", "验收通过", "费用材料", "关闭维修单"],
      "ru-RU": ["Приемка", "Проверка", "Принято", "Расходы", "Закрыть"]
    },
    fields: [
      ["维修单号", "AR-20260527-002", "Заявка", "AR-20260527-002"],
      ["验收人", "车队负责人", "Приемка", "Ответственный"],
      ["费用材料", "待确认", "Расходы", "Ожидает"],
      ["关闭状态", "未关闭", "Закрытие", "Не закрыто"]
    ],
    evidence: { "zh-CN": "验收照片、验收签字、材料费用、关闭记录", "ru-RU": "Фото, подпись, расходы, закрытие" },
    policy: { "zh-CN": "验收不通过或费用缺失时不能关闭。", "ru-RU": "Нельзя закрыть без приемки и расходов." }
  },
  vehicleCreation: {
    category: "objectCreation",
    label: "vehicleCreationFlow",
    taskId: "T-VEHICLE-CREATE",
    stages: {
      "zh-CN": ["选择客户", "录入车牌", "品牌车型", "VIN/发动机", "重复校验", "创建车辆"],
      "ru-RU": ["Клиент", "Номер", "Модель", "VIN/двиг.", "Дубликат", "Создать"]
    },
    fields: [
      ["客户", "张三汽修客户", "Клиент", "Клиент Чжан"],
      ["车牌", "01KG999XYZ", "Номер", "01KG999XYZ"],
      ["车型", "Toyota Camry", "Модель", "Toyota Camry"],
      ["VIN", "VIN-PENDING-009", "VIN", "VIN-PENDING-009"]
    ],
    evidence: { "zh-CN": "客户授权、车辆证件、车牌/VIN 重复校验", "ru-RU": "Клиент, документы, проверка номера/VIN" },
    policy: { "zh-CN": "无客户或车牌/VIN 重复时不能建档。", "ru-RU": "Нельзя без клиента или при дубле номера/VIN." }
  }
};

const objects = {
  "SO-20260528-001": { title: "stayObject", domain: "stay", line: { "zh-CN": "张三 · A301 · A301-02 下铺", "ru-RU": "Чжан Сан · A301 · нижняя койка" } },
  "AR-20260528-004": { title: "repairObject", domain: "repair", line: { "zh-CN": "01KG123ABC · 司机 Иван Петров", "ru-RU": "01KG123ABC · водитель Иван Петров" } },
  "FIN-20260528-009": { title: "financeObject", domain: "finance", line: { "zh-CN": "张三住宿单 · 3000 KGS", "ru-RU": "Ордер Чжана · 3000 KGS" } },
  "SO-20260520-003": { title: "stayObject", domain: "stay", line: { "zh-CN": "张三 · 待退房 · A301-02", "ru-RU": "Чжан Сан · выселение · A301-02" } },
  "ROOM-DRAFT-A302": { title: "createRoom", domain: "stay", line: { "zh-CN": "A302 · 宿舍 A 栋 · 待建档", "ru-RU": "A302 · корпус A · черновик" } },
  "BED-DRAFT-A302-01": { title: "createBed", domain: "stay", line: { "zh-CN": "A302-01 · 下铺 · 待检查", "ru-RU": "A302-01 · нижняя · проверка" } },
  "VEH-DRAFT-01KG999": { title: "createVehicle", domain: "repair", line: { "zh-CN": "01KG999XYZ · Toyota Camry · 待建档", "ru-RU": "01KG999XYZ · Toyota Camry · черновик" } },
  "AR-20260527-002": { title: "repairObject", domain: "repair", line: { "zh-CN": "维修完成 · 待验收关闭", "ru-RU": "Ремонт завершен · приемка" } }
};

const state = {
  lang: localStorage.getItem("workosnext.lang") || "zh-CN",
  view: localStorage.getItem("workosnext.onboarded") ? "home" : "onboarding",
  selectedTask: "T-STAY-DEPOSIT",
  query: "",
  filterOpen: false,
  advancedOpen: false,
  queueDomain: "all",
  queueBadge: "mine",
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
}
if (params.has("q")) {
  state.query = params.get("q");
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
      ${scenarioFlowCard("stayCheckin")}
      ${scenarioFlowCard("repairDispatch")}
      ${scenarioFlowCard("stayCheckout")}
      ${scenarioFlowCard("vehicleCreation")}
    </section>
  `);
}

function searchView() {
  const results = searchResults();
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
    ${scenario("stay", ["createRoom", "createBed", "createResident", "checkin", "checkout", "depositBlocked"])}
    ${scenario("repair", ["createRepairCustomer", "createVehicle", "createRepair", "assignRepair", "repairInspect"])}
    ${scenario("finance", ["confirmPayment", "returnEvidence"])}
  </section>`;
}

function scenario(domain, actions) {
  return `<article class="scenario-card ${domain}">
    <h3>${tr(domain)}</h3>
    <div>${actions.map((key) => `<button data-scenario="${key}">${tr(key)}</button>`).join("")}</div>
  </article>`;
}

function scenarioFlowCard(flowKey) {
  const loop = scenarioFlows[flowKey];
  const item = tasks.find((entry) => entry.id === loop.taskId);
  return `<article class="loop-card ${item.domain}">
    <div class="loop-head">
      <div><span>${tr(loop.category)} · ${tr(loop.label)}</span><strong>${tr(item.title)}</strong></div>
      <button data-task="${item.id}" data-target="task">${tr("continue")}</button>
    </div>
    <p>${tr(item.problem)}</p>
    <div class="loop-steps">${loop.stages[state.lang].map((stage, index) => `<span class="${index < 3 ? "done" : index === 3 ? "current" : ""}">${stage}</span>`).join("")}</div>
    <div class="loop-meta">
      <span>${tr("evidence")}: ${tx(loop.evidence)}</span>
      <span>${tr("policy")}: ${tx(loop.policy)}</span>
    </div>
  </article>`;
}

function searchResultBlocks(results) {
  const first = results[0] || tasks[0];
  return `
    <section class="result-focus">
      <span>${tr("bestNext")}</span>
      ${taskCard(first)}
    </section>
    <section class="compact-section">
      <h2>${tr("runnableTasks")}</h2>
      ${results.map(taskCard).join("")}
    </section>
    <section class="compact-section">
      <h2>${tr("relatedObjects")}</h2>
      ${results.map((item) => objectRow(item.objectId)).join("")}
    </section>
    <section class="help-card">
      <span>${tr("helpExplain")}</span>
      <p>${tr(first.problem)} ${tx(first.next)}</p>
    </section>`;
}

function searchResults() {
  const q = state.query.toLowerCase();
  if (!q) return [];
  const found = tasks.filter((item) => {
    const flow = scenarioFlows[item.flow];
    return [tr(item.title), tr(item.object), tr(item.problem), tr(flow.label), tr(flow.category), item.objectId].join(" ").toLowerCase().includes(q);
  });
  if (found.length) return found;
  if (q.includes("房间") || q.includes("комнат")) return [tasks.find((item) => item.id === "T-ROOM-CREATE")];
  if (q.includes("床位") || q.includes("койк")) return [tasks.find((item) => item.id === "T-BED-CREATE")];
  if (q.includes("车辆") || q.includes("车牌") || q.includes("vin") || q.includes("авто")) return [tasks.find((item) => item.id === "T-VEHICLE-CREATE")];
  if (q.includes("退房") || q.includes("высел")) return [tasks.find((item) => item.id === "T-STAY-CHECKOUT")];
  if (q.includes("维修") || q.includes("ремонт") || q.includes("toyota")) return [tasks[1]];
  if (q.includes("押金") || q.includes("депозит")) return [tasks[0], tasks[2]];
  return tasks;
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
      ${personal("feedback", "feedbackTitle", "feedbackBody")}
      ${personal("onboarding", "tutorial", "guideBody")}
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

function taskView() {
  const item = task();
  const loop = scenarioFlows[item.flow];
  return shell(`
    <section class="task-page">
      <span>${tr(item.domain)} · ${item.due}</span>
      <h1>${tr(item.title)}</h1>
      <p>${tr(item.object)}</p>
    </section>
    <section class="compact-section">
      <h2>${tr("flowStage")}</h2>
      <div class="loop-steps task-steps">${loop.stages[state.lang].map((stage, index) => `<span class="${index < 3 ? "done" : index === 3 ? "current" : ""}">${stage}</span>`).join("")}</div>
    </section>
    <section class="compact-section">
      <h2>${tr("fieldModel")}</h2>
      <div class="field-grid">${loop.fields.map(fieldRow).join("")}</div>
    </section>
    <section class="compact-section">
      <h2>${tr("whyMe")}</h2>
      <p>${tx(item.why)}</p>
      <h2>${tr("ifDelay")}</h2>
      <p>${tx(item.delay)}</p>
    </section>
    <section class="compact-section">
      <h2>${tr("operation")}</h2>
      ${operationFields(item)}
    </section>
    <section class="help-card">
      <span>${tr("guidance")}</span>
      <p>${tx(item.next)}</p>
    </section>
    <div class="sticky-action"><button data-view="confirmPage">${tr("confirmAction")}</button></div>
  `);
}

function operationFields(item) {
  if (item.flow === "roomCreation") {
    return `
      <label><span>Building / zone</span><input value="宿舍 A 栋" /></label>
      <label><span>Room number</span><input value="A302" /></label>
      <label><span>Capacity</span><input value="4" /></label>`;
  }
  if (item.flow === "bedCreation") {
    return `
      <label><span>Room</span><input value="A302" /></label>
      <label><span>Bed number</span><input value="A302-01" /></label>
      <label><span>Bed type</span><input value="下铺" /></label>`;
  }
  if (item.flow === "vehicleCreation") {
    return `
      <label><span>Customer</span><input value="张三汽修客户" /></label>
      <label><span>Plate</span><input value="01KG999XYZ" /></label>
      <label><span>VIN</span><input value="VIN-PENDING-009" /></label>`;
  }
  if (item.flow === "stayCheckout") {
    return `
      <label><span>Room inspection</span><input value="待检查" /></label>
      <label><span>Fee settlement</span><input value="待核对" /></label>
      <label><span>Deposit refund</span><input value="待财务确认" /></label>`;
  }
  if (item.flow === "repairClose") {
    return `
      <label><span>Inspection result</span><input value="待验收" /></label>
      <label><span>Fee material</span><input value="待确认" /></label>
      <label><span>Close policy</span><input value="人工确认" /></label>`;
  }
  if (item.domain === "repair") {
    return `
      <label><span>Technician</span><input value="Алексей Смирнов" /></label>
      <label><span>Arrival slot</span><input value="2026-05-28 16:30" /></label>
      <label><span>Vehicle status</span><input value="On site · not diagnosed" /></label>`;
  }
  return `
    <label><span>Deposit evidence</span><input value="DEP-009 · 3000 KGS" /></label>
    <label><span>Receipt number</span><input value="RCPT-20260528-009" /></label>
    <label><span>Stay order</span><input value="SO-20260528-001 · A301-02" /></label>`;
}

function fieldRow(field) {
  return `<div><span>${state.lang === "zh-CN" ? field[0] : field[2]}</span><strong>${state.lang === "zh-CN" ? field[1] : field[3]}</strong></div>`;
}

function objectView() {
  const object = objects[task().objectId];
  return shell(`
    <section class="task-page">
      <span>${tr(object.domain)}</span>
      <h1>${tr(object.title)}</h1>
      <p>${tx(object.line)}</p>
    </section>
    <section class="compact-section">${taskCard(task())}</section>
  `);
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
  return `<article class="task-card">
    <div><span>${tr(item.domain)} · ${tr(item.badges[0])} · ${item.due}</span><strong>${tr(item.title)}</strong><p>${tr(item.object)}</p><p>${tr("whyMe")}: ${tx(item.why)}</p></div>
    <button data-task="${item.id}" data-target="task">${tr("enterTask")}</button>
  </article>`;
}

function objectRow(id) {
  const object = objects[id];
  return `<article class="object-row"><div><span>${tr(object.domain)}</span><strong>${tr(object.title)}</strong><p>${tx(object.line)}</p></div><button data-task="${tasks.find((item) => item.objectId === id)?.id}" data-target="object">${tr("open")}</button></article>`;
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
    task: taskView,
    object: objectView,
    notes: () => simpleView("noteTitle", "noteBody"),
    reminders: () => simpleView("reminderTitle", "reminderBody"),
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
  document.querySelectorAll("[data-task]").forEach((node) => node.addEventListener("click", () => {
    state.selectedTask = node.dataset.task || state.selectedTask;
    setView(node.dataset.target || "task");
  }));
  document.querySelectorAll("[data-scenario]").forEach((node) => node.addEventListener("click", () => {
    state.query = node.textContent.trim();
    setView("search");
  }));
  document.querySelector("#query")?.addEventListener("input", (event) => {
    state.query = event.target.value;
  });
  document.querySelector("#searchNow")?.addEventListener("click", () => {
    state.query = document.querySelector("#query")?.value || "";
    state.view = "search";
    render(true);
  });
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
