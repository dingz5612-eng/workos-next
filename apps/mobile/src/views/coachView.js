import { learningDomainFilters, learningTypeFilters } from "../selectors/coachSelectors.js";
import { cardSearchText, normalize, workspaceSearchText } from "../selectors/searchSelectors.js";
import { selectLearningCatalog } from "../selectors/surfaceSelectors.js";
import { activeCardForWorkspace } from "../selectors/workspaceSelectors.js";
import { modeCard } from "./loginView.js";
import { nextCardTitle } from "./workspaceView.js";

export function learningView(ctx) {
  const coachEntries = scenarioCoachEntries(ctx);
  return ctx.shell(`
    <section class="profile-card">
      <span>${ctx.tr("me")}</span>
      <h1>${ctx.tr("scenarioCoach")}</h1>
      <p>${ctx.tr("learningCenterBody")}</p>
    </section>
    <section class="knowledge-search">
      <span>${ctx.tr("coachHowToUse")}</span>
      <div class="search-line">
        <input id="learningQuery" value="${ctx.escapeAttr(ctx.state.learningQuery)}" placeholder="${ctx.tr("coachSearchPlaceholder")}" />
        <button id="learningSearch">${ctx.tr("search")}</button>
      </div>
      <div class="filter-row">${learningDomainFilters({ state: ctx.state, tr: ctx.tr })}</div>
      <span>${ctx.tr("coachPerspective")}</span>
      <div class="filter-row">${learningTypeFilters({ state: ctx.state, tr: ctx.tr })}</div>
    </section>
    <section class="compact-section">
      <h2>${ctx.tr("sceneLearning")}</h2>
      ${coachEntries.length ? coachEntries.map((item) => learningScenarioCard(item, ctx)).join("") : `<p>${ctx.tr("coachNoMatch")}</p>`}
    </section>
    <section class="compact-section">
      <h2>${ctx.tr("quickStart")}</h2>
      <div class="mode-list light">
        ${modeCard("home", "todayMode", ctx.tr)}
        ${modeCard("search", "intentMode", ctx.tr)}
        ${modeCard("workbench", "queueMode", ctx.tr)}
        ${modeCard("me", "personalMode", ctx.tr)}
      </div>
    </section>
    <section class="help-card">
      <span>${ctx.tr("roleLearning")}</span>
      <p>${ctx.tr("permission")}: ${ctx.tr("stay")} · ${ctx.tr("repair")} · ${ctx.tr("finance")}</p>
      <p>${ctx.tr("aiCanDo")}</p>
      <p>${ctx.tr("aiCannotDo")}</p>
    </section>
  `);
}

export function scenarioCoachEntries(ctx) {
  const query = normalize(ctx.state.learningQuery);
  return selectLearningCatalog(ctx.state)
    .filter((item) => ctx.state.learningDomain === "all" || item.domain === ctx.state.learningDomain)
    .filter((item) => !query || normalize(workspaceSearchText(item, ctx)).includes(query));
}

export function learningScenarioCard(item, ctx) {
  const activeStage = activeCoachStage(item, ctx);
  const card = item.cards[activeStage] || item.cards[0];
  return `<article class="learning-card">
    <span>${ctx.tr(item.domain)}</span>
    <strong>${ctx.tx(item.title)}</strong>
    <p>${ctx.tx(item.summary)}</p>
    <div class="coach-stages">${item.cards.map((entry, index) => `<button class="${index === activeStage ? "active" : ""} ${entry.status}" data-coach-flow="${item.id}" data-coach-stage="${index}">${ctx.tx(entry.title)}</button>`).join("")}</div>
    <div class="stage-coach">
      <span>${ctx.tr("cardOperation")}</span>
      <h3>${ctx.tx(card.title)}</h3>
      ${coachDetailSections(item, card, ctx)}
      <div class="coach-actions">
        <button data-workspace="${item.id}">${ctx.tr("openWorkspace")}</button>
        <button data-workspace="${item.id}">${ctx.tr("openRelatedObject")}</button>
      </div>
    </div>
  </article>`;
}

function activeCoachStage(item, ctx) {
  if (ctx.state.coachFlow === item.id) return Number(ctx.state.coachStage) || 0;
  const query = normalize(ctx.state.learningQuery);
  if (!query) return preferredCoachCardIndex(item);
  const matched = item.cards.findIndex((card) => normalize(cardSearchText(card, ctx)).includes(query));
  if (matched >= 0) return matched;
  return preferredCoachCardIndex(item);
}

function preferredCoachCardIndex(item) {
  const active = activeCardForWorkspace(item);
  return item.cards.findIndex((card) => card.id === active.id);
}

export function coachDetailSections(item, card, ctx) {
  const sections = [
    coachDetail("coachHowTo", "stageWhat", cardPurpose(card, ctx), ctx),
    coachDetail("coachFields", "stageFields", cardFieldGuidance(card, ctx), ctx),
    coachDetail("coachException", "stageJudgement", cardJudgement(card, ctx), ctx),
    coachDetail("coachConfirm", "stageEvidence", ctx.localList(card.evidence), ctx),
    coachDetail("coachConfirm", "stageConfirm", cardConfirmation(card, ctx), ctx),
    coachDetail("coachNext", "stageAfter", cardAfterState(card, ctx), ctx),
    coachDetail("coachNext", "stageNext", `${nextCardTitle(card, item, ctx)} · ${ctx.tx(item.next)}`, ctx),
    coachDetail("coachAi", "coachAi", `${ctx.tr("aiCanDo")} ${ctx.tr("aiCannotDo")}`, ctx)
  ];
  return sections.filter((section) => ctx.state.learningType === "coachAll" || section.type === ctx.state.learningType).map((section) => section.html).join("");
}

function coachDetail(type, titleKey, body, ctx) {
  return { type, html: `<section><b>${ctx.tr(titleKey)}</b><p>${body}</p></section>` };
}

export function cardPurpose(card, ctx) {
  const fields = card.fields.business.map((field) => ctx.localTerm(field)).join(ctx.state.lang === "zh-CN" ? "、" : ", ");
  return ctx.state.lang === "zh-CN"
    ? `围绕“${ctx.tx(card.title)}”完成当前任务卡。先选系统候选项，再补充必要业务字段：${fields}。`
    : `На карточке "${ctx.tx(card.title)}" сначала выбирайте системные варианты, затем заполните нужные поля: ${fields}.`;
}

export function cardFieldGuidance(card, ctx) {
  return card.fields.business.map((field) => {
    const help = ctx.tx(field.help);
    return help ? `${ctx.localTerm(field)}: ${help}` : ctx.localTerm(field);
  }).join(" · ");
}

export function cardJudgement(card, ctx) {
  const checks = ctx.localList(card.checks);
  return ctx.state.lang === "zh-CN"
    ? `系统会检查 ${checks}，并确认材料完整、权限满足、关键动作已人工确认。`
    : `Система проверит: ${checks}; также полноту материалов, право доступа и ручное подтверждение.`;
}

export function cardConfirmation(card, ctx) {
  if (card.status === "done") return ctx.tr("done");
  return `${ctx.tx(card.confirmation?.label || card.Confirmation?.label)} ${ctx.tr("aiCannotDo")}`;
}

export function cardAfterState(card, ctx) {
  return ctx.state.lang === "zh-CN"
    ? `${ctx.tx(card.title)}完成后，系统会更新工作区状态并把下一张任务卡推到前面。`
    : `После карточки "${ctx.tx(card.title)}" система обновит рабочую область и выведет следующую карточку.`;
}
