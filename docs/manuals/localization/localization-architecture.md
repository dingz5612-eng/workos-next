# Localization Architecture

## 语言权威

- `zh-CN` 是 canonical copy authority。
- `ru-RU` 是 supported language，必须与 `zh-CN` 保持 key coverage。
- `ky-KG` 当前是 pilot language，通过 canonical fallback 展示；未完成 full copy coverage gate 前不得标记为 supported。

## Copy 来源

移动端 copy 由以下文件组合：

```text
apps/mobile/src/i18n/shellCopy.js
apps/mobile/src/i18n/domainCopy.js
apps/mobile/src/i18n/coachCopy.js
apps/mobile/src/i18n/operationCopy.js
apps/mobile/src/i18n.js
```

`i18n.js` 只是 composition manifest，不拥有业务事实、DomainEvent、流程或 runtime contract。

## Runtime fallback

`tr()` 和 `ctx.tr()` 对未知语言必须 fallback 到 `zh-CN`。URL `lang` 只接受 `zh-CN`、`ru-RU`、`ky-KG`；非法值回退到 `zh-CN`。

Runtime payload、搜索词、业务备注、错误 reason、tenant/workspace/card 文案进入 DOM 前必须经过 HTML escape。i18n fallback 只能返回安全的 canonical copy，不得把 raw server payload、raw i18n key 或 `[object Object]` 作为用户可见文案。

## 业务术语

业务术语以 `zh-CN` 为 canonical。`ru-RU` 使用 `termDictionary.js` 与 i18n copy 显示。`ky-KG` 作为 pilot 可回退到 `zh-CN`，不得声明 full supported。

## 禁止项

- 用户可见 DOM 不得显示 raw i18n key。
- Search 不得显示 `[object Object]`。
- 用户输入、runtime reason 和 API 错误不得绕过 `escapeHtml` / `escapeAttr` 进入 DOM。
- 手册、PR 和 UI copy 不得暗示 Dormitory L2 Production、Business Production 或 Day-2 started。
- Localization 不得成为业务事实源。
