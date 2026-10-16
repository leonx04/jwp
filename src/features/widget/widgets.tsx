// Giao diện widget màn hình chính (react-native-android-widget): thẻ gradient "Hôm nay được tiêu" và thẻ "Ngân sách".
// Màu đổi theo trạng thái để nhìn lướt là biết: tím-xanh = ổn, vàng = sắp hết, đỏ hồng = vượt.
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { t } from '@/lib/i18n';

import type { WidgetBudget, WidgetData, WidgetToday } from './data';

const WHITE = '#ffffff';
const SOFT = 'rgba(255, 255, 255, 0.72)';
const TRACK = 'rgba(255, 255, 255, 0.24)';

const GRADIENTS = {
  ok: { from: '#6B4AF1', to: '#2563EB' },
  low: { from: '#F59E0B', to: '#EA580C' },
  over: { from: '#E11D48', to: '#9F1239' },
} as const;

const BUDGET_COLOR = { ok: '#34D399', warning: '#FBBF24', over: '#FB7185' } as const;

type Uri = (path: string) => { clickAction: 'OPEN_URI'; clickActionData: { uri: string } };
const open: Uri = (path) => ({ clickAction: 'OPEN_URI', clickActionData: { uri: `jwp://${path}` } });

function Bar({ ratio, fill, track, height = 8 }: { ratio: number; fill: string; track: string; height?: number }) {
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

function Pill({ label, path }: { label: string; path: string }) {
  return (
    <FlexWidget
      {...open(path)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
      }}
    >
      <TextWidget text={label} style={{ fontSize: 12, fontWeight: '700', color: WHITE }} />
    </FlexWidget>
  );
}

export function TodayWidget({ today }: { today: WidgetToday | null }) {
  if (!today) {
    return (
      <FlexWidget
        {...open('')}
        style={{
          width: 'match_parent',
          height: 'match_parent',
          borderRadius: 28,
          padding: 16,
          justifyContent: 'center',
          backgroundGradient: { ...GRADIENTS.ok, orientation: 'TL_BR' },
        }}
      >
        <TextWidget text={t('Mở JWP để bắt đầu')} style={{ fontSize: 15, fontWeight: '700', color: WHITE }} />
      </FlexWidget>
    );
  }
  const over = today.state === 'over';
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        borderRadius: 28,
        padding: 16,
        justifyContent: 'space-between',
        backgroundGradient: { ...GRADIENTS[today.state], orientation: 'TL_BR' },
      }}
    >
      <FlexWidget {...open('')} style={{ width: 'match_parent' }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
          <TextWidget
            text={(over ? t('Vượt hôm nay') : t('Hôm nay được tiêu')).toUpperCase()}
            style={{ fontSize: 10, fontWeight: '700', color: SOFT }}
          />
          <TextWidget text={today.incomeText} maxLines={1} truncate="END" style={{ fontSize: 10, color: SOFT }} />
        </FlexWidget>
        <TextWidget
          text={over ? today.overText : today.leftText}
          maxLines={1}
          style={{ fontSize: 30, fontWeight: '800', color: WHITE }}
        />
      </FlexWidget>
      <Bar ratio={today.progress} fill={WHITE} track={TRACK} />
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TextWidget text={t('Đã tiêu {amount}', { amount: today.spentText })} style={{ fontSize: 11, color: SOFT }} />
        <FlexWidget style={{ flexDirection: 'row', flexGap: 6 }}>
          <Pill label={`+ ${t('Chi')}`} path="transaction/new?type=expense" />
          <Pill label={`+ ${t('Thu')}`} path="transaction/new?type=income" />
          <Pill label={`✦ ${t('Gõ nhanh')}`} path="quick-add" />
        </FlexWidget>
      </FlexWidget>
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
      <FlexWidget style={{ height: 4 }} />
      <Bar ratio={b.ratio} fill={BUDGET_COLOR[b.state]} track="rgba(255, 255, 255, 0.14)" height={6} />
    </FlexWidget>
  );
}

export function BudgetWidget({ budgets }: { budgets: WidgetBudget[] }) {
  return (
    <FlexWidget
      {...open('budgets')}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        borderRadius: 28,
        padding: 16,
        justifyContent: 'space-between',
        backgroundGradient: { from: '#111827', to: '#0B1020', orientation: 'TOP_BOTTOM' },
      }}
    >
      <TextWidget
        text={t('Ngân sách còn lại').toUpperCase()}
        style={{ fontSize: 10, fontWeight: '700', color: SOFT }}
      />
      {budgets.length ? (
        <FlexWidget style={{ width: 'match_parent', flexGap: 9 }}>
          {budgets.slice(0, 3).map((b) => (
            <BudgetRow key={b.name} b={b} />
          ))}
        </FlexWidget>
      ) : (
        <TextWidget text={t('Chưa có ngân sách')} style={{ fontSize: 14, color: WHITE }} />
      )}
      <FlexWidget />
    </FlexWidget>
  );
}

export const WIDGET_NAMES = ['JwpToday', 'JwpBudgets'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

export function renderWidgetByName(name: string, data: WidgetData): React.JSX.Element {
  return name === 'JwpBudgets' ? <BudgetWidget budgets={data.budgets} /> : <TodayWidget today={data.today} />;
}
