import { fetchProductionObservability, fetchReleaseControlCenter } from "./pcApiClient.js";

export async function hydratePcSurfaceData(state) {
  const [releaseControl, productionObservability] = await Promise.all([
    optionalSurface(fetchReleaseControlCenter),
    optionalSurface(fetchProductionObservability)
  ]);
  if (releaseControl) state.releaseControl = releaseControl;
  if (productionObservability) {
    state.pcGovernance = { ...state.pcGovernance, productionObservability };
  }
}

async function optionalSurface(load) {
  try {
    return await load();
  } catch {
    return null;
  }
}
