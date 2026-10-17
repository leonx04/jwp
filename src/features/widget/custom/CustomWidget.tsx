// Giao diện widget "JWP · Tùy chỉnh": cùng một khung cho mọi loại nội dung, tự co giãn theo kích thước người dùng kéo.
//  • Nhỏ (2×1): nhãn + giá trị lớn + thanh tiến độ (nếu bật).
//  • Cao hơn: thêm dòng mô tả; cao nữa: thêm các dòng phụ (ví, ngân sách, quỹ…).
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { PALETTE_COLORS, TONE_COLORS, type WidgetConfig } from './config';
import type { Card } from './metrics';

export type CustomSize = { width: number; height: number };

const WHITE = '#ffffff';
const SOFT = 'rgba(255, 255, 255, 0.75)';
const HIDDEN = '••••';

/** Màu nền: bảng màu đã chọn, hoặc theo trạng thái khi để "tự động" */
export function backgroundOf(config: Pick<WidgetConfig, 'palette'>, tone: Card['tone']) {
  return config.palette === 'auto' ? TONE_COLORS[tone] : PALETTE_COLORS[config.palette];
}

function Bar({ ratio, height = 5 }: { ratio: number; height?: number }) {
  const p = Math.max(0, Math.min(1, ratio));
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height,
        flexDirection: 'row',
        borderRadius: height / 2,
        backgroundColor: 'rgba(255, 255, 255, 0.26)',
        overflow: 'hidden',
      }}
    >
      {p > 0 ? <FlexWidget style={{ flex: p, height, borderRadius: height / 2, backgroundColor: WHITE }} /> : null}
      {p < 1 ? <FlexWidget style={{ flex: 1 - p, height }} /> : null}
    </FlexWidget>
  );
}

export function CustomWidget({ card, config, size }: { card: Card; config: WidgetConfig; size: CustomSize }) {
  const bg = backgroundOf(config, card.tone);
  const roomy = size.height >= 100;
  const tall = size.height >= 150;
  const maxRows = Math.max(0, Math.min(card.rows.length, Math.floor((size.height - 130) / 22) + 1));
  const value = config.hideAmounts ? HIDDEN : size.width >= 210 ? card.value : card.short;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `jwp://${card.href}` }}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        borderRadius: 22,
        paddingHorizontal: 12,
        paddingVertical: 9,
        justifyContent: 'center',
        backgroundGradient: { from: bg.from as `#${string}`, to: bg.to as `#${string}`, orientation: 'TL_BR' },
      }}
    >
      <TextWidget text={card.label.toUpperCase()} maxLines={1} truncate="END" style={{ fontSize: 9, fontWeight: '700', color: SOFT }} />
      <TextWidget text={value} maxLines={1} style={{ fontSize: 22, fontWeight: '800', color: WHITE }} />
      {config.showBar && card.ratio !== null ? <Bar ratio={card.ratio} /> : null}
      {roomy && card.sub ? (
        <TextWidget
          text={config.hideAmounts ? '' : card.sub}
          maxLines={2}
          truncate="END"
          style={{ fontSize: 10, color: SOFT, marginTop: 4 }}
        />
      ) : null}
      {tall && maxRows > 0 ? (
        <FlexWidget style={{ width: 'match_parent', marginTop: 6, flexGap: 4 }}>
          {card.rows.slice(0, maxRows).map((row) => (
            <FlexWidget key={row.label} style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
              <TextWidget text={row.label} maxLines={1} truncate="END" style={{ fontSize: 11, color: SOFT }} />
              <TextWidget text={config.hideAmounts ? HIDDEN : row.value} style={{ fontSize: 11, fontWeight: '700', color: WHITE }} />
            </FlexWidget>
          ))}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
