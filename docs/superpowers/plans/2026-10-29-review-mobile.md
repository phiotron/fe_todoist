# REVIEW-MOBILE "Cho duyet" Implementation Plan

> For agentic workers: use superpowers:executing-plans / test-driven-development. Steps use checkboxes.

**Goal:** Member/Guest tick in a TEAM project asks for review (PENDING); Admin approves / returns it.

**Architecture:** Pure rule `lib/review.ts` (tick outcome by role/state) shared by the offline optimistic layer and the
online toggle. Task gets `reviewStatus` fields; rows only read props (no per-row hook: `TaskRowEnv` gets `meId`).
Review screen `/review` (Admin: Duyet / Tra lai, Member: read-only) opened from a card in the Team tab.

**Tech Stack:** RN 0.88 / Expo 58, TanStack Query, expo-router, i18next, jest.

---
### Task 1: Types + rule (`api/models.ts`, `api/projects.ts`, `lib/review.ts`, fixtures) - test `lib/__tests__/review.test.ts`
- [ ] failing test: tickOutcome(task, caps) -> 'REQUEST' | 'CANCEL' | 'COMPLETE'
- [ ] implement, commit
### Task 2: Sync (`commandMap.ts`, `optimistic.ts`, `invalidation.ts`) - tests in `lib/sync/__tests__/review.test.ts`
- [ ] routes approve/reject -> task_review_approve / task_review_reject {taskId}; queue + offline optimistic
- [ ] optimistic task_close by role (PENDING / cancel / complete); narrow invalidation for review writes
### Task 3: API + hooks (`api/review.ts`, `features/review/useReview.ts`, `useCompleteWithUndo`) - tests `features/review/__tests__`
- [ ] toast "Da gui yeu cau duyet" + Undo; tick again = cancel; approve Undo = reopen; reject deferred 5 s (Undo cancels)
### Task 4: Rows (`Checkbox`, `TaskRow`, `TaskMeta`, `taskRowEnv`) - tests `features/tasks/__tests__/review.row.test.tsx`
- [ ] pending ring + clock, "Cho duyet" label, locked reopen for Member, no new hook per row
### Task 5: Screen + Team tab card (`features/review/ReviewScreen.tsx`, `app/(app)/review.tsx`, `TeamScreen`)
### Task 6: Notifications (3 types) + activity (4 events) + i18n vi/en (`review.json`) + 403/409 messages
### Task 7: tsc + full jest, commit
