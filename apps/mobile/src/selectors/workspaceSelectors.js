import { tasks } from "../demoQueue.js";
import { i18n } from "../i18n.js";
import { translateTerm } from "../termDictionary.js";
import { intentWorkspaces } from "../workspaceProjections.js";

export function tr(state, key) {
  return i18n[state.lang][key] || key;
}

export function tx(state, value) {
  return typeof value === "string" ? value : value[state.lang] || value["zh-CN"];
}

export function txFor(value, lang) {
  return typeof value === "string" ? value : value[lang] || value["zh-CN"];
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
  return tasks.find((item) => item.id === state.selectedTask) || tasks[0];
}

export function workspace(state) {
  return intentWorkspaces.find((item) => item.id === state.selectedWorkspace) || intentWorkspaces[0];
}

export function activeWorkspaceCard(item, selectedCardIndex) {
  const defaultIndex = item.cards.findIndex((card) => ["ready", "blocked", "inProgress"].includes(card.status));
  const activeIndex = Number.isInteger(selectedCardIndex) && selectedCardIndex >= 0 ? selectedCardIndex : defaultIndex;
  return item.cards[activeIndex >= 0 ? activeIndex : 0] || item.cards[0];
}

export function isCardActionDisabled(card) {
  return ["notStarted", "done"].includes(card.status);
}

export function activeCardForWorkspace(item) {
  return item.cards.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || item.cards[0];
}

export function metric(value, label, ctx) {
  return `<article><span>${ctx.tr(label)}</span><strong>${value}</strong></article>`;
}

