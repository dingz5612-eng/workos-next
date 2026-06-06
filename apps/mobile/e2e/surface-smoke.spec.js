import { expect, test } from "@playwright/test";

const workItem = {
  workItemId: "wi-e2e-room-setup",
  caseId: "case:e2e-room",
  workItemType: "roomSetup",
  lifecycleState: "ready",
  ownerRole: "operator",
  workspaceId: "W-STAY-RESOURCE",
  cardId: "roomSetup",
  domain: "stay",
  businessObject: "房间准备",
  nextAction: "配置房间和床位后提交确认。",
  requiredEvidence: ["room_duplicate_check"],
  traceRefs: ["trace:e2e-room"],
  riskLevel: "P1",
  dueAt: "2026-06-02T10:00:00Z"
};

const projection = {
  workspaces: [
    {
      id: "W-STAY-RESOURCE",
      domain: "stay",
      title: { "zh-CN": "房间资源配置" },
      summary: { "zh-CN": "配置房间和床位，准备宿舍 L1 内测资源。" },
      next: { "zh-CN": "配置房间和床位后提交确认。" },
      cards: [
        {
          id: "roomSetup",
          status: "ready",
          title: { "zh-CN": "房间配置" },
          fields: {
            business: [
              { id: "roomId", label: { "zh-CN": "房间编号" }, type: "text" },
              { id: "roomNo", label: { "zh-CN": "房间号" }, type: "text" }
            ],
            system: [{ id: "definitionVersion", label: { "zh-CN": "定义版本" } }],
            analytics: [{ id: "sla", label: { "zh-CN": "SLA" } }]
          },
          evidence: ["房间重复校验"],
          checks: ["字段完整"],
          events: ["RoomConfigured"],
          transitions: { onPrepare: "prepared", onConfirm: "confirmed" },
          confirmation: { requiredRole: "operator", policyRef: "operations-runtime-policy" },
          blockerRules: []
        }
      ],
      blockers: []
    }
  ],
  events: []
};

let runtimeProjection = projection;
let runtimeWorkItems = [workItem];
let runtimeSearchResults = [];

test.beforeEach(async ({ page }) => {
  runtimeProjection = projection;
  runtimeWorkItems = [workItem];
  runtimeSearchResults = [];
  await page.addInitScript(() => {
    localStorage.setItem("workosnext.onboarded", "1");
    localStorage.setItem("workosnext.lang", "zh-CN");
  });
  await page.route("http://127.0.0.1:5191/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/health") return route.fulfill({ json: { status: "ok", persistence: "postgresql" } });
    if (url.pathname === "/api/auth/login") {
      const request = route.request().postDataJSON();
      return route.fulfill({ json: actorFor(request.username || "operator") });
    }
    if (url.pathname === "/api/workspaces") return route.fulfill({ json: runtimeProjection });
    if (url.pathname === "/api/operations/work-items") return route.fulfill({ json: runtimeWorkItems });
    if (url.pathname === "/api/lenses/home-surface") return route.fulfill({ json: runtimeWorkItems });
    if (url.pathname === "/api/lenses/learning-catalog") return route.fulfill({ json: [{ title: "证据怎么补", domain: "evidence", nextAction: "查看示例" }] });
    if (url.pathname.startsWith("/api/lenses/accommodation/")) return route.fulfill({ json: {} });
    if (url.pathname === "/api/lenses/search") return route.fulfill({ json: runtimeSearchResults });
    if (url.pathname === "/api/control-plane/releases") return route.fulfill({ json: [{ releaseId: "rel-e2e", status: "pilot" }] });
    if (url.pathname === "/api/control-plane/releases/rel-e2e") {
      return route.fulfill({
        json: {
          overview: { releaseId: "rel-e2e", gateResultStatus: "blocked", shadowGrade: "green" },
          gateResult: { status: "blocked", gateResultId: "gate-e2e", generatedAtUtc: "2026-06-02T10:00:00Z" },
          featureFlags: [],
          sliceCutoverStates: []
        }
      });
    }
    if (url.pathname === "/api/observability/runtime") {
      return route.fulfill({
        json: {
          runtime: { confirmLatencyP95Ms: 120, confirmLatencySampleCount: 5, handlerFailureCount: 0 },
          outbox: { outboxLagSeconds: 0, deadLetterCount: 0, replayCount: 0 },
          projection: { projectionLagSeconds: 0, rebuildCount: 0, staleLensCount: 0 },
          controlPlane: { gateResultStatus: "blocked", redShadowReports: 0, p0InvariantFailures: 0, releaseState: "L1_INTERNAL_PILOT_OBSERVATION" }
        }
      });
    }
    if (url.pathname.endsWith("/prepare") && method === "POST") return route.fulfill({ json: { prepared: true, workItemId: workItem.workItemId } });
    if (url.pathname.endsWith("/confirm") && method === "POST") {
      return route.fulfill({
        json: {
          confirmed: true,
          commitStatus: "committed",
          projectionStatus: "pending",
          commandSubmissionId: "sub-e2e-room",
          traceRefs: ["trace:e2e-room"]
        }
      });
    }
    if (url.pathname.startsWith("/api/operations/trace/")) return route.fulfill({ json: { traceRefs: ["trace:e2e-room"] } });
    return route.fulfill({ status: 404, json: { error: "not_mocked", path: url.pathname } });
  });
});

function actorFor(role) {
  const actors = {
    operator: { role: "operator", displayName: "内测经办人", token: "dev-e2e-token", capabilities: ["operations.confirm"] },
    finance: { role: "finance", displayName: "财务确认人", token: "finance-e2e-token", capabilities: ["finance.control.view"] },
    manager: { role: "manager", displayName: "经理", token: "manager-e2e-token", capabilities: ["manager.control.view"] },
    releaseOwner: { role: "releaseOwner", displayName: "发布负责人", token: "release-e2e-token", capabilities: ["release.flight_deck.view"] }
  };
  return actors[role] || actors.operator;
}

async function seedActor(page, role) {
  await page.addInitScript((actor) => {
    localStorage.setItem("workosnext.actorSession", JSON.stringify(actor));
    localStorage.setItem("workosnext.onboarded", "1");
    localStorage.setItem("workosnext.lang", "zh-CN");
  }, actorFor(role));
}

test("mobile work plane smoke covers login, WorkItem, search, me, and PC boundary", async ({ page }) => {
  await page.goto("/?device=mobile");
  await page.getByRole("button", { name: "登录" }).click();

  const bottomNav = page.getByRole("navigation", { name: "移动端主导航" });
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "今天", exact: true })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "工作项", exact: true })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "搜索", exact: true })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "我的", exact: true })).toBeVisible();

  await bottomNav.getByRole("button", { name: "工作项", exact: true }).click();
  await page.locator('[data-work-item-id="wi-e2e-room-setup"]').click();
  await expect(page.locator('[data-surface="operation-panel-route"]')).toBeVisible();
  await expect(page.locator('[data-surface="trusted-confirm"]')).toHaveCount(0);
  await expect(page.locator('[data-surface="operation-admission"]')).toBeVisible();
  await expect(page.locator("body")).toContainText("准入状态");
  await expect(page.locator("body")).toContainText("提交前检查");
  await expect(page.locator("body")).toContainText("可以提交");
  await expect(page.locator("body")).toContainText("查看检查详情");
  await expect(page.getByRole("button", { name: /提交观察记录/u })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("payloadHash");
  await expect(page.locator("body")).not.toContainText("commandSubmissionId");
  await expect(page.locator("body")).not.toContainText("traceAvailable");
  await expect(page.locator('[data-surface="operation-runtime-proof"]')).toHaveCount(0);
  await expect(page.locator('[data-surface="operation-panel-route"]')).toHaveAttribute("data-admission-decision", "confirm_allowed_production_blocked");
  await expect(page.locator('[data-surface="operation-panel-route"]')).toHaveAttribute("data-runtime-decision", "work_item_confirm_ready:production_blocked");

  await bottomNav.getByRole("button", { name: "搜索", exact: true }).click();
  await page.locator("#query").fill("创建房间");
  await page.locator("#searchNow").click();
  await expect(page.locator("body")).not.toContainText("[object Object]");
  await expect(page.locator('[data-search-section="searchWorkItems"]')).toContainText("继续观察记录");
  await expect(page.locator('[data-search-section="searchLearning"]')).toHaveCount(0);
  await page.locator('[data-search-section="searchWorkItems"] [data-work-item-id]').first().click();
  await expect(page.locator('[data-surface="operation-panel-route"]')).toBeVisible();

  await bottomNav.getByRole("button", { name: "我的", exact: true }).click();
  await expect(page.getByRole("button", { name: /学习中心/u })).toBeVisible();
  await expect(page.getByRole("button", { name: /我的权限/u })).toBeVisible();
  await expect(page.getByRole("button", { name: /当前设备/u })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Governance Center");
  await expect(page.locator("body")).not.toContainText("Release Flight Deck");
});

test("mobile finance session stays on home and direct PC route shows diagnostic", async ({ page }) => {
  await seedActor(page, "finance");

  await page.goto("/?device=mobile");
  await expect(page.locator(".surface-mobile")).toBeVisible();
  await expect(page.locator("body")).toContainText("今日工作");
  await expect(page.locator("body")).not.toContainText("财务对账与修正工作区");

  await page.reload();
  await expect(page.locator("body")).toContainText("今日工作");

  await page.goto("/?device=mobile&view=financeControl");
  await expect(page.locator('[data-surface="permission-diagnostic"]')).toBeVisible();
  await expect(page.locator("body")).toContainText("这个工作面只能在 PC 或发布设备打开。");
});

test("missing persisted WorkItem, numeric search, workspace debug, and recovery states stay user safe", async ({ page }) => {
  runtimeWorkItems = [];
  runtimeProjection = { workspaces: [], events: [] };
  await seedActor(page, "operator");

  await page.goto("/?device=mobile&view=workbench");
  await expect(page.locator('[data-work-item-id]')).toHaveCount(0);
  await expect(page.locator("body")).toContainText("当前没有分配给你的待办");

  runtimeWorkItems = [workItem];
  runtimeProjection = projection;
  await page.goto("/?device=mobile&view=search&q=21");
  await expect(page.locator('[data-search-section="searchWorkItems"] [data-work-item-id]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("[object Object]");

  await page.goto("/?device=mobile&view=workspace");
  await expect(page.locator("body")).not.toContainText("Debug / blocked");
  await expect(page.locator(".primary-action")).toHaveCount(1);

  await page.goto("/?device=mobile&view=workbench");
  await page.locator('[data-work-item-id="wi-e2e-room-setup"]').click();
  await page.evaluate(() => {
    window.__appCtx.state.lastActionResult = { status: "idempotency_conflict_409" };
    window.__appCtx.render(true);
  });
  await expect(page.locator("body")).toContainText("系统识别到重复提交");
  await page.evaluate(() => {
    window.__appCtx.state.lastActionResult = { status: "business_blocked_422" };
    window.__appCtx.render(true);
  });
  await expect(page.locator("body")).toContainText("提交校验未通过");
  await page.evaluate(() => {
    window.__appCtx.state.lastActionResult = { status: "permission_blocked_403", requiredPermission: "finance.control.view", owner: "finance" };
    window.__appCtx.render(true);
  });
  await expect(page.locator("body")).toContainText("财务工作台访问权限");
});

test("manager on PC surface opens Manager Control Tower without mobile nav", async ({ page }) => {
  await seedActor(page, "manager");

  await page.goto("/?device=pc&view=managerControlTower");

  await expect(page.locator(".surface-pc")).toBeVisible();
  await expect(page.locator("[data-pc-manager-control-tower]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "经理控制塔" })).toBeVisible();
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
});

test("releaseOwner on PC surface opens Release Flight Deck without mobile nav", async ({ page }) => {
  await seedActor(page, "releaseOwner");

  await page.goto("/?device=pc&view=releaseFlightDeck");

  await expect(page.locator(".surface-pc")).toBeVisible();
  await expect(page.locator(".release-control")).toBeVisible();
  await expect(page.locator("body")).toContainText("发布工作区");
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
});
