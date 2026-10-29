# Review batch + true Undo (mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Pending-review screen: multi-select Approve/Return, and a real Undo for Return (backend `task_review_restore`).

**Architecture:** Reject is sent at once (no 5 s deferral). Undo = `task_review_restore {id, requestedBy, requestedAt}` taken from the task snapshot kept in the closure. Adapter in `api/review.ts` + `lib/sync/commandMap.ts`. Selection state lives in a small hook (`useReviewSelection`), rows stay `memo` with plain props. A batch is ONE data mutation that awaits n calls one after another (the interceptor queues them in order offline).

**Tech Stack:** RN 0.88, Expo 58, TanStack Query, i18next, RNTL/jest.

---

### Task 1: Sync layer (commandMap, optimistic, invalidation, api, errors)
- [ ] Failing tests in `src/lib/sync/__tests__/review.test.ts` (map restore args, optimistic reappear, offline order reject then restore, impact narrow) and `reviewKeys.test.ts`.
- [ ] Implement `reviewApi.restore`, route `task_review_restore`, optimistic case, `review-not-restorable` in `describeError`, i18n key `review.notRestorable`.
- [ ] Run tests, commit.

### Task 2: Real Undo for Return
- [ ] Failing tests in `ReviewScreen.test.tsx`: reject sent at once; Undo posts restore with `{requestedBy, requestedAt}`; 409 shows the Vietnamese message.
- [ ] Rewrite `useReviewActions` (onReject(task) sends now; Undo restores).
- [ ] Run tests, commit.

### Task 3: Multi-select
- [ ] Failing tests: long press / "Chọn" enters mode, toggle, select all, batch approve n commands, batch return + Undo n restores, own rows not selectable, Member has no mode, no extra observers.
- [ ] Implement `useReviewSelection`, `ReviewSelectionBar`, `useReviewBatch`, row props, i18n vi/en.
- [ ] Run tests, commit.

### Task 4: Verify
- [ ] `npx tsc --noEmit`; full jest `--maxWorkers=2 --testTimeout=30000 --forceExit`.
