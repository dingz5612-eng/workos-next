import { describe, expect, it } from "vitest";
import { renderSurface, visibleText } from "./surfaceContractTestHelpers.js";

describe("mobile onboarding guide contract", () => {
  it("renders clear guide copy in all supported languages", () => {
    const zh = visibleText(renderSurface("onboarding", { lang: "zh-CN" }));
    const ru = visibleText(renderSurface("onboarding", { lang: "ru-RU" }));
    const ky = visibleText(renderSurface("onboarding", { lang: "ky-KG" }));

    expect(zh).toContain("今天看判断，搜索找对象，工作接派单");
    expect(zh).toContain("只处理系统派给你的任务");
    expect(ru).toContain("Сегодня — для решения");
    expect(ru).toContain("Только назначенные вам задачи");
    expect(ky).toContain("Бүгүн — чечим үчүн");
    expect(ky).toContain("Сизге дайындалган тапшырмалар гана");
    expect(ky).not.toContain("Сначала решение");
  });

  it("keeps guide steps informational until onboarding is completed", () => {
    const html = renderSurface("onboarding", { lang: "zh-CN" });

    expect(html).toContain('<article class="mode-card">');
    expect(html).not.toContain('class="mode-card" data-view=');
    expect(html).toContain('id="start"');
  });
});
