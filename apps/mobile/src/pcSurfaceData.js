import { fetchAccountAudit, fetchAccountUsers, fetchDeviceSessions, fetchProductionObservability, fetchReleaseControlCenter } from "./pcApiClient.js";

export async function hydratePcSurfaceData(state) {
  const [releaseControl, productionObservability, accountUsers, accountAudit, deviceSessions] = await Promise.all([
    optionalSurface(fetchReleaseControlCenter),
    optionalSurface(fetchProductionObservability),
    optionalSurface(fetchAccountUsers),
    optionalSurface(fetchAccountAudit),
    optionalSurface(fetchDeviceSessions)
  ]);
  if (releaseControl) state.releaseControl = releaseControl;
  if (productionObservability || accountUsers || accountAudit || deviceSessions) {
    state.pcGovernance = {
      ...state.pcGovernance,
      ...(productionObservability ? { productionObservability } : {}),
      ...(accountUsers ? { accountUsers } : {}),
      ...(accountAudit ? { accountAudit } : {}),
      ...(deviceSessions ? { deviceSessions } : {})
    };
  }
}

async function optionalSurface(load) {
  try {
    return await load();
  } catch {
    return null;
  }
}
