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

test.beforeEach(async ({ page }) => {
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
    if (url.pathname === "/api/workspaces") return route.fulfill({ json: projection });
    if (url.pathname === "/api/operations/work-items") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/home-surface") return route.fulfill({ json: [workItem] });
    if (url.pathname === "/api/lenses/learning-catalog") return route.fulfill({ json: [{ title: "证据怎么补", domain: "evidence", nextAction: "查看示例" }] });
    if (url.pathname.startsWith("/api/lenses/accommodation/")) return route.fulfill({ json: {} });
    if (url.pathname === "/api/lenses/search") return route.fulfill({ json: [] });
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
    manager: pcActor("manager", "经理", "manager-e2e-token", ["manager.control.view"]),
    releaseOwner: pcActor("releaseOwner", "发布负责人", "release-e2e-token", ["release.flight_deck.view"])
  };
  return actors[role] || actors.operator;
}

function pcActor(role, displayName, token, capabilities) {
  return {
    role,
    displayName,
    token,
    capabilities,
    currentDevice: { deviceId: "pc-e2e-current", deviceTrustStatus: "trusted", surface: "pc" },
    pcGovernance: { currentDevice: { deviceId: "pc-e2e-current", deviceTrustStatus: "trusted", surface: "pc" } }
  };
}

async function loginAs(page, role) {
  await page.goto("/");
  await page.selectOption("#loginRole", role);
  await page.getByRole("button", { name: "登录" }).click();
}

test("mobile work plane smoke covers login, WorkItem, search, me, and PC boundary", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).click();

  const bottomNav = page.getByRole("navigation", { name: "移动端主导航" });
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "今天", exact: true })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "工作", exact: true })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "搜索", exact: true })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "我的", exact: true })).toBeVisible();

  await bottomNav.getByRole("button", { name: "工作", exact: true }).click();
  await page.locator('[data-work-item-id="wi-e2e-room-setup"]').click();
  await expect(page.locator('[data-surface="operation-panel-route"]')).toBeVisible();
  await expect(page.locator('[data-surface="trusted-confirm"]')).toBeVisible();

  await bottomNav.getByRole("button", { name: "搜索", exact: true }).click();
  await page.locator("#query").fill("房间");
  await page.locator("#searchNow").click();
  await expect(page.locator("body")).not.toContainText("[object Object]");
  await expect(page.locator('[data-search-section="searchWorkItems"]')).toBeVisible();
  await expect(page.locator('[data-search-section="searchLearning"]')).toBeVisible();

  await bottomNav.getByRole("button", { name: "我的", exact: true }).click();
  await expect(page.getByRole("button", { name: /学习中心/u })).toBeVisible();
  await expect(page.getByRole("button", { name: /我的权限/u })).toBeVisible();
  await expect(page.getByRole("button", { name: /当前设备/u })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Governance Center");
  await expect(page.locator("body")).not.toContainText("Release Flight Deck");
});

test("manager on PC surface opens Manager Control Tower without mobile nav", async ({ page }) => {
  await loginAs(page, "manager");

  await expect(page.locator(".surface-pc")).toBeVisible();
  await expect(page.locator("[data-pc-manager-control-tower]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "经理控制塔" })).toBeVisible();
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
});

test("releaseOwner on PC surface opens Release Flight Deck without mobile nav", async ({ page }) => {
  await loginAs(page, "releaseOwner");

  await expect(page.locator(".surface-pc")).toBeVisible();
  await expect(page.locator(".release-control")).toBeVisible();
  await expect(page.locator("body")).toContainText("发布工作区");
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
});
