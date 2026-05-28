import { intentWorkspaces } from "../workspaceProjections.js";

export function normalize(value) {
  return String(value || "").toLocaleLowerCase();
}

export function searchWorkspaceResults(state, ctx) {
  const q = normalize(state.query);
  if (!q) return [];
  const found = intentWorkspaces.filter((item) => normalize(workspaceSearchText(item, ctx)).includes(q));
  if (found.length) return found;
  if (q.includes("房间") || q.includes("床位") || q.includes("комнат") || q.includes("койк")) return [intentWorkspaces.find((item) => item.id === "W-STAY-RESOURCE")];
  if (q.includes("车辆") || q.includes("车牌") || q.includes("vin") || q.includes("авто")) return [intentWorkspaces.find((item) => item.id === "W-REPAIR-MASTER-DATA")];
  if (q.includes("退房") || q.includes("высел")) return [intentWorkspaces.find((item) => item.id === "W-STAY-CHECKOUT")];
  if (q.includes("报修")) return [intentWorkspaces.find((item) => item.id === "W-REPAIR-REQUEST")];
  if (q.includes("维修") || q.includes("派工") || q.includes("ремонт") || q.includes("toyota")) return [intentWorkspaces.find((item) => item.id === "W-REPAIR-DISPATCH")];
  if (q.includes("押金") || q.includes("депозит")) return [intentWorkspaces.find((item) => item.id === "W-STAY-CHECKIN"), intentWorkspaces.find((item) => item.id === "W-STAY-DEPOSIT-EXCEPTION")];
  return intentWorkspaces;
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

