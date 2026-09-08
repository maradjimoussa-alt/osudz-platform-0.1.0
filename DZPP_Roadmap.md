# osu!DZ — DZPP Ranking Roadmap

## Purpose

Algeria ranking system called DZ Performance Points (DZPP).

DZPP is osu!DZ's own performance ranking currency. It is not osu! pp, and no osu! global rank, profile pp, or ranked-score value is imported into the ranking system.

Players earn DZPP only through osu!DZ monthly challenges.

---

## The Intended Flow

```
Play / Import Challenge Score
        ↓
Validate Score (phase + timestamp check)
        ↓
Get osu! Performance Value
        ↓
Calculate Completion Points
        ↓
Calculate Qualification Points
        ↓
Challenge Ends
        ↓
Calculate Final Placement + Field Factor
        ↓
Finalize DZPP
        ↓
Store/Fix Historical Result
        ↓
Update Cumulative DZPP Ranking
        ↓
Display on DZ Performance Rankings page
```

---

## Important Working Rules

- Do not change existing challenge, voting, authentication, or phase rules unless the ranking feature strictly requires it.
- Keep self-voting protection unchanged.
- Do not weaken security rules to make testing easier.
- Do not import osu! profile pp or global rank into DZPP.
- Do not implement a second difficulty multiplier if the osu! performance calculation already accounts for map difficulty.
- DZPP earned from a completed challenge must be historically stable/frozen.
- Work in small phases. Complete and verify each phase before starting the next.
- For each implementation phase, add tests before or alongside code changes.
- Before changing code in a new phase, inspect the existing implementation and explain what will be changed.
- Do not modify the production database with synthetic data unless an explicitly approved development/testing fixture is required.

---

## Core DZPP Formula

```
Final DZPP = round(
    osu! Performance Value
  + Completion Points
  + Qualification Points
  + Adjusted Placement Points
)
```

Where:

```
Adjusted Placement Points = Base Placement Points × Field Factor
Field Factor = min(1, Qualified Players / 8)
```

Rounding is applied **once**, to the final total. Per round rather than per total, so the rows on a player's detail panel sum exactly to the total on the leaderboard.

---

## Formula Version History

| Version | Change | Date |
|---------|--------|------|
| 1 | Initial implementation — flat Completion Points (10), flat Qualification Points (25) | 2026-09-05 |
| 2 | Completion Points split into three sub-awards (see Component 2) | 2026-09-08 |

Every frozen `round_dzpp` row carries the `formula_version` it was scored under. Historical rounds are never silently rewritten when a constant changes — a recompute is the only sanctioned way to rescore a past round, and it is audited.

---

## Component 1 — osu! Performance Value

The osu! performance value for the player's imported/submitted score is read directly from the osu! API response (`pp` field on the score object). It is never recalculated here.

- Stored as `challenge_scores.pp` (nullable `numeric(8,2)`).
- `null` when osu! reported no pp — Loved beatmaps, unranked mod combinations.
- A `null` performance value contributes `0` to the total rather than being treated as an error.
- Negative, infinite, or NaN values are treated as absent (`null`).
- The value belongs to the **play**, not the player's profile. No profile total or global rank is ever read.

---

## Component 2 — Completion Points (Formula Version 2)

Completion Points reward participation across three independent sub-awards. A player earns each part separately.

| Sub-award | Condition | Points |
|-----------|-----------|--------|
| Challenge Score | Submitted or imported a score during the challenge phase | +2 |
| Approved Submission | Submitted a beatmap for the round AND it was approved by an admin | +3 |
| Vote | Cast a vote for the round AND still held it when the round ended | +5 |
| **Maximum** | All three | **+10** |

**Rules:**
- `CHALLENGE_SCORE_POINTS = 2` — unconditional for any player with a `challenge_scores` row.
- `SUBMISSION_APPROVED_POINTS = 3` — requires `submissions.status = 'approved'` for this round.
- `VOTE_POINTS = 5` — requires a `votes` row for this round at finalization time. A retracted vote does not count.
- A player receives each sub-award at most once per round. Multiple score attempts cannot multiply any sub-award.
- The maximum total (10) matches the old flat constant, preserving the scale of the formula.

**Previous system (Formula Version 1):** flat `+10` for any valid challenge score.

---

## Component 3 — Qualification Points (Approved, Pending Implementation)

Qualification Points are split into two independent parts, each earned separately.

| Part | Condition | Points |
|------|-----------|--------|
| Mod Compliance | Used the required mod(s) for the round | +10 |
| Requirement Achievement | Won the challenge metric (see table below) | +15 |
| **Maximum** | Both | **+25** |

### Who earns Requirement Achievement (+15)?

| Challenge Type | Who gets +15 |
|---|---|
| Full Combo | Every player who actually FC'd (0 misses) |
| Top #1 Score | The player(s) with the highest eligible score |
| Best Accuracy | The player(s) with the highest eligible accuracy |
| Lowest Miss Count | The player(s) with the lowest eligible miss count |

**Tie rule:** when two or more players share the top metric value, **all of them** receive the +15.

**Placement independence:** Placement Points still require **full qualification** (both mod compliance AND challenge requirement met — the existing `qualified` boolean). Partial qualification earns points but does not unlock placement.

**Previous system (Formula Version 1 & 2):** flat `+25` for full qualification, `+0` otherwise.

> **Status: APPROVED — not yet implemented.** Requires a new formula version bump and updated scoring logic.

---

## Component 4 — Placement Points

Placement Points reward performing better than other **fully qualified** players.

Placement uses the challenge's own ranking rule:
- Best Accuracy challenge → rank by accuracy descending.
- Lowest Miss Count challenge → rank by miss count ascending.
- Top #1 Score / Full Combo → rank by score descending.

Only **fully qualified** players receive Placement Points.

### Base Placement Table

| Placement | Base Points |
|-----------|-------------|
| 1st | 50 |
| 2nd | 40 |
| 3rd | 30 |
| 4th | 25 |
| 5th | 20 |
| 6th | 15 |
| 7th | 10 |
| 8th | 5 |
| 9th+ | 0 |

---

## Field Factor

```
Field Factor = min(1, Qualified Players / 8)
```

| Qualified Players | Field Factor |
|-------------------|--------------|
| 1 | 12.5% |
| 2 | 25% |
| 3 | 37.5% |
| 4 | 50% |
| 5 | 62.5% |
| 6 | 75% |
| 7 | 87.5% |
| 8+ | 100% |

- Applies **only** to Placement Points.
- Completion, Qualification, and Performance are unaffected.
- Every reachable value is an exact eighth — exact in binary floating point, no rounding needed on this term alone.

**Example:** 6 qualified players, 2nd place → `40 × 0.75 = 30`

---

## Score Validity — Challenge Phase Timestamp Rule

A score is only valid if it was **set on or after the moment the challenge phase started** (`winner_approved_at` on the round).

- Scores predating the challenge start are rejected with HTTP 422.
- Scores with no timestamp from osu! are also rejected.
- This is enforced at import time in `POST /api/challenge/scores`.

---

## Score Outcome Matrix (Formula Version 2)

| Situation | Performance | Completion | Qualification | Placement | DZPP |
|-----------|-------------|------------|---------------|-----------|------|
| No challenge score | 0 | 0 | 0 | 0 | 0 |
| Score, no sub-awards | Yes | +2 | +0 | +0 | pp + 2 |
| Score + approved submission | Yes | +5 | +0 | +0 | pp + 5 |
| Score + vote | Yes | +7 | +0 | +0 | pp + 7 |
| Score + both sub-awards | Yes | +10 | +0 | +0 | pp + 10 |
| Qualifies (full), no sub-awards | Yes | +2 | +25 | Yes | pp + 2 + 25 + placement |
| Qualifies (full), all sub-awards | Yes | +10 | +25 | Yes | pp + 10 + 25 + placement |
| Mod only (partial) | Yes | varies | +10 | No | pp + completion + 10 |
| Requirement only (partial) | Yes | varies | +15 | No | pp + completion + 15 |

> Note: Qualification Points column reflects the **approved but not yet implemented** two-part system.

---

## Multiple Attempts

A player may import multiple attempts, but only their **current** score row counts — `challenge_scores` holds one row per player per round (enforced by `challenge_scores_one_per_user_per_round`). A new import overwrites the previous one. Completion Points are awarded once regardless of how many times a player imports.

---

## When DZPP Becomes Final

**During the active challenge:** scores are stored, provisional DZPP is shown on the leaderboard (placement and field factor are approximate).

**When the challenge ends:** `finalizeRound` runs automatically inside the same transaction that closes the round. It:
1. Locks the round row.
2. Queries approved submitters and voters for completion sub-awards.
3. Reads challenge scores in leaderboard order.
4. Scores every play through `scoreRound`.
5. Writes frozen rows to `round_dzpp`.
6. Stamps `dzpp_finalized_at`.

Historical DZPP never changes silently. A recompute (`recomputeRound`) is the only sanctioned way to rescore a past round, requires a reason, and is recorded in `dzpp_recomputes`.

---

## Ranking Eligibility

- Algeria only (`country_code = 'DZ'`).
- Frozen rows are written for **all** players who participated, whatever their country. The Algeria filter lives on the read, so `field_size` and `placement` describe the real field.
- Changing who is displayed never requires a recompute.

---

## Ranking Periods

- **All-Time** (default) — cumulative DZPP from all finalized rounds.
- **Year/Season** — cumulative DZPP for a selected year (e.g. 2026), using `rounds.year`.

---

## Roadmap Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | DZPP Specification | ✅ DONE |
| 2 | Pure Calculation Engine | ✅ DONE |
| 3 | Database + Challenge Integration | ✅ DONE |
| 4 | Ranking API | ✅ DONE |
| 5 | Design (Figma) | ✅ DONE |
| 6 | Frontend Implementation | ✅ DONE |
| 7 | Automation + Admin Safety | ✅ DONE |
| 8 | End-to-End Verification | ✅ DONE |
| 9 | Polish | 🔄 IN PROGRESS |

---

## Phase Details

### Phase 1 — DZPP Specification ✅ DONE
Frozen in `docs/superpowers/specs/2026-09-05-dzpp-design.md`. All rules resolved: performance source, completion, qualification, placement table, tie handling, multiple attempts, finalization trigger, historical storage, Algeria eligibility, rounding.

### Phase 2 — Pure Calculation Engine ✅ DONE
`server/src/repo/dzpp.ts` — pure functions `scoreOne`, `scoreRound`, `fieldFactor`, `basePlacementPoints`, `placementPoints`. 67 tests in `dzpp.test.ts` covering every field size, worked examples, edge cases, and DTO mappers.

### Phase 3 — Database + Challenge Integration ✅ DONE
Migrations 001–012 applied. `round_dzpp` table stores frozen per-player per-round breakdowns. `dzpp_recomputes` audit table. `finalizeRound` and `recomputeRound` transactions. `challenge_scores.pp` persisted from osu! API.

### Phase 4 — Ranking API ✅ DONE
`GET /api/rankings` — paginated, Algeria-only, all-time and year filter. `GET /api/rankings/:userId` — player round history. `RANK()` window function for tied players. `rankingMeta` for pager total and year list in one query.

### Phase 5 — Design ✅ DONE
Figma-based design implemented for the DZ Performance Rankings page, player detail panel, year selector, loading/empty/error states, mobile and desktop layouts.

### Phase 6 — Frontend Implementation ✅ DONE
`RankingsPage.tsx`, `PlayerRankingDetail.tsx` — real API data, all-time/year selectors, DZPP totals, challenge history, loading/error/empty states, mobile responsive.

### Phase 7 — Automation + Admin Safety ✅ DONE
- `freezeEndedRound` called automatically when a round ends (clock or admin).
- Idempotent latch (`dzpp_finalized_at`) prevents double-scoring.
- `recomputeRound` for admin-sanctioned rescoring, scoped to one round, audited.
- Admin recompute UI in `AdminDashboard.tsx`.

### Phase 8 — End-to-End Verification ✅ DONE
`verify-public.mjs` (63 checks, anonymous API contract) and `verify-authenticated.mjs` (authenticated flow including challenge scores, comments, session revocation). All areas covered.

### Phase 9 — Polish 🔄 IN PROGRESS

**Completed in this phase so far:**
- **Completion Points v2** — replaced flat +10 with three sub-awards: +2 (challenge score) + +3 (approved submission) + +5 (vote held at round end). `DZPP_FORMULA_VERSION` bumped to 2. All 154 tests pass.
- **Challenge score timestamp validation** — scores set before `winner_approved_at` are rejected with HTTP 422.

**Pending:**
- Qualification Points two-part system (approved, not yet implemented — see Component 3).
- Performance optimization and query review.
- Accessibility improvements.
- Mobile refinement.
- Better empty/error states.
- Admin/audit polish.
- Documentation updates.

---

## Next Implementation Task — Qualification Points v2

The approved two-part Qualification Points system (Component 3) needs to be implemented as **Formula Version 3**.

### What changes:
1. `QUALIFICATION_POINTS = 25` splits into `MOD_COMPLIANCE_POINTS = 10` and `REQUIREMENT_ACHIEVEMENT_POINTS = 15`.
2. `DzppScoreInput` and `DzppRoundPlay` gain `hadModCompliance: boolean` and `hadRequirementAchievement: boolean`.
3. `scoreOne` computes `qualificationPoints = (hadModCompliance ? 10 : 0) + (hadRequirementAchievement ? 15 : 0)`.
4. `scoreRound` determines `hadModCompliance` per play (already checkable from `mods` + `mod_requirement`).
5. `scoreRound` determines `hadRequirementAchievement` by finding the winner(s) of the metric across the field.
6. Placement still requires full qualification (`qualified` boolean — both mod + challenge requirement met).
7. `DZPP_FORMULA_VERSION` bumps to 3.
8. All tests updated.
