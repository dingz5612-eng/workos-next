import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { fieldControlKind, optionsForField } from "../controls/fieldControls.js";
import {
  bedLayoutPreviewValue,
  canonicalTaskFieldId,
  operationFieldId,
  preferredTaskFieldIds,
  taskDisplayLabel,
  taskDisplayValue,
  taskValueByFieldId
} from "../operationFieldKernel.js";

const zhCtx = {
  state: { lang: "zh-CN" },
  tr: (key) => ({
    bedTypeTemplateLabel: "床铺生成方式",
    bedLayoutPreviewLabel: "将生成的床位"
  }[key] || key)
};

describe("Operation field kernel contract", () => {
  it("owns operation field identity for multilingual and business aliases", () => {
    expect(operationFieldId({ id: "床位标签" })).toBe("bedLabels");
    expect(operationFieldId({ label: { "zh-CN": "押金截止时间" } })).toBe("depositDueAt");
    expect(operationFieldId({ id: "联系方式" })).toBe("phone");
  });

  it("keeps lead reservation submit fields aligned with backend canonical ids", () => {
    expect(operationFieldId({ id: "leadName", label: { "zh-CN": "线索姓名" } })).toBe("leadName");
    expect(operationFieldId({ id: "stayDurationText", label: { "zh-CN": "住宿时长" } })).toBe("stayDurationText");
    expect(operationFieldId({ label: { "zh-CN": "需要床位数" } })).toBe("requestedBedCount");
    expect(operationFieldId({ id: "guestName", label: { "zh-CN": "姓名" } })).toBe("guestName");

    expect(canonicalTaskFieldId({ id: "leadName", label: { "zh-CN": "线索姓名" } })).toBe("leadName");
    expect(preferredTaskFieldIds("leadCapture")).toEqual(["leadName", "phone", "requestedBedCount", "stayDurationText"]);
    expect(taskValueByFieldId({ leadName: "DING" }, "leadName", null, zhCtx)).toBe("DING");
  });

  it("normalizes scenario 6 payment evidence labels to runtime field keys", () => {
    expect(operationFieldId({ id: "对应收款项目" })).toBe("paymentItem");
    expect(operationFieldId({ id: "收款项目" })).toBe("paymentItem");
    expect(operationFieldId({ id: "是否分笔" })).toBe("splitPayment");
    expect(operationFieldId({ id: "是否需要押金" })).toBe("depositRequired");
    expect(operationFieldId({ id: "是否需要担保" })).toBe("guaranteeRequired");
    expect(operationFieldId({ id: "实收金额" })).toBe("receivedAmount");
    expect(operationFieldId({ id: "收款方式" })).toBe("paymentMethod");
    expect(operationFieldId({ id: "收款时间" })).toBe("paymentTime");
    expect(operationFieldId({ id: "付款人" })).toBe("payerName");
    expect(operationFieldId({ id: "押金金额" })).toBe("depositAmount");
    expect(operationFieldId({ id: "押金" })).toBe("depositOption");
    expect(operationFieldId({ id: "押金方式" })).toBe("depositMethod");
    expect(operationFieldId({ id: "担保" })).toBe("guaranteeOption");
    expect(operationFieldId({ id: "预授权" })).toBe("preAuthorizationOption");
    expect(operationFieldId({ id: "担保人/担保方式" })).toBe("guaranteeMethod");
    expect(operationFieldId({ id: "担保有效期" })).toBe("guaranteeValidUntil");
    expect(operationFieldId({ id: "确认" })).toBe("financeConfirm");
    expect(operationFieldId({ id: "退回补证" })).toBe("financeReturnForEvidence");
    expect(operationFieldId({ id: "部分确认" })).toBe("financePartialConfirm");
    expect(operationFieldId({ id: "标记异常" })).toBe("financeMarkException");
    expect(operationFieldId({ id: "退回原因" })).toBe("financeReturnReason");
    expect(operationFieldId({ id: "确认备注" })).toBe("确认备注");
  });

  it("keeps current scenario 7 generated identity field ids instead of non-current identity aliases", () => {
    expect(operationFieldId({ id: "证件类型", label: { "zh-CN": "证件类型" } })).toBe("证件类型");
    expect(operationFieldId({ id: "紧急联系人", label: { "zh-CN": "紧急联系人" } })).toBe("紧急联系人");
    expect(operationFieldId({ id: "identityType" })).toBe("identityType");
    expect(operationFieldId({ id: "emergencyContactName" })).toBe("emergencyContactName");
  });

  it("renders lead reservation branch action as a stable option set even when backend ui metadata is missing", () => {
    const field = { id: "reservationNextAction", label: { "zh-CN": "预订后动作" }, ui: {} };

    expect(fieldControlKind(field)).toBe("select");
    expect(optionsForField(field, "zh-CN")).toEqual([
      { value: "convert", label: "继续转入住" },
      { value: "cancel", label: "取消并释放预留" }
    ]);
  });

  it("renders bed generation mode as the shared bunk option set when backend ui metadata is missing", () => {
    const field = { id: "bedType", label: { "zh-CN": "床位类型" }, type: "text", ui: {} };

    expect(fieldControlKind(field)).toBe("select");
    expect(optionsForField(field, "zh-CN")).toEqual([
      { value: "bunk_pair", label: "上下铺：两上两下" },
      { value: "upper", label: "全部上铺" },
      { value: "lower", label: "全部下铺" },
      { value: "whole", label: "全部平铺" }
    ]);
  });

  it("normalizes capacity into bedCount for task overview continuity", () => {
    const field = { id: "capacity", label: { "zh-CN": "容量" } };

    expect(canonicalTaskFieldId(field)).toBe("bedCount");
    expect(taskValueByFieldId({ capacity: "4" }, "bedCount", field, zhCtx)).toBe("4");
  });

  it("renders bed setup previews from bed count and generation method", () => {
    const bedTypeField = {
      id: "bedType",
      label: { "zh-CN": "床型模板" },
      ui: { control: "select", optionSet: "bunkType" }
    };
    const card = { id: "cert.bedSetupConfirm" };

    expect(taskDisplayLabel(bedTypeField, "bedType", card, zhCtx)).toBe("床铺生成方式");
    expect(taskDisplayValue(bedTypeField, "bedType", "bunk_pair", zhCtx)).toBe("上下铺：两上两下");
    expect(bedLayoutPreviewValue("4", "bunk_pair", zhCtx)).toContain("01 · 上铺");
    expect(bedLayoutPreviewValue("4", "bunk_pair", zhCtx)).toContain("04 · 下铺");
    expect(preferredTaskFieldIds("cert.bedSetupConfirm")).toEqual([
      "bedCount",
      "bedLabels",
      "bedRemark",
      "specialNotes",
      "bedType",
      "bedEnabledStatus",
      "bedTypeBatchSetting",
      "bedSetRef",
      "bedRef[01..N]",
      "bedNo[01..N]",
      "bedLayout[01..N]",
      "bedSetVersion",
      "bedCountMatchedFlag"
    ]);
  });

  it("keeps controllers and views from copying private field rules", () => {
    const controller = fs.readFileSync(new URL("../operationController.js", import.meta.url), "utf8");
    const workspace = fs.readFileSync(new URL("../views/workspaceView.js", import.meta.url), "utf8");
    const fieldSourceRenderer = fs.readFileSync(new URL("../fieldSourceRenderer.js", import.meta.url), "utf8");
    const components = fs.readFileSync(new URL("../views/experienceComponents.js", import.meta.url), "utf8");

    expect(controller).toContain('from "./operationFieldKernel.js"');
    expect(controller).not.toContain('from "./views/workspaceView.js"');
    expect(workspace).toContain('from "../operationFieldKernel.js"');
    expect(workspace).toContain('from "../fieldSourceRenderer.js"');
    expect(workspace).not.toContain("export function operationFieldId(field)");
    expect(workspace).not.toContain("function operationFieldState");
    expect(workspace).not.toContain("function carriedForwardValue");
    expect(fieldSourceRenderer).toContain("export function fieldSourceState");
    expect(fieldSourceRenderer).toContain("export function operationFieldRequired");
    expect(fieldSourceRenderer).toContain("carriedFieldFromCurrentWorkItemPayload");
    expect(components).toContain('from "../operationFieldKernel.js"');
    expect(components).not.toContain("const taskValueAliases");
    expect(components).not.toContain("function canonicalTaskFieldId");
    expect(components).not.toContain("function taskDisplayValue");
  });
});
