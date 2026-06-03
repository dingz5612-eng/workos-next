import { coachCopy } from "./i18n/coachCopy.js";
import { domainCopy } from "./i18n/domainCopy.js";
import { operationCopy } from "./i18n/operationCopy.js";
import { shellCopy } from "./i18n/shellCopy.js";

const languages = ["zh-CN", "ru-RU", "ky-KG"];

export const dynamicProjectionI18nKeys = Object.freeze([
  "checkin",
  "createRoom",
  "createBed",
  "createVehicle",
  "repairInspect",
  "businessFields",
  "systemFields",
  "analyticsFields"
]);

export const i18n = Object.fromEntries(
  languages.map((language) => [
    language,
    {
      ...shellCopy["ru-RU"],
      ...domainCopy["ru-RU"],
      ...coachCopy["ru-RU"],
      ...operationCopy["ru-RU"],
      ...(shellCopy[language] || {}),
      ...(domainCopy[language] || {}),
      ...(coachCopy[language] || {}),
      ...(operationCopy[language] || {})
    }
  ])
);
