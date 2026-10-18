# Plan: Habblaud OpenCode/9Router adapter

Status: approved-for-build
Version: 2026-10-18
Source of truth: `README.md`, `AGENTS.md`, `server/sources/source.ts`, `server/model/office.ts`, OpenCode local API contract, 9Router loopback API.
Approval: user explicitly requested “Fork Habblaud, thêm adapter OpenCode/9Router — nhiều công hơn, tách khỏi Desk.” User request authorized a GitHub fork; fork created at `https://github.com/congapro60-dev/habblaud`. Push/PR not performed.

## 1. Objective and outcome

Local Habblaud fork displays OpenCode sessions as office agents and labels their observed model/transport. Optional 9Router loopback metadata enriches source/account status. Existing Claude/Codex behavior remains intact.

## 2. Scope

### In scope

- Add additive `engine: 'opencode'` snapshot field; retain `provider` as the legacy Claude-compatible projection for local API compatibility, and guard controls with the explicit engine.
- Add configurable `OpenCodeSource` using read-only OpenCode `/session`, `/session/status`, `/event` APIs.
- Observe one or more directories from `HABBLAUD_OPENCODE_DIRS`; endpoint from `HABBLAUD_OPENCODE_URL`.
- Map session status/events to Habblaud activity/status and model.
- Add optional read-only `HABBLAUD_9ROUTER_URL` metadata source; default loopback only.
- Add unit tests with fake HTTP fixtures; SSE remains a wake-up signal and polling is the source of truth.
- Document Windows/Node mode configuration and safety boundaries.

### Out of scope

- No prompt sending, shell execution, file writes, approvals, session takeover, or terminal reconstruction for OpenCode.
- No OpenCode Desk control API dependency.
- No credentials, cookies, `control.json`, API keys, cloud uploads, Habblaud World schema changes, or GitHub push.
- No claim that requested model equals served model unless the provider event/API reports it.

## 3. Current evidence

- Habblaud currently supports `claude` and `codex` providers only (`shared/types.ts`).
- `SourceSet` already supports additive agent sources (`server/sources/source.ts`).
- `Office.addMain`, `setStatus`, `applyTranscript`, and `addActivity` provide the required projection boundary.
- Desk has a richer local API but is intentionally excluded from this fork.
- OpenCode client contract observed in Desk: `/global/health`, `/session`, `/session/status`, `/event`.

## 4. Design

- `OpenCodeSource` owns endpoint config, directory set, session cache, SSE reconnect, and bounded polling fallback.
- Main agent id: `opencode:<directory-hash>:<session-id>`; OpenCode engine identity is separate from legacy provider controls.
- Project room: session directory, normalized by existing Office.
- Status mapping: busy/streaming → `working`; permission/request event → `waiting`; idle/completed → `idle`; error → `offline`/error activity.
- Event payload text is masked/truncated through existing activity helpers; no raw prompt/tool payloads stored.
- Model field records reported `providerID/modelID`; otherwise omitted/`unknown` in source metadata, never inferred from route names.
- 9Router adapter performs bounded GET-only reads of `/v1/models` and health/metadata when available. Failure is `unknown`, not fatal to OpenCode observation.
- Native OpenCode endpoint is not routed through 9Router implicitly. User must configure endpoint and provider intentionally.

## 5. Permissions and privacy

- Bind Habblaud and configured OpenCode/9Router endpoints to loopback; remote URLs are rejected.
- Read-only GET/SSE only. Optional Basic Auth comes from process environment and is sent only to a loopback endpoint; never log it or persist it.
- Redact tokens, cookies, paths with sensitive values, prompts and tool arguments before activity projection.
- Preserve Habblaud World truthfulness: OpenCode sessions are excluded from `shared/world/projection.ts` until the remote schema has a truthful engine mapping; no World protocol/schema or server changes.

## 6. Acceptance criteria

1. Existing tests pass on supported Node runtime; unrelated Windows-host full-suite failures are recorded separately.
2. Typecheck/build pass on Windows Node runtime.
3. `OpenCodeSource` boots with endpoint unavailable without crashing Habblaud.
4. Fake OpenCode session/status fixtures produce one room/agent with correct status and reported model.
5. Reconnect/poll is bounded and idempotent; duplicate events do not duplicate feed entries.
6. 9Router unavailable/404/403 produces `unknown` metadata and no secret/log leakage.
7. Default configuration observes nothing unless `HABBLAUD_OPENCODE_URL` is set.
8. `git diff --check` passes; no files outside fork change.

## 7. Work order

1. Shared engine/config contracts.
2. OpenCode source + 9Router metadata reader.
3. UI provider labels/filter compatibility.
4. Unit tests and documentation.
5. Typecheck, tests, build, diff audit.

## 8. Stop points

- Stop if OpenCode event schema cannot be safely normalized without reading raw prompt/tool content.
- Stop if a required API needs credentials not supplied via explicit environment configuration.
- Stop before any GitHub fork/push or Desk integration; request separate approval.
