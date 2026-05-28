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
    stayClosedLoop: "住宿闭环",
    repairClosedLoop: "维修闭环",
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
    createRepair: "创建维修单",
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
    stayClosedLoop: "Цикл проживания",
    repairClosedLoop: "Цикл ремонта",
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
    createRepair: "Создать ремонт",
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
    title: "financeTask",
    object: "financeObject",
    problem: "financeProblem",
    due: "明天 12:00",
    badges: ["confirm", "waiting"],
    priority: 86,
    why: { "zh-CN": "你是财务确认人，需要人工核对收款证据。", "ru-RU": "Вы финансовый проверяющий, нужна ручная проверка." },
    delay: { "zh-CN": "住宿经办人无法继续办理入住。", "ru-RU": "Оператор проживания не сможет продолжить заселение." },
    next: { "zh-CN": "核对凭证后确认或退回，AI 不可自动通过。", "ru-RU": "Проверьте и подтвердите или верните; AI не проходит автоматически." }
  }
];

const businessLoops = {
  stay: {
    label: "stayClosedLoop",
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
  repair: {
    label: "repairClosedLoop",
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
  }
};

const objects = {
  "SO-20260528-001": { title: "stayObject", domain: "stay", line: { "zh-CN": "张三 · A301 · A301-02 下铺", "ru-RU": "Чжан Сан · A301 · нижняя койка" } },
  "AR-20260528-004": { title: "repairObject", domain: "repair", line: { "zh-CN": "01KG123ABC · 司机 Иван Петров", "ru-RU": "01KG123ABC · водитель Иван Петров" } },
  "FIN-20260528-009": { title: "financeObject", domain: "finance", line: { "zh-CN": "张三住宿单 · 3000 KGS", "ru-RU": "Ордер Чжана · 3000 KGS" } }
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
      <h2>${tr("businessFocus")}</h2>
      ${businessLoopCard("stay")}
      ${businessLoopCard("repair")}
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
    ${scenario("stay", ["checkin", "depositBlocked", "createStay"])}
    ${scenario("repair", ["createRepair", "assignRepair", "repairInspect"])}
    ${scenario("finance", ["confirmPayment", "returnEvidence"])}
  </section>`;
}

function scenario(domain, actions) {
  return `<article class="scenario-card ${domain}">
    <h3>${tr(domain)}</h3>
    <div>${actions.map((key) => `<button data-scenario="${key}">${tr(key)}</button>`).join("")}</div>
  </article>`;
}

function businessLoopCard(domain) {
  const loop = businessLoops[domain];
  const item = tasks.find((entry) => entry.id === loop.taskId);
  return `<article class="loop-card ${domain}">
    <div class="loop-head">
      <div><span>${tr(loop.label)}</span><strong>${tr(item.title)}</strong></div>
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
  const found = tasks.filter((item) => [tr(item.title), tr(item.object), tr(item.problem), item.objectId].join(" ").toLowerCase().includes(q));
  if (found.length) return found;
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
  const loop = businessLoops[item.domain];
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
