import "./styles.css";
import { checkHealth, fetchHomeSurface, fetchLearningCatalog, fetchWorkQueue, fetchWorkspaceProjection } from "./apiClient.js";
import { shell } from "./appShell.js";
import { routeView } from "./appRouter.js";
import { createInitialState } from "./appState.js";
import { bindEvents } from "./eventBinder.js";
import { refreshDefaultAccommodationLenses } from "./operationRuntime.js";
import { applyRuntimeOfflineFallback, applyRuntimeProjection, applyRuntimeSurfacePayloads } from "./runtime/runtimeStore.js";
import { escapeAttr, escapeHtml } from "./htmlEscaping.js";
import { metric, localList, localTerm, task, tr, tx, workspace } from "./selectors/workspaceSelectors.js";

const state = createInitialState();

const ctx = {
  state,
  shell: (content) => shell(content, ctx),
  tr: (key) => escapeHtml(tr(state, key)),
  tx: (value) => escapeHtml(tx(state, value)),
  localTerm: (value, lang = state.lang) => escapeHtml(localTerm(state, value, lang)),
  localList: (items) => escapeHtml(localList(state, items)),
  escapeHtml,
  escapeAttr,
  task: () => task(state),
  workspace: () => workspace(state),
  metric: (value, label) => metric(value, label, ctx),
  render,
  hydrateProjectionFromApi,
  applyRuntimeProjection
};

async function hydrateProjectionFromApi() {
  try {
    await checkHealth();
    state.apiStatus = "online";
    const [projection, workQueue, homeSurface, learningCatalog, accommodationLenses] = await Promise.all([
      fetchWorkspaceProjection(),
      optionalSurface(fetchWorkQueue),
      optionalSurface(fetchHomeSurface),
      optionalSurface(fetchLearningCatalog),
      optionalSurface(refreshDefaultAccommodationLenses)
    ]);
    applyRuntimeProjection(state, projection);
    applyRuntimeSurfacePayloads(state, { workQueue, homeSurface, learningCatalog, accommodationLenses });
  } catch {
    state.apiStatus = "offline";
    applyRuntimeOfflineFallback(state);
    state.operationMessage = ctx.tr("apiOffline");
  }
}

async function optionalSurface(load) {
  try {
    return await load();
  } catch {
    return null;
  }
}

function render(scrollTop = false) {
  document.documentElement.lang = state.lang;
  document.querySelector("#app").innerHTML = routeView(ctx);
  bindEvents(ctx);
  if (scrollTop) window.scrollTo({ top: 0, left: 0 });
}

hydrateProjectionFromApi().finally(() => render());
