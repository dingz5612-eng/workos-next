import { homeView } from "./views/homeView.js";
import { learningView } from "./views/coachView.js";
import { pcManagerLiteView } from "./views/checkoutServiceView.js";
import { financeReconciliationView } from "./views/financeReconciliationView.js";
import { loginView, onboardingView } from "./views/loginView.js";
import { meView } from "./views/meView.js";
import { pcGovernanceView } from "./views/pcGovernanceView.js";
import { releaseControlView } from "./views/releaseControlView.js";
import { searchView } from "./views/searchView.js";
import { confirmPageView, resultView, simpleView } from "./views/simpleView.js";
import { workbenchView } from "./views/workbenchView.js";
import { workspaceView } from "./views/workspaceView.js";
import { PermissionDiagnostic } from "./views/experienceComponents.js";
import { evaluateSurfaceAccess } from "./surfaceGuard.js";

export function routeView(ctx) {
  const access = evaluateSurfaceAccess(ctx.state.view, ctx.state);
  if (!access.allowed) {
    ctx.state.permissionDiagnostic = access;
    return ctx.shell(PermissionDiagnostic(access, ctx));
  }
  const views = {
    login: loginView,
    onboarding: onboardingView,
    home: homeView,
    search: searchView,
    workbench: workbenchView,
    releaseControl: releaseControlView,
    releaseFlightDeck: releaseControlView,
    pcGovernance: pcGovernanceView,
    governanceCenter: pcGovernanceView,
    managerControlTower: pcGovernanceView,
    pcManager: pcManagerLiteView,
    financeReconciliation: financeReconciliationView,
    financeControl: financeReconciliationView,
    me: meView,
    workspace: workspaceView,
    notes: () => simpleView("noteTitle", "noteBody", ctx),
    reminders: () => simpleView("reminderTitle", "reminderBody", ctx),
    learning: learningView,
    feedback: () => simpleView("feedbackTitle", "feedbackBody", ctx),
    confirmPage: confirmPageView,
    result: resultView,
    permissionDiagnostic: () => PermissionDiagnostic(ctx.state.permissionDiagnostic, ctx)
  };
  return (views[ctx.state.view] || homeView)(ctx);
}
