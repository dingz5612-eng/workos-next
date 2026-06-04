import { describe, expect, it } from "vitest";
import { renderSurface, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B mobile work plane IA", () => {
  it("renders Today and Work as Chinese work-execution IA", () => {
    const text = visibleText(`${renderSurface("home")}\n${renderSurface("workbench")}`);

    for (const label of ["必须做", "即将超时", "缺证据", "等待财务", "刚提交 / 同步中", "风险提醒", "今日必学", "可处理", "有阻断", "等他人处理", "需人工补证", "可转交给同事"]) {
      expect(text).toContain(label);
    }
  });
});
