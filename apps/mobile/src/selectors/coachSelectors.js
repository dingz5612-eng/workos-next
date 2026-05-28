export function learningDomainFilters({ state, tr }) {
  return ["all", "stay", "repair", "finance"].map((key) => {
    const active = state.learningDomain === key ? "active" : "";
    return `<button class="pill ${active}" data-learning-domain="${key}">${tr(key)}</button>`;
  }).join("");
}

export function learningTypeFilters({ state, tr }) {
  return ["coachAll", "coachHowTo", "coachFields", "coachException", "coachConfirm", "coachNext", "coachAi"].map((key) => {
    const active = state.learningType === key ? "active" : "";
    return `<button class="pill ${active}" data-learning-type="${key}">${tr(key)}</button>`;
  }).join("");
}
