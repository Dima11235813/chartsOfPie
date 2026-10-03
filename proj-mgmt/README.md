# Project management

Lightweight, file-based planning that lives next to the code so humans and AI agents can read and
update it in the same commit as the work.

```
Epic (E01)            a large outcome, e.g. "Music theory engine"
 └─ Feature (F01.2)   a shippable capability inside the epic
     └─ Story (S01.2.1)   a user-facing slice with acceptance criteria
         └─ Task (T1…)    engineering steps — a checklist inside the story,
                          or proj-mgmt/tasks/T-xxx-*.md when it needs its own page
Bug (B-001)           a defect; links to the story that fixes it
Research (R-001)      investigation notes that feed epics and stories
```

| Folder       | Contents                                                      |
| ------------ | ------------------------------------------------------------- |
| `ROADMAP.md` | Phases, sequencing and the long-term vision                   |
| `BOARD.md`   | Status of every epic, feature, open story and bug at a glance |
| `epics/`     | One file per epic                                             |
| `features/`  | One file per feature (written once an epic is being planned)  |
| `stories/`   | One file per story (written once a feature is `ready`)        |
| `tasks/`     | Stand-alone task files (rare)                                 |
| `bugs/`      | One file per bug                                              |
| `research/`  | Research notes                                                |
| `templates/` | Copy these to create new items                                |

**Statuses:** `backlog → ready → in-progress → review → done` (or `wont-do`).
Bugs add `severity: low | medium | high | critical`.

Epics further out stay coarse (features listed inline in the epic) and are broken down into files
only when they become the next thing to build. Agents: follow `.claude/skills/proj-mgmt/SKILL.md`.
