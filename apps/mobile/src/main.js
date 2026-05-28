import "./styles.css";
import { apiBaseUrl, checkHealth, fetchWorkspaceProjection, loginActor } from "./apiClient.js";
import { learningDomainFilters, learningTypeFilters } from "./coachView.js";
import { tasks } from "./demoQueue.js";
import { capacityForRoomType, defaultValueForLabel, fieldControlKind, optionsForLabel } from "./fieldControls.js";
import { i18n } from "./i18n.js";
import { clearDraft, loadDraft, saveDraft } from "./operationDrafts.js";
import { submitCardOperation } from "./operationRuntime.js";
import { translateTerm } from "./termDictionary.js";
import { activeWorkspaceCard as resolveActiveWorkspaceCard, isCardActionDisabled } from "./workspaceView.js";
import { intentWorkspaces, replaceIntentWorkspaces, workspaceIdForTask } from "./workspaceProjections.js";

const state = {
  lang: localStorage.getItem("workosnext.lang") || "zh-CN",
  view: savedActor() ? (localStorage.getItem("workosnext.onboarded") ? "home" : "onboarding") : "login",
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
  currentActor: savedActor(),
  loginMessage: ""
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
if (!state.currentActor && state.view !== "login") {
  state.view = "login";
}

function savedActor() {
  try {
    const raw = localStorage.getItem("workosnext.actorSession");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
    return lang === "zh-CN" ? raw : translateTerm(raw, lang) || txFor(value.label || value.title || value, lang);
  }

  return translateTerm(value, lang);
}

function txFor(value, lang) {
  return typeof value === "string" ? value : value[lang] || value["zh-CN"];
}

function setView(view) {
  if (!state.currentActor && view !== "login") {
    state.view = "login";
    render(true);
    return;
  }
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
        <div><strong>${tr("app")}</strong><span>${state.currentActor ? `${state.currentActor.displayName} · ${state.currentActor.role}` : tr("subtitle")}</span></div>
        <select id="language" aria-label="${tr("language")}">
          <option value="zh-CN" ${state.lang === "zh-CN" ? "selected" : ""}>${tr("zh")}</option>
          <option value="ru-RU" ${state.lang === "ru-RU" ? "selected" : ""}>${tr("ru")}</option>
        </select>
      </header>
      ${apiBanner()}
      ${content}
      ${feedbackButton()}
      ${state.view !== "onboarding" && state.view !== "login" ? bottomNav() : ""}
    </main>
  `;
}

function apiBanner() {
  const label = state.apiStatus === "online" ? tr("apiOnline") : state.apiStatus === "checking" ? tr("apiChecking") : tr("apiOffline");
  return `<section class="api-status ${state.apiStatus}"><span>${label}</span><small>${apiBaseUrl}</small>${state.apiStatus === "offline" ? `<button id="retryApi">${tr("retryApi")}</button>` : ""}</section>`;
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
  return ["onboarding", "login"].includes(state.view) ? "" : `<button class="feedback-fab" data-view="feedback">${tr("feedback")}</button>`;
}

function loginView() {
  return shell(`
    <section class="login-panel">
      <span>${tr("loginTitle")}</span>
      <h1>${tr("app")}</h1>
      <p>${tr("loginBody")}</p>
      <label>
        <span>${tr("loginRole")}</span>
        <select id="loginRole">
          <option value="operator">${tr("operatorRole")}</option>
          <option value="finance">${tr("financeRole")}</option>
          <option value="manager">${tr("managerRole")}</option>
        </select>
      </label>
      <label>
        <span>${tr("loginPassword")}</span>
        <input id="loginPassword" type="password" value="dev" autocomplete="current-password" />
      </label>
      <button id="loginSubmit">${tr("loginSubmit")}</button>
      ${state.loginMessage ? `<p class="login-message">${state.loginMessage}</p>` : ""}
    </section>
  `);
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
  return `<button class="mode-card" data-view="${view}"><b>${tr(key)}</b></button>`;
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
      <h1>${state.currentActor?.displayName || tr("personalMode")}</h1>
      <p>${tr("permission")}: ${state.currentActor?.role || "-"} · ${tr("stay")} · ${tr("repair")} · ${tr("finance")}</p>
      <button id="logout" class="secondary">${tr("logout")}</button>
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
      <div class="filter-row">${learningDomainFilters({ state, tr })}</div>
      <span>${tr("coachPerspective")}</span>
      <div class="filter-row">${learningTypeFilters({ state, tr })}</div>
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
  const disabled = isCardActionDisabled(card) ? "disabled" : "";
  const visibleBlockers = card.blockerRules.length ? card.blockerRules : item.blockers;
  const statusHelp = cardStatusHelp(card);
  return `<div class="card-operation">
    <span>${tr("cardOperation")}</span>
    <h3>${tx(card.title)}</h3>
    ${statusHelp ? `<section class="operation-state"><b>${tr(card.status)}</b><p>${statusHelp}</p></section>` : ""}
    <section>
      <b>${tr("cardAction")}</b>
      <p>${operationActionText(card, item)}</p>
    </section>
    <section>
      <b>${tr("cardInput")}</b>
      <div class="operation-inputs">
        ${operationInputFields(card).map((field) => operationControl(field, item, card, disabled)).join("")}
      </div>
    </section>
    <section>
      <b>${tr("cardEvidence")}</b>
      <p>${tr("cardEvidenceHelp")}</p>
      <div class="evidence-row">
        ${card.evidence.map((field) => `<button ${disabled}>${localTerm(field)}</button>`).join("")}
      </div>
    </section>
    <section>
      <b>${tr("cardConfirm")}</b>
      <p>${confirmationText(card, item)}</p>
    </section>
    <section>
      <b>${tr("cardNext")}</b>
      <p>${tr("cardNextHelp")} ${nextCardTitle(card, item)}</p>
    </section>
    <section>
      <b>${tr("nextBestAction")}</b>
      <p>${tr("nextBestActionHelp")} ${tx(item.next)}</p>
    </section>
    <section>
      <b>${tr("blockers")}</b>
      <p>${visibleBlockers.length ? visibleBlockers.map((entry) => tx(entry.title)).join(" · ") : `${tr("noCriticalBlocker")} ${tr("blockerHelp")}`}</p>
    </section>
    <div class="operation-actions">
      <button class="secondary" data-save-draft ${disabled}>${tr("saveDraft")}</button>
      <button data-submit-card ${disabled}>${tr("submitForReview")}</button>
    </div>
    ${state.operationMessage ? `<p class="operation-message">${state.operationMessage}</p>` : ""}
  </div>`;
}

function cardStatusHelp(card) {
  if (card.status === "done") return tr("completedCardHelp");
  if (card.status === "notStarted") return tr("notReadyCardHelp");
  return "";
}

function confirmationText(card, item) {
  if (card.status === "blocked") return tx(item.next);
  return `${tr("cardConfirmHelp")} ${tr("confirmationDraft")} ${state.lang === "zh-CN" ? "所需角色" : "Роль"}: ${card.Confirmation?.requiredRole || card.confirmation?.requiredRole || "-"}.`;
}

function operationActionText(card, item) {
  if (card.id === "activate") {
    return state.lang === "zh-CN"
      ? "确认房间和床位检查通过，把资源从建档状态切换为可分配状态。不会自动分配给入住人。"
      : "Подтвердите проверку комнаты и койки, затем переведите ресурс в доступный для назначения статус.";
  }
  if (card.status === "blocked") return tx(item.next);
  return state.lang === "zh-CN"
    ? `处理“${tx(card.title)}”，提交前系统会校验字段、证据和人工确认边界。`
    : `Обработайте "${tx(card.title)}"; перед отправкой система проверит поля, доказательства и подтверждение.`;
}

function operationInputFields(card) {
  const priority = card.fields.business.filter((field) => !["备注", "补充说明", "异议说明"].includes(localTerm(field, "zh-CN")));
  return priority;
}

function operationControl(field, item, card, disabled) {
  const label = localTerm(field, "zh-CN");
  const value = operationValue(field, item, card);
  const kind = fieldControlKind(label, field.type);
  if (kind === "searchSelect") {
    return `<label class="search-select"><span>${localTerm(field)} · ${tr("searchableSelect")}</span><input data-operation-field="${field.id}" list="${field.id}Options" value="${value}" ${disabled} /><datalist id="${field.id}Options">${optionsForLabel(label).map((entry) => `<option value="${entry}">`).join("")}</datalist></label>`;
  }
  if (kind === "select") {
    return `<label><span>${localTerm(field)}</span><select data-operation-field="${field.id}" data-field-label="${label}" ${disabled}>${optionsForLabel(label).map((entry) => `<option ${entry === value ? "selected" : ""}>${entry}</option>`).join("")}</select></label>`;
  }
  if (kind === "dateTimeRange") {
    const [start = "", end = ""] = String(value || "").split(" 至 ");
    return `<label><span>${localTerm(field)}</span><div class="datetime-range"><input data-operation-field-start="${field.id}" type="datetime-local" value="${start}" ${disabled} /><input data-operation-field-end="${field.id}" type="datetime-local" value="${end}" ${disabled} /></div></label>`;
  }
  if (kind === "dateTime") {
    return `<label><span>${localTerm(field)}</span><input data-operation-field="${field.id}" type="datetime-local" value="${value}" ${disabled} /></label>`;
  }
  if (kind === "number") {
    const readonly = label === "容量" ? "readonly data-derived-capacity" : "";
    return `<label><span>${localTerm(field)}</span><input data-operation-field="${field.id}" data-field-label="${label}" inputmode="decimal" value="${value}" ${readonly} ${disabled} /></label>`;
  }
  return `<label><span>${localTerm(field)}</span><input data-operation-field="${field.id}" value="${value}" ${disabled} /></label>`;
}

function operationValue(field, item, card) {
  const label = localTerm(field, "zh-CN");
  const draft = loadDraft(item.id, card.id);
  const values = draft.values || {};
  if (values[field.id]) return values[field.id];
  if (label === "容量") {
    const roomType = Object.entries(values).find(([, candidate]) => ["单人间", "双人间", "四人间", "六人间"].includes(candidate))?.[1] || "四人间";
    return capacityForRoomType(roomType);
  }
  return defaultValueForLabel(label);
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
    await checkHealth();
    state.apiStatus = "online";
    const payload = await fetchWorkspaceProjection();
    replaceIntentWorkspaces(payload.workspaces);
  } catch {
    state.apiStatus = "offline";
    state.operationMessage = tr("apiOffline");
  }
}

function activeWorkspaceCard(item) {
  return resolveActiveWorkspaceCard(item, state.selectedCardIndex);
}

function collectOperationValues() {
  const values = Array.from(document.querySelectorAll("[data-operation-field]")).reduce((current, node) => {
    current[node.dataset.operationField] = node.value || "";
    return current;
  }, {});
  Array.from(document.querySelectorAll("[data-operation-field-start]")).forEach((node) => {
    const key = node.dataset.operationFieldStart;
    const end = document.querySelector(`[data-operation-field-end="${key}"]`)?.value || "";
    values[key] = [node.value, end].filter(Boolean).join(" 至 ");
  });
  return values;
}

function saveCurrentDraft() {
  const item = workspace();
  const card = activeWorkspaceCard(item);
  if (!item || !card) return;
  saveDraft(item.id, card.id, collectOperationValues());
  state.operationMessage = tr("draftSaved");
  render();
}

function updateDerivedFields() {
  const roomType = document.querySelector('[data-field-label="房型"]')?.value;
  const capacity = document.querySelector("[data-derived-capacity]");
  if (roomType && capacity) {
    capacity.value = capacityForRoomType(roomType);
  }
}

function collectDraftingValuesOnInput(event) {
  if (!event.target.matches("[data-operation-field], [data-operation-field-start], [data-operation-field-end]")) return;
  updateDerivedFields();
  const item = workspace();
  const card = activeWorkspaceCard(item);
  if (!item || !card) return;
  saveDraft(item.id, card.id, collectOperationValues());
}

async function submitCurrentCard() {
  const item = workspace();
  const card = activeWorkspaceCard(item);
  if (!item || !card || isCardActionDisabled(card)) return;
  if (!state.currentActor) {
    state.loginMessage = tr("loginRequired");
    setView("login");
    return;
  }
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
    const actor = state.currentActor;
    const fieldValues = collectOperationValues();
    await submitCardOperation({
      workspace: item,
      card,
      actor,
      language: state.lang,
      fieldValues,
      onProjection: (payload) => replaceIntentWorkspaces(payload.workspaces)
    });
    clearDraft(item.id, card.id);
    state.selectedCardIndex = -1;
    state.operationMessage = tr("submitDone");
  } catch {
    state.apiStatus = "offline";
    state.operationMessage = tr("submitFailed");
  }

  render(true);
}

async function login() {
  await hydrateProjectionFromApi();
  if (state.apiStatus !== "online") {
    state.loginMessage = tr("apiOffline");
    render();
    return;
  }

  const username = document.querySelector("#loginRole")?.value || "operator";
  const password = document.querySelector("#loginPassword")?.value || "dev";
  let session;
  try {
    session = await loginActor(username, password);
  } catch {
    state.loginMessage = tr("loginFailed");
    render();
    return;
  }

  state.currentActor = session;
  state.loginMessage = "";
  localStorage.setItem("workosnext.actorSession", JSON.stringify(session));
  setView(localStorage.getItem("workosnext.onboarded") ? "home" : "onboarding");
}

function logout() {
  state.currentActor = null;
  state.loginMessage = "";
  localStorage.removeItem("workosnext.actorSession");
  setView("login");
}

function render(scrollTop = false) {
  const views = {
    login: loginView,
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
  document.querySelector("#retryApi")?.addEventListener("click", async () => {
    await hydrateProjectionFromApi();
    render();
  });
  document.querySelector("#loginSubmit")?.addEventListener("click", login);
  document.querySelector("#logout")?.addEventListener("click", logout);
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
  document.querySelector(".operation-inputs")?.addEventListener("input", collectDraftingValuesOnInput);
  document.querySelector(".operation-inputs")?.addEventListener("change", collectDraftingValuesOnInput);
  document.querySelector("#finish")?.addEventListener("click", () => setView("result"));
  document.querySelector("[data-save-draft]")?.addEventListener("click", saveCurrentDraft);
  document.querySelectorAll("[data-submit-card]").forEach((node) => node.addEventListener("click", submitCurrentCard));
}

hydrateProjectionFromApi().finally(() => render());
