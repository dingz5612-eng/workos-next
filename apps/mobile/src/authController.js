import { loginActor } from "./apiClient.js";
import { persistActorSession } from "./appState.js";
import { setView } from "./navigationController.js";
import { defaultHomeForSession as resolveHomeForSession } from "./surfaceResolver.js";

export async function login(ctx) {
  await ctx.hydrateProjectionFromApi();
  if (ctx.state.apiStatus !== "online") {
    ctx.state.loginMessage = ctx.tr("apiOffline");
    ctx.render();
    return;
  }
  try {
    const username = document.querySelector("#loginRole")?.value || "operator";
    const password = document.querySelector("#loginPassword")?.value || "dev";
    const session = await loginActor(username, password);
    ctx.state.currentActor = session;
    applyAuthenticatedSessionContext(ctx.state, session);
    ctx.state.loginMessage = "";
    persistActorSession(session);
    await ctx.hydrateProjectionFromApi();
    setView(localStorage.getItem("workosnext.onboarded") ? resolveHomeForSession(session, ctx.state) : "onboarding", ctx);
  } catch {
    ctx.state.loginMessage = ctx.tr("loginFailed");
    ctx.render();
  }
}

export function logout(ctx) {
  ctx.state.currentActor = null;
  ctx.state.loginMessage = "";
  localStorage.removeItem("workosnext.actorSession");
  setView("login", ctx);
}

export function defaultHomeForSession(session = {}, state = {}) {
  return resolveHomeForSession(session, state);
}

function applyAuthenticatedSessionContext(state, session = {}) {
  if (session.currentDevice) state.currentDevice = session.currentDevice;
  if (session.pcGovernance?.currentDevice) {
    state.pcGovernance = {
      ...(state.pcGovernance || {}),
      ...session.pcGovernance,
      currentDevice: session.pcGovernance.currentDevice
    };
  }
}
