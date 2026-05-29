import { selectSearchSurfaceResults } from "./surfaceSelectors.js";

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
    item.cards.map((card) => cardSearchText(card, ctx)).join(" ")
  ].join(" ");
}

export function cardSearchText(card, ctx) {
  return [
    card.id,
    ctx.tx(card.title),
    ctx.localList(card.fields.business),
    ctx.localList(card.evidence),
    ctx.localList(card.checks),
    ctx.localList(card.fields.system),
    ctx.localList(card.fields.analytics)
  ].join(" ");
}
