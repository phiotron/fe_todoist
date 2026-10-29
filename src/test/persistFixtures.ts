import type { QueryClient } from '@tanstack/react-query';
import type { Task } from '../api/models';
import { makeTask, page } from './m1Fixtures';

/**
 * PERF3: a query cache like the one measured on the demo account (2221 tasks): Today 84, Overdue, widget, Inbox 300,
 * 7 projects with 250 open tasks each, Upcoming, 80 task details, 40 subtask lists, one search, 150 activity rows.
 */
const uuid = (n: number) => `3f2a9c1e-7b4d-4e8a-9c3f-${n.toString(16).padStart(12, '0')}`;

export function demoTasks(from: number, count: number): Task[] {
  return Array.from({ length: count }, (_, i) =>
    makeTask({
      id: uuid(from + i),
      projectId: uuid(900000 + ((from + i) % 12)),
      content: `Cong viec so ${from + i} can hoan thanh truoc han nop bao cao quy`,
      description: i % 3 === 0 ? 'Mo ta chi tiet cua cong viec, gom cac buoc can lam va nguoi lien quan.' : '',
      dueDate: '2026-10-29',
      projectName: 'Du an trien khai he thong',
      labelIds: [uuid(1), uuid(2)],
      createdAt: '2026-10-20T08:15:30.123Z',
      updatedAt: '2026-10-28T10:22:11.456Z',
    }),
  );
}

export function infiniteOf<T>(all: T[], size = 50) {
  const pages = [];
  for (let i = 0; i < all.length; i += size) {
    pages.push(page(all.slice(i, i + size), i + size < all.length ? `cur${i}` : null));
  }
  return { pages, pageParams: pages.map((_, i) => (i === 0 ? null : `cur${i}`)) };
}

export function fillDemoCache(qc: QueryClient): void {
  const all = demoTasks(1, 2221);
  qc.setQueryData(
    ['tasks', 'list', { view: 'today', today: '2026-10-29', sort: 'date', order: 'asc', group: 'none' }],
    infiniteOf(all.slice(0, 84)),
  );
  qc.setQueryData(['tasks', 'list', { view: 'overdue' }], infiniteOf(all.slice(84, 150)));
  qc.setQueryData(['tasks', 'widget-today', '2026-10-29'], page(all.slice(0, 50)));
  qc.setQueryData(['tasks', 'list', { projectId: 'inbox' }], infiniteOf(all.slice(150, 450)));
  for (let p = 0; p < 7; p++) {
    qc.setQueryData(['tasks', 'list', { projectId: `p${p}` }], infiniteOf(all.slice(450 + p * 250, 700 + p * 250)));
  }
  qc.setQueryData(['tasks', 'upcoming', '2026-10-29', null], infiniteOf(all.slice(300, 500)));
  for (let i = 0; i < 80; i++) qc.setQueryData(['tasks', 'detail', all[i].id], all[i]);
  for (let i = 0; i < 40; i++) qc.setQueryData(['tasks', 'subtasks', all[i].id], all.slice(i, i + 6));
  qc.setQueryData(['search', 'tasks', { q: 'a', completed: false }], infiniteOf(all.slice(0, 100)));
  qc.setQueryData(
    ['projects', 'list', { archived: false }],
    Array.from({ length: 60 }, (_, i) => ({ id: uuid(900000 + i), name: `Du an ${i}`, color: 'red', description: '', parentId: null })),
  );
  qc.setQueryData(['labels', 'list'], Array.from({ length: 100 }, (_, i) => ({ id: uuid(i), name: `nhan ${i}`, color: 'red' })));
  qc.setQueryData(['me'], { id: 'u1', email: 'a@b.c' });
  qc.setQueryData(['settings'], { locale: 'vi' });
  qc.setQueryData(['activity', 'list', {}], infiniteOf(Array.from({ length: 150 }, (_, i) => ({ id: i, text: 'x'.repeat(120) }))));
}
