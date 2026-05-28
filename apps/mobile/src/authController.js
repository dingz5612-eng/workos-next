import { loginActor } from "./apiClient.js";
import { setView } from "./navigationController.js";

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
    ctx.state.loginMessage = "";
    localStorage.setItem("workosnext.actorSession", JSON.stringify(session));
    setView(localStorage.getItem("workosnext.onboarded") ? "home" : "onboarding", ctx);
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
