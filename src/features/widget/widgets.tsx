// Widget màn hình chính — nhỏ gọn và co giãn theo kích thước người dùng kéo:
//  • JwpToday   2×1: "còn được tiêu hôm nay" + thanh tiến độ + nút "+" ghi nhanh. Kéo cao / rộng hơn mới hiện thêm.
//  • JwpBudgets 2×1: ngân sách sát hạn mức nhất; kéo cao hơn thì hiện thêm các ngân sách tiếp theo.
//  • JwpQuick   1×1: một nút "+" mở Gõ nhanh.
// Màu theo trạng thái: tím-xanh = ổn, cam = sắp hết, đỏ hồng = vượt.
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { t } from '@/lib/i18n';

import type { WidgetBudget, WidgetData, WidgetToday } from './data';

export type WidgetSize = { width: number; height: number };

const WHITE = '#ffffff';
const SOFT = 'rgba(255, 255, 255, 0.75)';
const TRACK = 'rgba(255, 255, 255, 0.26)';

const GRADIENTS = {
  ok: { from: '#6B4AF1', to: '#2563EB' },
  low: { from: '#F59E0B', to: '#EA580C' },
  over: { from: '#E11D48', to: '#9F1239' },
} as const;

const BUDGET_COLOR = { ok: '#34D399', warning: '#FBBF24', over: '#FB7185' } as const;

const open = (path: string) => ({
  clickAction: 'OPEN_URI' as const,
  clickActionData: { uri: `jwp://${path}` },
});

function Bar({ ratio, fill, track, height = 5 }: { ratio: number; fill: string; track: string; height?: number }) {
  const p = Math.max(0, Math.min(1, ratio));
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height,
        flexDirection: 'row',
        borderRadius: height / 2,
        backgroundColor: track as `#${string}`,
        overflow: 'hidden',
      }}
    >
      {p > 0 ? (
        <FlexWidget style={{ flex: p, height, borderRadius: height / 2, backgroundColor: fill as `#${string}` }} />
      ) : null}
      {p < 1 ? <FlexWidget style={{ flex: 1 - p, height }} /> : null}
    </FlexWidget>
  );
}

function PlusButton({ size = 34, path = 'quick-add' }: { size?: number; path?: string }) {
  return (
    <FlexWidget
      {...open(path)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255, 255, 255, 0.24)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TextWidget text="+" style={{ fontSize: size * 0.62, fontWeight: '700', color: WHITE }} />
    </FlexWidget>
  );
}

function Pill({ label, path }: { label: string; path: string }) {
  return (
    <FlexWidget
      {...open(path)}
      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
    >
      <TextWidget text={label} style={{ fontSize: 11, fontWeight: '700', color: WHITE }} />
    </FlexWidget>
  );
}

export function TodayWidget({ today, size }: { today: WidgetToday | null; size: WidgetSize }) {
  const base = {
    width: 'match_parent' as const,
    height: 'match_parent' as const,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 9,
  };
  if (!today) {
    return (
      <FlexWidget
        {...open('')}
        style={{ ...base, justifyContent: 'center', backgroundGradient: { ...GRADIENTS.ok, orientation: 'TL_BR' } }}
      >
        <TextWidget text={t('Mở JWP')} style={{ fontSize: 14, fontWeight: '700', color: WHITE }} />
      </FlexWidget>
    );
  }
  const over = today.state === 'over';
  const roomy = size.height >= 100; // đủ cao: thêm dòng "còn N ngày tới lương" + nút Chi / Thu
  const showPlus = size.width >= 150;
  const amount = size.width >= 230 ? (over ? today.overText : today.leftText) : over ? today.overCompact : today.leftCompact;

  return (
    <FlexWidget
      style={{
        ...base,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundGradient: { ...GRADIENTS[today.state], orientation: 'TL_BR' },
      }}
    >
      <FlexWidget {...open('')} style={{ flex: 1, justifyContent: 'center' }}>
        <TextWidget
          text={(over ? t('Vượt hôm nay') : t('Còn hôm nay')).toUpperCase()}
          maxLines={1}
          style={{ fontSize: 9, fontWeight: '700', color: SOFT }}
        />
        <TextWidget text={amount} maxLines={1} style={{ fontSize: 22, fontWeight: '800', color: WHITE }} />
        <Bar ratio={today.progress} fill={WHITE} track={TRACK} />
        {roomy ? (
          <FlexWidget style={{ width: 'match_parent', marginTop: 6, flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
            <Pill label={`− ${t('Chi')}`} path="transaction/new?type=expense" />
            <Pill label={`+ ${t('Thu')}`} path="transaction/new?type=income" />
            {today.incomeText && size.width >= 230 ? (
              <TextWidget text={today.incomeText} maxLines={1} truncate="END" style={{ fontSize: 10, color: SOFT }} />
            ) : null}
          </FlexWidget>
        ) : null}
      </FlexWidget>
      {showPlus ? (
        <FlexWidget style={{ marginLeft: 8 }}>
          <PlusButton />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

export function QuickWidget() {
  return (
    <FlexWidget
      {...open('quick-add')}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundGradient: { ...GRADIENTS.ok, orientation: 'TL_BR' },
      }}
    >
      <TextWidget text="+" style={{ fontSize: 32, fontWeight: '700', color: WHITE }} />
    </FlexWidget>
  );
}

function BudgetRow({ b }: { b: WidgetBudget }) {
  return (
    <FlexWidget style={{ width: 'match_parent' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
        <TextWidget text={b.name} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: '600', color: WHITE }} />
        <TextWidget text={b.remainingText} style={{ fontSize: 12, fontWeight: '700', color: BUDGET_COLOR[b.state] }} />
      </FlexWidget>
      <FlexWidget style={{ height: 3 }} />
      <Bar ratio={b.ratio} fill={BUDGET_COLOR[b.state]} track="rgba(255, 255, 255, 0.16)" height={5} />
    </FlexWidget>
  );
}

export function BudgetWidget({ budgets, size }: { budgets: WidgetBudget[]; size: WidgetSize }) {
  // Mỗi dòng ngân sách cao ~34dp; cao hơn thì hiện thêm dòng (tối đa 4)
  const rows = Math.max(1, Math.min(4, Math.floor((size.height - 18) / 34)));
  return (
    <FlexWidget
      {...open('budgets')}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        borderRadius: 22,
        paddingHorizontal: 12,
        paddingVertical: 9,
        justifyContent: 'center',
        backgroundGradient: { from: '#111827', to: '#0B1020', orientation: 'TOP_BOTTOM' },
      }}
    >
      {budgets.length ? (
        <FlexWidget style={{ width: 'match_parent', flexGap: 8 }}>
          {budgets.slice(0, rows).map((b) => (
            <BudgetRow key={b.name} b={b} />
          ))}
        </FlexWidget>
      ) : (
        <TextWidget text={t('Chưa có ngân sách')} style={{ fontSize: 13, color: WHITE }} />
      )}
    </FlexWidget>
  );
}

export const WIDGET_NAMES = ['JwpCustom', 'JwpToday', 'JwpBudgets', 'JwpQuick'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

/** Kích thước chưa biết (hiếm) → coi như cỡ nhỏ mặc định 2×1 */
const DEFAULT_SIZE: WidgetSize = { width: 160, height: 70 };

export function renderWidgetByName(name: string, data: WidgetData, size?: Partial<WidgetSize>): React.JSX.Element {
  const s = { width: size?.width || DEFAULT_SIZE.width, height: size?.height || DEFAULT_SIZE.height };
  if (name === 'JwpBudgets') return <BudgetWidget budgets={data.budgets} size={s} />;
  if (name === 'JwpQuick') return <QuickWidget />;
  return <TodayWidget today={data.today} size={s} />;
}
