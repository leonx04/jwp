// Chọn cách vẽ cho từng widget đang có trên màn hình chính: widget tùy chỉnh đọc cấu hình riêng theo widgetId.
import React from 'react';
import type { WidgetInfo } from 'react-native-android-widget';

import type { AppDatabase } from '@/db/types';

import { CustomWidget } from './custom/CustomWidget';
import { getWidgetConfig } from './custom/config';
import { resolveCard } from './custom/metrics';
import { loadWidgetData } from './data';
import { renderWidgetByName } from './widgets';

export function renderWidgetForInfo(db: AppDatabase, info: WidgetInfo): React.JSX.Element {
  if (info.widgetName === 'JwpCustom') {
    const config = getWidgetConfig(info.widgetId);
    return <CustomWidget card={resolveCard(db, config)} config={config} size={{ width: info.width, height: info.height }} />;
  }
  return renderWidgetByName(info.widgetName, loadWidgetData(db), info);
}
