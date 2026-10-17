// Điểm vào của app: expo-router + tác vụ nền và màn cấu hình cho widget màn hình chính (Android).
import 'expo-router/entry';

import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';

import { WidgetConfigScreen } from './src/features/widget/custom/ConfigScreen';
import { widgetTaskHandler } from './src/features/widget/task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
registerWidgetConfigurationScreen(WidgetConfigScreen);
