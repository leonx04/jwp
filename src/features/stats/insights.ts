// Nhận xét tự động bằng tiếng Việt từ số liệu đã phân tích. Hàm thuần — định dạng tiền truyền vào.
import { WEEKDAY_NAMES, formatDate, type DateString } from '@/lib/date';

import type { CategoryDelta, FlowType, Spike } from './analysis';
import type { StatsMode } from './periods';

/** good: tin tốt (chi giảm / thu tăng) · bad: cần chú ý · neutral: thông tin */
export type InsightTone = 'good' | 'bad' | 'neutral';

export type InsightIcon =
  | 'trending-up'
  | 'trending-down'
  | 'speedometer-outline'
  | 'flash-outline'
  | 'calendar-outline'
  | 'today-outline'
  | 'pie-chart-outline'
  | 'remove-outline';

export type Insight = { key: string; tone: InsightTone; icon: InsightIcon; text: string };

export type InsightInput = {
  type: FlowType;
  mode: StatsMode;
  /** Kỳ đang diễn ra (chưa hết) → so sánh "cùng kỳ" */
  inProgress: boolean;
  total: number;
  /** Tổng kỳ trước tính đến cùng thời điểm (so sánh công bằng) */
  previousTotal: number;
  /** Tổng cả kỳ trước */
  previousFullTotal: number;
  categories: readonly CategoryDelta[];
  spikes: readonly Spike[];
  /** Trung bình mỗi ngày (tháng) hoặc mỗi tháng (năm) */
  average: number;
  topDay: { date: DateString; amount: number } | null;
  topWeekday: { weekday: number; average: number; ratio: number } | null;
  /** Dự báo tổng cuối kỳ (chỉ khi kỳ đang diễn ra) */
  projection: number | null;
  format: (amount: number) => string;
  /** Tối đa bao nhiêu nhận xét */
  limit?: number;
};

/** 35.4 → '35%' · 0.6 → '1%' */
export function formatPercent(value: number): string {
  return `${Math.max(1, Math.round(Math.abs(value)))}%`;
}

/** 2.14 → '2,1' */
export function formatRatio(value: number): string {
  return (Math.round(value * 10) / 10).toString().replace('.', ',');
}

/** Chênh lệch tối thiểu để một danh mục "đáng nói": ≥ 5% tổng kỳ và ≥ 50.000 ₫ */
function notable(delta: number, total: number): boolean {
  return Math.abs(delta) >= Math.max(50_000, total * 0.05);
}

export function buildInsights(input: InsightInput): Insight[] {
  const {
    type,
    mode,
    inProgress,
    total,
    previousTotal,
    previousFullTotal,
    categories,
    spikes,
    average,
    topDay,
    topWeekday,
    projection,
    format,
    limit = 6,
  } = input;
  const expense = type === 'expense';
  const noun = expense ? 'Chi tiêu' : 'Thu nhập';
  const verb = expense ? 'chi' : 'thu';
  const unit = mode === 'month' ? 'tháng' : 'năm';
  const prevNoun = `${unit} trước`;
  const versus = inProgress ? `cùng kỳ ${prevNoun}` : prevNoun;
  /** Tăng là tốt với thu nhập, xấu với chi tiêu */
  const toneOf = (up: boolean): InsightTone => (up === expense ? 'bad' : 'good');
  const insights: Insight[] = [];
  if (total <= 0 && previousTotal <= 0) return insights;

  // 1. Dự báo cuối kỳ theo tốc độ hiện tại (chỉ với chi tiêu — thu nhập thường dồn vào ngày lương)
  if (expense && projection != null && projection > 0) {
    const ratio = previousFullTotal > 0 ? projection / previousFullTotal : 1;
    insights.push({
      key: 'projection',
      tone: ratio > 1.05 ? 'bad' : ratio < 0.95 ? 'good' : 'neutral',
      icon: 'speedometer-outline',
      text:
        `Theo tốc độ hiện tại, cuối ${unit} ${verb} khoảng ${format(projection)}` +
        (previousFullTotal > 0 ? ` (${prevNoun} ${format(previousFullTotal)})` : ''),
    });
  }

  // 2. Tổng so với kỳ trước
  if (previousTotal > 0) {
    const change = ((total - previousTotal) / previousTotal) * 100;
    if (Math.abs(change) < 3) {
      insights.push({
        key: 'total',
        tone: 'neutral',
        icon: 'remove-outline',
        text: `${noun} gần như không đổi so với ${versus}`,
      });
    } else {
      insights.push({
        key: 'total',
        tone: toneOf(change > 0),
        icon: change > 0 ? 'trending-up' : 'trending-down',
        text: `${noun} ${change > 0 ? 'tăng' : 'giảm'} ${formatPercent(change)} so với ${versus}`,
      });
    }
  }

  // 3. Danh mục tăng mạnh nhất
  const mentioned = new Set<string>();
  const increase = categories
    .filter((c) => c.change != null && c.change >= 20 && notable(c.delta, total))
    .sort((a, b) => b.delta - a.delta)[0];
  if (increase && increase.change != null) {
    mentioned.add(increase.key);
    insights.push({
      key: `up-${increase.key}`,
      tone: toneOf(true),
      icon: 'trending-up',
      text: `${increase.name} tăng ${formatPercent(increase.change)} so với ${versus}`,
    });
  }

  // 4. Tăng đột biến so với trung bình nhiều kỳ trước
  const spike = spikes.find((s) => !mentioned.has(s.key));
  if (spike && expense) {
    mentioned.add(spike.key);
    insights.push({
      key: `spike-${spike.key}`,
      tone: 'bad',
      icon: 'flash-outline',
      text: `${spike.name} cao bất thường: gấp ${formatRatio(spike.ratio)} lần mức trung bình 3 ${unit} trước`,
    });
  }

  // 5. Danh mục giảm mạnh nhất (chỉ khi kỳ đã có số liệu cùng kỳ)
  const decrease = categories
    .filter((c) => c.change != null && c.change <= -20 && notable(c.delta, Math.max(total, previousTotal)))
    .sort((a, b) => a.delta - b.delta)[0];
  if (decrease && decrease.change != null && !mentioned.has(decrease.key)) {
    insights.push({
      key: `down-${decrease.key}`,
      tone: toneOf(false),
      icon: 'trending-down',
      text: `${decrease.name} giảm ${formatPercent(decrease.change)} so với ${versus}`,
    });
  }

  // 6. Thứ trong tuần chi nhiều nhất
  if (expense && topWeekday && topWeekday.ratio >= 1.15) {
    insights.push({
      key: 'weekday',
      tone: 'neutral',
      icon: 'calendar-outline',
      text: `${WEEKDAY_NAMES[topWeekday.weekday - 1]} là ngày bạn chi nhiều nhất (trung bình ${format(topWeekday.average)})`,
    });
  }

  // 7. Trung bình
  if (total > 0 && average > 0 && (expense || mode === 'year')) {
    insights.push({
      key: 'average',
      tone: 'neutral',
      icon: 'today-outline',
      text: `Trung bình mỗi ${mode === 'month' ? 'ngày' : 'tháng'} ${verb} ${format(average)}`,
    });
  }

  // 8. Danh mục chiếm tỷ trọng lớn
  const top = categories[0];
  if (top && categories.length >= 2 && top.share >= 0.3) {
    insights.push({
      key: 'share',
      tone: 'neutral',
      icon: 'pie-chart-outline',
      text: `${top.name} chiếm ${formatPercent(top.share * 100)} tổng ${expense ? 'chi' : 'thu'}`,
    });
  }

  // 9. Ngày chi nhiều nhất trong tháng
  if (expense && mode === 'month' && topDay && total > 0 && topDay.amount >= total * 0.15) {
    insights.push({
      key: 'top-day',
      tone: 'neutral',
      icon: 'flash-outline',
      text: `Ngày ${verb} nhiều nhất: ${formatDate(topDay.date, false)} — ${format(topDay.amount)}`,
    });
  }

  return insights.slice(0, limit);
}
