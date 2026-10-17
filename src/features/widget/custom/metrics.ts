// Tính nội dung cho widget tùy chỉnh: mỗi loại (số dư, thu chi, ngân sách, quỹ…) trả về cùng một "thẻ" để vẽ.
// Chạy được khi app đóng (tác vụ nền) nên chỉ dùng truy vấn DB, không dùng hook.
import type { AppDatabase } from '@/db/types';
import { getAccountBalances } from '@/features/accounts/queries';
import { listBudgets } from '@/features/budgets/queries';
import { getCreditSummaries } from '@/features/credit/queries';
import { listDebts } from '@/features/debts/queries';
import { listGoals } from '@/features/goals/queries';
import { getSettings } from '@/features/settings/store';
import { periodRange, statsPeriod } from '@/features/stats/periods';
import { getPeriodSummary } from '@/features/transactions/queries';
import { addDays, startOfWeek, todayVn, vnDateToMs } from '@/lib/date';
import { t } from '@/lib/i18n';
import { formatCompact, formatMoney } from '@/lib/money';

import { loadUpcoming, loadWidgetData } from '../data';
import type { Metric, Period, WidgetConfig } from './config';

export type CardTone = 'info' | 'ok' | 'low' | 'over';

export type CardRow = { label: string; value: string; ratio: number | null };

export type Card = {
  /** Nhãn nhỏ phía trên */
  label: string;
  /** Giá trị lớn (đầy đủ) và bản rút gọn cho widget hẹp */
  value: string;
  short: string;
  /** Dòng mô tả (hiện khi widget đủ cao) */
  sub: string;
  /** 0–1, null = không có thanh */
  ratio: number | null;
  tone: CardTone;
  /** Các dòng phụ (hiện khi widget cao) */
  rows: CardRow[];
  /** Đường dẫn khi chạm: jwp://<href> */
  href: string;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

type Fmt = { money: (n: number) => string; compact: (n: number) => string };

function formats(): Fmt {
  const symbol = getSettings().currencySymbol;
  return {
    money: (n) => formatMoney(n, { symbol }),
    compact: (n) => formatCompact(n, { symbol }),
  };
}

const signed = (n: number, f: (x: number) => string) => (n < 0 ? `−${f(-n)}` : f(n));

const PERIOD_LABEL: Record<Period, string> = {
  today: 'hôm nay',
  week: 'tuần này',
  month: 'tháng này',
  cycle: 'kỳ lương này',
  year: 'năm nay',
};

/** Khoảng thời gian của kỳ cần xem, [from, to) tính bằng ms */
export function rangeOf(period: Period, today: string, startDay: number): { from: number; to: number } {
  switch (period) {
    case 'today':
      return { from: vnDateToMs(today), to: vnDateToMs(addDays(today, 1)) };
    case 'week': {
      const s = startOfWeek(today);
      return { from: vnDateToMs(s), to: vnDateToMs(addDays(s, 7)) };
    }
    case 'month':
      return periodRange(statsPeriod('month', 0, today, 1));
    case 'year':
      return periodRange(statsPeriod('year', 0, today, startDay));
    default:
      return periodRange(statsPeriod('month', 0, today, startDay));
  }
}

const EMPTY = (label: string, href: string, sub = ''): Card => ({
  label,
  value: '—',
  short: '—',
  sub,
  ratio: null,
  tone: 'info',
  rows: [],
  href,
});

export function resolveCard(db: AppDatabase, config: WidgetConfig, now: number = Date.now()): Card {
  const settings = getSettings();
  const today = todayVn(now);
  const f = formats();
  const custom = config.title.trim();
  const card = resolvers[config.metric](db, config, { today, now, f, startDay: settings.startDayOfMonth });
  return custom ? { ...card, label: custom } : card;
}

type Ctx = { today: string; now: number; f: Fmt; startDay: number };
type Resolver = (db: AppDatabase, c: WidgetConfig, ctx: Ctx) => Card;

const resolvers: Record<Metric, Resolver> = {
  safe_today: (db, _c, { now }) => {
    const today = loadWidgetData(db, now).today;
    if (!today) return EMPTY(t('Còn hôm nay'), '');
    const over = today.state === 'over';
    return {
      label: over ? t('Vượt hôm nay') : t('Còn hôm nay'),
      value: over ? today.overText : today.leftText,
      short: over ? today.overCompact : today.leftCompact,
      sub: [t('Đã tiêu {amount}', { amount: today.spentText }), today.incomeText].filter(Boolean).join(' · '),
      ratio: today.progress,
      tone: today.state === 'over' ? 'over' : today.state === 'low' ? 'low' : 'ok',
      rows: [],
      href: '',
    };
  },

  balance: (db, c, { f }) => {
    const all = getAccountBalances(db);
    const picked = c.accountIds.length
      ? all.filter((a) => c.accountIds.includes(a.id))
      : all.filter((a) => a.includeInBalance);
    if (!picked.length) return EMPTY(t('Số dư'), '/accounts', t('Chưa chọn ví nào.'));
    const total = picked.reduce((s, a) => s + a.balance, 0);
    const label = picked.length === 1 && c.accountIds.length ? picked[0].name : c.accountIds.length ? t('{n} ví', { n: picked.length }) : t('Tổng số dư');
    return {
      label,
      value: signed(total, f.money),
      short: signed(total, f.compact),
      sub: picked.length > 1 ? picked.map((a) => a.name).slice(0, 4).join(' · ') : '',
      ratio: null,
      tone: total < 0 ? 'over' : 'info',
      rows: picked.slice(0, 5).map((a) => ({ label: a.name, value: signed(a.balance, f.compact), ratio: null })),
      href: '/accounts',
    };
  },

  cashflow: (db, c, { today, startDay, f }) => {
    const range = rangeOf(c.period, today, startDay);
    const transfers = getSettings().transfersAsIncomeExpense;
    const ids = c.accountIds.length ? c.accountIds : [undefined];
    let income = 0;
    let expense = 0;
    for (const accountId of ids) {
      const s = getPeriodSummary(db, { ...range, accountId, transfersAsIncomeExpense: transfers });
      income += s.income;
      expense += s.expense;
    }
    const net = income - expense;
    const when = t(PERIOD_LABEL[c.period]);
    const rows: CardRow[] = [
      { label: t('Thu'), value: f.compact(income), ratio: null },
      { label: t('Chi'), value: f.compact(expense), ratio: null },
    ];
    const ratio = income > 0 ? clamp01(expense / income) : expense > 0 ? 1 : 0;
    if (c.cash === 'expense') {
      return { label: t('Chi {when}', { when }), value: f.money(expense), short: f.compact(expense), sub: t('Thu {amount}', { amount: f.compact(income) }), ratio: null, tone: 'info', rows, href: '/transactions' };
    }
    if (c.cash === 'income') {
      return { label: t('Thu {when}', { when }), value: f.money(income), short: f.compact(income), sub: t('Chi {amount}', { amount: f.compact(expense) }), ratio: null, tone: 'ok', rows, href: '/transactions' };
    }
    return {
      label: c.cash === 'net' ? t('Còn lại {when}', { when }) : t('Thu chi {when}', { when }),
      value: signed(net, f.money),
      short: signed(net, f.compact),
      sub: t('Thu {income} · Chi {expense}', { income: f.compact(income), expense: f.compact(expense) }),
      ratio,
      tone: net < 0 ? 'over' : ratio > 0.8 ? 'low' : 'ok',
      rows,
      href: '/transactions',
    };
  },

  budget: (db, c, { today, startDay, f }) => {
    const list = listBudgets(db, { today, startDayOfMonth: startDay });
    if (!list.length) return EMPTY(t('Ngân sách'), '/budgets', t('Chưa có ngân sách.'));
    const sorted = [...list].sort((a, b) => b.ratio - a.ratio);
    const main = (c.budgetId && list.find((b) => b.id === c.budgetId)) || sorted[0];
    const tone: CardTone = main.state === 'over' ? 'over' : main.state === 'warning' ? 'low' : 'ok';
    return {
      label: main.name,
      value: signed(main.remaining, f.money),
      short: signed(main.remaining, f.compact),
      sub: t('{spent} / {limit} · còn {days} ngày', { spent: f.compact(main.spent), limit: f.compact(main.amount), days: main.daysLeft }),
      ratio: clamp01(main.amount > 0 ? main.spent / main.amount : main.spent > 0 ? 1 : 0),
      tone,
      rows: sorted
        .filter((b) => b.id !== main.id)
        .slice(0, 4)
        .map((b) => ({ label: b.name, value: signed(b.remaining, f.compact), ratio: clamp01(b.amount > 0 ? b.spent / b.amount : 0) })),
      href: '/budgets',
    };
  },

  goal: (db, c, { today, f }) => {
    const list = listGoals(db, today);
    if (!list.length) return EMPTY(t('Quỹ tiết kiệm'), '/goals', t('Chưa có quỹ nào.'));
    const main = (c.goalId && list.find((g) => g.goal.id === c.goalId)) || list.find((g) => !g.done) || list[0];
    const pct = Math.round(main.ratio * 100);
    return {
      label: main.goal.name,
      value: f.money(main.saved),
      short: f.compact(main.saved),
      sub: main.done
        ? t('Đã đạt {target}', { target: f.compact(main.target) })
        : [t('{pct}% của {target}', { pct, target: f.compact(main.target) }), main.perMonth ? t('góp {amount}/tháng', { amount: f.compact(main.perMonth) }) : ''].filter(Boolean).join(' · '),
      ratio: main.ratio,
      tone: main.done ? 'ok' : main.overdue ? 'low' : 'info',
      rows: list
        .filter((g) => g.goal.id !== main.goal.id)
        .slice(0, 4)
        .map((g) => ({ label: g.goal.name, value: `${Math.round(g.ratio * 100)}%`, ratio: g.ratio })),
      href: '/goals',
    };
  },

  credit: (db, c, { today, f }) => {
    const all = getCreditSummaries(db, today);
    const picked = c.accountIds.length ? all.filter((s) => c.accountIds.includes(s.account.id)) : all;
    if (!picked.length) return EMPTY(t('Dư nợ trả sau'), '/accounts', t('Chưa có ví trả sau.'));
    const owed = picked.reduce((s, x) => s + x.status.owed, 0);
    const first = picked[0];
    const due = first.status.current?.dueAmount ?? 0;
    const next = first.status.next?.estimatedAmount ?? 0;
    return {
      label: picked.length === 1 ? first.account.name : t('Dư nợ trả sau'),
      value: f.money(owed),
      short: f.compact(owed),
      sub: due > 0 ? t('Đến hạn kỳ này {amount}', { amount: f.compact(due) }) : next > 0 ? t('Kỳ sau ước {amount}', { amount: f.compact(next) }) : '',
      ratio: first.status.utilization === null ? null : clamp01(first.status.utilization),
      tone: first.status.current?.overdue ? 'over' : due > 0 ? 'low' : 'info',
      rows: picked.map((s) => ({ label: s.account.name, value: f.compact(s.status.owed), ratio: s.status.utilization === null ? null : clamp01(s.status.utilization) })).slice(0, 4),
      href: '/accounts',
    };
  },

  upcoming: (db, _c, { now, f }) => {
    const events = loadUpcoming(db, now, 4);
    if (!events.length) return EMPTY(t('Sắp tới'), '/schedule', t('Không có khoản nào trong 30 ngày tới.'));
    const [first, ...rest] = events;
    const when = (d: number) => (d <= 0 ? t('hôm nay') : d === 1 ? t('ngày mai') : t('{n} ngày nữa', { n: d }));
    return {
      label: first.title || t('Sắp tới'),
      value: signed(first.amount, f.money),
      short: signed(first.amount, f.compact),
      sub: `${first.date.slice(8)}/${first.date.slice(5, 7)} · ${when(first.days)}`,
      ratio: null,
      tone: first.amount < 0 && first.days <= 2 ? 'low' : first.amount > 0 ? 'ok' : 'info',
      rows: rest.map((e) => ({ label: `${e.date.slice(8)}/${e.date.slice(5, 7)} ${e.title}`, value: signed(e.amount, f.compact), ratio: null })),
      href: '/schedule',
    };
  },

  debt: (db, _c, { today, f }) => {
    const items = listDebts(db, today).filter((d) => d.status !== 'closed' && d.status !== 'settled' && d.remaining > 0);
    const lent = items.filter((d) => d.direction === 'lent').reduce((s, d) => s + d.remaining, 0);
    const borrowed = items.filter((d) => d.direction === 'borrowed').reduce((s, d) => s + d.remaining, 0);
    if (!items.length) return EMPTY(t('Sổ nợ'), '/debts', t('Không có khoản nợ nào đang mở.'));
    const net = lent - borrowed;
    return {
      label: t('Sổ nợ'),
      value: signed(net, f.money),
      short: signed(net, f.compact),
      sub: t('Cho vay {lent} · Đang nợ {borrowed}', { lent: f.compact(lent), borrowed: f.compact(borrowed) }),
      ratio: null,
      tone: items.some((d) => d.status === 'overdue') ? 'low' : 'info',
      rows: [
        { label: t('Cho vay'), value: f.compact(lent), ratio: null },
        { label: t('Đang nợ'), value: f.compact(borrowed), ratio: null },
      ],
      href: '/debts',
    };
  },
};
