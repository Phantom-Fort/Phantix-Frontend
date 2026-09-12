# Command Centre: VAPT schedules, procedures & settings

**Where:** **VAPT** → `/vapt/schedules` · `/vapt/procedures` · `/vapt/settings`
**What:** The cadence, the rules of engagement, and the engine configuration behind VAPT campaigns.

---

## Process flow

```mermaid
flowchart TD
  A[Procedures & rules] --> B[Schedules]
  B --> C[Campaign runs on cadence]
  C --> D[Findings through verification]
  D --> E[Reassessment]
```

---

## Schedules

| Field | Means |
|-------|-------|
| **Target / scope** | The assets and environments this schedule may touch |
| **Cadence** | How often the campaign repeats |
| **Procedure** | Which rules of engagement apply |
| **Next run** | When the loop fires next |

A schedule without a procedure is a scan without rules — set the procedure first.

---

## Procedures & rules

Procedures are the rules of engagement: what may be tested, what is explicitly
out of scope, and which tests require approval before they run. They are
versioned, so a change to a rule does not retroactively rewrite what a past
campaign was allowed to do.

---

## Engine settings

Engine settings tune the engine's behaviour for your environment — concurrency,
timeouts, and the depth of the assessment. Change them with the same care as a
scope: a longer timeout is harmless, a wider scope is not.

---

## Continuous reassessment

A campaign can be set to reassess continuously, so a fixed issue is re-tested
rather than assumed fixed. Reassessment re-runs the relevant checks and updates
the finding's state; it does not create a duplicate.

---

## Notes

- Continuous / recurring pentest is a Growth capability.
- Starting or changing a campaign is a mutating action — dual control applies.
