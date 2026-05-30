import { coachCopy } from "./i18n/coachCopy.js";
import { domainCopy } from "./i18n/domainCopy.js";
import { operationCopy } from "./i18n/operationCopy.js";
import { shellCopy } from "./i18n/shellCopy.js";

const languages = ["zh-CN", "ru-RU"];

export const i18n = Object.fromEntries(
  languages.map((language) => [
    language,
    {
      ...shellCopy[language],
      ...domainCopy[language],
      ...coachCopy[language],
      ...operationCopy[language]
    }
  ])
);
