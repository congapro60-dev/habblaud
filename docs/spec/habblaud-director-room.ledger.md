# Ledger: Habblaud Director Room

Spec: `docs/spec/habblaud-director-room.md`
Current brain: Codex Desktop / orchestration session

## Providers (updated 2026-10-19 14:25 local)

| provider | status | evidence | resets |
|---|---|---|---|
| Claude | alive, weekly exhausted | `quota.py --json`: session 91%, weekly 0%; reset 2026-10-21 | 2026-10-21 |
| ChatGPT/Codex | alive | one Plus account session 92% / weekly 34%; another Plus session LIMIT / weekly 7%; Free/Go LIMIT | 2026-10-25 |
| Gemini/Antigravity | alive | two Antigravity connections; 94.79% weekly and 100% model window; account/model-specific | 2026-10-25 / 2026-10-19 |
| 9Router catalog | live | `GET http://127.0.0.1:20128/v1/models` HTTP 200, 91 models; quota/cost unknown | recheck per run |
| OpenCode via 9Router | live | prior `ag/gemini-3.8-flash-high` text canary served expected family; current P1D reviewer wave cancelled after scope change | unknown |

### Route evidence

- `codex exec -m ag/gemini-3.8-flash-high` returned text but served telemetry recorded `gpt-6-luna`; treat as `degraded: served-by-other-model`, not a valid Gemini canary.
- `opencode run -m 9router-local/ag/gemini-3.8-flash-high` returned `OK`; served telemetry recorded `antigravity / gemini-3.8-flash-high`; tools/write capability still task-specific.
- Consumer Antigravity OAuth via 9Router remains `terms_license: conflict`, `data_boundary: account-session`, `status: candidate`; user explicitly authorized this bounded work session. No account rotation.

## Tier → model (this session)

NÃO=`9router-local/ag/gemini-3.8-flash-high` (bounded worker; served identity verified) · SÂU=unassigned · CHỦ LỰC=`9router-local/ag/gemini-3.8-flash-high` · NHẸ=unassigned · UI=unassigned

## Tasks

| id | title | kind | size | risky | model (effort) | status | session id / output file | verified by | notes |
|---|---|---|---|---|---|---|---|---|---|
| P0 | Director Room + WorkOrder journal/API/UI | logic+ui | M | yes | prior local implementation | implemented | prior evidence in spec | pending current full suite | Existing dirty worktree; do not reset. |
| P1A | Router catalog/health cockpit | logic+ui | M | yes | prior local implementation | implemented | prior evidence in spec | pending current full suite | Discovery only. |
| P1B | Route selector + `ROUTE_SELECTED` journal event | logic+ui | M | yes | prior local implementation | implemented | prior evidence in spec | pending current full suite | No worker execution yet. |
| FIX1 | Repair shell-home regression after physical department wing | logic+test | S | no | local targeted fix after worker diagnosis | tested |  | pending independent review | `CORE_COLS=5` increases walk distance; test budget 60s→180s; behavior unchanged. |
| FIX2 | Visitor path budget after physical department wing | test | S | no | local targeted fix | tested |  | pending independent review | Visitor target path now crosses fixed wing; test budget 30s→180s; path/guard unchanged. |
| P1C | Runtime adapter for one approved route | logic+ui | M | yes | `9router-local/ag/gemini-3.8-flash-high` via OpenCode | implemented | `server/runtime/opencode.test.ts` | pending cross-vendor review | Start/cancel/report API + Director buttons; no subagents. |
| P1C-H | Department rooms + head identity | logic+ui | S | no | local Habblaud runtime | tested | `server/departments.test.ts`, `client/src/world/render/overlay.test.ts` | current local checks | Stable `roomId/headId/headSymbol`; WorkOrder `HEAD_ASSIGNED`; persistent canvas badges. |
| P1D | Global worker waves + cross-review | logic+ui | M | yes | Astra requested; route effort/cost live-check required | partial | `server/orchestration.ts`, `server/orchestration.test.ts` | pending current full suite | Sequential waves, task/evidence journal implemented; direct-head mode and provider-family isolation remain. |
| P1D.1 | Global vs department route policies | logic | M | yes | local implementation; no provider calls authorized | tested | Revision v0.6; `server/coordination.test.ts`; C14-C16 | local checks only; no provider review | Explicit family pin; same-family worker/reviewer gates; legacy global replay. Catalog discovery has no served telemetry, so department dispatch stays blocked until trusted adapter evidence is available. |
| P1D.2 | Clickable head chat + per-head archive | logic+ui | M | yes | local implementation | implemented | Revision v0.6 | typecheck/build + local API smoke | `messages[]`, `workOrderIds[]`, idempotency, replay, head/project link checks; head selection reuses the scoped conversation. |
| P1D.3 | Realtime head travel/activity | logic+ui | M | yes | local implementation | implemented | Revision v0.6 | typecheck/build + SSE smoke | WorkOrder SSE enriches head/department; Director Room and pixel overlay animate the head badge between physical department rooms from journal events. |
| P1E | Recovery/reconcile + approval gate | logic+ui | M | yes | local Control Core | partial | `server/orchestration.ts`, `shared/work-orders.ts` | pending current full suite | Restart → BLOCKED; stale-safe approval records; UI/reconciliation edge cases remain. |

## Checks

| check | task | requirement | command | verdict | evidence |
|---|---|---|---|---|---|
| C1 | FIX1 | shell-home test passes | `npx vitest run client/src/world/sim/sim.test.ts --testTimeout 60000` | pass | `28/28` |
| C2 | FIX2 | visitor/path test passes | `npx vitest run client/src/world/sim/world-visit.test.ts --testTimeout 60000` | pass | `12/12` |
| C3 | P1C | runtime/work-order/router tests | `npx vitest run server/runtime/opencode.test.ts server/work-orders.test.ts server/router.test.ts --testTimeout 60000` | pass | `12/12` |
| C4 | P0/P1C-H | typecheck | `npm run typecheck` | pass | current head/department changes |
| C5 | P0/P1C-H | Vietnamese translations complete | `npm run i18n:check -- vi` | pass | `3050/3050` |
| C6 | P0/P1C-H | full tests | `npm test -- --testTimeout 60000 --maxWorkers 1` | pass | `164` files, `1891` pass, `18` skipped |
| C7 | P0/P1C-H | production build | `npm run build` | pass | client + server build |
| C8 | all | whitespace errors absent | `git diff --check` | pass | warnings only LF/CRLF |
| C9 | P1C-H | phòng ↔ trưởng phòng replay + runtime mapping | `npx vitest run server/departments.test.ts server/work-orders.test.ts client/src/world/render/overlay.test.ts --testTimeout 60000` | pass | `11/11` targeted tests |
| C10 | P1C-H | build hiển thị phòng/head và API head metadata | `npm run typecheck; npm run i18n:check -- vi; npm run build` + `http://127.0.0.1:4750/api/departments` + browser smoke | pass | typecheck, `3050/3050`, build; 7 phòng + VVC/CL/CX/AG/OC/RV/AR visible |
| C11 | P1D | worker waves + reviewer + evidence | `npx vitest run server/orchestration.test.ts server/runtime/opencode.test.ts --testTimeout 60000` | pass | orchestration/reviewer/recovery targeted tests |
| C12 | P1E | journal approval/replay and stale guard | `npx vitest run server/work-orders.test.ts --testTimeout 60000` | pass | task/review/evidence/approval replay tests |
| C13 | P1D | real provider-backed worker + reviewer | WorkOrder `94163fe6-aaf5-4472-b3f4-ecb3bda43cfd` | inconclusive/cancelled | worker completed; reviewer cancelled after user's scope change; no cross-review verdict |
| C14 | P1D.1 | typecheck | `npm run typecheck` | pass | both TypeScript projects; exit 0 |
| C15 | P1D.1 | family classification, pins, reviewer isolation, replay, runtime guards | `npm test -- server/coordination.test.ts server/router.test.ts server/work-orders.test.ts server/orchestration.test.ts server/runtime/opencode.test.ts server/departments.test.ts --testTimeout 60000 --maxWorkers 1` | pass | 65/65 tests, 6 files; synthetic fixtures only; no provider calls |
| C16 | P1D.1 | whitespace and scope | `git diff --check`; baseline comparison including existing untracked files | pass | routing/store/runtime/API, focused tests, changelog and this ledger only; canvas/chat/conversation UI untouched |
| C17 | P1D.2/P1D.3 | department selection + local event refresh | `npm run typecheck; npm test -- --run server/work-orders.test.ts server/coordination.test.ts client/src/ui --testTimeout 60000 --maxWorkers 1` | pass | 357/357 focused tests; department cards keyboard/touch; `/api/work-orders/stream` 200 `text/event-stream` |
| C18 | all | full suite after roster/SSE changes | `npm test -- --testTimeout 60000 --maxWorkers 1` | pass | 166 files, 1941 pass, 18 skipped |

## Decisions

- 2026-10-20: Local Habblaud characters use the user-provided roster: six named department heads plus the remaining names for observed office agents. `Vũ Việt Cường` remains director. Existing World projection and its anonymous name pool are unchanged.
- 2026-10-20: Reused `dieu-phoi-ai` with local model routing; no Astra xhigh. Added accessible department selection, family-pinned WorkOrders, and local WorkOrder SSE refresh.
- 2026-10-21: Conversation archive completed: append-only messages, WorkOrder links, idempotency, restart replay, head/project isolation. Director UI reuses a selected department conversation.
- 2026-10-21: SSE events now carry head/department identity; Director head cards show event-derived activity and return state with reduced-motion-safe CSS pulse.
- 2026-10-21: Pixel overlay now animates the corresponding head badge between source and target department rooms for live journal events; virtual badge remains client-only.
- 2026-10-21: Travel animation is restricted to `coordinationMode=global`; department mode keeps the head in its home room and shows status there. Review/archive remain lanes without workers.
- 2026-10-21: Added six client-only virtual head Characters with real department-room spots and grid paths. Global journal events move them; they never enter server snapshots or World.
- 2026-10-21: Installed official `@opencode/cli@2.1.2`; Habblaud adapter detects v2 `/api` endpoints and connects to a local v2 server with loopback Basic Auth.
- 2026-10-21: Final implementation slice typechecked and built successfully. Local API smoke confirmed two messages, one WorkOrder link, idempotent replay, and health `200`.

- 2026-10-19: Use OpenCode transport for `ag/*` workers because Codex transport silently served `gpt-6-luna` for an `ag/gemini-3.8-flash-high` request.
- 2026-10-19: Keep route/model/account/served evidence explicit. No silent fallback.
- 2026-10-19: Preserve existing dirty changes; no commit/push/deploy.
- 2026-10-19: P1C runs only `opencode.exe` with `9router-local/<ag model>`; Windows `.cmd`/`.ps1` shims are never executed through a shell.
- 2026-10-19: P1C focused checks pass; full suite single-worker pass. OpenCode runtime requires an existing Git repo root and rejects paid API route/model families.
- 2026-10-19: Cross-review Gemini plan/read-only: `pass`; medium finding on secret redaction and minor findings on persistence/report/project-root were fixed, then gates rerun.
- 2026-10-19: Auto route now skips bare combo IDs and prefers `ag/gemini-3.8-flash-high` only when nested tool capability is live-confirmed.
- 2026-10-19: P1D uses sequential task waves; default reviewer selects a live tools-capable model from a different route family, otherwise start blocks. P1E records approval only; never commits/pushes/deploys.
- 2026-10-19: User clarified two distinct coordination modes: global Director routing vs department-scoped head chat. New department mode is restricted to the selected served-model family, with same-family/single-model degraded review; no cross-department fallback.
- 2026-10-19: User explicitly authorized updating the approved plan and implementing the new department/head UX. Current request asks for Astra xhigh; live catalog currently reports Astra `thinkingEffortSupported=false`, so the exact effort remains unverified until a bounded route canary.
- 2026-10-19: Read-only plan review via `codex exec` requested `cx/gpt-6-astra` with `model_reasoning_effort=xhigh`; provider reported `ninerouter`, CLI accepted effort, but served-model/account telemetry remained unknown. Seven findings recorded in `docs/spec/habblaud-director-room.md` v0.6 and resolved as explicit contract/test changes before build.

## Open questions

- Direct runtime task-sized tool canary remains unrun; text canary only proves route response. P1C records `servedModel: unknown` and requires a fresh live catalog/tool capability check before start.
- Served account identity for the Antigravity route remains `unknown` unless router telemetry attributes it without exposing credentials.

- 2026-10-20: Full suite rerun after department roster compatibility fix: 166 files, 1941 pass, 18 skipped. P1D.2/P1D.3 remain partial by design: conversation message append and pixel movement projection still pending.
