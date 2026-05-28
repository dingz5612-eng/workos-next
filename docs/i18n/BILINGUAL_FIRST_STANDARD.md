# Bilingual First Standard

Supported V1.0 languages:

- `zh-CN`
- `ru-RU`

## Rules

- No user-visible copy should be hardcoded without an i18n key or translation entry.
- Business states must be stored as codes.
- Error responses should return stable codes.
- Mobile UI resolves codes into the active language.
- AI output must follow the user's active language.
- Audit display text must be translated from stored codes.

## Required Coverage

- Page titles.
- Buttons.
- Field labels.
- Empty states.
- Error messages.
- Task names.
- State labels.
- Journey labels.
- Confirmation summaries.
- Help content.
- Feedback labels.
- Notification labels.
- Search result groups.
- Metric labels.

