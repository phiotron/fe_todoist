import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SwipeToFavorite } from '../SwipeToFavorite';

describe('SwipeToFavorite', () => {
  it('renders the row it wraps (the swipe itself is gesture-handler territory, covered on the emulator)', async () => {
    await render(
      <SwipeToFavorite isFavorite={false} onToggle={jest.fn()} testID="swipe">
        <Text>Gấp</Text>
      </SwipeToFavorite>,
    );
    expect(screen.getByText('Gấp')).toBeTruthy();
  });
});
