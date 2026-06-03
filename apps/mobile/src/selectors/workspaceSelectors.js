import { i18n } from "../i18n.js";
import { selectRuntimeWorkspaces, selectWorkbenchQueue, selectWorkspaceById } from "./surfaceSelectors.js";
import { translateTerm } from "../termDictionary.js";

export const terminalCardStatuses = new Set(["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"]);

export function isTerminalCardStatus(status) {
  return terminalCardStatuses.has(String(status || ""));
}

export function tr(state, key) {
  return i18n[state.lang][key] || key;
}

export function tx(state, value) {
  if (value == null) return "";
  if (typeof value === "string") return translateTerm(value, state.lang);
  return translateTerm(value[state.lang] || value["zh-CN"] || value["ru-RU"] || "", state.lang);
}

export function txFor(value, lang) {
  if (value == null) return "";
  return typeof value === "string"
    ? translateTerm(value, lang)
    : translateTerm(value[lang] || value["zh-CN"] || value["ru-RU"] || "", lang);
}

export function localTerm(state, value, lang = state.lang) {
  if (value && typeof value === "object") {
    if (value.eventType) return value.eventType;
    return txFor(value.label || value.title || value, lang);
  }
  return translateTerm(value, lang);
}

export function localList(state, items) {
  return items.map((item) => localTerm(state, item)).join(" · ");
}

export function task(state) {
  return selectWorkbenchQueue(state).find((item) => item.queueItemId === state.selectedTask || item.id === state.selectedTask) || selectWorkbenchQueue(state)[0];
}

export function workspace(state) {
  return selectWorkspaceById(state, state.selectedWorkspace) || selectRuntimeWorkspaces(state)[0];
}

export function activeWorkspaceCard(item, selectedCardIndex, selectedCardId = "") {
  if (selectedCardId) {
    const selected = item.cards.find((card) => card.id === selectedCardId);
    if (selected) return selected;
  }
  const defaultIndex = item.cards.findIndex((card) => ["ready", "blocked", "inProgress"].includes(card.status));
  const activeIndex = Number.isInteger(selectedCardIndex) && selectedCardIndex >= 0 ? selectedCardIndex : defaultIndex;
  return item.cards[activeIndex >= 0 ? activeIndex : 0] || item.cards[0];
}

export function isCardActionDisabled(card) {
  return card.status === "notStarted" || isTerminalCardStatus(card.status);
}

export function activeCardForWorkspace(item) {
  return item.cards.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || item.cards[0];
}

export function metric(value, label, ctx) {
  return `<article><span>${ctx.tr(label)}</span><strong>${value}</strong></article>`;
}
