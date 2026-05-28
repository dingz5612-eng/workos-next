import "./styles.css";
import { tasks } from "./demoQueue.js";
import { i18n } from "./i18n.js";
import { intentWorkspaces, replaceIntentWorkspaces, workspaceIdForTask } from "./workspaceProjections.js";

const apiBaseUrl = resolveApiBaseUrl();

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
  sort: "smartSort",
  operationMessage: "",
  apiStatus: "checking",
  actorSessions: {}
};

const params = new URLSearchParams(window.location.search);
if (params.has("api")) {
  localStorage.setItem("workosnext.apiBaseUrl", params.get("api"));
}
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

function resolveApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_WORKOS_API_BASE_URL;
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, "");
  const configured = localStorage.getItem("workosnext.apiBaseUrl");
  if (configured) return configured.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:5180`;
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
function localList(items) {
  return items.map(localTerm).join(" · ");
}

function localTerm(value, lang = state.lang) {
  if (value && typeof value === "object") {
    if (value.eventType) return value.eventType;
    const raw = value.label?.["zh-CN"] || value.title?.["zh-CN"] || txFor(value.label || value.title || value, "zh-CN");
    return lang === "zh-CN" ? raw : terms[raw] || txFor(value.label || value.title || value, lang);
  }
  if (lang === "zh-CN") return value;
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

function txFor(value, lang) {
  return typeof value === "string" ? value : value[lang] || value["zh-CN"];
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
      ${apiBanner()}
      ${content}
      ${feedbackButton()}
      ${state.view !== "onboarding" ? bottomNav() : ""}
    </main>
  `;
}

function apiBanner() {
  const label = state.apiStatus === "online" ? tr("apiOnline") : state.apiStatus === "checking" ? tr("apiChecking") : tr("apiOffline");
  return `<section class="api-status ${state.apiStatus}"><span>${label}</span><small>${apiBaseUrl}</small></section>`;
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
    const label = localTerm(field, "zh-CN");
    if (field.type === "searchSelect") {
      return `${localTerm(field)}: ${tr("searchableSelect")}`;
    }
    if (field.type === "select" || field.source === "optionSet") {
      return `${localTerm(field)}: ${state.lang === "zh-CN" ? "下拉选择" : "выбор из списка"}`;
    }
    if (field.type === "money") {
      return `${localTerm(field)}: ${state.lang === "zh-CN" ? "金额字段，系统核对币种和规则" : "сумма, система проверит валюту и правило"}`;
    }
    if (field.type === "evidenceUpload") {
      return `${localTerm(field)}: ${state.lang === "zh-CN" ? "提交或关联证据" : "прикрепите или свяжите доказательство"}`;
    }
    return `${localTerm(field)}${field.required && label ? "" : ""}`;
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
  const activeCard = activeWorkspaceCard(item);
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
    <div class="sticky-action"><button data-submit-card>${tr("confirmAction")}</button></div>
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
  const disabled = ["notStarted", "done"].includes(card.status) ? "disabled" : "";
  const visibleBlockers = card.blockerRules.length ? card.blockerRules : item.blockers;
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
      <p>${visibleBlockers.length ? visibleBlockers.map((entry) => tx(entry.title)).join(" · ") : tr("noCriticalBlocker")}</p>
    </section>
    <div class="operation-actions">
      <button class="secondary" data-save-draft ${disabled}>${tr("saveDraft")}</button>
      <button data-submit-card ${disabled}>${tr("submitForReview")}</button>
    </div>
    ${state.operationMessage ? `<p class="operation-message">${state.operationMessage}</p>` : ""}
  </div>`;
}

function operationActionText(card, item) {
  if (card.status === "blocked") return tx(item.next);
  return state.lang === "zh-CN"
    ? `处理“${tx(card.title)}”，提交前系统会校验字段、证据和人工确认边界。`
    : `Обработайте "${tx(card.title)}"; перед отправкой система проверит поля, доказательства и подтверждение.`;
}

function operationInputFields(card) {
  const priority = card.fields.business.filter((field) => !["备注", "补充说明", "异议说明"].includes(localTerm(field, "zh-CN")));
  return priority;
}

function operationControl(field, disabled) {
  const label = localTerm(field, "zh-CN");
  if (field.type === "searchSelect") {
    return `<label class="search-select"><span>${localTerm(field)} · ${tr("searchableSelect")}</span><input data-operation-field="${field.id}" list="${field.id}Options" value="${operationValue(field)}" ${disabled} /><datalist id="${field.id}Options">${optionValues(label).map((item) => `<option value="${item}">`).join("")}</datalist></label>`;
  }
  if (field.type === "select") {
    return `<label><span>${localTerm(field)}</span><select data-operation-field="${field.id}" ${disabled}>${optionValues(label).map((item) => `<option>${item}</option>`).join("")}</select></label>`;
  }
  if (field.type === "money") {
    return `<label><span>${localTerm(field)}</span><input data-operation-field="${field.id}" inputmode="decimal" value="${operationValue(field)}" ${disabled} /></label>`;
  }
  if (field.type === "evidenceUpload") {
    return `<label><span>${localTerm(field)}</span><input data-operation-field="${field.id}" value="${operationValue(field)}" ${disabled} /></label>`;
  }
  return `<label><span>${localTerm(field)}</span><input data-operation-field="${field.id}" value="${operationValue(field)}" ${disabled} /></label>`;
}

function optionValues(label) {
  if (label.includes("房间") || label.includes("床位")) return ["A301 / A301-02", "A302 / A302-01", "B201 / B201-03"];
  if (label.includes("客户")) return ["张三汽修客户", "Fleet Partner 01", "新客户"];
  if (label.includes("车辆")) return ["Toyota Camry · 01KG123ABC", "Mercedes Sprinter · 01KG777", "新车辆"];
  if (label.includes("技师")) return ["Алексей Смирнов", "Иван Орлов", "维修主管分配"];
  if (label.includes("工位")) return ["2 号位", "1 号位", "等待空位"];
  if (label.includes("币种")) return ["KGS", "RUB", "USD"];
  if (label.includes("付款方式")) return ["现金", "银行转账", "POS"];
  if (label.includes("优先级") || label.includes("紧急程度")) return ["高", "中", "低"];
  if (label.includes("预计") || label.includes("周期") || label.includes("时间")) return ["今天 18:00", "明天 10:00", "本周内"];
  return ["已确认", "待补充", "需要人工确认"];
}

function operationValue(field) {
  const label = localTerm(field, "zh-CN");
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
  return samples[label] || localTerm(field);
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

async function hydrateProjectionFromApi() {
  try {
    const health = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(1600) });
    if (!health.ok) throw new Error("health_failed");
    state.apiStatus = "online";
    const response = await fetch(`${apiBaseUrl}/api/workspaces`, { signal: AbortSignal.timeout(2400) });
    if (!response.ok) throw new Error("projection_failed");
    const payload = await response.json();
    replaceIntentWorkspaces(payload.workspaces);
  } catch {
    state.apiStatus = "offline";
    state.operationMessage = tr("apiOffline");
  }
}

function activeWorkspaceCard(item) {
  const defaultIndex = item.cards.findIndex((card) => ["ready", "blocked", "inProgress"].includes(card.status));
  const activeIndex = Number.isInteger(state.selectedCardIndex) && state.selectedCardIndex >= 0 ? state.selectedCardIndex : defaultIndex;
  return item.cards[activeIndex >= 0 ? activeIndex : 0] || item.cards[0];
}

function collectOperationValues() {
  return Array.from(document.querySelectorAll("[data-operation-field]")).reduce((values, node) => {
    values[node.dataset.operationField] = node.value || "";
    return values;
  }, {});
}

function saveCurrentDraft() {
  state.operationMessage = tr("draftSaved");
  render();
}

async function submitCurrentCard() {
  const item = workspace();
  const card = activeWorkspaceCard(item);
  if (!item || !card || ["notStarted", "done"].includes(card.status)) return;
  if (state.apiStatus !== "online") {
    await hydrateProjectionFromApi();
    if (state.apiStatus !== "online") {
      state.operationMessage = tr("apiOffline");
      render();
      return;
    }
  }

  state.operationMessage = tr("submitting");
  render();

  try {
    const actor = await actorSessionForCard(card);
    const fieldValues = collectOperationValues();
    const idempotencyKey = `${item.id}:${card.id}:${actor.actorId}`;
    const prepareResponse = await fetch(`${apiBaseUrl}/api/workspaces/${item.id}/cards/${card.id}/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(3200)
    });
    if (!prepareResponse.ok) throw new Error("prepare_failed");

    const confirmResponse = await fetch(`${apiBaseUrl}/api/workspaces/${item.id}/cards/${card.id}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WorkOS-Actor-Token": actor.token
      },
      body: JSON.stringify({
        language: state.lang,
        idempotencyKey,
        fieldValues,
        evidenceIds: []
      }),
      signal: AbortSignal.timeout(4200)
    });
    if (!confirmResponse.ok) throw new Error("confirm_failed");

    const result = await confirmResponse.json();
    await waitForProjectionEvent(result.event.eventId);
    state.selectedCardIndex = -1;
    state.operationMessage = tr("submitDone");
  } catch {
    state.apiStatus = "offline";
    state.operationMessage = tr("submitFailed");
  }

  render(true);
}

async function actorSessionForCard(card) {
  const role = actorRoleForCard(card);
  if (state.actorSessions[role]) return state.actorSessions[role];
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: role, password: "dev" }),
    signal: AbortSignal.timeout(2400)
  });
  if (!response.ok) throw new Error("login_failed");
  const session = await response.json();
  state.actorSessions[role] = session;
  return session;
}

async function waitForProjectionEvent(eventId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${apiBaseUrl}/api/workspaces`, { signal: AbortSignal.timeout(2400) });
    if (response.ok) {
      const payload = await response.json();
      replaceIntentWorkspaces(payload.workspaces);
      if ((payload.events || []).some((item) => item.eventId === eventId)) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function actorRoleForCard(card) {
  return ["finance", "checkoutFinance", "review", "feeMaterial"].includes(card.id) ? "finance" : "operator";
}

function actorIdForCard(card) {
  return actorRoleForCard(card) === "finance" ? "u-finance" : "u-operator";
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
  document.querySelector("[data-save-draft]")?.addEventListener("click", saveCurrentDraft);
  document.querySelectorAll("[data-submit-card]").forEach((node) => node.addEventListener("click", submitCurrentCard));
}

hydrateProjectionFromApi().finally(() => render());
