export function fieldControlKind(label, fieldType) {
  if (["房型", "上/下铺", "启用范围", "可用状态", "维护状态", "币种", "付款方式", "到账状态", "审批意见", "通过", "退回", "需人工沟通", "是否可派工"].some((item) => label.includes(item))) return "select";
  if (["预计入住/退房", "入住周期"].some((item) => label.includes(item))) return "dateTimeRange";
  if (["实际入住时间", "预计退房时间", "预计开始时间", "到场时间", "上线时间", "可分配时间"].some((item) => label.includes(item))) return "dateTime";
  if (["容量", "押金金额", "确认金额", "住宿费用", "额外费用", "押金抵扣", "应退/应补", "工时费", "配件费", "其它费用", "里程"].some((item) => label.includes(item))) return "number";
  if (fieldType === "searchSelect") return "searchSelect";
  return "text";
}

export function optionsForLabel(label) {
  if (label.includes("房型")) return ["单人间", "双人间", "四人间", "六人间"];
  if (label.includes("上/下铺")) return ["下铺", "上铺", "整床"];
  if (label.includes("启用范围")) return ["当前床位", "当前房间全部床位"];
  if (label.includes("可用状态")) return ["可分配", "暂不开放", "仅内部预留"];
  if (label.includes("维护状态")) return ["检查通过", "待保洁", "待维修"];
  if (label.includes("到账状态")) return ["已到账", "未到账", "金额不一致"];
  if (label.includes("审批意见")) return ["通过", "退回补充", "需主管复核"];
  if (label.includes("房间") || label.includes("床位")) return ["A301 / A301-02", "A302 / A302-01", "B201 / B201-03"];
  if (label.includes("客户")) return ["张三汽修客户", "Fleet Partner 01", "新客户"];
  if (label.includes("车辆")) return ["Toyota Camry · 01KG123ABC", "Mercedes Sprinter · 01KG777", "新车辆"];
  if (label.includes("技师")) return ["Алексей Смирнов", "Иван Орлов", "维修主管分配"];
  if (label.includes("工位")) return ["2 号位", "1 号位", "等待空位"];
  if (label.includes("币种")) return ["KGS", "RUB", "USD"];
  if (label.includes("付款方式")) return ["现金", "银行转账", "POS"];
  if (label.includes("优先级") || label.includes("紧急程度")) return ["高", "中", "低"];
  return ["已确认", "待补充", "需要人工确认"];
}

export function capacityForRoomType(roomType) {
  if (roomType === "单人间") return "1";
  if (roomType === "双人间") return "2";
  if (roomType === "四人间") return "4";
  if (roomType === "六人间") return "6";
  return "";
}

export function defaultValueForLabel(label) {
  const samples = {
    "入住人": "张三",
    "房型": "四人间",
    "容量": "4",
    "上/下铺": "下铺",
    "启用范围": "当前床位",
    "可分配时间": "2026-05-29T10:00",
    "启用备注": "检查通过，可进入分配池",
    "房间床位": "A301 / A301-02",
    "押金金额": "3000",
    "币种": "KGS",
    "付款方式": "现金",
    "凭证编号": "DEP-009",
    "技师": "Алексей Смирнов",
    "工位": "2 号位",
    "预计开始时间": "2026-05-29T16:30",
    "到场时间": "2026-05-29T15:40",
    "车辆状态": "已到场，待诊断",
    "接车人": "维修主管"
  };
  return samples[label] || "";
}
