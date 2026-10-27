import { createContext } from 'react';

/**
 * true when the task screen was opened by the "Reminders" swipe action (route param `reminders=1`): the reminder
 * editor opens at once. A context (default false) so the M1 task screen and its tests need no router mock for it.
 */
export const OpenRemindersContext = createContext(false);
