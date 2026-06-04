const scopedServiceCards = new Set(["serviceTaskCreate", "roomReleaseAfterService"]);

export function isScopedResourceFieldRequired(cardId = "", fieldId = "", values = {}, fallbackRequired = false) {
  if (!scopedServiceCards.has(cardId)) return fallbackRequired;
  const scope = values.resourceScope || "";
  if (fieldId === "resourceScope") return true;
  if (fieldId === "roomId") return scope === "room" || scope === "room_beds";
  if (fieldId === "bedId") return scope === "bed";
  return fallbackRequired;
}

export function isScopedResourceFieldVisible(cardId = "", fieldId = "", values = {}, fallbackVisible = true) {
  if (!scopedServiceCards.has(cardId)) return fallbackVisible;
  const scope = values.resourceScope || "";
  if (fieldId === "roomId") return scope === "room" || scope === "room_beds";
  if (fieldId === "bedId") return scope === "bed";
  return fallbackVisible;
}
