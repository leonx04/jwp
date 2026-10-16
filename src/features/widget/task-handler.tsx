// Tác vụ nền của widget: Android gọi khi widget được thêm / làm mới định kỳ / đổi cỡ.
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { db } from '@/db';

import { loadWidgetData } from './data';
import { renderWidgetByName } from './widgets';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(renderWidgetByName(props.widgetInfo.widgetName, loadWidgetData(db)));
      break;
    default:
      break;
  }
}
