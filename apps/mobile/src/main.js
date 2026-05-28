import "./styles.css";

const i18n = {
  "zh-CN": {
    app: "WorkOSNext",
    subtitle: "移动端业务操作系统",
    role: "运营经办人",
    home: "首页",
    search: "搜索",
    workbench: "工作台",
    help: "帮助",
    todayFocus: "现在最该处理",
    activeEntry: "我要找 / 我要办",
    passiveEntry: "今天该我处理",
    searchPlaceholder: "搜索人、车辆、房间、维修单",
    searchAction: "搜索",
    handleNow: "立即处理",
    viewDetails: "查看详情",
    continueTask: "继续办理",
    bestMatch: "最佳匹配",
    relatedObjects: "相关对象",
    availableTasks: "可处理任务",
    blockers: "阻断原因",
    workFirst: "先处理",
    dueToday: "今天到期",
    waitingConfirm: "等我确认",
    returned: "被退回",
    newlyAssigned: "新分配",
    recent: "最近处理",
    objectWorkspace: "业务对象",
    currentProblem: "当前问题",
    nextStep: "下一步",
    owner: "责任人",
    keyInfo: "关键信息",
    related: "相关信息",
    timeline: "时间线",
    taskSurface: "办理任务",
    checkBefore: "办理前核对",
    actionInfo: "填写信息",
    guidance: "提示与帮助",
    confirm: "确认办理",
    confirmTitle: "确认前核对影响",
    finish: "确认完成",
    resultTitle: "已完成并记录证据",
    resultBody: "系统已记录操作证据，下一步会回到对象页继续推荐。",
    aiBoundary: "AI 可解释、总结和推荐，但不能替你确认、扣费、退款、核销或关闭终态。",
    language: "语言",
    zh: "中文",
    ru: "Русский",
    domainStay: "住宿",
    domainAuto: "汽车维修",
    priorityCritical: "先处理",
    priorityToday: "今天处理",
    priorityConfirm: "待确认",
    statusBlocked: "已阻断",
    statusReady: "待处理",
    statusInspecting: "待诊断",
    statusConfirm: "待确认",
    bottomActionDeposit: "补交押金材料",
    bottomActionDiagnostic: "安排技师检查",
    fieldAmount: "押金金额",
    fieldNote: "补充说明",
    fieldTechnician: "维修技师",
    fieldSlot: "到场时间",
    helpWhy: "为什么不能继续？",
    helpField: "这个字段怎么填？",
    helpImpact: "会影响哪些业务？",
    metricTasks: "今日任务",
    metricBlocked: "阻断",
    metricConfirm: "待确认"
  },
  "ru-RU": {
    app: "WorkOSNext",
    subtitle: "Мобильная бизнес ОС",
    role: "Операционный сотрудник",
    home: "Главная",
    search: "Поиск",
    workbench: "Работа",
    help: "Помощь",
    todayFocus: "Главное сейчас",
    activeEntry: "Найти / выполнить",
    passiveEntry: "Моя работа сегодня",
    searchPlaceholder: "Поиск гостя, авто, комнаты, заявки",
    searchAction: "Искать",
    handleNow: "Обработать",
    viewDetails: "Открыть",
    continueTask: "Продолжить",
    bestMatch: "Лучшее совпадение",
    relatedObjects: "Связанные объекты",
    availableTasks: "Доступные задачи",
    blockers: "Причины блокировки",
    workFirst: "Сначала",
    dueToday: "Сегодня",
    waitingConfirm: "Ждет подтверждения",
    returned: "Возвращено",
    newlyAssigned: "Новое",
    recent: "Недавнее",
    objectWorkspace: "Бизнес-объект",
    currentProblem: "Текущая проблема",
    nextStep: "Следующий шаг",
    owner: "Ответственный",
    keyInfo: "Ключевые данные",
    related: "Связанные данные",
    timeline: "История",
    taskSurface: "Задача",
    checkBefore: "Проверить перед действием",
    actionInfo: "Заполнить данные",
    guidance: "Подсказка и помощь",
    confirm: "Подтвердить",
    confirmTitle: "Проверьте влияние",
    finish: "Завершить",
    resultTitle: "Готово, доказательство записано",
    resultBody: "Система записала аудит и вернется к объекту для следующего шага.",
    aiBoundary: "AI может объяснять, резюмировать и рекомендовать, но не подтверждает, не списывает, не возвращает деньги и не закрывает конечные состояния.",
    language: "Язык",
    zh: "中文",
    ru: "Русский",
    domainStay: "Проживание",
    domainAuto: "Авторемонт",
    priorityCritical: "Сначала",
    priorityToday: "Сегодня",
    priorityConfirm: "Подтвердить",
    statusBlocked: "Заблокировано",
    statusReady: "Ожидает",
    statusInspecting: "Диагностика",
    statusConfirm: "Подтверждение",
    bottomActionDeposit: "Дополнить депозит",
    bottomActionDiagnostic: "Назначить техника",
    fieldAmount: "Сумма депозита",
    fieldNote: "Комментарий",
    fieldTechnician: "Механик",
    fieldSlot: "Время визита",
    helpWhy: "Почему нельзя продолжить?",
    helpField: "Как заполнить поле?",
    helpImpact: "На что это влияет?",
    metricTasks: "Задачи",
    metricBlocked: "Блок",
    metricConfirm: "Подтв."
  }
};

const state = {
  lang: localStorage.getItem("workosnext.lang") || "zh-CN",
  view: "home",
  selectedId: "SO-20260528-001",
  query: ""
};

const projections = [
  {
    id: "SO-20260528-001",
    type: "stayOrder",
    domainKey: "domainStay",
    priorityKey: "priorityCritical",
    statusKey: "statusBlocked",
    title: { "zh-CN": "张三的住宿单", "ru-RU": "Ордер проживания Чжана" },
    subtitle: { "zh-CN": "A301 · A301-02 下铺", "ru-RU": "A301 · нижняя койка A301-02" },
    problem: { "zh-CN": "押金 3000 KGS 财务未通过，不能办理入住。", "ru-RU": "Депозит 3000 KGS не прошел фин. проверку, заселение недоступно." },
    next: { "zh-CN": "补交押金材料，等待财务确认。", "ru-RU": "Дополнить материалы депозита и ждать фин. подтверждения." },
    owner: { "zh-CN": "宿舍经办人 / 财务经办人", "ru-RU": "Оператор проживания / Финансы" },
    primaryTaskId: "TASK-STAY-DEPOSIT",
    primaryActionKey: "bottomActionDeposit",
    facts: [
      ["住宿单号", "SO-20260528-001", "Номер ордера", "SO-20260528-001"],
      ["入住人", "张三", "Гость", "Чжан Сан"],
      ["房间", "A301", "Комната", "A301"],
      ["床位", "A301-02 下铺", "Койка", "A301-02 нижняя"],
      ["计划入住", "2026-05-28", "План заселения", "2026-05-28"],
      ["押金", "3000 KGS · 财务未通过", "Депозит", "3000 KGS · не подтвержден"]
    ],
    related: { "zh-CN": "入住申请 APP-20260528-018 · 财务门禁 DEP-GATE-009", "ru-RU": "Заявка APP-20260528-018 · фин. проверка DEP-GATE-009" },
    timeline: {
      "zh-CN": ["申请已审批", "已选择 A301-02 床位", "押金材料被退回"],
      "ru-RU": ["Заявка одобрена", "Выбрана койка A301-02", "Материалы депозита возвращены"]
    },
    task: {
      title: { "zh-CN": "补交押金材料", "ru-RU": "Дополнить депозит" },
      journey: {
        "zh-CN": ["申请", "选床", "住宿单", "押金", "入住"],
        "ru-RU": ["Заявка", "Койка", "Ордер", "Депозит", "Заселение"]
      },
      activeStep: 3,
      checklist: {
        "zh-CN": ["住宿单号是否正确", "押金金额是否为 3000 KGS", "付款主体是否和申请一致"],
        "ru-RU": ["Номер ордера верный", "Сумма депозита 3000 KGS", "Плательщик совпадает с заявкой"]
      },
      fields: ["amount", "note"],
      risk: { "zh-CN": "提交后只生成押金材料，不代表财务已收款或核销。", "ru-RU": "После отправки создается материал депозита, это не оплата и не сверка." }
    }
  },
  {
    id: "AR-20260528-004",
    type: "autoRepair",
    domainKey: "domainAuto",
    priorityKey: "priorityToday",
    statusKey: "statusInspecting",
    title: { "zh-CN": "Toyota Camry 发动机异响", "ru-RU": "Toyota Camry: шум двигателя" },
    subtitle: { "zh-CN": "01KG123ABC · 司机 Иван Петров", "ru-RU": "01KG123ABC · водитель Иван Петров" },
    problem: { "zh-CN": "车辆已到场，等待安排技师检查。", "ru-RU": "Автомобиль на месте, ожидает назначения техника." },
    next: { "zh-CN": "安排技师诊断，记录预计检查时间。", "ru-RU": "Назначить механика и указать время диагностики." },
    owner: { "zh-CN": "维修主管", "ru-RU": "Руководитель сервиса" },
    primaryTaskId: "TASK-AUTO-DIAGNOSE",
    primaryActionKey: "bottomActionDiagnostic",
    facts: [
      ["维修单", "AR-20260528-004", "Заявка", "AR-20260528-004"],
      ["车辆", "Toyota Camry · 01KG123ABC", "Авто", "Toyota Camry · 01KG123ABC"],
      ["司机", "Иван Петров", "Водитель", "Иван Петров"],
      ["问题", "发动机异响", "Проблема", "Шум двигателя"],
      ["优先级", "今天处理", "Приоритет", "Сегодня"],
      ["当前状态", "等待诊断", "Статус", "Ожидает диагностики"]
    ],
    related: { "zh-CN": "车辆档案 VEH-00129 · 上次保养 2026-04-15", "ru-RU": "Карточка VEH-00129 · ТО 2026-04-15" },
    timeline: {
      "zh-CN": ["司机提交报修", "车辆已到场", "等待维修主管派诊断"],
      "ru-RU": ["Водитель подал заявку", "Авто прибыло", "Ожидает назначения диагностики"]
    },
    task: {
      title: { "zh-CN": "安排技师检查", "ru-RU": "Назначить диагностику" },
      journey: {
        "zh-CN": ["报修", "到场", "诊断", "维修", "验收", "关闭"],
        "ru-RU": ["Заявка", "Прибыло", "Диагностика", "Ремонт", "Приемка", "Закрытие"]
      },
      activeStep: 2,
      checklist: {
        "zh-CN": ["车辆牌照是否一致", "司机描述是否完整", "是否需要紧急停运"],
        "ru-RU": ["Номер авто совпадает", "Описание водителя полное", "Нужна ли срочная остановка"]
      },
      fields: ["technician", "slot", "note"],
      risk: { "zh-CN": "派工会通知技师，不会自动确认维修完成或生成费用。", "ru-RU": "Назначение уведомит механика, но не завершит ремонт и не создаст расходы." }
    }
  }
];

const analytics = [];

function tr(key) {
  return i18n[state.lang][key] || i18n["zh-CN"][key] || key;
}

function tx(value) {
  return typeof value === "string" ? value : value[state.lang] || value["zh-CN"];
}

function currentObject() {
  return projections.find((item) => item.id === state.selectedId) || projections[0];
}

function setView(view) {
  state.view = view;
  record("view", view);
  render();
}

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("workosnext.lang", lang);
  record("language", lang);
  render();
}

function selectObject(id, view = "object") {
  state.selectedId = id;
  record("object", id);
  setView(view);
}

function record(type, value) {
  analytics.unshift({ type, value, language: state.lang, time: new Date().toISOString() });
}

function shell(content) {
  return `
    <main class="app-shell">
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
      ${content}
      <nav class="bottom-nav">
        ${navButton("home", "home")}
        ${navButton("search", "search")}
        ${navButton("workbench", "workbench")}
        ${navButton("help", "help")}
      </nav>
    </main>
  `;
}

function navButton(view, labelKey) {
  return `<button data-view="${view}" class="${state.view === view ? "active" : ""}">${tr(labelKey)}</button>`;
}

function homeView() {
  const focus = projections[0];
  return shell(`
    <section class="focus-card">
      <span>${tr("todayFocus")} · ${tr(focus.domainKey)}</span>
      <h1>${tx(focus.title)}</h1>
      <p>${tx(focus.problem)}</p>
      <button data-object="${focus.id}" data-target="task">${tr("handleNow")}</button>
    </section>
    <section class="intent-card">
      <label>${tr("activeEntry")}</label>
      <div class="search-line">
        <input id="query" value="${state.query}" placeholder="${tr("searchPlaceholder")}" />
        <button id="searchNow">${tr("searchAction")}</button>
      </div>
    </section>
    <section class="metric-row">
      <div><span>${tr("metricTasks")}</span><strong>7</strong></div>
      <div><span>${tr("metricBlocked")}</span><strong>2</strong></div>
      <div><span>${tr("metricConfirm")}</span><strong>3</strong></div>
    </section>
    <section class="section-block">
      <div class="section-title">
        <h2>${tr("passiveEntry")}</h2>
        <button data-view="workbench">${tr("viewDetails")}</button>
      </div>
      ${compactWorkItem(projections[1])}
    </section>
    <section class="section-block">
      <h2>${tr("recent")}</h2>
      ${projections.map((item) => objectRow(item)).join("")}
    </section>
  `);
}

function searchView() {
  const query = state.query || (state.lang === "zh-CN" ? "张三 押金未通过" : "Чжан депозит");
  return shell(`
    <section class="page-head">
      <span>Intent Hub</span>
      <h1>${tr("activeEntry")}</h1>
      <div class="search-line">
        <input id="query" value="${query}" />
        <button id="searchNow">${tr("searchAction")}</button>
      </div>
    </section>
    <section class="best-match">
      <span>${tr("bestMatch")}</span>
      ${decisionCard(projections[0])}
    </section>
    <section class="section-block">
      <h2>${tr("relatedObjects")}</h2>
      ${projections.map((item) => objectRow(item)).join("")}
    </section>
    <section class="section-block">
      <h2>${tr("availableTasks")}</h2>
      ${projections.map((item) => taskRow(item)).join("")}
    </section>
    <section class="hint-card">
      <h2>${tr("blockers")}</h2>
      <p>${tx(projections[0].problem)}</p>
    </section>
  `);
}

function workbenchView() {
  return shell(`
    <section class="page-head compact">
      <span>Work Queue</span>
      <h1>${tr("passiveEntry")}</h1>
    </section>
    ${workLane("workFirst", [projections[0]])}
    ${workLane("dueToday", [projections[1]])}
    ${workLane("waitingConfirm", [projections[0]])}
    ${workLane("newlyAssigned", [projections[1]])}
    ${workLane("recent", projections)}
  `);
}

function objectView() {
  const item = currentObject();
  return shell(`
    <section class="object-hero">
      <span>${tr("objectWorkspace")} · ${tr(item.domainKey)}</span>
      <h1>${tx(item.title)}</h1>
      <p>${tx(item.subtitle)}</p>
      <div class="status-strip">
        <b>${tr(item.statusKey)}</b>
        <span>${tr(item.priorityKey)}</span>
      </div>
    </section>
    <section class="issue-card">
      <span>${tr("currentProblem")}</span>
      <strong>${tx(item.problem)}</strong>
      <p>${tr("nextStep")}: ${tx(item.next)}</p>
    </section>
    <section class="section-block">
      <h2>${tr("keyInfo")}</h2>
      <div class="fact-list">${item.facts.map((fact) => factRow(fact)).join("")}</div>
    </section>
    <section class="section-block">
      <h2>${tr("availableTasks")}</h2>
      ${taskRow(item)}
    </section>
    <section class="section-block">
      <h2>${tr("related")}</h2>
      <p>${tx(item.related)}</p>
    </section>
    <section class="section-block">
      <h2>${tr("timeline")}</h2>
      <ol class="timeline">${item.timeline[state.lang].map((step) => `<li>${step}</li>`).join("")}</ol>
    </section>
  `);
}

function taskView() {
  const item = currentObject();
  const task = item.task;
  const steps = task.journey[state.lang];
  return shell(`
    <section class="task-head">
      <span>${tr("taskSurface")} · ${tr(item.domainKey)}</span>
      <h1>${tx(task.title)}</h1>
      <p>${tx(item.title)} · ${tx(item.subtitle)}</p>
    </section>
    <section class="journey">${steps.map((step, index) => `<span class="${index === task.activeStep ? "current" : index < task.activeStep ? "done" : ""}">${step}</span>`).join("")}</section>
    <section class="section-block">
      <h2>${tr("checkBefore")}</h2>
      <ul class="check-list">${task.checklist[state.lang].map((step) => `<li>${step}</li>`).join("")}</ul>
    </section>
    <section class="section-block">
      <h2>${tr("actionInfo")}</h2>
      ${task.fields.map((field) => inputField(field)).join("")}
    </section>
    <section class="hint-card">
      <h2>${tr("guidance")}</h2>
      <p>${tx(task.risk)}</p>
      <button data-view="help">${tr("help")}</button>
    </section>
    <div class="sticky-action">
      <button id="confirmAction">${tr("confirm")}</button>
    </div>
  `);
}

function confirmView() {
  const item = currentObject();
  return shell(`
    <section class="confirm-panel">
      <span>${tr("confirm")}</span>
      <h1>${tr("confirmTitle")}</h1>
      <p>${tx(item.task.risk)}</p>
      <div class="confirm-grid">
        <div><span>${tr("objectWorkspace")}</span><strong>${tx(item.title)}</strong></div>
        <div><span>${tr("owner")}</span><strong>${tx(item.owner)}</strong></div>
        <div><span>${tr("nextStep")}</span><strong>${tx(item.next)}</strong></div>
      </div>
      <button id="finishAction">${tr("finish")}</button>
    </section>
  `);
}

function resultView() {
  const item = currentObject();
  return shell(`
    <section class="result-panel">
      <span>After Action</span>
      <h1>${tr("resultTitle")}</h1>
      <p>${tr("resultBody")}</p>
      <button data-object="${item.id}" data-target="object">${tr("viewDetails")}</button>
      <button data-view="workbench">${tr("workbench")}</button>
    </section>
  `);
}

function helpView() {
  return shell(`
    <section class="page-head compact">
      <span>Guidance Dock</span>
      <h1>${tr("help")}</h1>
    </section>
    <section class="help-grid">
      ${helpCard("helpWhy", projections[0].problem)}
      ${helpCard("helpField", projections[0].next)}
      ${helpCard("helpImpact", { "zh-CN": "押金影响入住，维修派工影响车辆停运和费用材料。", "ru-RU": "Депозит влияет на заселение, назначение ремонта влияет на простой авто и материалы расходов." })}
      ${helpCard("AI", { "zh-CN": tr("aiBoundary"), "ru-RU": tr("aiBoundary") })}
    </section>
  `);
}

function workLane(labelKey, items) {
  return `<section class="section-block"><h2>${tr(labelKey)}</h2>${items.map((item) => compactWorkItem(item)).join("")}</section>`;
}

function compactWorkItem(item) {
  return `<article class="compact-item">
    <div><span>${tr(item.domainKey)} · ${tr(item.priorityKey)}</span><strong>${tx(item.title)}</strong><p>${tx(item.problem)}</p></div>
    <button data-object="${item.id}" data-target="task">${tr("continueTask")}</button>
  </article>`;
}

function objectRow(item) {
  return `<article class="object-row">
    <div><span>${tr(item.domainKey)}</span><strong>${tx(item.title)}</strong><p>${tx(item.subtitle)}</p></div>
    <button data-object="${item.id}" data-target="object">${tr("viewDetails")}</button>
  </article>`;
}

function taskRow(item) {
  return `<article class="object-row task-row">
    <div><span>${tr(item.statusKey)}</span><strong>${tx(item.task.title)}</strong><p>${tx(item.next)}</p></div>
    <button data-object="${item.id}" data-target="task">${tr("continueTask")}</button>
  </article>`;
}

function decisionCard(item) {
  return `<article class="decision-card">
    <div><span>${tr(item.domainKey)} · ${tr(item.statusKey)}</span><strong>${tx(item.title)}</strong><p>${tx(item.problem)}</p></div>
    <button data-object="${item.id}" data-target="task">${tr(item.primaryActionKey)}</button>
  </article>`;
}

function factRow(fact) {
  const label = state.lang === "zh-CN" ? fact[0] : fact[2];
  const value = state.lang === "zh-CN" ? fact[1] : fact[3];
  return `<div><span>${label}</span><strong>${value}</strong></div>`;
}

function inputField(field) {
  const labels = {
    amount: tr("fieldAmount"),
    note: tr("fieldNote"),
    technician: tr("fieldTechnician"),
    slot: tr("fieldSlot")
  };
  const values = {
    amount: "3000 KGS",
    note: state.lang === "zh-CN" ? "补交付款截图和收据编号" : "Добавить чек и номер квитанции",
    technician: state.lang === "zh-CN" ? "Алексей Смирнов" : "Алексей Смирнов",
    slot: "16:30"
  };
  return `<label class="field"><span>${labels[field]}</span><input value="${values[field] || ""}" /></label>`;
}

function helpCard(labelKey, body) {
  return `<article class="hint-card"><h2>${tr(labelKey)}</h2><p>${tx(body)}</p></article>`;
}

function render() {
  const views = { home: homeView, search: searchView, workbench: workbenchView, object: objectView, task: taskView, confirm: confirmView, result: resultView, help: helpView };
  document.documentElement.lang = state.lang;
  document.querySelector("#app").innerHTML = views[state.view]();
  bind();
}

function bind() {
  document.querySelector("#language")?.addEventListener("change", (event) => setLanguage(event.target.value));
  document.querySelectorAll("[data-view]").forEach((node) => node.addEventListener("click", () => setView(node.dataset.view)));
  document.querySelectorAll("[data-object]").forEach((node) => node.addEventListener("click", () => selectObject(node.dataset.object, node.dataset.target || "object")));
  document.querySelectorAll("#searchNow").forEach((node) => node.addEventListener("click", () => {
    state.query = document.querySelector("#query")?.value || "";
    setView("search");
  }));
  document.querySelector("#confirmAction")?.addEventListener("click", () => setView("confirm"));
  document.querySelector("#finishAction")?.addEventListener("click", () => setView("result"));
}

render();
