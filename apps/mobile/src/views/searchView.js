import { searchWorkspaceResults } from "../selectors/searchSelectors.js";
import { intentWorkspaces } from "../workspaceProjections.js";
import { workspaceCard } from "./workspaceView.js";

export function searchView(ctx) {
  const results = searchWorkspaceResults(ctx.state, ctx);
  return ctx.shell(`
    <section class="page-title">
      <span>${ctx.tr("activeSearch")}</span>
      <h1>${ctx.tr("intentMode")}</h1>
    </section>
    <section class="search-box">
      <div class="search-line">
        <input id="query" value="${ctx.escapeAttr(ctx.state.query)}" placeholder="${ctx.tr("searchPlaceholder")}" />
        <button id="searchNow">${ctx.tr("search")}</button>
      </div>
    </section>
    ${ctx.state.query ? searchResultBlocks(results, ctx) : scenarioBlocks(ctx)}
  `);
}

function scenarioBlocks(ctx) {
  return `<section class="scenario-list">
    <h2>${ctx.tr("scenarios")}</h2>
    ${scenario("stay", intentWorkspaces.filter((item) => item.domain === "stay"), ctx)}
    ${scenario("repair", intentWorkspaces.filter((item) => item.domain === "repair"), ctx)}
    ${scenario("finance", intentWorkspaces.filter((item) => item.domain === "finance"), ctx)}
  </section>`;
}

function scenario(domain, workspaces, ctx) {
  return `<article class="scenario-card ${domain}">
    <h3>${ctx.tr(domain)}</h3>
    <div>${workspaces.length ? workspaces.map((item) => `<button data-workspace="${item.id}">${ctx.tx(item.title)}</button>`).join("") : `<button data-workspace="W-STAY-DEPOSIT-EXCEPTION">${ctx.tr("confirmPayment")}</button>`}</div>
  </article>`;
}

function searchResultBlocks(results, ctx) {
  const first = results[0] || intentWorkspaces[0];
  return `
    <section class="result-focus">
      <span>${ctx.tr("bestNext")}</span>
      ${workspaceCard(first, ctx)}
    </section>
    <section class="compact-section">
      <h2>${ctx.tr("intentWorkspace")}</h2>
      ${results.map((item) => workspaceCard(item, ctx)).join("")}
    </section>
    <section class="help-card">
      <span>${ctx.tr("helpExplain")}</span>
      <p>${ctx.tx(first.summary)} ${ctx.tx(first.next)}</p>
    </section>`;
}
