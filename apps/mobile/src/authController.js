import { loginActor } from "./apiClient.js";
import { persistActorSession } from "./appState.js";
import { setView } from "./navigationController.js";
import { defaultHomeForSession } from "./surfaceResolver.js";

export async function login(ctx) {
  const username = document.querySelector("#loginAccount")?.value || document.querySelector("#loginRole")?.value || "operator";
  const department = document.querySelector("#loginDepartment")?.value || "stay";
  const password = document.querySelector("#loginPassword")?.value || "dev";
  await ctx.hydrateProjectionFromApi();
  if (ctx.state.apiStatus !== "online") {
    ctx.state.loginMessage = ctx.tr("apiOffline");
    ctx.render();
    return;
  }
  try {
    const session = await loginActor(username, password);
    session.department = department;
    ctx.state.currentActor = session;
    ctx.state.loginMessage = "";
    persistActorSession(session);
    await ctx.hydrateProjectionFromApi();
    setView(localStorage.getItem("workosnext.onboarded") ? defaultHomeForSession(session, ctx.state) : "onboarding", ctx);
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

export { defaultHomeForSession } from "./surfaceResolver.js";
