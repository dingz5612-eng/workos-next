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

export function routeView(ctx) {
  const views = {
    login: loginView,
    onboarding: onboardingView,
    home: homeView,
    search: searchView,
    workbench: workbenchView,
    releaseControl: releaseControlView,
    pcGovernance: pcGovernanceView,
    pcManager: pcManagerLiteView,
    financeReconciliation: financeReconciliationView,
    me: meView,
    workspace: workspaceView,
    notes: () => simpleView("noteTitle", "noteBody", ctx),
    reminders: () => simpleView("reminderTitle", "reminderBody", ctx),
    learning: learningView,
    feedback: () => simpleView("feedbackTitle", "feedbackBody", ctx),
    confirmPage: confirmPageView,
    result: resultView
  };
  return (views[ctx.state.view] || homeView)(ctx);
}
