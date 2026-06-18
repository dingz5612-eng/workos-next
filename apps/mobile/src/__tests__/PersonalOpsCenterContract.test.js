import { describe, expect, it } from "vitest";
import { renderSurface, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C Personal Ops Center contract", () => {
  it("renders Me as a localized Personal Ops Center with learning and device entries", () => {
    const html = renderSurface("me");

    expect(html).toContain("个人运营中心");
    expect(html).toContain("学习中心");
    expect(html).toContain("我的权限");
    expect(html).toContain("最近提交");
    expect(html).toContain("最近轨迹");
    expect(html).toContain("设备可信状态");
    expect(html).toContain("材料上传");
    expect(html).toContain("提交队列");
    expect(html).toContain("当前设备");
    expect(visibleText(html)).not.toContain("PersonalOpsCenter");
    expect(visibleText(html)).not.toMatch(/\b(deviceId|trustState|surface)\b/);
  });
});
