import { translateTerm } from "./termDictionary.js";

const optionSets = {
  roomType: ["单人间", "双人间", "四人间", "六人间"],
  bunkType: ["下铺", "上铺", "整床"],
  activationScope: ["当前床位", "当前房间全部床位"],
  availability: ["可分配", "暂不开放", "仅内部预留"],
  maintenance: ["检查通过", "待保洁", "待维修"],
  paymentStatus: ["已到账", "未到账", "金额不一致"],
  approvalDecision: ["通过", "退回补充", "需主管复核"],
  currency: ["KGS", "RUB", "USD"],
  paymentMethod: ["现金", "银行转账", "POS"],
  priority: ["高", "中", "低"],
  genericConfirm: ["已确认", "待补充", "需要人工确认"],
  approvedApplicationCandidates: ["APP-2026-009 / 张三", "APP-2026-010 / Fleet Partner 01", "新审批申请"],
  roomBedCandidates: ["A301 / A301-02", "A302 / A302-01", "B201 / B201-03"],
  customerCandidates: ["张三汽修客户", "Fleet Partner 01", "新客户"],
  vehicleCandidates: ["Toyota Camry · 01KG123ABC", "Mercedes Sprinter · 01KG777", "新车辆"],
  technicianCandidates: ["Алексей Смирнов", "Иван Орлов", "维修主管分配"],
  workbayCandidates: ["2 号位", "1 号位", "等待空位"]
};

const defaults = {
  入住人: "张三",
  房型: "四人间",
  容量: "4",
  "上/下铺": "下铺",
  启用范围: "当前床位",
  可分配时间: "2026-05-29T10:00",
  启用备注: "检查通过，可进入分配池",
  房间床位: "A301 / A301-02",
  押金金额: "3000",
  币种: "KGS",
  付款方式: "现金",
  凭证编号: "DEP-009",
  技师: "Алексей Смирнов",
  工位: "2 号位",
  预计开始时间: "2026-05-29T16:30",
  到场时间: "2026-05-29T15:40",
  车辆状态: "已到场，待诊断",
  接车人: "维修主管"
};

const controlByType = {
  select: "select",
  searchSelect: "searchSelect",
  money: "number",
  evidenceUpload: "evidence",
  confirmation: "select",
  readonly: "readonly",
  dateTime: "dateTime",
  text: "text"
};

export function localizedText(zhCn) {
  return {
    "zh-CN": zhCn,
    "ru-RU": translateTerm(zhCn, "ru-RU")
  };
}

export function fieldMetadata(label, type, source) {
  const optionSet = optionSetForLabel(label);
  const control = controlForLabel(label, type, source);
  return {
    label: localizedText(label),
    ui: {
      control,
      optionSet,
      options: optionSet ? localizedOptions(optionSets[optionSet]) : [],
      defaultValue: defaults[label] || "",
      derivedFrom: label === "容量" ? "房型" : "",
      readonly: label === "容量" || type === "readonly"
    },
    help: helpText(label, control, optionSet)
  };
}

export function capacityForRoomType(roomType) {
  if (roomType === "单人间") return "1";
  if (roomType === "双人间") return "2";
  if (roomType === "四人间") return "4";
  if (roomType === "六人间") return "6";
  return "";
}

function controlForLabel(label, type, source) {
  if (label === "预计入住/退房" || label === "入住周期") return "dateTimeRange";
  if (label === "容量") return "number";
  if (controlByType[type]) return controlByType[type];
  if (source === "optionSet") return "select";
  if (source === "searchableProjection") return "searchSelect";
  return "text";
}

function optionSetForLabel(label) {
  if (label.includes("房型")) return "roomType";
  if (label.includes("上/下铺")) return "bunkType";
  if (label.includes("启用范围")) return "activationScope";
  if (label.includes("可用状态")) return "availability";
  if (label.includes("维护状态")) return "maintenance";
  if (label.includes("到账状态")) return "paymentStatus";
  if (label.includes("审批意见")) return "approvalDecision";
  if (label.includes("币种")) return "currency";
  if (label.includes("付款方式")) return "paymentMethod";
  if (label.includes("优先级") || label.includes("紧急程度")) return "priority";
  if (label.includes("已审批申请")) return "approvedApplicationCandidates";
  if (label.includes("房间") || label.includes("床位")) return "roomBedCandidates";
  if (label.includes("客户")) return "customerCandidates";
  if (label.includes("车辆")) return "vehicleCandidates";
  if (label.includes("技师")) return "technicianCandidates";
  if (label.includes("工位")) return "workbayCandidates";
  if (["确认", "关闭", "通过", "退回", "需人工沟通", "是否可派工"].some((item) => label.includes(item))) return "genericConfirm";
  return "";
}

function localizedOptions(values) {
  return (values || []).map((value) => ({
    value,
    label: localizedText(value)
  }));
}

function helpText(label, control, optionSet) {
  if (label === "资源启用卡") return localizedText("把已建档且检查通过的床位放入可分配资源池。");
  if (label === "容量") return localizedText("容量由房型自动带出，不需要手填。");
  if (control === "select") return localizedText("从合同给出的业务选项中选择。");
  if (control === "searchSelect") return localizedText("从投影候选对象中搜索选择，不手写对象。");
  if (control === "dateTime" || control === "dateTimeRange") return localizedText("使用日期时间控件，便于后端校验周期冲突。");
  if (control === "number") return localizedText("填写数值，提交后由系统检查规则。");
  if (optionSet) return localizedText("选项由 projection 合同提供。");
  return localizedText("填写当前卡需要的业务信息。");
}
