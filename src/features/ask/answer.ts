// Trả lời câu hỏi đã hiểu (xem parse.ts) bằng dữ liệu thật trong máy.
import type { AppDatabase } from '@/db/types';
import { getAccountBalances } from '@/features/accounts/queries';
import { listBudgets } from '@/features/budgets/queries';
import { listTransactions, type TransactionListItem } from '@/features/transactions/queries';
import { vnDateToMs, addDays } from '@/lib/date';
import { t } from '@/lib/i18n';
import { matchesSearch } from '@/lib/text';

import { previousAskPeriod, type AskPeriod, type Question } from './parse';

export type AnswerRow = { label: string; value: string };
export type Answer = {
  /** Dòng to nhất: số tiền / số lần… ('' khi không hiểu câu hỏi) */
  headline: string;
  /** Câu mô tả ngắn ngay dưới */
  summary: string;
  rows: AnswerRow[];
  /** Chạm để xem chi tiết */
  href?: string;
  understood: boolean;
};

export type AskContext = {
  today: string;
  startDay: number;
  money: (n: number) => string;
};

const periodText = (p: AskPeriod) => t(p.label, p.params);
const termText = (terms: string[]) => (terms.length ? ` “${terms.join(' ')}”` : '');

function fetchItems(db: AppDatabase, period: AskPeriod, terms: string[]): TransactionListItem[] {
  return listTransactions(db, {
    from: vnDateToMs(period.start),
    to: vnDateToMs(addDays(period.end, 1)),
    search: terms.join(' '),
  }).filter((r) => !r.isAdjustment && !r.debtId && r.type !== 'transfer');
}

const sum = (items: readonly TransactionListItem[]) => items.reduce((s, r) => s + r.amount, 0);

function biggestRows(items: readonly TransactionListItem[], ctx: AskContext, n = 3): AnswerRow[] {
  return [...items]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n)
    .map((r) => ({ label: r.title || r.categoryName || t('(không tiêu đề)'), value: ctx.money(r.amount) }));
}

const NONE: Answer = { headline: '', summary: '', rows: [], understood: false };

export function answerQuestion(db: AppDatabase, q: Question, ctx: AskContext): Answer {
  switch (q.kind) {
    case 'total': {
      const items = fetchItems(db, q.period, q.terms).filter((r) => r.type === q.flow);
      const total = sum(items);
      const verb = q.flow === 'expense' ? t('Đã chi') : t('Đã thu');
      const base = t('{verb}{terms} {period}', {
        verb,
        terms: termText(q.terms),
        period: periodText(q.period),
      });
      const rows = biggestRows(items, ctx);
      let compareLine = '';
      if (q.compare) {
        const prev = previousAskPeriod(q.period, ctx.startDay);
        const before = sum(fetchItems(db, prev, q.terms).filter((r) => r.type === q.flow));
        const diff = total - before;
        if (before === 0 && total === 0) compareLine = t('Kỳ trước cũng không có.');
        else if (before === 0) compareLine = t('Kỳ trước không có khoản nào.');
        else {
          const pct = Math.round((Math.abs(diff) / before) * 100);
          compareLine = diff === 0
            ? t('Bằng kỳ trước ({amount}).', { amount: ctx.money(before) })
            : t(diff > 0 ? 'Nhiều hơn kỳ trước {amount} (+{pct}%).' : 'Ít hơn kỳ trước {amount} (−{pct}%).', {
                amount: ctx.money(Math.abs(diff)),
                pct,
              });
        }
      }
      return {
        headline: ctx.money(total),
        summary: items.length
          ? `${base} · ${t('{n} giao dịch', { n: items.length })}${compareLine ? `\n${compareLine}` : ''}`
          : `${t('Không thấy giao dịch nào khớp.')}${compareLine ? `\n${compareLine}` : ''}`,
        rows,
        href: '/transactions',
        understood: true,
      };
    }
    case 'count': {
      const items = fetchItems(db, q.period, q.terms).filter((r) => r.type === q.flow);
      return {
        headline: t('{n} lần', { n: items.length }),
        summary: `${t('Tổng {amount}', { amount: ctx.money(sum(items)) })} · ${periodText(q.period)}${termText(q.terms)}`,
        rows: biggestRows(items, ctx),
        href: '/transactions',
        understood: true,
      };
    }
    case 'top_category': {
      const items = fetchItems(db, q.period, []).filter((r) => r.type === q.flow);
      const by = new Map<string, number>();
      for (const r of items) {
        const name = t(r.categoryName ?? 'Chưa phân loại');
        by.set(name, (by.get(name) ?? 0) + r.amount);
      }
      const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      if (!top.length) return { ...NONE, summary: t('Không có dữ liệu trong kỳ này.'), understood: true };
      return {
        headline: top[0][0],
        summary: `${ctx.money(top[0][1])} · ${periodText(q.period)}`,
        rows: top.slice(1).map(([name, amount]) => ({ label: name, value: ctx.money(amount) })),
        href: '/stats',
        understood: true,
      };
    }
    case 'biggest': {
      const items = fetchItems(db, q.period, q.terms).filter((r) => r.type === 'expense');
      const rows = biggestRows(items, ctx, 4);
      if (!rows.length) return { ...NONE, summary: t('Không thấy giao dịch nào khớp.'), understood: true };
      return {
        headline: rows[0].value,
        summary: `${rows[0].label} · ${periodText(q.period)}`,
        rows: rows.slice(1),
        href: '/transactions',
        understood: true,
      };
    }
    case 'balance': {
      const all = getAccountBalances(db);
      const picked = q.terms.length ? all.filter((a) => matchesSearch(q.terms.join(' '), a.name)) : [];
      const list = picked.length ? picked : all.filter((a) => a.includeInBalance);
      return {
        headline: ctx.money(list.reduce((s, a) => s + a.balance, 0)),
        summary: picked.length ? t('Số dư các ví khớp.') : t('Tổng số dư các ví đang tính.'),
        rows: list.slice(0, 6).map((a) => ({ label: a.name, value: ctx.money(a.balance) })),
        href: '/accounts',
        understood: true,
      };
    }
    case 'budget': {
      const all = listBudgets(db, { today: ctx.today, startDayOfMonth: ctx.startDay });
      const list = q.terms.length ? all.filter((b) => matchesSearch(q.terms.join(' '), b.name)) : all;
      if (!list.length) return { ...NONE, summary: t('Không thấy ngân sách nào khớp.'), understood: true };
      const first = list[0];
      return {
        headline: first.remaining >= 0 ? ctx.money(first.remaining) : `−${ctx.money(-first.remaining)}`,
        summary:
          list.length === 1 || q.terms.length
            ? t('{name}: còn {days} ngày, tối đa {perDay} mỗi ngày.', {
                name: first.name,
                days: first.daysLeft,
                perDay: ctx.money(Math.max(0, first.perDay)),
              })
            : t('Còn lại của ngân sách “{name}”; xem các ngân sách khác bên dưới.', { name: first.name }),
        rows: list
          .slice(1, 6)
          .map((b) => ({ label: b.name, value: `${ctx.money(b.remaining)} / ${ctx.money(b.amount)}` })),
        href: '/budgets',
        understood: true,
      };
    }
    default:
      return NONE;
  }
}
