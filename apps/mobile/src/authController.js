import { loginActor, logoutActor, registerDeviceSession } from "./apiClient.js";
import { persistActorSession } from "./appState.js";
import { setView } from "./navigationController.js";
import { defaultHomeForSession } from "./surfaceResolver.js";

export async function login(ctx) {
  if (ctx.state.loginSubmitting) return;
  const username = document.querySelector("#loginAccount")?.value || "";
  const password = document.querySelector("#loginPassword")?.value || "";
  ctx.state.loginSubmitting = true;
  ctx.state.loginMessage = ctx.tr("loginSubmitting");
  ctx.render();
  try {
    if (ctx.state.apiStatus !== "online") {
      await ctx.hydrateProjectionFromApi();
      if (ctx.state.apiStatus !== "online") {
        ctx.state.loginSubmitting = false;
        ctx.state.loginMessage = ctx.tr("apiOffline");
        ctx.render();
        return;
      }
    }
    const session = await loginActor(username, password);
    ctx.state.currentActor = session;
    await registerCurrentDevice(ctx, session);
    ctx.state.loginMessage = "";
    ctx.state.loginSubmitting = false;
    persistActorSession(session);
    setView(localStorage.getItem("workosnext.onboarded") ? defaultHomeForSession(session, ctx.state) : "onboarding", ctx);
    void ctx.hydrateProjectionFromApi().finally(() => ctx.render());
  } catch {
    ctx.state.loginSubmitting = false;
    ctx.state.loginMessage = ctx.tr("loginFailed");
    ctx.render();
  }
}

export async function logout(ctx) {
  try {
    if (ctx.state.currentActor) await logoutActor();
  } catch {
    // Local session cleanup must still happen when the network is unavailable.
  }
  ctx.state.currentActor = null;
  ctx.state.loginMessage = "";
  localStorage.removeItem("workosnext.actorSession");
  setView("login", ctx);
}

export { defaultHomeForSession } from "./surfaceResolver.js";

async function registerCurrentDevice(ctx, session) {
  const device = ctx.state.currentDevice || { deviceId: "mobile-current", deviceTrustStatus: "unknown", surface: "mobile" };
  if (!session?.actorId || !session?.tenantId || !device.deviceId) return;
  try {
    const registered = await registerDeviceSession({
      tenantId: session.tenantId,
      actorId: session.actorId,
      deviceId: device.deviceId,
      deviceTrustStatus: device.deviceTrustStatus || "unknown",
      userAgentHash: await userAgentHash()
    });
    ctx.state.currentDevice = {
      ...device,
      deviceTrustStatus: registered.deviceTrustStatus || device.deviceTrustStatus || "unknown"
    };
    if (ctx.state.pcGovernance && device.surface === "pc") {
      ctx.state.pcGovernance.currentDevice = { ...registered, surface: "pc" };
      ctx.state.pcGovernance.deviceSessions = upsertByDeviceId(ctx.state.pcGovernance.deviceSessions || [], registered);
    }
  } catch {
    ctx.state.currentDevice = device;
  }
}

async function userAgentHash() {
  const value = navigator.userAgent || "unknown";
  if (!crypto?.subtle) return `ua-${value.length}-${value.charCodeAt(0) || 0}`;
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function upsertByDeviceId(items, next) {
  const filtered = items.filter((item) => item.deviceId !== next.deviceId);
  return [next, ...filtered];
}
