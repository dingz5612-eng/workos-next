export function updateLearningQuery(value, ctx) {
  ctx.state.learningQuery = value;
}

export function runLearningSearch(ctx) {
  ctx.state.learningQuery = document.querySelector("#learningQuery")?.value || "";
  ctx.render(true);
}

export function setLearningDomain(value, ctx) {
  ctx.state.learningDomain = value;
  ctx.render();
}

export function setLearningType(value, ctx) {
  ctx.state.learningType = value;
  ctx.render();
}

export function setCoachStage(flow, stage, ctx) {
  ctx.state.coachFlow = flow;
  ctx.state.coachStage = Number(stage) || 0;
  ctx.render();
}
