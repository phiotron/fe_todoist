import '../../i18n';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { layout, size } from '../../theme';
import { Fab } from '../Fab';

/** M3x: the + button follows Settings › Navigation bar › Add button position (default right). */
describe('Fab placement', () => {
  const styleOf = () => StyleSheet.flatten(screen.getByTestId('fab').props.style);

  it('sits 20 from the right by default and for RIGHT', async () => {
    await render(<Fab label="Add" onPress={jest.fn()} placement="RIGHT" />);
    expect(styleOf()).toMatchObject({ right: layout.fabRight, bottom: layout.fabBottom });
    expect(styleOf().left).toBeUndefined();
  });

  it('sits 20 from the left for LEFT', async () => {
    await render(<Fab label="Add" onPress={jest.fn()} placement="LEFT" />);
    expect(styleOf()).toMatchObject({ left: layout.fabRight, bottom: layout.fabBottom });
    expect(styleOf().right).toBeUndefined();
  });

  it('is centred horizontally for CENTER', async () => {
    await render(<Fab label="Add" onPress={jest.fn()} placement="CENTER" />);
    expect(styleOf()).toMatchObject({ left: '50%', marginLeft: -size.fab / 2, bottom: layout.fabBottom });
    expect(styleOf().right).toBeUndefined();
  });
});
