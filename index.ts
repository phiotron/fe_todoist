// App entry. expo-router/entry registers the app; the widget handler (M12, Android only) must be registered here as
// well, because Android can start the JS runtime only to draw a widget, without any screen. X5: on iOS the widget
// library is never loaded (see registerWidgetsIfAndroid).
import 'expo-router/entry';
import { registerWidgetsIfAndroid } from './src/features/widgets/registerWidgets';

registerWidgetsIfAndroid();
