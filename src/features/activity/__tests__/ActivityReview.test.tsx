import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { activityItem } from '../../../test/m10Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { ActivityLogView } from '../ActivityLogView';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-11-12T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const at = '2026-11-12T02:00:00Z';
const items = [
  activityItem({ id: 'r1', eventType: 'REVIEW_REQUESTED', objectName: 'Báo cáo', createdAt: at }),
  activityItem({ id: 'r2', eventType: 'REVIEW_APPROVED', objectName: 'Hợp đồng', createdAt: at }),
  activityItem({ id: 'r3', eventType: 'REVIEW_REJECTED', objectName: 'Slide', createdAt: at }),
  activityItem({ id: 'r4', eventType: 'REVIEW_CANCELLED', objectName: 'Lịch họp', createdAt: at }),
];
const routes = () => ({
  'GET /api/v1/activity': () => jsonResponse(200, { items, nextCursor: null }),
  'GET /api/v1/projects': () => jsonResponse(200, []),
});

describe('Activity log — review events', () => {
  it('shows the four review events in Vietnamese', async () => {
    await renderSignedIn(<ActivityLogView />, routes());
    expect(await screen.findByText('Bạn đã gửi yêu cầu duyệt công việc: Báo cáo')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã duyệt công việc: Hợp đồng')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã trả lại công việc: Slide')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã huỷ yêu cầu duyệt công việc: Lịch họp')).toBeOnTheScreen();
  });

  it('the filter chip of a review event sends the lower-case eventType', async () => {
    const { fetchMock } = await renderSignedIn(<ActivityLogView />, routes());
    await screen.findByText('Bạn đã duyệt công việc: Hợp đồng');
    await fireEvent.press(screen.getByTestId('activity-log-event-REVIEW_APPROVED'));
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET', '/api/v1/activity').some((r) => r.query.get('eventType') === 'review_approved')).toBe(true),
    );
  });
});
