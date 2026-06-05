import { describe, expect, it } from "vitest";
import { bedLayoutForCount, serializeBedLayout } from "../controls/bedLabelControls.js";

describe("bed layout controls", () => {
  it("expands a four-bed bunk template into two upper and two lower beds", () => {
    const layout = bedLayoutForCount(4, "bunk_pair", "zh-CN");

    expect(layout.map((entry) => `${entry.label}:${entry.type}`)).toEqual([
      "01:upper",
      "02:lower",
      "03:upper",
      "04:lower"
    ]);
    expect(layout.map((entry) => entry.typeLabel)).toEqual(["上铺", "下铺", "上铺", "下铺"]);
    expect(serializeBedLayout(layout)).toBe('[{"label":"01","type":"upper"},{"label":"02","type":"lower"},{"label":"03","type":"upper"},{"label":"04","type":"lower"}]');
  });
});
