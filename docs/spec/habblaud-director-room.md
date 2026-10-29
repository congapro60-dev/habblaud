# Plan: Habblaud Director Room

Status: approved-for-build
Version: 2026-10-19 / v0.5
Source of truth: user brief; ORCA threads `01a03c5c-321e-7da3-b1ec-34a7dae363d9`, `01a0576c-8928-7d11-a6b4-a3b35f24d0f9`, `01a05b61-d8bf-7fe2-b95a-87c3c417ec27`, `01a05c88-541a-7520-8fbc-022ade63f899`; current Habblaud source; user clarification on 2026-10-19 for department-first chat and solo-provider routing.

## 1. Objective and outcome

Biến Habblaud thành harness văn phòng AI: Vũ Việt Cường gửi một yêu cầu trong phòng giám đốc; hệ thống tạo WorkOrder, giao cho trưởng phòng AI, theo dõi nhân viên/subagents, lưu sự kiện, thu kết quả và báo cáo lại.

Đợt đầu phải tạo được WorkOrder và trạng thái bền vững trong Habblaud. Chưa hứa multi-provider execution hoàn chỉnh khi adapter chưa có bằng chứng live.

## 2. Users, audience, and use cases

- Người dùng duy nhất: giám đốc Vũ Việt Cường.
- Mặt giao diện: Habblaud web local `127.0.0.1:4747`.
- Luồng chính: nhập yêu cầu → xem WorkOrder → theo dõi trạng thái → xem báo cáo.
- Luồng lỗi: thiếu runtime, quota, quyền workspace, reviewer hoặc provider → `BLOCKED`, lý do rõ, không hạ cấp âm thầm.

## 3. Scope

### In scope

- Director Room state/API/UI tối thiểu.
- WorkOrder, task item, event journal append-only, replay sau restart.
- State machine: `PLANNED → QUEUED → RUNNING → READY_FOR_REVIEW → VERIFIED`; nhánh `FAILED`, `BLOCKED`, `CANCELLED`.
- Fields: objective, repo/worktree, skill names, permission mode, requested runtime/model, acceptance criteria, evidence references.
- Local-only write routes, CSRF/content-type guard hiện có.
- Vietnamese UI strings qua `tr()`.

### Out of scope đợt đầu

- Copy toàn bộ ORCA/Electron vào Habblaud.
- Tự động dùng browser ChatGPT/Muse làm provider.
- Tự động commit/push/deploy.
- Bypass quota, permission, approval hoặc secret boundary.
- Habblaud World payload giả; không sửa `shared/world/` cho mục tiêu này.
- Multi-process journal lock hoàn chỉnh; phase đầu dùng một server process.

## 4. Current state and evidence

- Habblaud đã có `Office`, `Hub`/SSE, Claude/Codex/OpenCode observation sources, spawn, messages, deliveries và local HTTP guard.
- `server/http/app.ts` là API router; `server/index.ts` là composition root.
- `shared/types.ts` là protocol additive.
- ORCA có các contract tham khảo: Control Core, Daily Driver, Codex runtime receipt, replay/recovery. P2F của ORCA vẫn có limitation về multi-process/Windows durability; không bê nguyên claim chưa verify.
- Habblaud hiện chưa có Director WorkOrder store hoặc direct coding execution contract.

## 5. Constraints and technology choices

- Không thêm dependency.
- Node stdlib: append-only NDJSON + atomic temp/rename + bounded recovery; state payload bounded, không lưu full prompt/output/secret ngoài dữ liệu cần thiết.
- `workspace-write` phải explicit; mặc định `READ_ONLY`.
- Route local only; remote access không được tự có quyền code.
- Existing dirty worktree preserved.
- Provider/model/quota/cost dùng `unknown` khi chưa có live evidence.

## 6. Main flows and system boundaries

```text
Director Room UI
  → /api/work-orders
  → WorkOrderStore (journal + snapshot)
  → future RuntimeAdapter (Codex/OpenCode/9Router/Claude)
  → events/evidence
  → SSE snapshot + Director report
```

Phase 0 chỉ tạo/đọc/cancel WorkOrder và replay. Phase 1 wiring một runtime adapter đã kiểm chứng. Phase 2 thêm routing/worker waves/review chéo.

## 7. Data, integrations, permissions, and privacy

WorkOrder ID và event sequence idempotent. Không ghi access token, refresh token, API key, cookie, full transcript hoặc raw secret vào journal/log/UI. Redact bounded before persistence. `workspace` phải canonical/validated. Mọi mutation local-only.

## 8. Design or UX direction

- Director Room: nhân vật Vũ Việt Cường, ô chat “Yêu cầu cuộc họp”.
- Bảng WorkOrder: trạng thái, trưởng phòng/runtime, task count, evidence, blocker.
- Hoạt cảnh chạy đến phòng chỉ là projection từ state event; không dùng animation làm source of truth.
- UI tối thiểu trước; pixel-art mở rộng sau khi state/API ổn định.

## 9. Risks, unknowns, and fallback paths

- `codex queue` hiện gửi tin cho session có sẵn; chưa thay thế direct app-server runner.
- OpenCode Desk/9Router capability và quota thay đổi; phải canary từng route.
- Một process chưa bảo vệ nhiều writer; ép single-instance hoặc fail-closed nếu phát hiện contention.
- Nếu runtime không đủ capability, WorkOrder dừng `BLOCKED`, không fallback im lặng.

## 10. Alternatives and trade-offs

- ORCA clone: phạm vi lớn, hai source of truth; loại.
- Habblaud-native Control Core: ít file, tận dụng API/SSE hiện có; chọn.
- SQLite: thêm dependency/runtime coupling; chưa cần cho MVP.
- NDJSON journal: dễ inspect/recover, đủ cho single-process MVP; nâng cấp storage khi có bằng chứng scale.

## 11. Acceptance criteria and verification

- `POST /api/work-orders` tạo WorkOrder hợp lệ, mặc định `READ_ONLY`.
- `GET /api/work-orders` và `GET /api/work-orders/:id` replay đúng sau server restart.
- Event sequence tăng đơn điệu; duplicate event không nhân đôi.
- Payload reject token-like fields, oversized content, invalid path/status transition.
- UI tạo được yêu cầu, hiển thị tiếng Việt, cập nhật trạng thái qua SSE/poll.
- `npm run i18n:check -- vi`, `npm run typecheck`, targeted tests, `npm test`, `npm run build`, `git diff --check` pass.
- Không đổi `shared/world/`.

## 12. Work order and stopping points

1. Plan/review: contract + store + API test, chưa runtime.
2. Build P0: shared types, WorkOrderStore, routes, tests, minimal Director panel.
3. Verify diff/gates.
4. Review độc lập read-only.
5. Chỉ sau P0 pass mới lập plan P1 runtime adapter.

Stop nếu: route/model không có live capability; secret boundary fail; state journal corrupt/ambiguous; diff ngoài scope; test/build fail sau ba vòng sửa.

## 13. Open questions and decisions

- Assumption: Habblaud web local là surface chính; Electron wrapper chưa cần.
- Assumption: P0 dùng một process server; multi-process lock là phase sau.
- Decision: user đã ủy quyền tự triển khai sau plan/review; không cần hỏi lại cho P0.

## 15. Revision v0.4 — P1D/P1E orchestration contract

### P1D outcome

- A WorkOrder can hold a bounded execution plan with at most two worker waves.
- Each wave has explicit task ids, head/department, requested and served model evidence, status, report and evidence refs.
- In `global` mode, reviewer tasks are read-only and provider-family independent when a live route exists; otherwise the parent remains `BLOCKED`/`READY_FOR_REVIEW`, never silently self-approves. In `department` mode, see v0.5 single-family exception and explicit director verification gate.
- The report desk reads task/review/evidence records from the same append-only journal.
- No concurrent writers for one repository. Wave tasks run sequentially by default; separate read-only reviewer may run only after worker completion.

### P1E outcome

- Restart reconcile marks unknown child work as `BLOCKED`, preserving output/evidence already recorded.
- Commit/deploy requests create an explicit approval record. No commit, push or deploy is executed by this phase.
- Approval is idempotent and bound to WorkOrder revision plus evidence refs; stale approval is rejected.

### P1D/P1E stop conditions

- More than two waves, missing route/tool evidence, missing independent reviewer, repository path drift, or unknown worker state after restart → blocked with a human-readable reason.
- No automatic provider/account rotation, paid fallback, browser-session provider, commit, push or deploy.

## 17. Revision v0.6 — Astra review fixes and implementation gate

Single-model review of v0.5 via `codex exec` requested `cx/gpt-6-astra`, `model_reasoning_effort=xhigh`; CLI accepted the effort setting. Provider was `ninerouter`; served-model/account telemetry unavailable. Review findings and decisions:

1. Private SSE boundary: add loopback/terminal-trust denial tests; prove message text stays out of Office/World streams.
2. Conversation/work-order isolation: immutable conversation head/project scope, per-message WorkOrder IDs, idempotency, out-of-order report replay; reject mismatched links.
3. Single-provider gate: missing same-family reviewer may reach only `READY_FOR_REVIEW`; `VERIFIED` requires explicit director verification with degraded mode and test evidence. Global mode still requires independent cross-family review.
4. OpenCode room: runtime/transport, not model family. Pin `servedFamily` explicitly before department-mode dispatch.
5. Movement identity: one `coordinatorHeadId` travels in global mode. Worker heads stay home unless separately assigned. Cancel/stale events cannot move a head after terminal state; per-head activity is serialized.

User explicitly requested this revised plan be used for implementation. Approval decision: approved-for-build. Astra review did not edit files; the active provider-backed P1D reviewer canary was cancelled after this scope change and is recorded as inconclusive in the ledger.

## 16. Revision v0.5 — department-first chat, single-AI mode, clickable heads

### User outcome

The director can either convene the whole building or open one department head and give that AI a private task. A department head may use its own provider-family model pool and subagents; it must not silently recruit other departments. The user can click a head's visible symbol, chat, revisit that head's conversation archive, and see truthful work activity in the building.

### Two explicit operating modes

1. **Whole building (`global`)** — Director Room chooses a coordinator head/model. WorkOrder may delegate to multiple departments. Cross-provider review is preferred and recorded. Only the coordinator head travels to the assigned worker department; worker heads remain in their rooms. A journal assignment event is required before motion.
2. **One department (`department`)** — clicking a head opens that head's chat. Every worker and reviewer route is constrained to that department's model family. No other department is dispatched. Transport (9Router/OpenCode) does not define model family; classify from the served-model family/model ID. `unknown` family fails closed.

Department mode is the normal fallback when only one AI/provider is usable. That AI may plan several tasks and use same-family models/subagents. If only one model is usable, it may run one bounded worker and automated checks; if no distinct same-family reviewer exists, mark `degraded: single-model-review`, set `READY_FOR_REVIEW` (never `VERIFIED`), and require explicit director verification. Director verification records `verificationMode: director-after-tests`, evidence refs, and reviewer limitation; it is not mislabeled as independent review. Never recruit a different department to fill a missing model.

### Clickable head and chat

- The existing VVC/CL/CX/AG/OC/RV/AR symbols become actual hit targets, not decorative canvas paint. Add a keyboard/screen-reader accessible department-head list with the same actions; canvas is not the only input method.
- Selecting a provider head opens a department-scoped chat panel showing that head's identity, live route-family availability, recent conversations, active WorkOrders, reports, blockers and evidence.
- A director message creates a WorkOrder linked to the current per-head conversation. The head response/report appends to that conversation. New conversations are per head/project; rooms remain fixed, never one room per chat or message.
- Conversation is an archive with `messages[]` and `workOrderIds[]`; each message/event carries its own `workOrderId`. Keep legacy `workOrderId` as the latest-linked projection only. Validate every link/message against the conversation's immutable `headId` and `projectPath`; reject cross-head/project reuse. Use `idempotencyKey` per director message; out-of-order reports append by WorkOrder ID, not overwrite a single slot.
- Director Room retains a separate `global` mode for cross-department coordination. The UI always shows the current mode and scope before dispatch.
- Conversation messages are local-only, length-bounded, secret-marker rejected and stored as user/assistant message events; never store provider tool transcripts or credentials. Retain report/checkpoint/evidence links.
- Department conversation/detail/SSE reads and writes require loopback Host plus local terminal trust. Add tests rejecting remote-listener access and proving private messages never enter `OfficeSnapshot`, `/api/stream` shared events, or Habblaud World projection.

### Real-time movement and truthful state

- Head avatars are Habblaud-local UI projections backed by client-only virtual `Character` objects. They are not real `AgentInfo`/subagents; never add them to usage counts, source snapshots, or Habblaud World payloads.
- Local character roster uses the names supplied in the user's spreadsheet for department heads and office agents. `Vũ Việt Cường` remains the director. The roster is UI-local; `shared/world/` keeps its anonymous pool and never receives these names.
- The Control Core journal is source of truth: `HEAD_REQUEST_RECEIVED`, `HEAD_PLANNING`, `HEAD_DISPATCHED`, `HEAD_ARRIVED`, `TASK_STARTED`, `TASK_FINISHED`, `REVIEW_STARTED`, `HEAD_REPORTING`, `HEAD_BLOCKED`, `HEAD_RETURNED` (or equivalent typed events).
- Global mode: show `coordinatorHeadId` traveling from its own room to the assigned department, then returning/reporting after worker/review events. Department mode: head stays in its home room while its own model workers execute; show task status at that room. A department head is not also animated as the worker unless a journal event assigns that same head.
- `OpenCode / 9Router` is a transport/runtime head, not a served-model family. Department mode for this head must pin one explicit `servedFamily` in the chat before dispatch; candidates are filtered to that family, and the pin cannot change mid-conversation without a new director action. Unknown family blocks.
- Animation begins only after the corresponding journal event. `unknown`, cancelled, blocked, or offline state is shown explicitly; do not invent motion/activity.
- Deliver events to the UI in real time through a bounded local-only SSE stream (or existing local event transport if it can carry typed WorkOrder events without changing Office/World truth). Reconnect from the last sequence; full snapshot repairs gaps.
- Reduced-motion and keyboard/touch alternatives required. Motion is decorative; status text remains accessible and authoritative.

### Provider-family routing contract

```text
CoordinationMode = global | department
DepartmentRequest = { mode, headId, departmentId, projectPath, objective, permissionMode, policy, requestedModel? }
AllowedRoute = live, tool-capable route whose served family matches departmentId
```

- `claude`: Claude-family models only (`cc/*` or verified Claude-served route).
- `codex`: OpenAI/Codex-family models only (`cx/*` or verified OpenAI-served route).
- `gemini-antigravity`: Gemini-family models only; Antigravity consumer OAuth remains a clearly labeled terms-conflict candidate and requires action-time acknowledgement.
- `opencode-9router`: `transport=opencode/9router`, `servedFamily=<explicitly pinned family>` in department mode. There is no implicit "OpenCode model family". The selected family and model pin are shown in UI and archived on each WorkOrder.
- `review`: read-only reviewer lane, not a general worker destination. `archive` is storage-only.
- `requestedModel` never proves served family. Record `servedModel` and `servedFamily` when telemetry supports it, else `unknown` and block family-constrained auto-dispatch.
- No silent provider switch, account rotation, paid API fallback, or cross-family worker in `department` mode.

### Phase updates

- **P1D.1:** `global` vs `department` contracts; family-filtered router and one-provider quality fallback; state/journal tests.
- **P1D.2:** clickable head selection, per-head chat, conversation archive, direct task submission; responsive/accessible UX.
- **P1D.3:** local WorkOrder SSE/reconnect and event-derived department head movement.
- **P1E:** restart recovery, stale approval checks, explicit commit/deploy approval record only; no execution.

### Acceptance criteria

- Clicking each provider head (canvas and accessible list) opens the matching head chat; keyboard and touch work.
- A department WorkOrder's requested/served family cannot leave its selected family. Property/unit tests cover every head mapping, mismatched route, unknown family, and no cross-department fallback.
- With only one provider family live, that room can still run one worker plan. If distinct same-family reviewer is missing, automated checks may reach `READY_FOR_REVIEW` but cannot auto-mark `VERIFIED`; explicit director verification records the degraded mode and evidence. No false cross-review or automatic global dispatch.
- Global mode can assign two departments and records a `coordinatorHeadId`, `HEAD_DISPATCHED` and `HEAD_ARRIVED`; direct mode never emits cross-department dispatch.
- Head icons move only from committed WorkOrder events; SSE reconnect/replay yields the same head state and no duplicate motion. Cancel-before-arrival emits terminal state and invalidates stale arrival events; per-head execution sequence prevents overlapping stale movement.
- SSE tests verify `Host`/remote trust rejection, reconnect cursor, event sequence gaps, and that conversation text is absent from ordinary Office and World events.
- Archive tests cover two messages creating two WorkOrders, reports completing out of order, restart replay, idempotent duplicate message keys, and rejection of cross-head/project links.
- Virtual heads do not affect `OfficeSnapshot.agents`, top-bar agent counts, account usage, or World projection.
- Conversation messages, reports, checkpoints and active task survive restart; no token-like content accepted.
- Responsive panel provides model-family route details, route/permission/cost/quota `unknown` where evidence is absent, confirmation before workspace writes, and clear cancel/blocker/report states.

## 14. Revision v0.2 — 9Router và điều phối AI

### Mục tiêu

Đưa 9Router thành lớp route trung tâm của Habblaud. Director Room phải hiển thị model/provider live, health, cost/quota và cho phép chọn route có bằng chứng. WorkOrder giữ route đã chọn; không fallback âm thầm.

### Phạm vi ưu tiên UI + logic

1. **Router Cockpit:** thẻ provider/account/model, thời điểm kiểm tra, health, cost class, quota/reset (`unknown` khi router không công bố).
2. **Director WorkOrder form:** vai trò (`planner`, `worker`, `reviewer`), route policy (`free-fast`, `balanced-code`, `deep-code`, `review-code`), model override, quyền, repo/worktree, acceptance criteria.
3. **Head board:** các trưởng phòng Claude/Codex/Antigravity/OpenCode/9Router; trạng thái `available`, `unknown`, `blocked`, `running`, `done`.
4. **Event feed:** `ROUTE_DISCOVERED`, `ROUTE_SELECTED`, `HEAD_ASSIGNED`, `WORKER_STARTED`, `REVIEW_REQUESTED`, `EVIDENCE_RECORDED`.
5. **Logic selector:** lọc capability/tool/health/cost; route không đủ bằng chứng chuyển `BLOCKED` hoặc `ASK`, không tự đổi sang paid.

### Hợp đồng route

```text
RouterProvider = { id, name, baseUrl, loopback, health, costClass, quotaState, resetAt, checkedAt }
RouterModel = { providerId, modelId, family, supportsTools, context, reasoning, costClass, quotaState, health }
RoutePolicy = free-fast | balanced-code | deep-code | review-code
RouteDecision = { policy, providerId, modelId, role, evidenceRefs, degraded, selectedAt }
```

`requestedModel` chỉ là ý định. `servedModel` chỉ ghi khi có telemetry/response evidence. Không ghi API key, token, cookie, `control.json` hoặc raw provider config.

### API/UI boundary

- `GET /api/router/catalog`: catalog đã khử nhạy cảm, loopback only.
- `GET /api/router/health`: health probe bounded, không retry vô hạn.
- `GET /api/router/quota`: quota theo account/model nếu provider công bố; nếu không `unknown`.
- `POST /api/work-orders`: nhận thêm `role`, `routePolicy`, `requestedModel`.
- `POST /api/work-orders/:id`: `select-route`, `assign-head`, `block`, `report`.

### State machine P1

```text
PLANNED
 → ROUTE_CHECKING
 → ROUTE_SELECTED
 → QUEUED
 → HEAD_ASSIGNED
 → RUNNING
 → READY_FOR_REVIEW
 → VERIFIED
```

Nhánh lỗi: `BLOCKED_CAPABILITY`, `BLOCKED_QUOTA_UNKNOWN`, `FAILED_TRANSPORT`, `CANCELLED`. Chỉ `ROUTE_SELECTED` mới cho phép khởi động worker.

### Vai trò mặc định

- `planner`: Codex/Claude/Gemini/Antigravity phù hợp context, read-only.
- `worker`: Codex/OpenCode/9Router tool-capable, quyền theo WorkOrder.
- `reviewer`: provider/model family khác tác giả, read-only.
- `director`: Vũ Việt Cường duyệt route, scope, permission và kết quả.

### Lộ trình bắt buộc

- **P1A:** shared route contracts + catalog/health/quota API + Router Cockpit UI; read-only, chưa gọi model.
- **P1B:** selector + WorkOrder route decision + event journal; canary text/tool-call bounded.
- **P1C:** một worker adapter Codex hoặc OpenCode; start/cancel/result/evidence.
- **P1D:** worker waves tối đa 2, subagents, reviewer chéo, report desk.
- **P1E:** recovery/reconcile sau restart, commit/deploy approval.

### Acceptance P1A

- Router catalog chỉ đọc loopback; model list không lộ credential.
- UI hiển thị `unknown` đúng khi thiếu cost/quota/served model.
- Route selector loại provider không khỏe, thiếu tools hoặc unknown cost khi policy yêu cầu free.
- Chọn route tạo event `ROUTE_SELECTED` với evidence reference.
- WorkOrder cũ vẫn replay được (schema additive).
- Test/typecheck/i18n/build pass; không sửa `shared/world/` để giả dữ liệu.

### Stop conditions

- 9Router endpoint không loopback hoặc health không xác minh được.
- Model metadata thiếu nhưng tool/cost bị giả định.
- Fallback sang paid/API/browser bridge chưa được ủy quyền.
- Reviewer độc lập unavailable: gate `inconclusive`, không claim verified.

### P1C runtime boundary

- Adapter: OpenCode CLI, provider `9router-local`, model identity from the selected live 9Router catalog item.
- `READ_ONLY` uses OpenCode's `plan` agent. `WORKSPACE_WRITE` uses `build --auto` only after an action-time browser confirmation.
- OpenCode `--auto` approves all tools and is **not** an OS filesystem sandbox. Show this warning before every write run; require a trusted Git repository path; never promise writes are confined to that repository. If this permission is unacceptable, do not start the worker.
- `gemini/*` paid API routes are blocked in P1C. Unknown cost/quota stays visible and requires explicit user confirmation. Antigravity consumer OAuth remains a terms-conflict candidate, never an automatic route; no account rotation.
- P1C does not implement commit, push, deploy, external message, subagent fan-out, or restart recovery.

## Review record

- Single-model review ngày 2026-10-18: P0 giữ phạm vi backend journal + API + UI tối thiểu; chưa wiring runtime/provider.
- OpenCode review attempt: `opencode/deepseek-v4.1-flash-free` bị API key expired; `9router-local/ag/gemini-3-flash` bị permission boundary tới worktree khác. Không dùng các lượt này làm approval.
- Quyết định điều phối: triển khai P0 trực tiếp trong Habblaud theo ủy quyền của người dùng; ghi rõ runtime adapter là phase kế tiếp.

## Execution evidence — 2026-10-19

- `server/work-orders.test.ts`: `3/3` pass.
- Full suite: `160` files pass; `1877` tests pass; `18` skipped.
- `npm run typecheck`: pass.
- `npm run i18n:check -- vi`: `3019/3019`.
- `npm run build`: pass.
- `git diff --check`: pass; LF/CRLF warning only on `shared/locales/vi.ts`.
- Local smoke: `GET /api/work-orders` `200`; `POST /api/work-orders` `201`; status transition `PLANNED → QUEUED` `200`.
- UI smoke: button `Phòng giám đốc: tạo WorkOrder`, dialog `Vũ Việt Cường · Diretor`, avatar `VVC` visible.
- Independent OpenCode review: `inconclusive`; direct free routes failed with expired API key / wrong external worktree boundary. No commit/push.

## P1A execution evidence — 2026-10-19

- `GET /api/router/catalog`: `200`; loopback `http://127.0.0.1:20128`; live catalog `91` models; health `ok`; quota `unknown`.
- UI Director Room: role selector, route policy selector, model selector (`92` options including auto), router status text visible.
- Router unit tests: `5/5`; full suite after P1A: `161` files, `1879` pass, `18` skipped.
- `typecheck`, `i18n:check` (`3028/3028`), build and diff check pass.
- No canary/model turn yet. P1A remains discovery/UI only; P1B required before runtime execution.

## P1B bounded route decision — 2026-10-19

- WorkOrder now carries `role` and `routePolicy`.
- Director Room submits a bounded `select-route` action after creation.
- `RouterService.select()` requires live `health=ok`; unknown cost/quota becomes `degraded`, never silently free.
- Journal event `ROUTE_SELECTED` stores provider/model/role/policy/evidence reference.
- `free-fast` blocks until a model gets `free-verified` evidence; no paid fallback.
- Runtime worker, tool canary, subagents and review execution remain P1C/P1D.

## Revision v0.3 — Department Heads và Conversation Archive

### Objective

Tách rõ ba lớp: phòng vật lý pixel, phòng ban logic, conversation archive. Không biến mỗi chat hoặc mỗi message thành một phòng mới.

### Department registry

Departments cố định:

```text
director
claude
codex
gemini-antigravity
opencode-9router
review
archive
```

Mỗi department có `headId`, provider family, role mặc định, health, route/model hiện tại, active WorkOrders và `unknown` khi chưa có bằng chứng live. Registry không tự tạo tài khoản, không đọc credential.

### Conversation archive

Conversation là hồ sơ logic gắn với WorkOrder/project, không phải room pixel. Lưu local append-only:

```text
~/.habblaud/conversations.ndjson
```

Mỗi record: `conversationId`, title, projectPath, workOrderId, headId, requested/served route, checkpoint summary, report, status, timestamps, evidenceRefs. Không lưu cookie, token, full raw transcript hoặc secret. Raw transcript vẫn thuộc provider source; Habblaud lưu summary/checkpoint/report.

API:

- `GET /api/departments`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `POST /api/conversations/:id` với `checkpoint`, `report`, `archive`.

Director Room UI thêm hai khu: `Trưởng phòng` và `Kho lưu trữ`. Project rooms tiếp tục lấy từ cwd thật; không thêm department giả vào `OfficeSnapshot.rooms`, tránh làm sai Habblaud World.

### Acceptance v0.3

- Director Room hiển thị department/head/health/route/status.
- Tạo WorkOrder tạo conversation record liên kết.
- Checkpoint/report/archive replay sau restart.
- Conversation list lọc được project/status; archive không chứa secret-like payload.
- Existing rooms và Habblaud World payload không đổi.

- Latest full suite after v0.3: `162` files, `1880` pass, `18` skipped (timeout budget `60000ms`).

## v0.3 implementation evidence — 2026-10-19

- Department registry API: `GET /api/departments` with Director, Claude, Codex, Gemini/Antigravity, OpenCode/9Router, Review, Archive.
- Conversation archive: `~/.habblaud/conversations.ndjson`, checkpoint/report/archive replay, WorkOrder linkage.
- Director Room now renders `Trưởng phòng` and `Kho lưu trữ` sections.
- Department rooms remain logical; no fake entries added to `OfficeSnapshot.rooms` or Habblaud World.

