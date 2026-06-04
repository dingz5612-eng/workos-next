import "./styles.css";
import { checkHealth, fetchHomeSurface, fetchLearningCatalog, fetchOperationWorkItems, fetchWorkspaceProjection } from "./apiClient.js";
import { shell } from "./appShell.js";
import { routeView } from "./appRouter.js";
import { createInitialState, shouldHydrateProtectedSurfaces } from "./appState.js";
import { bindEvents } from "./eventBinder.js";
import { refreshDefaultAccommodationLenses } from "./operationRuntime.js";
import { applyRuntimeOfflineFallback, applyRuntimeProjection, applyRuntimeSurfacePayloads } from "./runtime/runtimeStore.js";
import { escapeAttr, escapeHtml } from "./htmlEscaping.js";
import { metric, localList, localTerm, task, tr, tx, workspace } from "./selectors/workspaceSelectors.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";

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
  applyRuntimeProjection: (payload) => applyRuntimeProjection(state, payload)
};

if (typeof window !== "undefined") {
  window.__appCtx = ctx;
}

async function hydrateProjectionFromApi() {
  const protectedHydration = shouldHydrateProtectedSurfaces(state);
  if (protectedHydration) state.runtimeHydrating = true;
  try {
    await checkHealth();
    state.apiStatus = "online";
  } catch {
    state.apiStatus = "offline";
    applyRuntimeOfflineFallback(state);
    state.operationMessage = ctx.tr("apiOffline");
    if (protectedHydration) state.runtimeHydrating = false;
    return;
  }
  if (!protectedHydration) {
    return;
  }
  try {
    const [projection, operationWorkItems] = await Promise.all([
      optionalSurface(fetchWorkspaceProjection),
      optionalSurface(fetchOperationWorkItems)
    ]);
    if (projection) applyRuntimeProjection(state, projection);
    applyRuntimeSurfacePayloads(state, { operationWorkItems });
    if (isPcSurfaceView(state.view)) await hydratePcSurfaceData();
    if (state.operationMessage === ctx.tr("apiOffline")) {
      state.operationMessage = "";
    }
  } finally {
    state.runtimeHydrating = false;
  }
  void hydrateSecondarySurfaces();
}

async function hydratePcSurfaceData() {
  const { hydratePcSurfaceData: hydratePcData } = await import("./pcSurfaceData.js");
  await hydratePcData(state);
}

async function optionalSurface(load) {
  try {
    return await load();
  } catch {
    return null;
  }
}

async function hydrateSecondarySurfaces() {
  const [homeSurface, learningCatalog, accommodationLenses] = await Promise.all([
    optionalSurface(fetchHomeSurface),
    optionalSurface(fetchLearningCatalog),
    optionalSurface(refreshDefaultAccommodationLenses)
  ]);
  applyRuntimeSurfacePayloads(state, { homeSurface, learningCatalog, accommodationLenses });
  render();
}

function render(scrollTop = false) {
  document.documentElement.lang = state.lang;
  document.querySelector("#app").innerHTML = routeView(ctx);
  bindEvents(ctx);
  if (scrollTop) window.scrollTo({ top: 0, left: 0 });
}

render();
hydrateProjectionFromApi().finally(() => render());
