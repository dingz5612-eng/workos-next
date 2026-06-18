import { capabilityCommandCatalog, isGeneratedObjectSearchQuery } from "./capabilityProjection.js";

const [dormitoryScenario1Command] = capabilityCommandCatalog();

const searchIntents = {
  accommodationResourceSetup: {
    intentId: "accommodationResourceSetup",
    commandId: "startOperationsWorkspace",
    templateWorkspaceId: dormitoryScenario1Command.templateWorkspaceId,
    firstCardId: dormitoryScenario1Command.firstCardId,
    title: dormitoryScenario1Command.title,
    suggestionGroups: ["frequent", "team"],
    terms: dormitoryScenario1Command.keywords
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
  if (isGeneratedObjectSearchQuery(query)) return false;
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
