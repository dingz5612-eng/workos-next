import "./styles.css";

const translations = {
  "zh-CN": {
    appName: "WorkOSNext",
    appSubtitle: "移动端业务操作系统",
    language: "语言",
    role: "当前角色",
    roleValue: "运营经办人",
    home: "首页",
    intent: "我要找 / 我要办",
    workbench: "今天该我处理",
    objects: "对象",
    task: "任务",
    help: "帮助",
    tutorialTitle: "先说意图，再处理任务",
    tutorialText: "你可以搜索业务对象，也可以从工作台接收系统分配的任务。每个任务页只做一件事，关键动作前必须人工确认。",
    searchPlaceholder: "试试：张三入住 / 维修空调 / 押金未通过",
    searchButton: "搜索",
    important: "重要事项",
    recentObjects: "最近对象",
    startTask: "进入任务",
    openObject: "打开对象",
    todayWork: "今日工作",
    blockedWork: "阻断任务",
    waitingConfirm: "等我确认",
    recommended: "推荐下一步",
    objectWorkspace: "对象工作区",
    objectSummary: "对象摘要",
    currentState: "当前状态",
    blocker: "当前阻断",
    related: "相关对象",
    timeline: "流程时间线",
    taskSurface: "任务执行页",
    contextBar: "当前对象",
    journey: "流程位置",
    actionPanel: "办理操作",
    guidance: "下一步 / 提示 / 帮助",
    prepareAction: "准备动作",
    confirmAction: "人工确认",
    confirmTitle: "确认前请核对",
    confirmText: "系统只准备动作，不自动绕过权限、状态机或人工确认。",
    finish: "完成并记录证据",
    resultTitle: "动作已完成",
    resultText: "已生成审计证据，下一步回到对象页或工作台继续处理。",
    feedback: "提交反馈",
    aiBoundary: "AI 只做推荐、解释、草稿和搜索理解，不直接执行关键业务动作。",
    stats: "数据占位",
    statsText: "V1.0 先采集行为事件，完整统计分析后续版本启用。",
    domainAccommodation: "住宿",
    domainMaintenance: "维修",
    statusReady: "待处理",
    statusBlocked: "已阻断",
    statusConfirm: "待确认",
    navHome: "首页",
    navIntent: "搜索",
    navWorkbench: "工作台",
    navHelp: "帮助"
  },
  "ru-RU": {
    appName: "WorkOSNext",
    appSubtitle: "Мобильная бизнес ОС",
    language: "Язык",
    role: "Текущая роль",
    roleValue: "Операционный сотрудник",
    home: "Главная",
    intent: "Найти / выполнить",
    workbench: "Моя работа сегодня",
    objects: "Объекты",
    task: "Задача",
    help: "Помощь",
    tutorialTitle: "Сначала намерение, затем задача",
    tutorialText: "Ищите бизнес-объект или берите задачу из рабочего стола. Каждая страница задачи выполняет только одно действие, а важные действия требуют подтверждения человеком.",
    searchPlaceholder: "Например: заселить Чжана / ремонт кондиционера / депозит заблокирован",
    searchButton: "Искать",
    important: "Важные уведомления",
    recentObjects: "Недавние объекты",
    startTask: "Открыть задачу",
    openObject: "Открыть объект",
    todayWork: "Работа сегодня",
    blockedWork: "Заблокированные",
    waitingConfirm: "Ждет подтверждения",
    recommended: "Рекомендованный шаг",
    objectWorkspace: "Рабочее место объекта",
    objectSummary: "Сводка объекта",
    currentState: "Текущий статус",
    blocker: "Текущая блокировка",
    related: "Связанные объекты",
    timeline: "Лента процесса",
    taskSurface: "Страница задачи",
    contextBar: "Текущий объект",
    journey: "Позиция в процессе",
    actionPanel: "Действие",
    guidance: "Следующий шаг / подсказка / помощь",
    prepareAction: "Подготовить действие",
    confirmAction: "Подтвердить человеком",
    confirmTitle: "Проверьте перед подтверждением",
    confirmText: "Система только готовит действие и не обходит права, состояние или подтверждение человека.",
    finish: "Завершить и записать доказательство",
    resultTitle: "Действие завершено",
    resultText: "Аудит записан. Вернитесь к объекту или рабочему столу для следующего шага.",
    feedback: "Отправить отзыв",
    aiBoundary: "AI только рекомендует, объясняет, создает черновик и понимает поиск. Он не выполняет критические действия.",
    stats: "Заглушка аналитики",
    statsText: "V1.0 сначала собирает события поведения. Полная аналитика будет позже.",
    domainAccommodation: "Проживание",
    domainMaintenance: "Ремонт",
    statusReady: "В работе",
    statusBlocked: "Заблокировано",
    statusConfirm: "Ждет подтверждения",
    navHome: "Главная",
    navIntent: "Поиск",
    navWorkbench: "Работа",
    navHelp: "Помощь"
  }
};

const state = {
  lang: localStorage.getItem("workosnext.lang") || "zh-CN",
  view: "home",
  selectedObjectId: "stay-1001",
  selectedTaskId: "task-deposit"
};

const data = {
  objects: [
    {
      id: "stay-1001",
      domain: "domainAccommodation",
      title: { "zh-CN": "张三的住宿单", "ru-RU": "Проживание Чжана" },
      statusKey: "statusBlocked",
      blocker: { "zh-CN": "押金未通过，不能办理入住。", "ru-RU": "Депозит не прошел проверку, заселение недоступно." },
      nextTaskId: "task-deposit"
    },
    {
      id: "repair-2001",
      domain: "domainMaintenance",
      title: { "zh-CN": "A301 空调维修单", "ru-RU": "Заявка на ремонт кондиционера A301" },
      statusKey: "statusReady",
      blocker: { "zh-CN": "等待维修经办人派工。", "ru-RU": "Ожидает назначения ремонтного сотрудника." },
      nextTaskId: "task-dispatch"
    }
  ],
  tasks: [
    {
      id: "task-deposit",
      objectId: "stay-1001",
      title: { "zh-CN": "提交押金材料", "ru-RU": "Подать материалы по депозиту" },
      journey: ["申请", "选房", "住宿单", "押金", "入住", "退房"],
      journeyRu: ["Заявка", "Комната", "Ордер", "Депозит", "Заселение", "Выезд"],
      activeStep: 3,
      risk: { "zh-CN": "押金只提交材料，不代表财务已接收或核销。", "ru-RU": "Депозит является только материалом, это не прием или сверка финансов." },
      action: { "zh-CN": "填写押金金额并提交材料", "ru-RU": "Введите сумму депозита и отправьте материалы" }
    },
    {
      id: "task-dispatch",
      objectId: "repair-2001",
      title: { "zh-CN": "维修派工", "ru-RU": "Назначить ремонт" },
      journey: ["报修", "派工", "诊断", "维修", "验收", "关闭"],
      journeyRu: ["Заявка", "Назначение", "Диагностика", "Ремонт", "Приемка", "Закрытие"],
      activeStep: 1,
      risk: { "zh-CN": "派工后会通知维修人员，不会自动关闭工单。", "ru-RU": "После назначения сотрудник получит уведомление, заявка не закроется автоматически." },
      action: { "zh-CN": "选择维修人员并派工", "ru-RU": "Выберите исполнителя и назначьте работу" }
    }
  ],
  events: []
};

function t(key) {
  return translations[state.lang][key] || translations["zh-CN"][key] || key;
}

function text(value) {
  if (typeof value === "string") return value;
  return value[state.lang] || value["zh-CN"];
}

function track(eventType, payload = {}) {
  data.events.unshift({
    eventType,
    language: state.lang,
    at: new Date().toISOString(),
    ...payload
  });
}

function setView(view) {
  state.view = view;
  track("view_opened", { source: view });
  render();
}

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("workosnext.lang", lang);
  track("language_changed", { source: lang });
  render();
}

function selectObject(objectId) {
  state.selectedObjectId = objectId;
  const obj = data.objects.find((item) => item.id === objectId);
  state.selectedTaskId = obj?.nextTaskId || state.selectedTaskId;
  setView("object");
}

function selectTask(taskId) {
  state.selectedTaskId = taskId;
  const task = data.tasks.find((item) => item.id === taskId);
  state.selectedObjectId = task?.objectId || state.selectedObjectId;
  setView("task");
}

function selectedObject() {
  return data.objects.find((item) => item.id === state.selectedObjectId) || data.objects[0];
}

function selectedTask() {
  return data.tasks.find((item) => item.id === state.selectedTaskId) || data.tasks[0];
}

function shell(content) {
  return `
    <main class="phone-shell">
      <header class="topbar">
        <div>
          <strong>${t("appName")}</strong>
          <span>${t("appSubtitle")}</span>
        </div>
        <select aria-label="${t("language")}" class="lang-select" id="lang-select">
          <option value="zh-CN" ${state.lang === "zh-CN" ? "selected" : ""}>中文</option>
          <option value="ru-RU" ${state.lang === "ru-RU" ? "selected" : ""}>Русский</option>
        </select>
      </header>
      <section class="role-card">
        <span>${t("role")}</span>
        <strong>${t("roleValue")}</strong>
      </section>
      ${content}
      <nav class="bottom-nav" aria-label="primary">
        <button data-view="home" class="${state.view === "home" ? "active" : ""}">${t("navHome")}</button>
        <button data-view="intent" class="${state.view === "intent" ? "active" : ""}">${t("navIntent")}</button>
        <button data-view="workbench" class="${state.view === "workbench" ? "active" : ""}">${t("navWorkbench")}</button>
        <button data-view="help" class="${state.view === "help" ? "active" : ""}">${t("navHelp")}</button>
      </nav>
    </main>
  `;
}

function homeView() {
  return shell(`
    <section class="hero">
      <p>${t("tutorialTitle")}</p>
      <h1>${t("intent")}</h1>
      <div class="search-box">
        <input id="home-search" placeholder="${t("searchPlaceholder")}" />
        <button id="home-search-button">${t("searchButton")}</button>
      </div>
    </section>
    <section class="split-actions">
      <button class="big-action" data-view="intent">
        <span>${t("intent")}</span>
        <strong>${t("searchButton")}</strong>
      </button>
      <button class="big-action muted-action" data-view="workbench">
        <span>${t("workbench")}</span>
        <strong>${data.tasks.length}</strong>
      </button>
    </section>
    <section class="card">
      <h2>${t("tutorialTitle")}</h2>
      <p>${t("tutorialText")}</p>
    </section>
    <section class="card warning">
      <h2>${t("important")}</h2>
      <p>${selectedObject().blocker[state.lang]}</p>
    </section>
    <section class="card">
      <h2>${t("recentObjects")}</h2>
      ${objectList()}
    </section>
  `);
}

function intentView() {
  return shell(`
    <section class="page-title">
      <span>Intent Hub</span>
      <h1>${t("intent")}</h1>
    </section>
    <section class="card">
      <div class="search-box">
        <input id="intent-search" value="${state.lang === "zh-CN" ? "张三 押金未通过" : "Чжан депозит"}" />
        <button id="intent-search-button">${t("searchButton")}</button>
      </div>
    </section>
    <section class="result-group">
      <h2>${t("objects")}</h2>
      ${objectList()}
    </section>
    <section class="result-group">
      <h2>${t("task")}</h2>
      ${taskList()}
    </section>
    <section class="card">
      <h2>${t("blockedWork")}</h2>
      <p>${selectedObject().blocker[state.lang]}</p>
    </section>
  `);
}

function workbenchView() {
  return shell(`
    <section class="page-title">
      <span>Work Queue</span>
      <h1>${t("workbench")}</h1>
    </section>
    ${metricRow()}
    <section class="lane">
      <h2>${t("todayWork")}</h2>
      ${taskList()}
    </section>
    <section class="lane">
      <h2>${t("blockedWork")}</h2>
      ${workItem(data.objects[0])}
    </section>
    <section class="lane">
      <h2>${t("recommended")}</h2>
      ${workItem(data.objects[1])}
    </section>
  `);
}

function objectView() {
  const obj = selectedObject();
  return shell(`
    <section class="page-title">
      <span>${t("objectWorkspace")}</span>
      <h1>${text(obj.title)}</h1>
    </section>
    <section class="object-card">
      <div>
        <span>${t("objectSummary")}</span>
        <strong>${obj.id}</strong>
      </div>
      <div>
        <span>${t("currentState")}</span>
        <strong>${t(obj.statusKey)}</strong>
      </div>
      <div>
        <span>${t("blocker")}</span>
        <strong>${text(obj.blocker)}</strong>
      </div>
    </section>
    <section class="card">
      <h2>${t("related")}</h2>
      <p>${obj.domain === "domainAccommodation" ? "Room A301 · Deposit · Finance Gate" : "Asset AC-A301 · Technician · Inspection"}</p>
    </section>
    <section class="card">
      <h2>${t("task")}</h2>
      ${taskList(obj.id)}
    </section>
    <section class="card">
      <h2>${t("timeline")}</h2>
      <ol class="timeline">
        <li>${state.lang === "zh-CN" ? "对象已创建" : "Объект создан"}</li>
        <li>${state.lang === "zh-CN" ? "进入当前任务" : "Открыта текущая задача"}</li>
        <li>${state.lang === "zh-CN" ? "等待人工确认" : "Ожидает подтверждения"}</li>
      </ol>
    </section>
  `);
}

function taskView() {
  const obj = selectedObject();
  const task = selectedTask();
  const steps = state.lang === "zh-CN" ? task.journey : task.journeyRu;
  return shell(`
    <section class="page-title">
      <span>${t("taskSurface")}</span>
      <h1>${text(task.title)}</h1>
    </section>
    <section class="context-bar">
      <span>${t("contextBar")}</span>
      <strong>${text(obj.title)}</strong>
      <em>${t(obj.statusKey)}</em>
    </section>
    <section class="journey-strip" aria-label="${t("journey")}">
      ${steps.map((step, index) => `<span class="${index === task.activeStep ? "current" : index < task.activeStep ? "done" : ""}">${step}</span>`).join("")}
    </section>
    <section class="action-panel">
      <h2>${t("actionPanel")}</h2>
      <p>${text(task.action)}</p>
      <label>
        ${state.lang === "zh-CN" ? "金额 / 说明" : "Сумма / описание"}
        <input value="${task.id === "task-deposit" ? "3000" : "A301"}" />
      </label>
      <button id="prepare-action">${t("prepareAction")}</button>
    </section>
    <section class="guidance-dock">
      <h2>${t("guidance")}</h2>
      <p>${text(task.risk)}</p>
      <button data-view="help">${t("help")}</button>
      <button id="feedback">${t("feedback")}</button>
    </section>
  `);
}

function confirmView() {
  const task = selectedTask();
  const obj = selectedObject();
  return shell(`
    <section class="confirm-sheet">
      <span>${t("confirmAction")}</span>
      <h1>${t("confirmTitle")}</h1>
      <p>${t("confirmText")}</p>
      <dl>
        <dt>${t("objects")}</dt><dd>${text(obj.title)}</dd>
        <dt>${t("task")}</dt><dd>${text(task.title)}</dd>
        <dt>${t("guidance")}</dt><dd>${text(task.risk)}</dd>
      </dl>
      <button id="finish-action">${t("finish")}</button>
    </section>
  `);
}

function resultView() {
  return shell(`
    <section class="result-screen">
      <span>After Action</span>
      <h1>${t("resultTitle")}</h1>
      <p>${t("resultText")}</p>
      <button data-view="object">${t("openObject")}</button>
      <button data-view="workbench">${t("workbench")}</button>
    </section>
  `);
}

function helpView() {
  return shell(`
    <section class="page-title">
      <span>Guidance Dock</span>
      <h1>${t("help")}</h1>
    </section>
    <section class="card">
      <h2>${t("guidance")}</h2>
      <p>${t("tutorialText")}</p>
    </section>
    <section class="card">
      <h2>AI</h2>
      <p>${t("aiBoundary")}</p>
    </section>
    <section class="card">
      <h2>${t("stats")}</h2>
      <p>${t("statsText")}</p>
      <ul class="event-list">
        ${data.events.slice(0, 5).map((event) => `<li>${event.eventType} · ${event.language}</li>`).join("") || "<li>no events yet</li>"}
      </ul>
    </section>
  `);
}

function objectList() {
  return data.objects.map((obj) => workItem(obj)).join("");
}

function taskList(objectId) {
  return data.tasks
    .filter((task) => !objectId || task.objectId === objectId)
    .map((task) => `
      <article class="work-item">
        <div>
          <span>${t(data.objects.find((obj) => obj.id === task.objectId)?.domain || "domainAccommodation")}</span>
          <strong>${text(task.title)}</strong>
          <p>${text(task.risk)}</p>
        </div>
        <button data-task="${task.id}">${t("startTask")}</button>
      </article>
    `).join("");
}

function workItem(obj) {
  return `
    <article class="work-item">
      <div>
        <span>${t(obj.domain)}</span>
        <strong>${text(obj.title)}</strong>
        <p>${text(obj.blocker)}</p>
      </div>
      <button data-object="${obj.id}">${t("openObject")}</button>
    </article>
  `;
}

function metricRow() {
  return `
    <section class="metrics">
      <div><span>${t("todayWork")}</span><strong>8</strong></div>
      <div><span>${t("blockedWork")}</span><strong>3</strong></div>
      <div><span>${t("waitingConfirm")}</span><strong>2</strong></div>
    </section>
  `;
}

function render() {
  const views = {
    home: homeView,
    intent: intentView,
    workbench: workbenchView,
    object: objectView,
    task: taskView,
    confirm: confirmView,
    result: resultView,
    help: helpView
  };

  document.documentElement.lang = state.lang;
  document.querySelector("#app").innerHTML = views[state.view]();
  bind();
}

function bind() {
  document.querySelector("#lang-select")?.addEventListener("change", (event) => setLanguage(event.target.value));
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll("[data-object]").forEach((button) => {
    button.addEventListener("click", () => selectObject(button.dataset.object));
  });
  document.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", () => selectTask(button.dataset.task));
  });
  document.querySelector("#home-search-button")?.addEventListener("click", () => setView("intent"));
  document.querySelector("#intent-search-button")?.addEventListener("click", () => track("search_submitted", { source: "intent" }));
  document.querySelector("#prepare-action")?.addEventListener("click", () => {
    track("action_prepared", { objectId: selectedObject().id, taskId: selectedTask().id });
    setView("confirm");
  });
  document.querySelector("#finish-action")?.addEventListener("click", () => {
    track("action_confirmed", { objectId: selectedObject().id, taskId: selectedTask().id });
    setView("result");
  });
  document.querySelector("#feedback")?.addEventListener("click", () => {
    track("feedback_opened", { objectId: selectedObject().id, taskId: selectedTask().id });
    setView("help");
  });
}

render();

