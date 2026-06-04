const searchIntents = {
  accommodationResourceSetup: {
    intentId: "accommodationResourceSetup",
    commandId: "startOperationsResourceSetup",
    templateWorkspaceId: "W-STAY-RESOURCE",
    firstCardId: "roomSetup",
    title: {
      "zh-CN": "新增住宿房源",
      "ru-RU": "Добавить комнату",
      "ky-KG": "Бөлмө кошуу"
    },
    suggestionGroups: ["frequent", "team"],
    terms: [
      "新增住宿房源",
      "新增房源",
      "添加房源",
      "创建住宿资源",
      "新增住宿资源",
      "住宿资源建档",
      "房源建档",
      "宿舍建档",
      "房间建档",
      "创建房间",
      "新增房间",
      "新建房间",
      "配置房间",
      "宿舍房间",
      "住宿房源",
      "住宿资源",
      "房源",
      "房间",
      "房号",
      "床位",
      "资源建档",
      "room setup",
      "create room",
      "add room",
      "new room",
      "add accommodation resource",
      "xinzengfangyuan",
      "xinzeng fangyuan",
      "chuangjianfangjian",
      "chuangjian fangjian",
      "добавить комнату",
      "создать комнату",
      "комната",
      "койки",
      "бөлмө",
      "койка"
    ]
  }
};

export function searchIntentTerms(intentId) {
  return searchIntents[intentId]?.terms || [];
}

export function accommodationResourceSetupIntent() {
  return searchIntents.accommodationResourceSetup;
}

export function searchIntentSuggestions(language = "zh-CN") {
  return Object.values(searchIntents).map((intent) => ({
    intentId: intent.intentId,
    label: intent.title?.[language] || intent.title?.["zh-CN"] || intent.terms[0],
    query: intent.terms[0],
    commandId: intent.commandId,
    templateWorkspaceId: intent.templateWorkspaceId,
    firstCardId: intent.firstCardId,
    suggestionGroups: intent.suggestionGroups || []
  }));
}

export function resolveSearchIntentId(query = "") {
  return Object.keys(searchIntents).find((intentId) => matchesSearchIntent(intentId, query)) || "unmatched";
}

export function isAccommodationResourceSetupQuery(query = "") {
  return matchesSearchIntent("accommodationResourceSetup", query);
}

export function matchesSearchIntent(intentId, query = "") {
  const normalized = normalizeSearchText(query);
  if (!normalized) return false;
  return searchIntentTerms(intentId).some((term) => {
    const candidate = normalizeSearchText(term);
    return candidate && normalized.includes(candidate);
  });
}

export function normalizeSearchText(value = "") {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[，。；、,.!?！？:：;；/\\|()[\]{}"'`~]/g, " ")
    .replace(/\s+/g, " ");
}
