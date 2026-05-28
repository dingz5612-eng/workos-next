import { loginActor } from "./apiClient.js";
import { capacityForRoomType } from "./controls/fieldControls.js";
import { clearDraft, saveDraft } from "./operationDrafts.js";
import { submitCardOperation } from "./operationRuntime.js";
import { activeWorkspaceCard, isCardActionDisabled } from "./selectors/workspaceSelectors.js";
import { intentWorkspaces } from "./workspaceProjections.js";

export function bindEvents(ctx) {
  const { state } = ctx;
  document.querySelector("#language")?.addEventListener("change", (event) => setLang(event.target.value, ctx));
  document.querySelector("#retryApi")?.addEventListener("click", async () => {
    await ctx.hydrateProjectionFromApi();
    ctx.render();
  });
  document.querySelector("#loginSubmit")?.addEventListener("click", () => login(ctx));
  document.querySelector("#logout")?.addEventListener("click", () => logout(ctx));
  document.querySelector("#start")?.addEventListener("click", () => onboard(ctx));
  document.querySelector("#skip")?.addEventListener("click", () => onboard(ctx));
  document.querySelectorAll("[data-view]").forEach((node) => node.addEventListener("click", () => setView(node.dataset.view, ctx)));
  document.querySelectorAll("[data-workspace]").forEach((node) => node.addEventListener("click", () => {
    state.selectedWorkspace = node.dataset.workspace;
    state.selectedCardIndex = -1;
    const linked = intentWorkspaces.find((entry) => entry.id === state.selectedWorkspace);
    state.selectedTask = linked?.taskId || state.selectedTask;
    setView("workspace", ctx);
  }));
  document.querySelectorAll("[data-card-index]").forEach((node) => node.addEventListener("click", () => {
    state.selectedCardIndex = Number(node.dataset.cardIndex) || 0;
    ctx.render(true);
  }));
  document.querySelector("#query")?.addEventListener("input", (event) => {
    state.query = event.target.value;
  });
  document.querySelector("#searchNow")?.addEventListener("click", () => {
    state.query = document.querySelector("#query")?.value || "";
    state.view = "search";
    ctx.render(true);
  });
  bindLearning(ctx);
  bindQueue(ctx);
  document.querySelector(".operation-inputs")?.addEventListener("input", (event) => collectDraftingValuesOnInput(event, ctx));
  document.querySelector(".operation-inputs")?.addEventListener("change", (event) => collectDraftingValuesOnInput(event, ctx));
  document.querySelector("#finish")?.addEventListener("click", () => setView("result", ctx));
  document.querySelector("[data-save-draft]")?.addEventListener("click", () => saveCurrentDraft(ctx));
  document.querySelectorAll("[data-submit-card]").forEach((node) => node.addEventListener("click", () => submitCurrentCard(ctx)));
}

export function setView(view, ctx) {
  if (!ctx.state.currentActor && view !== "login") {
    ctx.state.view = "login";
    ctx.render(true);
    return;
  }
  ctx.state.view = view;
  ctx.render(true);
}

function setLang(lang, ctx) {
  ctx.state.lang = lang;
  localStorage.setItem("workosnext.lang", lang);
  ctx.render();
}

function onboard(ctx) {
  localStorage.setItem("workosnext.onboarded", "1");
  setView("home", ctx);
}

function bindLearning(ctx) {
  const { state } = ctx;
  document.querySelector("#learningQuery")?.addEventListener("input", (event) => {
    state.learningQuery = event.target.value;
  });
  document.querySelector("#learningSearch")?.addEventListener("click", () => {
    state.learningQuery = document.querySelector("#learningQuery")?.value || "";
    ctx.render(true);
  });
  document.querySelectorAll("[data-learning-domain]").forEach((node) => node.addEventListener("click", () => {
    state.learningDomain = node.dataset.learningDomain;
    ctx.render();
  }));
  document.querySelectorAll("[data-learning-type]").forEach((node) => node.addEventListener("click", () => {
    state.learningType = node.dataset.learningType;
    ctx.render();
  }));
  document.querySelectorAll("[data-coach-flow]").forEach((node) => node.addEventListener("click", () => {
    state.coachFlow = node.dataset.coachFlow;
    state.coachStage = Number(node.dataset.coachStage) || 0;
    ctx.render();
  }));
}

function bindQueue(ctx) {
  const { state } = ctx;
  document.querySelectorAll("[data-filter-field]").forEach((node) => node.addEventListener("click", () => {
    state[node.dataset.filterField] = node.dataset.filterValue;
    ctx.render();
  }));
  document.querySelector("#toggleFilters")?.addEventListener("click", () => {
    state.filterOpen = !state.filterOpen;
    ctx.render();
  });
  document.querySelector("#advanced")?.addEventListener("click", () => {
    state.advancedOpen = true;
    ctx.render();
  });
  document.querySelector("#closeAdvanced")?.addEventListener("click", () => {
    state.advancedOpen = false;
    ctx.render();
  });
  document.querySelector("#sort")?.addEventListener("change", (event) => {
    state.sort = event.target.value;
    ctx.render();
  });
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

function saveCurrentDraft(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
  if (!item || !card) return;
  saveDraft(item.id, card.id, collectOperationValues());
  ctx.state.operationMessage = ctx.tr("draftSaved");
  ctx.render();
}

function updateDerivedFields(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
  const roomTypeField = card?.fields?.business?.find((field) => field.ui?.optionSet === "roomType");
  const capacityField = card?.fields?.business?.find((field) => field.ui?.derivedFrom === "房型");
  const roomType = roomTypeField ? document.querySelector(`[data-operation-field="${roomTypeField.id}"]`)?.value : "";
  const capacity = capacityField ? document.querySelector(`[data-operation-field="${capacityField.id}"]`) : null;
  if (roomType && capacity) capacity.value = capacityForRoomType(roomType);
}

function collectDraftingValuesOnInput(event, ctx) {
  if (!event.target.matches("[data-operation-field], [data-operation-field-start], [data-operation-field-end]")) return;
  updateDerivedFields(ctx);
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
  if (!item || !card) return;
  saveDraft(item.id, card.id, collectOperationValues());
}

async function submitCurrentCard(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
  if (!item || !card || isCardActionDisabled(card)) return;
  if (!ctx.state.currentActor) {
    ctx.state.loginMessage = ctx.tr("loginRequired");
    setView("login", ctx);
    return;
  }
  if (ctx.state.apiStatus !== "online") {
    await ctx.hydrateProjectionFromApi();
    if (ctx.state.apiStatus !== "online") {
      ctx.state.operationMessage = ctx.tr("apiOffline");
      ctx.render();
      return;
    }
  }
  ctx.state.operationMessage = ctx.tr("submitting");
  ctx.render();
  try {
    await submitCardOperation({
      workspace: item,
      card,
      actor: ctx.state.currentActor,
      language: ctx.state.lang,
      fieldValues: collectOperationValues(),
      onProjection: (payload) => ctx.replaceIntentWorkspaces(payload.workspaces)
    });
    clearDraft(item.id, card.id);
    ctx.state.selectedCardIndex = -1;
    ctx.state.operationMessage = ctx.tr("submitDone");
  } catch {
    ctx.state.apiStatus = "offline";
    ctx.state.operationMessage = ctx.tr("submitFailed");
  }
  ctx.render(true);
}

async function login(ctx) {
  await ctx.hydrateProjectionFromApi();
  if (ctx.state.apiStatus !== "online") {
    ctx.state.loginMessage = ctx.tr("apiOffline");
    ctx.render();
    return;
  }
  try {
    const username = document.querySelector("#loginRole")?.value || "operator";
    const password = document.querySelector("#loginPassword")?.value || "dev";
    const session = await loginActor(username, password);
    ctx.state.currentActor = session;
    ctx.state.loginMessage = "";
    localStorage.setItem("workosnext.actorSession", JSON.stringify(session));
    setView(localStorage.getItem("workosnext.onboarded") ? "home" : "onboarding", ctx);
  } catch {
    ctx.state.loginMessage = ctx.tr("loginFailed");
    ctx.render();
  }
}

function logout(ctx) {
  ctx.state.currentActor = null;
  ctx.state.loginMessage = "";
  localStorage.removeItem("workosnext.actorSession");
  setView("login", ctx);
}
