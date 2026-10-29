import { tickOutcome, isPendingReview, canReopenCompleted } from '../review';

const open = { completedAt: null, reviewStatus: 'NONE' as const };
const pending = { completedAt: null, reviewStatus: 'PENDING' as const };
const done = { completedAt: '2026-10-29T01:00:00Z', reviewStatus: 'NONE' as const };
const member = { canEditTasks: false, canCompleteTasks: true, canReview: false };
const admin = { canEditTasks: true, canCompleteTasks: true, canReview: true };
const personal = { canEditTasks: true, canCompleteTasks: true };

describe('tickOutcome (who completes, who only asks)', () => {
  it('Member / Guest ticking an open task asks for review', () => {
    expect(tickOutcome(open, member)).toBe('REQUEST');
  });
  it('Member ticking their pending task cancels the request', () => {
    expect(tickOutcome(pending, member)).toBe('CANCEL');
  });
  it('Admin completes at once, also a pending task', () => {
    expect(tickOutcome(open, admin)).toBe('COMPLETE');
    expect(tickOutcome(pending, admin)).toBe('COMPLETE');
  });
  it('personal / shared project and unknown capabilities: plain completion', () => {
    expect(tickOutcome(open, personal)).toBe('COMPLETE');
    expect(tickOutcome(open, undefined)).toBe('COMPLETE');
  });
});

describe('isPendingReview / canReopenCompleted', () => {
  it('reads reviewStatus; an old cache without the field is not pending', () => {
    expect(isPendingReview(pending)).toBe(true);
    expect(isPendingReview(open)).toBe(false);
    expect(isPendingReview({ completedAt: null } as never)).toBe(false);
  });
  it('a Member cannot reopen a completed task (completed by an Admin), everyone else can', () => {
    expect(canReopenCompleted(member)).toBe(false);
    expect(canReopenCompleted(admin)).toBe(true);
    expect(canReopenCompleted(undefined)).toBe(true);
  });
  it('done tasks are not pending', () => {
    expect(isPendingReview(done)).toBe(false);
  });
});
