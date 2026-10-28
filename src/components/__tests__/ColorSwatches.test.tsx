import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PROJECT_COLORS } from '../../api/models';
import i18n from '../../i18n';
import viProjects from '../../i18n/locales/vi/projects.json';
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

  describe('accessibility labels use the localised colour names (same as the project form)', () => {
    afterEach(async () => {
      await act(async () => {
        await i18n.changeLanguage('vi');
      });
    });

    it('speaks Vietnamese names in vi, never the raw key', async () => {
      await render(<ColorSwatches value="red" onChange={jest.fn()} testID="colors" />);
      expect(screen.getByTestId('colors-berry_red').props.accessibilityLabel).toBe('Màu Đỏ mận');
      expect(screen.getByTestId('colors-olive_green').props.accessibilityLabel).toBe('Màu Xanh ô liu');
      for (const color of PROJECT_COLORS) {
        const label = screen.getByTestId(`colors-${color}`).props.accessibilityLabel as string;
        expect(label).toBe(`Màu ${viProjects.projects.colors[color]}`);
        expect(label).not.toContain('_');
      }
    });

    it('speaks English names in en', async () => {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      await render(<ColorSwatches value="red" onChange={jest.fn()} testID="colors" />);
      expect(screen.getByTestId('colors-berry_red').props.accessibilityLabel).toBe('Color Berry red');
      expect(screen.getByTestId('colors-lime_green').props.accessibilityLabel).toBe('Color Lime green');
    });
  });
});
