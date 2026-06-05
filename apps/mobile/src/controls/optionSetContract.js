const optionValueLabels = {
  roomType: {
    single: "单人间",
    double: "双人间",
    four_bed: "四人间",
    six_bed: "六人间"
  },
  genderPolicy: {
    male: "男生房",
    female: "女生房",
    mixed: "混住",
    unrestricted: "未限制"
  },
  furnitureStatus: {
    complete: "家具齐全",
    partial: "部分缺失",
    missing: "缺失",
    pending: "待配置"
  },
  technicalState: {
    ready: "可入住",
    not_ready: "未准备",
    repair: "需维修",
    repair_required: "需维修"
  },
  bunkType: {
    bunk_pair: "上下铺：两上两下",
    upper: "全部上铺",
    lower: "全部下铺",
    whole: "全部平铺"
  },
  gender: {
    male: "男",
    female: "女",
    unspecified: "未说明"
  }
};

const preferredDefaults = {
  bunkType: "bunk_pair"
};

export function canonicalOptionLabels(optionSet) {
  return optionValueLabels[optionSet] || null;
}

export function canonicalLabelForOptionValue(optionSet, value) {
  return canonicalOptionLabels(optionSet)?.[value] || "";
}

export function preferredOptionSetDefault(optionSet) {
  return preferredDefaults[optionSet] || "";
}

export function normalizeOptionSetValue(optionSet, value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const canonical = canonicalOptionLabels(optionSet);
  if (!canonical) return text;
  if (canonical[text]) return text;
  const match = Object.entries(canonical).find(([, label]) => label === text);
  return match?.[0] || text;
}
