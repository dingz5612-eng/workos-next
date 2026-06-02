import { homeView } from "./views/homeView.js";
import { learningView } from "./views/coachView.js";
import { loginView, onboardingView } from "./views/loginView.js";
import { meView } from "./views/meView.js";
import { searchView } from "./views/searchView.js";
import { confirmPageView, resultView, simpleView } from "./views/simpleView.js";
import { workbenchView } from "./views/workbenchView.js";
import { workspaceView } from "./views/workspaceView.js";
import { operationPanelView } from "./views/operationPanelView.js";
import { PermissionDiagnostic } from "./views/experienceComponents.js";
import { routePcSurface } from "./pcRouteTree.js";
import { evaluateSurfaceAccess } from "./surfaceGuard.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";

export function routeView(ctx) {
  const access = evaluateSurfaceAccess(ctx.state.view, ctx.state);
  if (!access.allowed) {
    ctx.state.permissionDiagnostic = access;
    return ctx.shell(PermissionDiagnostic(access, ctx));
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
    feedback: () => simpleView("feedbackTitle", "feedbackBody", ctx),
    confirmPage: confirmPageView,
    result: resultView,
    permissionDiagnostic: () => PermissionDiagnostic(ctx.state.permissionDiagnostic, ctx)
  };
  return (views[ctx.state.view] || homeView)(ctx);
}
