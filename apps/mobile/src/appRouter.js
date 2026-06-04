import { homeView } from "./views/homeView.js";
import { learningView } from "./views/coachView.js";
import { loginView, onboardingView } from "./views/loginView.js";
import { meView } from "./views/meView.js";
import { searchView } from "./views/searchView.js";
import { confirmPageView, resultView, simpleView } from "./views/simpleView.js";
import { feedbackView } from "./views/feedbackView.js";
import { workbenchView } from "./views/workbenchView.js";
import { workspaceView } from "./views/workspaceView.js";
import { operationPanelView } from "./views/operationPanelView.js";
import { PermissionDiagnostic } from "./views/experienceComponents.js";
import { routePcSurface } from "./pcRouteTree.js";
import { evaluateSurfaceAccess } from "./surfaceGuard.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";

const runtimeHydrationViews = new Set(["home", "workbench", "search", "workspace", "operationPanel", "learning"]);

export function routeView(ctx) {
  const access = evaluateSurfaceAccess(ctx.state.view, ctx.state);
  if (!access.allowed) {
    ctx.state.permissionDiagnostic = access;
    return ctx.shell(PermissionDiagnostic(access, ctx));
  }
  if (ctx.state.runtimeHydrating && ctx.state.currentActor && runtimeHydrationViews.has(ctx.state.view)) {
    return ctx.shell(runtimeHydrationView(ctx));
  }
  if (isPcSurfaceView(ctx.state.view)) {
    return routePcSurface(ctx);
  }
  const views = {
    login: loginView,
    onboarding: onboardingView,
    home: homeView,
    search: searchView,
    workbench: workbenchView,
    me: meView,
    workspace: workspaceView,
    operationPanel: operationPanelView,
    notes: () => simpleView("noteTitle", "noteBody", ctx),
    reminders: () => simpleView("reminderTitle", "reminderBody", ctx),
    learning: learningView,
    permissions: () => simpleView("myPermissions", "myPermissionsBody", ctx),
    uploadQueue: () => simpleView("uploadQueue", "uploadQueueBody", ctx),
    submitQueue: () => simpleView("submitQueue", "submitQueueBody", ctx),
    drafts: () => simpleView("drafts", "draftsBody", ctx),
    failedSync: () => simpleView("failedSyncItems", "failedSyncItemsBody", ctx),
    recentSubmissions: () => simpleView("recentSubmissions", "recentSubmissionsBody", ctx),
    recentTraces: () => simpleView("recentTraces", "recentTracesBody", ctx),
    deviceTrust: () => simpleView("deviceTrustStatus", "deviceTrustStatusBody", ctx),
    feedback: feedbackView,
    confirmPage: confirmPageView,
    result: resultView,
    permissionDiagnostic: () => PermissionDiagnostic(ctx.state.permissionDiagnostic, ctx)
  };
  return (views[ctx.state.view] || homeView)(ctx);
}

function runtimeHydrationView(ctx) {
  return `<section class="runtime-loading" data-surface="runtime-hydration" data-admission-decision="pending_runtime_hydration" data-runtime-decision="hydrating">
    <span>${ctx.tr("apiChecking")}</span>
    <h1>${ctx.tr("runtimeLoadingTitle")}</h1>
    <p>${ctx.tr("runtimeLoadingBody")}</p>
    <div class="runtime-loading-grid" aria-hidden="true">
      <i></i><i></i><i></i>
    </div>
  </section>`;
}
