import { beforeEach, describe, expect, it, vi } from "vitest";
import { cardSearchText, normalize, workspaceSearchText } from "../selectors/searchSelectors.js";
import { feedbackStorageKey } from "../feedbackMessages.js";
import { feedbackView } from "../views/feedbackView.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Search and feedback branch matrix", () => {
  beforeEach(() => {
    const storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
      clear: () => storage.clear()
    });
  });

  it("normalizes empty and localized search text without granting write actions", () => {
    const ctx = createSurfaceCtx();
    const card = {
      id: "paymentConfirm",
      title: { "zh-CN": "收款确认" },
      fields: {
        business: [{ id: "amount", label: { "zh-CN": "金额" } }],
        system: [{ id: "workItemId" }],
        analytics: [null, { id: "projectionPending" }]
      },
      evidence: [{ id: "receipt-proof", label: { "zh-CN": "收据证明" } }],
      checks: [{ id: "trusted-device" }]
    };

    expect(normalize()).toBe("");
    expect(cardSearchText(card, ctx)).toContain("收款确认");
    expect(cardSearchText(card, ctx)).toContain("projectionPending");

    const workspaceText = workspaceSearchText({
      id: "W-FINANCE",
      domain: "finance",
      title: { "zh-CN": "财务办理" },
      summary: { "zh-CN": "只读搜索入口" },
      next: { "zh-CN": "进入办理面" },
      cards: [card]
    }, ctx);

    expect(workspaceText).toContain("W-FINANCE");
    expect(workspaceText).not.toContain("direct_db_written");
  });

  it("uses explicit local list adapters when the surface provides one", () => {
    const ctx = createSurfaceCtx();
    ctx.localList = (items) => items.map((item) => `term:${item.id}`).join("|");

    const text = cardSearchText({
      id: "roomReadiness",
      title: { "zh-CN": "房态检查" },
      fields: {
        business: [{ id: "roomId" }],
        system: [],
        analytics: []
      },
      evidence: [{ id: "completion-photo" }],
      checks: []
    }, ctx);

    expect(text).toContain("term:roomId");
    expect(text).toContain("term:completion-photo");
  });

  it("renders feedback messages as collaboration records, not business facts", () => {
    const ctx = createSurfaceCtx({
      view: "feedback",
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm",
      selectedWorkItemId: "wi-dorm-room-setup",
      feedbackMessage: { status: "localPending", message: "本地排队" }
    });
    localStorage.setItem(feedbackStorageKey(ctx.state.currentActor), JSON.stringify([
      {
        messageId: "fb-1",
        recipientId: "businessOwner",
        recipientAccount: "<owner>",
        topic: "businessFlow",
        body: "不能写业务事实 <script>",
        status: "sent",
        sentAt: "2026-06-07T00:00:00Z"
      },
      {
        messageId: "fb-2",
        recipientId: "missing",
        recipientAccount: "",
        topic: "missing-topic",
        body: "草稿",
        status: "unknown",
        createdAt: "2026-06-07T00:01:00Z"
      }
    ]));

    const html = feedbackView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-boundary-rule="collaboration-message-does-not-write-business-facts"');
    expect(html).toContain("localPending");
    expect(html).toContain("&lt;owner&gt;");
    expect(html).toContain("不能写业务事实 &lt;script&gt;");
    expect(text).toContain("新建房间和床位");
    expect(text).toContain("填写房间信息");
  });

  it("keeps feedback context safe when no workspace, card, role, or messages exist", () => {
    const ctx = createSurfaceCtx({
      view: "unknownInternalView",
      currentActor: { role: "", token: "operator-token" },
      selectedWorkspace: "",
      selectedCardId: "",
      selectedWorkItemId: "",
      runtimeStore: { workspaces: [] }
    });

    const text = visibleText(feedbackView(ctx));

    expect(text).toContain(ctx.tr("feedbackContextReady"));
    expect(text).toContain(ctx.tr("noRuntimeItems"));
    expect(text).toContain(ctx.tr("feedbackNoMessages"));
  });
});
