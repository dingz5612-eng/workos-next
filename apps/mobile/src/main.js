import "./styles.css";
import { checkHealth, fetchWorkspaceProjection } from "./apiClient.js";
import { shell } from "./appShell.js";
import { routeView } from "./appRouter.js";
import { createInitialState } from "./appState.js";
import { bindEvents } from "./eventBinder.js";
import { metric, localList, localTerm, task, tr, tx, workspace } from "./selectors/workspaceSelectors.js";
import { replaceIntentWorkspaces } from "./workspaceProjections.js";

const state = createInitialState();

const ctx = {
  state,
  shell: (content) => shell(content, ctx),
  tr: (key) => tr(state, key),
  tx: (value) => tx(state, value),
  localTerm: (value, lang = state.lang) => localTerm(state, value, lang),
  localList: (items) => localList(state, items),
  task: () => task(state),
  workspace: () => workspace(state),
  metric: (value, label) => metric(value, label, ctx),
  render,
  hydrateProjectionFromApi,
  replaceIntentWorkspaces
};

async function hydrateProjectionFromApi() {
  try {
    await checkHealth();
    state.apiStatus = "online";
    const payload = await fetchWorkspaceProjection();
    replaceIntentWorkspaces(payload.workspaces);
  } catch {
    state.apiStatus = "offline";
    state.operationMessage = ctx.tr("apiOffline");
  }
}

function render(scrollTop = false) {
  document.documentElement.lang = state.lang;
  document.querySelector("#app").innerHTML = routeView(ctx);
  bindEvents(ctx);
  if (scrollTop) window.scrollTo({ top: 0, left: 0 });
}

hydrateProjectionFromApi().finally(() => render());
