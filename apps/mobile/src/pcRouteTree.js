import { pcManagerLiteView } from "./views/checkoutServiceView.js";
import { financeReconciliationView } from "./views/financeReconciliationView.js";
import { pcGovernanceView } from "./views/pcGovernanceView.js";
import { releaseControlView } from "./views/releaseControlView.js";

const pcViews = {
  releaseControl: releaseControlView,
  releaseFlightDeck: releaseControlView,
  pcGovernance: pcGovernanceView,
  governanceCenter: pcGovernanceView,
  managerControlTower: pcGovernanceView,
  pcManager: pcManagerLiteView,
  financeReconciliation: financeReconciliationView,
  financeControl: financeReconciliationView
};

export function routePcSurface(ctx) {
  const view = pcViews[ctx.state.view] || pcGovernanceView;
  return view(ctx);
}
