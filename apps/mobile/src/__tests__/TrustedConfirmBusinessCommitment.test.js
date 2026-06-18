import { describe, expect, it } from "vitest";
import { TrustedConfirmSheet } from "../views/experienceComponents.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B TrustedConfirm business commitment", () => {
  it("renders concise business impact and rollback guidance without raw ids", () => {
    const ctx = createSurfaceCtx();
    const workspace = ctx.state.runtimeStore.workspaces[0];
    const card = workspace.cards[0];
    const html = TrustedConfirmSheet({ ...ctx.state.runtimeStore.operationWorkItems[0], workspace, card }, card, ctx);
    const text = visibleText(html);

    expect(text).toContain("可信确认");
    expect(text).toContain("提交后如需修改，请走更正或作废流程");
    expect(text).not.toContain("材料与权限");
    expect(text).not.toContain("提交后处理");
    expect(text).not.toMatch(/\b(workItemId|caseId|TrustedConfirmSheet)\b/);
  });

  it("renders TrustedConfirm copy in Russian without Chinese fallback fragments", () => {
    const ctx = createSurfaceCtx({ lang: "ru-RU" });
    const workspace = {
      ...ctx.state.runtimeStore.workspaces[0],
      title: { "zh-CN": "基础就绪", "ru-RU": "Базовая готовность" },
      next: { "zh-CN": "按步骤办理", "ru-RU": "Выполните шаги по порядку" }
    };
    const card = {
      ...workspace.cards[0],
      title: { "zh-CN": "完成基础检查", "ru-RU": "Базовая проверка" }
    };
    const html = TrustedConfirmSheet({
      ...ctx.state.runtimeStore.operationWorkItems[0],
      title: { "zh-CN": "基础就绪", "ru-RU": "Базовая готовность" },
      reason: { "zh-CN": "按步骤办理", "ru-RU": "Выполните шаги по порядку" },
      workspace,
      card
    }, card, ctx);
    const text = visibleText(html);

    expect(text).toContain("Информация перед отправкой");
    expect(text).toContain("Этот шаг отправляет только данные комнаты");
    expect(text).toContain("Не создает финансовых записей напрямую");
    expect(text).toContain("Если нужно изменить данные, откройте исправление или отмену");
    expect(text).not.toMatch(/影响|账务|提交后如需修改|；|。|、|\.\./);
    expect(text).not.toMatch(/runtime|Runtime|Аудит|аудит|трасс|Трасс|откат|компенсац|scope/i);
  });
});
