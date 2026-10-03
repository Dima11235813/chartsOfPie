---
name: proj-mgmt
description: How to create and update epics, features, stories, tasks, bugs and research notes in proj-mgmt/. Use whenever planning work, logging a bug, or changing the status of any work item.
---

# Project management conventions

All work items are Markdown files with YAML front-matter under `proj-mgmt/`:

| Type     | Folder                                                                              | ID format | Parent   |
| -------- | ----------------------------------------------------------------------------------- | --------- | -------- |
| Epic     | `proj-mgmt/epics/`                                                                  | `E01`     | —        |
| Feature  | `proj-mgmt/features/`                                                               | `F01.2`   | epic     |
| Story    | `proj-mgmt/stories/`                                                                | `S01.2.3` | feature  |
| Task     | inside the story (checklist `T1`, `T2`…) or `proj-mgmt/tasks/T-xxx-*.md` when large | `T-001`   | story    |
| Bug      | `proj-mgmt/bugs/`                                                                   | `B-001`   | optional |
| Research | `proj-mgmt/research/`                                                               | `R-001`   | optional |

File name: `<ID>-<kebab-title>.md`, e.g. `S02.1.1-select-scale.md`.

## Steps

1. Pick the next free ID: `ls proj-mgmt/<folder>/ | sort` and increment.
2. Copy the matching template from `proj-mgmt/templates/` and fill every field.
3. Front-matter `status` is one of `backlog | ready | in-progress | review | done | wont-do`.
   Bugs also carry `severity: low | medium | high | critical`.
4. Link parents and children both ways (`parent:` in front-matter, a children list in the parent).
5. Update `proj-mgmt/BOARD.md` (status table) in the same commit. Update `ROADMAP.md` only when
   scope or sequencing changes.
6. When closing a story, tick its tasks, set `status: done`, and reference the commit or PR.
