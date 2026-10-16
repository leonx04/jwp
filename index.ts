// Điểm vào của app: expo-router + tác vụ nền cho widget màn hình chính (Android).
import 'expo-router/entry';

import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './src/features/widget/task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
