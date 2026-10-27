import { fireEvent, render, screen } from '@testing-library/react-native';
import { PROJECT_COLORS } from '../../api/models';
import { ColorSwatches } from '../ColorSwatches';

describe('ColorSwatches (20 colour keys, spec 10.1)', () => {
  it('shows every colour key once', async () => {
    await render(<ColorSwatches value="charcoal" onChange={jest.fn()} testID="colors" />);
    expect(PROJECT_COLORS).toHaveLength(20);
    for (const color of PROJECT_COLORS) expect(screen.getByTestId(`colors-${color}`)).toBeTruthy();
  });

  it('marks the chosen colour and reports a new choice', async () => {
    const onChange = jest.fn();
    await render(<ColorSwatches value="red" onChange={onChange} testID="colors" />);
    expect(screen.getByTestId('colors-red').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('colors-blue').props.accessibilityState).toMatchObject({ selected: false });

    await fireEvent.press(screen.getByTestId('colors-blue'));
    expect(onChange).toHaveBeenCalledWith('blue');
  });
});
