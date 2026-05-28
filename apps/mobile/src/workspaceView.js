export function isCardActionDisabled(card) {
  return ["notStarted", "done"].includes(card.status);
}

export function activeWorkspaceCard(item, selectedCardIndex) {
  const defaultIndex = item.cards.findIndex((card) => ["ready", "blocked", "inProgress"].includes(card.status));
  const activeIndex = Number.isInteger(selectedCardIndex) && selectedCardIndex >= 0 ? selectedCardIndex : defaultIndex;
  return item.cards[activeIndex >= 0 ? activeIndex : 0] || item.cards[0];
}
