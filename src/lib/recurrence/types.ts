export type Weekday = 'MO'|'TU'|'WE'|'TH'|'FR'|'SA'|'SU';
export interface RecurrenceSpec {
  freq: 'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY';
  interval: number;                                   // ≥ 1
  byDay?: { weekday: Weekday; ordinal?: number }[];   // ordinal: 1..4 | -1
  byMonthDay?: number[];                              // 1..31 | -1
  byMonth?: number[];                                 // 1..12
  bySetPos?: number;                                  // -1 | 1..4
  untilDate?: string;                                 // 'yyyy-MM-dd' (gồm ngày cuối)
  fromCompletion: boolean;                            // every! / "completed date"
}
// toRRule / fromRRule (contract 8.1): khai báo trong contract không có thân hàm nên cài ở ./rrule và xuất lại ở đây.
export { toRRule, fromRRule } from './rrule';
