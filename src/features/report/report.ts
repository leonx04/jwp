// Báo cáo cuối tháng: gom số liệu đã tổng hợp thành bản tóm tắt dễ đọc + văn bản để chia sẻ.
// Hàm thuần — định dạng tiền truyền vào, không đụng DB. Số tiền luôn nguyên (không làm tròn).
import { t } from '@/lib/i18n';
import {
  percentChange,
  sumFlows,
  topSpendingDay,
  type CategoryTotal,
  type DailyFlow,
} from '@/features/stats/analysis';
import { elapsedDays, isInProgress, periodLength } from '@/features/stats/periods';
import { formatDate, toVnDate, type DateString, type Period } from '@/lib/date';

export type ReportExpense = {
  id: string;
  title: string;
  categoryName: string | null;
  amount: number;
  /** ms */
  date: number;
};

export type ReportBudget = { name: string; amount: number; spent: number };

export type ReportCategory = {
  key: string;
  name: string;
  color: string;
  icon: string | null;
  amount: number;
  /** Tỷ trọng trong tổng chi (0–1) */
  share: number;
  /** Cùng kỳ tháng trước */
  previous: number;
  /** % thay đổi; null khi tháng trước không có */
  change: number | null;
};

export type HighlightTone = 'good' | 'bad' | 'neutral';
export type Highlight = { key: string; tone: HighlightTone; text: string };

export type MonthlyReport = {
  period: Period;
  /** Tháng còn đang diễn ra → số liệu chưa đầy đủ */
  inProgress: boolean;
  income: number;
  expense: number;
  /** Thu − chi (âm = chi vượt thu) */
  net: number;
  /** Phần trăm thu nhập còn lại (0–100, có thể âm); null khi không có thu nhập */
  savingRate: number | null;
  /** Tháng trước, cùng số ngày với kỳ này */
  previousIncome: number;
  previousExpense: number;
  incomeChange: number | null;
  expenseChange: number | null;
  /** Chi trung bình mỗi ngày (theo số ngày đã qua) */
  averagePerDay: number;
  topDay: { date: DateString; amount: number } | null;
  /** Tối đa 5 danh mục chi nhiều nhất */
  categories: ReportCategory[];
  /** Phần chi còn lại ngoài các danh mục ở trên */
  otherAmount: number;
  biggestExpenses: ReportExpense[];
  budgets: { name: string; amount: number; spent: number; over: boolean }[];
  highlights: Highlight[];
  hasData: boolean;
};

export type ReportInput = {
  period: Period;
  today: DateString;
  /** Thu / chi từng ngày của kỳ này và của kỳ so sánh (đã cắt cùng số ngày) */
  daily: readonly DailyFlow[];
  previousDaily: readonly DailyFlow[];
  categories: readonly CategoryTotal[];
  previousCategories: readonly CategoryTotal[];
  biggestExpenses: readonly ReportExpense[];
  budgets: readonly ReportBudget[];
  format: (amount: number) => string;
};

const TOP_CATEGORIES = 5;
/** Danh mục tăng được nhắc tên khi tăng ít nhất ngần này % và ngần này tiền */
const RISE_MIN_PERCENT = 30;
const RISE_MIN_AMOUNT = 100_000;

const pct = (value: number) => `${Math.max(1, Math.round(Math.abs(value)))}%`;

export function buildMonthlyReport(input: ReportInput): MonthlyReport {
  const { period, today, format } = input;
  const inProgress = isInProgress(period, today);
  const income = sumFlows(input.daily, 'income');
  const expense = sumFlows(input.daily, 'expense');
  const previousIncome = sumFlows(input.previousDaily, 'income');
  const previousExpense = sumFlows(input.previousDaily, 'expense');
  const days = Math.max(1, inProgress ? elapsedDays(period, today) : periodLength(period));

  const total = input.categories.reduce((s, c) => s + c.amount, 0);
  const before = new Map(input.previousCategories.map((c) => [c.key, c.amount]));
  const ranked: ReportCategory[] = input.categories
    .filter((c) => c.amount > 0)
    .map((c) => {
      const previous = before.get(c.key) ?? 0;
      return {
        key: c.key,
        name: c.name,
        color: c.color,
        icon: c.icon,
        amount: c.amount,
        share: total > 0 ? c.amount / total : 0,
        previous,
        change: percentChange(c.amount, previous),
      };
    })
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const categories = ranked.slice(0, TOP_CATEGORIES);
  const otherAmount = ranked.slice(TOP_CATEGORIES).reduce((s, c) => s + c.amount, 0);

  const budgets = input.budgets.map((b) => ({ ...b, over: b.spent > b.amount }));
  const topDay = topSpendingDay(input.daily, 'expense', period);
  const net = income - expense;
  const savingRate = income > 0 ? (net / income) * 100 : null;

  const report: MonthlyReport = {
    period,
    inProgress,
    income,
    expense,
    net,
    savingRate,
    previousIncome,
    previousExpense,
    incomeChange: percentChange(income, previousIncome),
    expenseChange: percentChange(expense, previousExpense),
    averagePerDay: expense / days,
    topDay,
    categories,
    otherAmount,
    biggestExpenses: input.biggestExpenses.slice(0, 5),
    budgets,
    highlights: [],
    hasData: income > 0 || expense > 0,
  };
  report.highlights = buildHighlights(report, format);
  return report;
}

function buildHighlights(r: MonthlyReport, format: (amount: number) => string): Highlight[] {
  const out: Highlight[] = [];
  const since = r.inProgress ? 'cùng kỳ tháng trước' : 'tháng trước';

  if (r.expenseChange !== null && r.previousExpense > 0 && r.expense !== r.previousExpense) {
    const less = r.expense < r.previousExpense;
    out.push({
      key: 'expense-change',
      tone: less ? 'good' : 'bad',
      text: `Chi tiêu ${less ? 'giảm' : 'tăng'} ${pct(r.expenseChange)} so với ${since} (${
        less ? '−' : '+'
      }${format(Math.abs(r.expense - r.previousExpense))}).`,
    });
  }

  if (r.income > 0) {
    out.push(
      r.net >= 0
        ? {
            key: 'saving',
            tone: 'good',
            text: t('Còn lại {net}, bằng {savingRate} thu nhập.', {
              net: format(r.net),
              savingRate: pct(r.savingRate ?? 0),
            }),
          }
        : {
            key: 'saving',
            tone: 'bad',
            text: t('Chi vượt thu {net}.', { net: format(-r.net) }),
          },
    );
  } else if (r.expense > 0) {
    out.push({ key: 'no-income', tone: 'neutral', text: 'Tháng này chưa ghi khoản thu nào.' });
  }

  const top = r.categories[0];
  if (top) {
    out.push({
      key: 'top-category',
      tone: 'neutral',
      text: t('Chi nhiều nhất cho {name}: {amount} ({share} tổng chi).', {
        name: top.name,
        amount: format(top.amount),
        share: pct(top.share * 100),
      }),
    });
  }

  const rise = r.categories
    .filter(
      (c) =>
        c.change !== null &&
        c.change >= RISE_MIN_PERCENT &&
        c.amount - c.previous >= RISE_MIN_AMOUNT,
    )
    .sort((a, b) => b.amount - b.previous - (a.amount - a.previous))[0];
  if (rise) {
    out.push({
      key: 'rise',
      tone: 'bad',
      text: t('{name} tăng {previous} so với {since}.', {
        name: rise.name,
        previous: format(rise.amount - rise.previous),
        since,
      }),
    });
  }

  if (r.topDay && r.expense > 0) {
    out.push({
      key: 'top-day',
      tone: 'neutral',
      text: t('Ngày chi nhiều nhất: {false}, {amount}.', {
        false: formatDate(r.topDay.date, false),
        amount: format(r.topDay.amount),
      }),
    });
  }

  if (r.budgets.length) {
    const over = r.budgets.filter((b) => b.over);
    out.push(
      over.length === 0
        ? {
            key: 'budgets',
            tone: 'good',
            text: t('Giữ được {length}/{length2} ngân sách trong hạn mức.', {
              length: r.budgets.length,
              length2: r.budgets.length,
            }),
          }
        : {
            key: 'budgets',
            tone: 'bad',
            text: t('Vượt ngân sách: {join}.', { join: over.map((b) => b.name).join(', ') }),
          },
    );
  }
  return out;
}

/** Văn bản để gửi cho người khác / tự lưu (Zalo, Ghi chú…) */
export function reportToText(
  r: MonthlyReport,
  title: string,
  rangeLabel: string,
  format: (amount: number) => string,
): string {
  const lines: string[] = [`${title} (${rangeLabel})`];
  if (r.inProgress) lines.push('Tháng chưa kết thúc — số liệu tính đến hôm nay.');
  lines.push(
    '',
    `Thu: ${format(r.income)}`,
    `Chi: ${format(r.expense)}`,
    `${r.net >= 0 ? 'Còn lại' : 'Chi vượt thu'}: ${format(Math.abs(r.net))}${
      r.savingRate !== null && r.net >= 0
        ? t(' ({savingRate} thu nhập)', { savingRate: pct(r.savingRate) })
        : ''
    }`,
  );
  if (r.categories.length) {
    lines.push('', 'Chi nhiều nhất:');
    r.categories.forEach((c, i) =>
      lines.push(`${i + 1}. ${c.name}: ${format(c.amount)} (${pct(c.share * 100)})`),
    );
    if (r.otherAmount > 0)
      lines.push(t('Khác: {otherAmount}', { otherAmount: format(r.otherAmount) }));
  }
  if (r.biggestExpenses.length) {
    lines.push('', 'Khoản chi lớn:');
    for (const e of r.biggestExpenses) {
      lines.push(
        `- ${formatDate(toVnDate(e.date), false)} ${e.title || e.categoryName || 'Chi tiêu'}: ${format(e.amount)}`,
      );
    }
  }
  if (r.highlights.length) {
    lines.push('', 'Nhận xét:');
    for (const h of r.highlights) lines.push(`- ${h.text}`);
  }
  return lines.join('\n');
}
