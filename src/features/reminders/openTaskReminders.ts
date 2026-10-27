/** Swipe action "Reminders" (spec 9.2): the task screen with its reminder editor already open. */
export function openTaskReminders(router: { push: (href: { pathname: '/task/[id]'; params: { id: string; reminders: string } }) => void }, taskId: string): void {
  router.push({ pathname: '/task/[id]', params: { id: taskId, reminders: '1' } });
}
