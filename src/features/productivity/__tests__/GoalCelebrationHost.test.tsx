import { act, screen, waitFor } from '@testing-library/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../../../api/queryKeys';
import { jsonResponse } from '../../../test/http';
import { productivity } from '../../../test/m10Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { GoalCelebrationHost } from '../GoalCelebrationHost';

let answer = productivity();
let refetch: () => Promise<void> = async () => undefined;

/** Stands in for "a write happened": every data write invalidates GET productivity. */
function Invalidator() {
  const queryClient = useQueryClient();
  useEffect(() => {
    refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.productivity.all });
  }, [queryClient]);
  return null;
}

const routes = { 'GET /api/v1/productivity': () => jsonResponse(200, answer) };

function reached(base: ReturnType<typeof productivity>, which: 'daily' | 'weekly') {
  const next = productivity({ ...base });
  next[which] = { ...next[which], reached: true } as never;
  return next;
}

describe('GoalCelebrationHost', () => {
  beforeEach(() => {
    answer = productivity();
  });

  it('stays silent on the first answer, then congratulates when the daily goal is reached', async () => {
    await renderSignedIn(
      <>
        <GoalCelebrationHost />
        <Invalidator />
      </>,
      routes,
    );
    await waitFor(() => expect(screen.queryByText(/Chúc mừng/)).toBeNull());

    answer = reached(answer, 'daily');
    await act(async () => refetch());

    expect(await screen.findByText('Chúc mừng! Bạn đã đạt mục tiêu hôm nay.')).toBeOnTheScreen();
  });

  it('prefers the weekly message when both goals are reached at once', async () => {
    await renderSignedIn(
      <>
        <GoalCelebrationHost />
        <Invalidator />
      </>,
      routes,
    );
    await waitFor(() => expect(screen.queryByText(/Chúc mừng/)).toBeNull());

    answer = reached(reached(answer, 'daily'), 'weekly');
    await act(async () => refetch());

    expect(await screen.findByText('Tuyệt vời! Bạn đã đạt mục tiêu tuần này.')).toBeOnTheScreen();
  });

  it('says nothing when the user turned Goal celebrations off', async () => {
    answer = productivity({ goalCelebrations: false });
    await renderSignedIn(
      <>
        <GoalCelebrationHost />
        <Invalidator />
      </>,
      routes,
    );
    await waitFor(() => expect(screen.queryByText(/Chúc mừng/)).toBeNull());

    answer = { ...reached(answer, 'daily'), goalCelebrations: false };
    await act(async () => refetch());
    await act(async () => undefined);

    expect(screen.queryByText(/Chúc mừng/)).toBeNull();
  });
});
