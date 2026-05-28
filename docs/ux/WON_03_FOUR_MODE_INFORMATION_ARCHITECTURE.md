# WON-03 Four Mode Information Architecture

## Goal

Move the prototype from four ordinary pages into four working modes:

- Home: today mode.
- Search: active intent mode.
- Workbench: passive queue mode.
- Me: personal mode.

## Replaced

- Home no longer shows business lists or recent objects.
- Search no longer defaults to object/task database-style groups.
- Workbench no longer gives equal space to filters and advanced filters before tasks.
- Help remains contextual and personal, not a bottom navigation tab.

## Home

Home answers only one question:

```text
What should I handle first today?
```

It contains:

- One daily command card.
- Three small metrics.
- One next urgent task.

## Search

Search is an active business entry.

Default state shows scenario groups:

- Accommodation.
- Repair.
- Finance.

After input or scenario click, search shows:

- Best next step.
- Runnable tasks.
- Related objects.
- Help explanation.

## Workbench

Workbench is a passive task queue.

It contains:

- Queue count.
- Compact business filters with count badges.
- Compact task-state filters with count badges.
- Sort row.
- Advanced filter bottom sheet.
- Task cards visible on the first screen.

## Me

Me owns personal and supporting capabilities:

- Account and role.
- Statistics.
- Notes.
- Reminders.
- Feedback.
- Tutorial replay.
- Common searches.
- Saved filters.

## Hidden Architecture Centers

The UI stays simple, but V1 architecture keeps room for:

- Task Center.
- Object Center.
- Exception Center.
- Draft Center.
- Evidence Center.
- Personal Center.

Final UX verdict for this package:

```text
WON_03_FOUR_MODE_IA_READY_FOR_USER_REVIEW
```
