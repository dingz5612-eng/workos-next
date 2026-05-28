import "./styles.css";

const i18n = {
  "zh-CN": {
    app: "WorkOSNext",
    subtitle: "移动端业务操作系统",
    role: "运营经办人",
    home: "首页",
    search: "搜索",
    workbench: "工作台",
    me: "我的",
    language: "语言",
    zh: "中文",
    ru: "Русский",
    todayCommand: "今天先处理这些",
    todaySummary: "2 个紧急阻断，3 个待确认，维修与住宿都需要推进。",
    activeIntent: "我要找 / 我要办",
    searchPlaceholder: "搜索人、房间、车牌、业务动作",
    searchAction: "搜索",
    suggestedIntents: "默认意图",
    dynamicIntents: "根据习惯推荐",
    searchHint: "搜索只导航到对象或任务，关键动作仍需人工确认。",
    workByDomain: "按业务处理",
    domainAll: "全部",
    domainStay: "住宿",
    domainAuto: "维修",
    domainFinance: "财务",
    domainApproval: "审批",
    contextAll: "全部工作",
    contextMine: "待我处理",
    contextConfirm: "待我确认",
    contextWaiting: "等待他人",
    contextBlocked: "异常阻断",
    contextStarted: "我发起的",
    statusToday: "今天到期",
    statusSoon: "即将到期",
    statusOverdue: "已超时",
    statusHigh: "高优先级",
    statusEvidence: "缺证据",
    sortSmart: "智能推荐",
    sortDue: "截止时间",
    sortUpdated: "最近更新",
    sortImpact: "影响度",
    advancedFilters: "高级筛选",
    owner: "责任人",
    location: "地点",
    amount: "金额",
    hasBlocker: "有阻断",
    requiresConfirm: "需确认",
    viewObject: "打开对象",
    enterTask: "进入任务",
    confirmAction: "确认办理",
    finish: "确认完成",
    objectWorkspace: "业务对象",
    currentProblem: "当前问题",
    nextStep: "下一步",
    whyMe: "为什么给我",
    ifDelay: "不处理会怎样",
    facts: "业务事实",
    related: "相关对象",
    timeline: "流程时间线",
    taskSurface: "办理任务",
    operationArea: "操作区",
    guidanceArea: "下一步 / 提示 / 帮助",
    checklist: "办理前核对",
    helpQuestion: "上下文帮助",
    account: "账号",
    profile: "个人工作画像",
    permission: "权限范围",
    stats: "任务统计",
    preferences: "偏好设置",
    commonSearch: "常用搜索",
    savedFilters: "常用筛选",
    helpFeedback: "帮助与反馈",
    aiBoundary: "AI 可以解释、推荐和生成草稿，但不能自动确认、扣费、退款、核销或关闭终态。",
    resultTitle: "已记录操作证据",
    resultBody: "动作已进入人工确认后的业务链路，系统会继续推荐下一步。",
    depositTask: "补交押金材料",
    repairTask: "安排技师诊断",
    financeTask: "确认押金收款",
    stayTitle: "张三的住宿单",
    autoTitle: "Toyota Camry 发动机异响",
    financeTitle: "押金收款确认",
    depositBlocked: "押金 3000 KGS 财务未通过，不能办理入住。",
    autoWaiting: "车辆已到场，等待安排技师检查。",
    financeWaiting: "住宿经办人已补交材料，等待财务人工确认。",
    doneToday: "今日完成",
    overdue: "已超时",
    avgTime: "平均处理",
    recentObjects: "最近对象"
  },
  "ru-RU": {
    app: "WorkOSNext",
    subtitle: "Мобильная бизнес ОС",
    role: "Операционный сотрудник",
    home: "Главная",
    search: "Поиск",
    workbench: "Работа",
    me: "Мой",
    language: "Язык",
    zh: "中文",
    ru: "Русский",
    todayCommand: "Что делать сначала",
    todaySummary: "2 срочные блокировки, 3 подтверждения; проживание и ремонт нужно продвинуть.",
    activeIntent: "Найти / выполнить",
    searchPlaceholder: "Гость, комната, номер авто, действие",
    searchAction: "Искать",
    suggestedIntents: "Стандартные запросы",
    dynamicIntents: "Рекомендации по привычкам",
    searchHint: "Поиск открывает объект или задачу. Критические действия требуют человека.",
    workByDomain: "По бизнесу",
    domainAll: "Все",
    domainStay: "Проживание",
    domainAuto: "Ремонт",
    domainFinance: "Финансы",
    domainApproval: "Согласование",
    contextAll: "Все",
    contextMine: "Мои задачи",
    contextConfirm: "Подтвердить",
    contextWaiting: "Ждем других",
    contextBlocked: "Блокировки",
    contextStarted: "Я создал",
    statusToday: "Сегодня",
    statusSoon: "Скоро",
    statusOverdue: "Просрочено",
    statusHigh: "Высокий",
    statusEvidence: "Нет доказ.",
    sortSmart: "Умно",
    sortDue: "Срок",
    sortUpdated: "Обновлено",
    sortImpact: "Влияние",
    advancedFilters: "Фильтры",
    owner: "Ответственный",
    location: "Место",
    amount: "Сумма",
    hasBlocker: "Блок",
    requiresConfirm: "Подтвердить",
    viewObject: "Объект",
    enterTask: "Задача",
    confirmAction: "Подтвердить",
    finish: "Завершить",
    objectWorkspace: "Бизнес-объект",
    currentProblem: "Проблема",
    nextStep: "Следующий шаг",
    whyMe: "Почему мне",
    ifDelay: "Если задержать",
    facts: "Факты",
    related: "Связанные объекты",
    timeline: "История",
    taskSurface: "Задача",
    operationArea: "Операция",
    guidanceArea: "Следующий шаг / помощь",
    checklist: "Проверка",
    helpQuestion: "Контекстная помощь",
    account: "Аккаунт",
    profile: "Рабочий профиль",
    permission: "Права",
    stats: "Статистика",
    preferences: "Настройки",
    commonSearch: "Частый поиск",
    savedFilters: "Сохраненные фильтры",
    helpFeedback: "Помощь и отзыв",
    aiBoundary: "AI объясняет, рекомендует и готовит черновики, но не подтверждает, не списывает, не возвращает и не закрывает финальные статусы.",
    resultTitle: "Аудит записан",
    resultBody: "Действие вошло в цепочку после ручного подтверждения, система предложит следующий шаг.",
    depositTask: "Дополнить депозит",
    repairTask: "Назначить диагностику",
    financeTask: "Подтвердить депозит",
    stayTitle: "Ордер проживания Чжана",
    autoTitle: "Toyota Camry: шум двигателя",
    financeTitle: "Подтверждение депозита",
    depositBlocked: "Депозит 3000 KGS не прошел фин. проверку, заселение недоступно.",
    autoWaiting: "Авто прибыло, ожидает назначения механика.",
    financeWaiting: "Оператор дополнил материалы, ожидается ручное подтверждение финансов.",
    doneToday: "Готово",
    overdue: "Просрочено",
    avgTime: "Среднее",
    recentObjects: "Недавние"
  }
};

const state = {
  lang: localStorage.getItem("workosnext.lang") || "zh-CN",
  view: "home",
  selectedId: "SO-20260528-001",
  domain: "domainAll",
  context: "contextMine",
  status: "statusToday",
  sort: "sortSmart",
  query: "",
  searchOpen: false,
  scrollTopNext: false
};

const tasks = [
  {
    id: "T-STAY-DEPOSIT",
    objectId: "SO-20260528-001",
    domain: "domainStay",
    context: ["contextMine", "contextBlocked"],
    status: ["statusToday", "statusHigh", "statusEvidence"],
    priority: 98,
    due: "18:00",
    titleKey: "depositTask",
    objectTitleKey: "stayTitle",
    problemKey: "depositBlocked",
    location: "A301",
    owner: { "zh-CN": "宿舍经办人", "ru-RU": "Оператор проживания" },
    why: { "zh-CN": "你负责住宿单材料补交，财务确认前不能入住。", "ru-RU": "Вы отвечаете за материалы ордера; без финансов заселение недоступно." },
    delay: { "zh-CN": "入住会停在押金节点，床位不能释放给下一步。", "ru-RU": "Заселение останется на депозите, койка не перейдет дальше." },
    next: { "zh-CN": "补交付款截图和收据编号，等待财务人工确认。", "ru-RU": "Добавьте чек и номер квитанции, затем ждите финансов." }
  },
  {
    id: "T-AUTO-DIAGNOSE",
    objectId: "AR-20260528-004",
    domain: "domainAuto",
    context: ["contextMine"],
    status: ["statusToday", "statusHigh"],
    priority: 91,
    due: "17:30",
    titleKey: "repairTask",
    objectTitleKey: "autoTitle",
    problemKey: "autoWaiting",
    location: "维修场 2 号位",
    owner: { "zh-CN": "维修主管", "ru-RU": "Руководитель сервиса" },
    why: { "zh-CN": "你负责维修派工，车辆到场后必须先安排诊断。", "ru-RU": "Вы назначаете ремонт; после прибытия авто нужна диагностика." },
    delay: { "zh-CN": "车辆继续停运，后续配件和费用无法估算。", "ru-RU": "Авто простаивает, детали и стоимость нельзя оценить." },
    next: { "zh-CN": "选择技师和到场时间，不会自动关闭维修单。", "ru-RU": "Выберите механика и время, заявка не закроется автоматически." }
  },
  {
    id: "T-FIN-DEPOSIT",
    objectId: "FIN-20260528-009",
    domain: "domainFinance",
    context: ["contextConfirm", "contextWaiting"],
    status: ["statusSoon"],
    priority: 82,
    due: "明天 12:00",
    titleKey: "financeTask",
    objectTitleKey: "financeTitle",
    problemKey: "financeWaiting",
    location: "财务",
    owner: { "zh-CN": "财务经办人", "ru-RU": "Финансовый оператор" },
    why: { "zh-CN": "住宿押金已补交，需要你人工核对收款证据。", "ru-RU": "Материалы депозита дополнены, требуется ручная проверка." },
    delay: { "zh-CN": "住宿经办人无法继续办理入住。", "ru-RU": "Оператор проживания не сможет продолжить заселение." },
    next: { "zh-CN": "核对凭证后确认或退回，不能由 AI 自动通过。", "ru-RU": "Проверьте доказательства и подтвердите или верните; AI не проходит автоматически." }
  }
];

const objects = {
  "SO-20260528-001": {
    domain: "domainStay",
    titleKey: "stayTitle",
    subtitle: { "zh-CN": "张三 · A301 · A301-02 下铺", "ru-RU": "Чжан Сан · A301 · нижняя койка A301-02" },
    problemKey: "depositBlocked",
    next: tasks[0].next,
    facts: [
      ["住宿单号", "SO-20260528-001", "Ордер", "SO-20260528-001"],
      ["入住人", "张三", "Гость", "Чжан Сан"],
      ["房间/床位", "A301 / A301-02 下铺", "Комната/койка", "A301 / A301-02 нижняя"],
      ["押金", "3000 KGS · 待财务确认", "Депозит", "3000 KGS · ждет финансов"]
    ],
    related: { "zh-CN": "入住申请 APP-018 · 床位 BED-A301-02 · 押金凭证 DEP-009", "ru-RU": "Заявка APP-018 · койка BED-A301-02 · депозит DEP-009" },
    timeline: {
      "zh-CN": ["申请审批通过", "已选择 A301-02", "押金材料被退回", "等待补交"],
      "ru-RU": ["Заявка одобрена", "Выбрана A301-02", "Материалы возвращены", "Ждет дополнения"]
    }
  },
  "AR-20260528-004": {
    domain: "domainAuto",
    titleKey: "autoTitle",
    subtitle: { "zh-CN": "01KG123ABC · 司机 Иван Петров · 维修场 2 号位", "ru-RU": "01KG123ABC · водитель Иван Петров · пост 2" },
    problemKey: "autoWaiting",
    next: tasks[1].next,
    facts: [
      ["维修单号", "AR-20260528-004", "Заявка", "AR-20260528-004"],
      ["车辆", "Toyota Camry · 01KG123ABC", "Авто", "Toyota Camry · 01KG123ABC"],
      ["司机", "Иван Петров", "Водитель", "Иван Петров"],
      ["故障", "发动机异响", "Проблема", "Шум двигателя"]
    ],
    related: { "zh-CN": "车辆档案 VEH-00129 · 上次保养 2026-04-15 · 司机反馈 FB-102", "ru-RU": "Карточка VEH-00129 · ТО 2026-04-15 · отзыв FB-102" },
    timeline: {
      "zh-CN": ["司机提交报修", "车辆已到场", "等待维修主管派诊断"],
      "ru-RU": ["Водитель подал заявку", "Авто прибыло", "Ожидает диагностики"]
    }
  },
  "FIN-20260528-009": {
    domain: "domainFinance",
    titleKey: "financeTitle",
    subtitle: { "zh-CN": "张三住宿单 · 3000 KGS · 人工确认", "ru-RU": "Ордер Чжана · 3000 KGS · ручное подтверждение" },
    problemKey: "financeWaiting",
    next: tasks[2].next,
    facts: [
      ["凭证号", "DEP-009", "Документ", "DEP-009"],
      ["金额", "3000 KGS", "Сумма", "3000 KGS"],
      ["来源", "住宿押金", "Источник", "Депозит проживания"],
      ["边界", "AI 不可自动确认", "Граница", "AI не подтверждает"]
    ],
    related: { "zh-CN": "住宿单 SO-20260528-001 · 入住申请 APP-018", "ru-RU": "Ордер SO-20260528-001 · заявка APP-018" },
    timeline: {
      "zh-CN": ["押金材料退回", "经办人补交", "等待财务确认"],
      "ru-RU": ["Материалы возвращены", "Оператор дополнил", "Ждет финансы"]
    }
  }
};

const defaultIntents = {
  "zh-CN": ["办理入住", "押金未通过", "A301", "创建维修单", "维修派工", "今天到期"],
  "ru-RU": ["Заселение", "Депозит не прошел", "A301", "Создать ремонт", "Назначить механика", "Сегодня"]
};

const dynamicIntents = {
  "zh-CN": ["张三住宿单", "Toyota Camry", "待我确认", "异常阻断"],
  "ru-RU": ["Ордер Чжана", "Toyota Camry", "Подтвердить", "Блокировки"]
};

function tr(key) {
  return i18n[state.lang][key] || key;
}

function tx(value) {
  return typeof value === "string" ? value : value[state.lang] || value["zh-CN"];
}

function currentTask() {
  return tasks.find((task) => task.objectId === state.selectedId) || tasks[0];
}

function currentObject() {
  return objects[state.selectedId] || objects["SO-20260528-001"];
}

function setView(view) {
  state.view = view;
  state.searchOpen = false;
  state.scrollTopNext = true;
  render();
}

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("workosnext.lang", lang);
  render();
}

function selectObject(objectId, view = "object") {
  state.selectedId = objectId;
  setView(view);
}

function shell(content) {
  return `
    <main class="app-shell view-${state.view}">
      <header class="topbar">
        <div>
          <strong>${tr("app")}</strong>
          <span>${tr("subtitle")}</span>
        </div>
        <select id="language" aria-label="${tr("language")}">
          <option value="zh-CN" ${state.lang === "zh-CN" ? "selected" : ""}>${tr("zh")}</option>
          <option value="ru-RU" ${state.lang === "ru-RU" ? "selected" : ""}>${tr("ru")}</option>
        </select>
      </header>
      <section class="role-strip">
        <span>${tr("role")}</span>
        <strong>${tr("aiBoundary")}</strong>
      </section>
      ${content}
      <nav class="bottom-nav">
        ${navButton("home", "home")}
        ${navButton("search", "search")}
        ${navButton("workbench", "workbench")}
        ${navButton("me", "me")}
      </nav>
    </main>
  `;
}

function navButton(view, labelKey) {
  return `<button data-view="${view}" class="${state.view === view ? "active" : ""}">${tr(labelKey)}</button>`;
}

function homeView() {
  const primary = tasks[0];
  return shell(`
    <section class="hero-panel">
      <span>${tr("todayCommand")}</span>
      <h1>${tr(primary.objectTitleKey)}</h1>
      <p>${tr("todaySummary")}</p>
      <button data-object="${primary.objectId}" data-target="task">${tr("enterTask")}</button>
    </section>
    ${searchBlock("home")}
    <section class="metric-grid">
      ${metric("metric", "7", tr("contextMine"))}
      ${metric("warning", "2", tr("contextBlocked"))}
      ${metric("confirm", "3", tr("contextConfirm"))}
    </section>
    <section class="section-block">
      <div class="section-title">
        <h2>${tr("workByDomain")}</h2>
        <button data-view="workbench">${tr("workbench")}</button>
      </div>
      ${domainHighlight("domainStay", tasks[0])}
      ${domainHighlight("domainAuto", tasks[1])}
      ${domainHighlight("domainFinance", tasks[2])}
    </section>
    <section class="section-block">
      <h2>${tr("recentObjects")}</h2>
      ${Object.entries(objects).map(([id, object]) => objectRow(id, object)).join("")}
    </section>
  `);
}

function searchView() {
  const results = searchResults();
  return shell(`
    <section class="page-head">
      <span>Intent Hub</span>
      <h1>${tr("activeIntent")}</h1>
      <p>${tr("searchHint")}</p>
    </section>
    ${searchBlock("search")}
    <section class="suggestion-panel">
      <h2>${tr("suggestedIntents")}</h2>
      <div class="chip-grid">${defaultIntents[state.lang].map((item) => intentChip(item)).join("")}</div>
      <h2>${tr("dynamicIntents")}</h2>
      <div class="chip-grid">${dynamicIntents[state.lang].map((item) => intentChip(item, "soft")).join("")}</div>
    </section>
    <section class="section-block">
      <h2>${tr("objectWorkspace")}</h2>
      ${results.map((id) => objectRow(id, objects[id])).join("")}
    </section>
    <section class="section-block">
      <h2>${tr("taskSurface")}</h2>
      ${tasks.filter((task) => results.includes(task.objectId)).map((task) => taskCard(task)).join("")}
    </section>
    ${contextHelpCard(tasks[0])}
  `);
}

function workbenchView() {
  const visible = filteredTasks();
  return shell(`
    <section class="page-head">
      <span>Task Command Center</span>
      <h1>${tr("workbench")}</h1>
      <p>${tr("todaySummary")}</p>
    </section>
    <section class="filter-panel">
      <h2>${tr("workByDomain")}</h2>
      <div class="tab-row">${["domainAll", "domainStay", "domainAuto", "domainFinance", "domainApproval"].map((key) => filterButton("domain", key)).join("")}</div>
      <h2>${tr("contextMine")}</h2>
      <div class="context-grid">${["contextMine", "contextConfirm", "contextWaiting", "contextBlocked", "contextStarted"].map((key) => filterButton("context", key)).join("")}</div>
      <div class="chip-grid status-row">${["statusToday", "statusSoon", "statusOverdue", "statusHigh", "statusEvidence"].map((key) => filterButton("status", key, "chip")).join("")}</div>
      <label class="sort-line">
        <span>${tr("sortSmart")}</span>
        <select id="sortSelect">
          ${["sortSmart", "sortDue", "sortUpdated", "sortImpact"].map((key) => `<option value="${key}" ${state.sort === key ? "selected" : ""}>${tr(key)}</option>`).join("")}
        </select>
      </label>
    </section>
    <section class="section-block task-list">
      ${visible.map((task) => taskCard(task)).join("") || emptyState()}
    </section>
    <section class="advanced-panel">
      <h2>${tr("advancedFilters")}</h2>
      <div>${tr("owner")} · ${tr("location")} · ${tr("amount")} · ${tr("hasBlocker")} · ${tr("requiresConfirm")}</div>
    </section>
  `);
}

function objectView() {
  const object = currentObject();
  const task = currentTask();
  return shell(`
    <section class="object-hero">
      <span>${tr("objectWorkspace")} · ${tr(object.domain)}</span>
      <h1>${tr(object.titleKey)}</h1>
      <p>${tx(object.subtitle)}</p>
    </section>
    <section class="three-zone">
      <article>
        <span>${tr("currentProblem")}</span>
        <strong>${tr(object.problemKey)}</strong>
      </article>
      <article>
        <span>${tr("nextStep")}</span>
        <strong>${tx(object.next)}</strong>
      </article>
    </section>
    <section class="section-block">
      <h2>${tr("facts")}</h2>
      <div class="fact-list">${object.facts.map((fact) => factRow(fact)).join("")}</div>
    </section>
    <section class="section-block">
      <h2>${tr("taskSurface")}</h2>
      ${taskCard(task)}
    </section>
    <section class="section-block">
      <h2>${tr("related")}</h2>
      <p>${tx(object.related)}</p>
    </section>
    <section class="section-block">
      <h2>${tr("timeline")}</h2>
      <ol class="timeline">${object.timeline[state.lang].map((item) => `<li>${item}</li>`).join("")}</ol>
    </section>
  `);
}

function taskView() {
  const task = currentTask();
  const object = objects[task.objectId];
  const fields = task.domain === "domainAuto" ? repairFields() : depositFields();
  return shell(`
    <section class="task-head">
      <span>${tr("taskSurface")} · ${tr(task.domain)}</span>
      <h1>${tr(task.titleKey)}</h1>
      <p>${tr(task.objectTitleKey)} · ${task.location} · ${task.due}</p>
    </section>
    <section class="process-rail">
      ${processSteps(task.domain).map((step, index) => `<span class="${index === 2 ? "current" : index < 2 ? "done" : ""}">${step}</span>`).join("")}
    </section>
    <section class="section-block">
      <h2>${tr("checklist")}</h2>
      <ul class="check-list">
        <li>${tr(task.problemKey)}</li>
        <li>${tr("whyMe")}: ${tx(task.why)}</li>
        <li>${tr("ifDelay")}: ${tx(task.delay)}</li>
      </ul>
    </section>
    <section class="section-block">
      <h2>${tr("operationArea")}</h2>
      ${fields}
    </section>
    ${contextHelpCard(task)}
    <div class="sticky-action"><button id="confirmAction">${tr("confirmAction")}</button></div>
  `);
}

function confirmView() {
  const task = currentTask();
  return shell(`
    <section class="confirm-panel">
      <span>${tr("confirmAction")}</span>
      <h1>${tr(task.titleKey)}</h1>
      <p>${tx(task.next)}</p>
      <div class="confirm-grid">
        <div><span>${tr("objectWorkspace")}</span><strong>${tr(task.objectTitleKey)}</strong></div>
        <div><span>${tr("whyMe")}</span><strong>${tx(task.why)}</strong></div>
        <div><span>${tr("aiBoundary")}</span><strong>${tr("requiresConfirm")}</strong></div>
      </div>
      <button id="finishAction">${tr("finish")}</button>
    </section>
  `);
}

function resultView() {
  const task = currentTask();
  return shell(`
    <section class="result-panel">
      <span>Audit Evidence</span>
      <h1>${tr("resultTitle")}</h1>
      <p>${tr("resultBody")}</p>
      <button data-object="${task.objectId}" data-target="object">${tr("viewObject")}</button>
      <button data-view="workbench">${tr("workbench")}</button>
    </section>
  `);
}

function meView() {
  return shell(`
    <section class="profile-card">
      <span>${tr("account")}</span>
      <h1>${tr("role")}</h1>
      <p>${tr("permission")}: ${tr("domainStay")} · ${tr("domainAuto")} · ${tr("domainFinance")}</p>
    </section>
    <section class="metric-grid">
      ${metric("metric", "11", tr("doneToday"))}
      ${metric("warning", "1", tr("overdue"))}
      ${metric("confirm", "18m", tr("avgTime"))}
    </section>
    <section class="section-block">
      <h2>${tr("profile")}</h2>
      ${profileRow(tr("commonSearch"), dynamicIntents[state.lang].join(" · "))}
      ${profileRow(tr("savedFilters"), `${tr("domainAuto")} + ${tr("contextMine")} + ${tr("statusToday")}`)}
      ${profileRow(tr("preferences"), `${tr("language")}: ${state.lang === "zh-CN" ? tr("zh") : tr("ru")}`)}
    </section>
    <section class="section-block">
      <h2>${tr("helpFeedback")}</h2>
      <p>${tr("aiBoundary")}</p>
    </section>
  `);
}

function searchBlock(source) {
  const isOpen = state.searchOpen || source === "search";
  return `
    <section class="intent-card ${isOpen ? "open" : ""}">
      <div class="search-line">
        <input id="query" value="${state.query}" placeholder="${tr("searchPlaceholder")}" />
        <button id="searchNow">${tr("searchAction")}</button>
      </div>
      <div class="search-popover" ${isOpen ? "" : "hidden"}>${searchResults().map((id) => objectRow(id, objects[id])).join("")}</div>
    </section>
  `;
}

function searchResults() {
  const query = state.query.toLowerCase();
  if (!query) {
    return ["SO-20260528-001", "AR-20260528-004", "FIN-20260528-009"];
  }

  return Object.keys(objects).filter((id) => {
    const object = objects[id];
    const text = [id, tr(object.titleKey), tx(object.subtitle), tr(object.problemKey), tx(object.related)].join(" ").toLowerCase();
    return text.includes(query);
  }).concat(query.includes("押金") || query.includes("депозит") ? ["FIN-20260528-009"] : []).filter((id, index, list) => list.indexOf(id) === index);
}

function filteredTasks() {
  return tasks
    .filter((task) => state.domain === "domainAll" || task.domain === state.domain)
    .filter((task) => state.context === "contextAll" || task.context.includes(state.context))
    .filter((task) => task.status.includes(state.status))
    .sort((a, b) => state.sort === "sortImpact" ? b.priority - a.priority : a.due.localeCompare(b.due));
}

function domainHighlight(domain, task) {
  return `<article class="domain-card ${domain}">
    <span>${tr(domain)}</span>
    <strong>${tr(task.titleKey)}</strong>
    <p>${tr(task.problemKey)}</p>
    <button data-object="${task.objectId}" data-target="task">${tr("enterTask")}</button>
  </article>`;
}

function taskCard(task) {
  return `<article class="task-card">
    <div>
      <span>${tr(task.domain)} · ${tr(task.status[0])} · ${task.due}</span>
      <strong>${tr(task.titleKey)}</strong>
      <p>${tr(task.objectTitleKey)}</p>
      <p>${tr("whyMe")}: ${tx(task.why)}</p>
    </div>
    <button data-object="${task.objectId}" data-target="task">${tr("enterTask")}</button>
  </article>`;
}

function objectRow(id, object) {
  return `<article class="object-row">
    <div>
      <span>${tr(object.domain)}</span>
      <strong>${tr(object.titleKey)}</strong>
      <p>${tx(object.subtitle)}</p>
    </div>
    <button data-object="${id}" data-target="object">${tr("viewObject")}</button>
  </article>`;
}

function filterButton(kind, key, style = "") {
  const active = state[kind] === key;
  return `<button class="${style} ${active ? "active" : ""}" data-filter-kind="${kind}" data-filter-value="${key}">${tr(key)}</button>`;
}

function intentChip(text, style = "") {
  return `<button class="chip ${style}" data-intent="${text}">${text}</button>`;
}

function metric(style, value, label) {
  return `<div class="${style}"><span>${label}</span><strong>${value}</strong></div>`;
}

function factRow(fact) {
  return `<div><span>${state.lang === "zh-CN" ? fact[0] : fact[2]}</span><strong>${state.lang === "zh-CN" ? fact[1] : fact[3]}</strong></div>`;
}

function profileRow(label, value) {
  return `<article class="profile-row"><span>${label}</span><strong>${value}</strong></article>`;
}

function processSteps(domain) {
  return domain === "domainAuto"
    ? (state.lang === "zh-CN" ? ["报修", "到场", "诊断", "维修", "验收"] : ["Заявка", "Прибыло", "Диагностика", "Ремонт", "Приемка"])
    : (state.lang === "zh-CN" ? ["申请", "选床", "押金", "确认", "入住"] : ["Заявка", "Койка", "Депозит", "Подтв.", "Заселение"]);
}

function depositFields() {
  return `
    <label class="field"><span>${tr("amount")}</span><input value="3000 KGS" /></label>
    <label class="field"><span>${tr("related")}</span><input value="DEP-009 / SO-20260528-001" /></label>
  `;
}

function repairFields() {
  return `
    <label class="field"><span>${tr("owner")}</span><input value="Алексей Смирнов" /></label>
    <label class="field"><span>${tr("location")}</span><input value="${state.lang === "zh-CN" ? "维修场 2 号位 · 16:30" : "Пост 2 · 16:30"}" /></label>
  `;
}

function contextHelpCard(task) {
  return `<section class="guidance-card">
    <span>${tr("guidanceArea")}</span>
    <h2>${tr("helpQuestion")}</h2>
    <p>${tr("currentProblem")}: ${tr(task.problemKey)}</p>
    <p>${tr("nextStep")}: ${tx(task.next)}</p>
    <p>${tr("ifDelay")}: ${tx(task.delay)}</p>
  </section>`;
}

function emptyState() {
  return `<article class="empty-state"><strong>${tr("workbench")}</strong><p>${tr("searchHint")}</p></article>`;
}

function render() {
  const views = { home: homeView, search: searchView, workbench: workbenchView, object: objectView, task: taskView, confirm: confirmView, result: resultView, me: meView };
  document.documentElement.lang = state.lang;
  document.querySelector("#app").innerHTML = views[state.view]();
  bind();
  if (state.scrollTopNext) {
    window.scrollTo({ top: 0, left: 0 });
    state.scrollTopNext = false;
  }
}

function bind() {
  document.querySelector("#language")?.addEventListener("change", (event) => setLanguage(event.target.value));
  document.querySelectorAll("[data-view]").forEach((node) => node.addEventListener("click", () => setView(node.dataset.view)));
  document.querySelectorAll("[data-object]").forEach((node) => node.addEventListener("click", () => selectObject(node.dataset.object, node.dataset.target || "object")));
  document.querySelectorAll("[data-filter-kind]").forEach((node) => node.addEventListener("click", () => {
    state[node.dataset.filterKind] = node.dataset.filterValue;
    render();
  }));
  document.querySelectorAll("[data-intent]").forEach((node) => node.addEventListener("click", () => {
    state.query = node.dataset.intent;
    state.searchOpen = true;
    setView("search");
  }));
  document.querySelector("#query")?.addEventListener("focus", () => {
    state.searchOpen = true;
    document.querySelector(".intent-card")?.classList.add("open");
    document.querySelector(".search-popover")?.removeAttribute("hidden");
  });
  document.querySelector("#query")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.searchOpen = true;
  });
  document.querySelector("#searchNow")?.addEventListener("click", () => {
    state.query = document.querySelector("#query")?.value || "";
    state.searchOpen = true;
    setView("search");
  });
  document.querySelector("#sortSelect")?.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
  document.querySelector("#confirmAction")?.addEventListener("click", () => setView("confirm"));
  document.querySelector("#finishAction")?.addEventListener("click", () => setView("result"));
  document.addEventListener("click", closeSearchOutside, { once: true });
  document.addEventListener("keydown", closeSearchByEscape, { once: true });
}

function closeSearchOutside(event) {
  if (!state.searchOpen || event.target.closest(".intent-card")) {
    return;
  }

  state.searchOpen = false;
  document.querySelector(".intent-card")?.classList.remove("open");
  document.querySelector(".search-popover")?.setAttribute("hidden", "");
}

function closeSearchByEscape(event) {
  if (event.key !== "Escape" || !state.searchOpen) {
    return;
  }

  state.searchOpen = false;
  document.querySelector(".intent-card")?.classList.remove("open");
  document.querySelector(".search-popover")?.setAttribute("hidden", "");
}

render();
