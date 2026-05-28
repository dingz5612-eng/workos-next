import { intentWorkspaces } from "./workspaceProjections.js";

export function setView(view, ctx) {
  if (!ctx.state.currentActor && view !== "login") {
    ctx.state.view = "login";
    ctx.render(true);
    return;
  }
  ctx.state.view = view;
  ctx.render(true);
}

export function setLang(lang, ctx) {
  ctx.state.lang = lang;
  localStorage.setItem("workosnext.lang", lang);
  ctx.render();
}

export function onboard(ctx) {
  localStorage.setItem("workosnext.onboarded", "1");
  setView("home", ctx);
}

export function openWorkspace(workspaceId, ctx) {
  ctx.state.selectedWorkspace = workspaceId;
  ctx.state.selectedCardIndex = -1;
  const linked = intentWorkspaces.find((entry) => entry.id === workspaceId);
  ctx.state.selectedTask = linked?.taskId || ctx.state.selectedTask;
  setView("workspace", ctx);
}

export function selectCard(cardIndex, ctx) {
  ctx.state.selectedCardIndex = Number(cardIndex) || 0;
  ctx.render(true);
}

export function updateSearchQuery(value, ctx) {
  ctx.state.query = value;
}

export function runSearch(ctx) {
  ctx.state.query = document.querySelector("#query")?.value || "";
  ctx.state.view = "search";
  ctx.render(true);
}
