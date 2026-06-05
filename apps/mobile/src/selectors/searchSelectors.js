import { selectSearchSurfaceResults } from "./surfaceSelectors.js";
import { businessAnchorText } from "../businessAnchorKernel.js";

export function normalize(value) {
  return String(value || "").toLocaleLowerCase();
}

export function searchWorkspaceResults(state, ctx) {
  return selectSearchSurfaceResults(state, state.query).filter(Boolean);
}

export function workspaceSearchText(item, ctx) {
  return [
    item.id,
    ctx.tr(item.domain),
    ctx.tx(item.title),
    ctx.tx(item.summary),
    ctx.tx(item.next),
    businessAnchorText(item, ctx),
    item.cards.map((card) => cardSearchText(card, ctx)).join(" ")
  ].join(" ");
}

export function cardSearchText(card, ctx) {
  return [
    card.id,
    ctx.tx(card.title),
    localList(card.fields.business, ctx),
    localList(card.evidence, ctx),
    localList(card.checks, ctx),
    localList(card.fields.system, ctx),
    localList(card.fields.analytics, ctx)
  ].join(" ");
}

function localList(items = [], ctx = {}) {
  if (ctx.localList) return ctx.localList(items);
  return (items || []).map((item) => ctx.localTerm ? ctx.localTerm(item) : item?.label?.["zh-CN"] || item?.id || "").filter(Boolean).join(" · ");
}
