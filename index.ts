// App entry. expo-router/entry registers the app; the widget handler (M12) must be registered here as well, because
// Android can start the JS runtime only to draw a widget, without any screen.
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/features/widgets/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);
