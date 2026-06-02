import { mobileOrdinarySurfaces, pcSurfaceViews } from "../../apps/mobile/src/surfaceRegistry.js";
import { readText, updateProjectHygiene, writeJson, failIfNeeded } from "./project-hygiene-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const mobileRoutes = Array.from(mobileOrdinarySurfaces).sort();
const pcRoutes = Array.from(pcSurfaceViews).sort();
const appRouter = readText("apps/mobile/src/appRouter.js");
const appShell = readText("apps/mobile/src/appShell.js");
const pcRouteTree = readText("apps/mobile/src/pcRouteTree.js");
const noGoItems = [];

const routeInventory = [
  ...mobileRoutes.map((route) => routeEntry(route, "mobile_work_plane")),
  ...pcRoutes.map((route) => routeEntry(route, "pc_governance_plane"))
];

for (const route of mobileRoutes) {
  if (!appRouter.includes(route)) {
    noGoItems.push(`mobile route 未接入 appRouter：${route}`);
  }
}
for (const route of pcRoutes) {
  if (!pcRouteTree.includes(route)) {
    noGoItems.push(`PC route 未接入 pcRouteTree：${route}`);
  }
}
if (!appRouter.includes("isPcSurfaceView(ctx.state.view)") || !appRouter.includes("routePcSurface(ctx)")) {
  noGoItems.push("appRouter 必须通过 PC route tree 分流 PC surfaces。");
}
if (!appShell.includes("isPcSurfaceView") || !appShell.includes("!isPcSurfaceView(state.view)") || !appShell.includes("bottomNav(ctx)")) {
  noGoItems.push("appShell 必须阻止 PC surface 显示 mobile bottom nav。");
}
for (const route of pcRoutes) {
  const entry = routeInventory.find((item) => item.route === route);
  if (entry.ordinaryUserVisible) noGoItems.push(`PC surface 不得标记为 ordinary mobile visible：${route}`);
}
for (const route of mobileRoutes) {
  if (/release|governance|financeControl|financeReconciliation|pc/i.test(route)) {
    noGoItems.push(`mobile ordinary route 不得包含 PC/admin surface：${route}`);
  }
}

const result = {
  generatedAtUtc,
  generatedBy: "check-route-surface-hygiene",
  stage: "PROJECT-HYGIENE-CLEANUP",
  status: noGoItems.length ? "failed" : "passed",
  routeCount: routeInventory.length,
  mobileRouteCount: mobileRoutes.length,
  pcRouteCount: pcRoutes.length,
  noGoItems,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson("artifacts/project/route-surface-inventory.json", {
  generatedAtUtc,
  generatedBy: "check-route-surface-hygiene",
  stage: "PROJECT-HYGIENE-CLEANUP",
  routes: routeInventory
});
updateProjectHygiene("route_surface_hygiene", result);
failIfNeeded(noGoItems, "route surface hygiene check");
console.log("route surface hygiene check: PASS");

function routeEntry(route, surface) {
  const isMobile = surface === "mobile_work_plane";
  const operationRoute = route === "operationPanel" || route === "confirmPage";
  return {
    route,
    surface,
    allowedRoles: isMobile ? ["frontdesk", "operator", "housekeeping", "finance", "manager", "admin", "releaseOwner"] : allowedPcRoles(route),
    allowedDevices: isMobile ? ["trusted_mobile"] : ["trusted_pc"],
    ordinaryUserVisible: isMobile,
    requiresRuntimeGuard: operationRoute || !isMobile,
    backendGuardRequired: operationRoute || !isMobile,
    canWriteBusinessFact: false,
    businessWritePath: operationRoute ? "Operations Runtime via CommandSubmission only" : "none",
    productionAllowed: false
  };
}

function allowedPcRoles(route) {
  if (/release/i.test(route)) return ["releaseOwner"];
  if (/finance/i.test(route)) return ["finance"];
  if (/manager/i.test(route)) return ["manager"];
  return ["admin", "manager"];
}
