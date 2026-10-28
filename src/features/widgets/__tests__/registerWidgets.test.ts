import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { registerWidgetsIfAndroid } from '../registerWidgets';
import { widgetTaskHandler } from '../widgetTaskHandler';

describe('registerWidgetsIfAndroid (app entry, X5)', () => {
  it('registers the widget task handler on Android', () => {
    expect(registerWidgetsIfAndroid('android')).toBe(true);
    expect(registerWidgetTaskHandler).toHaveBeenCalledWith(widgetTaskHandler);
  });

  it('does not touch the widget library on iOS or web', () => {
    expect(registerWidgetsIfAndroid('ios')).toBe(false);
    expect(registerWidgetsIfAndroid('web')).toBe(false);
    expect(registerWidgetTaskHandler).not.toHaveBeenCalled();
  });
});
