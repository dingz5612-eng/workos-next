# WON-02 Task Command Center And Me Navigation

## Goal

Upgrade the Phase 0-1 prototype from a normal mobile app menu into a reusable Work OS reference pattern.

## Decisions

- Bottom navigation is `Home / Search / Workbench / Me`.
- `Help` is removed from primary navigation.
- Help is now shown through contextual cards, search results, and `Me -> Help and feedback`.
- Workbench is not a flat task list. It is a task command center.
- Automotive repair remains a first-class reference domain beside accommodation.
- Deprecated active UI must be deleted when replaced. Do not keep old page variants alive.

## Workbench Model

The workbench has four visible controls:

1. Business domain: all, accommodation, automotive repair, finance, approval.
2. Work context: mine, confirmation, waiting for others, blocked, started by me.
3. Task status: due today, due soon, overdue, high priority, missing evidence.
4. Sorting and advanced filters.

This prevents task volume from becoming a long unstructured list.

## Home Model

Home shows a small command summary:

- The most important task now.
- Intent search.
- Task metrics.
- One important work item per business domain.
- Recent objects.

Home must not duplicate the full workbench.

## Search Model

Search is the active entry.

- Default terms are always visible on the search page.
- Dynamic terms are reserved for user habit ranking.
- Search results open objects or tasks.
- Critical actions still require manual confirmation.
- Search popovers must close when clicking outside or pressing Escape.

## Me Model

`Me` replaces `Help` as the fourth primary tab.

It contains:

- Account and current role.
- Permission scope.
- Task statistics.
- Common searches.
- Saved filters.
- Language preference.
- Help and feedback.

## Visual Standard

- One primary visual focus per screen.
- Unified task cards across accommodation, repair, and finance.
- Less explanatory copy on home; more contextual guidance inside object and task pages.
- No technical labels in user-facing cards.

Final UX verdict for this package:

```text
WON_02_TASK_COMMAND_CENTER_READY_FOR_USER_REVIEW
```
