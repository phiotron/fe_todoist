import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { jsonResponse } from '../../../test/http';
import { page } from '../../../test/m1Fixtures';
import { makeNotification } from '../../../test/m8bFixtures';
import { renderSignedIn } from '../../../test/screen';
import { NotificationsScreen } from '../NotificationsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const requested = makeNotification({ id: 'n-req', type: 'REVIEW_REQUESTED', taskId: 't-7', taskContent: 'Làm báo cáo', commentExcerpt: null, commentId: null });
const approved = makeNotification({ id: 'n-ok', type: 'REVIEW_APPROVED', taskId: 't-8', taskContent: 'Gửi hợp đồng', commentExcerpt: null, commentId: null });
const rejected = makeNotification({ id: 'n-no', type: 'REVIEW_REJECTED', taskId: 't-9', taskContent: 'Làm slide', commentExcerpt: null, commentId: null });

describe('Notifications — review', () => {
  beforeEach(() => jest.clearAllMocks());

  async function open() {
    await renderSignedIn(<NotificationsScreen />, {
      'GET /api/v1/notifications': () => jsonResponse(200, page([requested, approved, rejected])),
      'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 3 }),
      'POST /api/v1/notifications/n-req/read': () => jsonResponse(204, null),
    });
    await screen.findByText('Bình yêu cầu bạn duyệt một công việc');
  }

  it('shows the right sentence for each review notification', async () => {
    await open();
    expect(screen.getByText('Bình đã duyệt công việc của bạn')).toBeOnTheScreen();
    expect(screen.getByText('Bình đã trả lại công việc của bạn')).toBeOnTheScreen();
    expect(screen.queryByText('Bình đã nhắc đến bạn trong một bình luận')).toBeNull();
  });

  it('opens the task', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('notification-n-req'));
    expect(router.push).toHaveBeenCalledWith('/task/t-7');
  });
});
