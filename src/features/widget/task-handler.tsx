// Tác vụ nền của widget: Android gọi khi widget được thêm / làm mới định kỳ / đổi cỡ / bị xóa.
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { db } from '@/db';

import { deleteWidgetConfig } from './custom/config';
import { renderWidgetForInfo } from './render';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(renderWidgetForInfo(db, props.widgetInfo));
      break;
    case 'WIDGET_DELETED':
      deleteWidgetConfig(props.widgetInfo.widgetId);
      break;
    default:
      break;
  }
}
