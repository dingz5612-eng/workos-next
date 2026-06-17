import { describe, expect, it } from "vitest";
import { renderSurface, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM Surface mobile work plane IA", () => {
  it("renders Today and Work as Chinese work-execution IA", () => {
    const text = visibleText(`${renderSurface("home")}\n${renderSurface("workbench")}`);

    for (const label of ["必须做", "即将超时", "缺材料", "等他人", "等待财务", "刚提交 / 同步中", "风险提醒", "全部工作项", "我的可办", "有阻断", "等他人处理", "可转交", "住宿资源", "入住收款", "押金", "普通收款", "服务任务", "退住", "支出", "周期复盘"]) {
      expect(text).toContain(label);
    }
    expect(text).not.toContain("今日必学");
  });
});
