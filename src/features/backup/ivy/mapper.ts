// Chuyển dữ liệu backup Ivy Wallet → các bản ghi JWP (hàm thuần, chưa đụng DB).
// Kết quả là một "kế hoạch import" để: (1) hiển thị màn xem trước, (2) ghi vào DB trong 1 transaction.
import type {
  NewAccount,
  NewBudget,
  NewCategory,
  NewDebt,
  NewDebtRecord,
  NewPerson,
  NewSchedule,
  NewScheduleOccurrence,
  NewTag,
  NewTransaction,
  TransactionTag,
  TransactionType,
} from '@/db/schema';
import { computeBalances } from '@/features/accounts/balance';
import type { SettingsState } from '@/features/settings/store';
import { bankIcon, detectBank } from '@/lib/banks';
import { addDays, toVnDate, todayVn, type DateString } from '@/lib/date';
import { generateOccurrences, type Frequency, type RecurrenceRule } from '@/lib/recurrence';
import { normalizeForSearch } from '@/lib/text';

import { mapIvyIcon } from './icons';
import type { IvyBackup, IvyPlannedRule } from './schema';

function accountIcon(name: string, ivyIcon: string | null | undefined): string {
  const bank = detectBank(name);
  return bank ? bankIcon(bank.code) : mapIvyIcon(ivyIcon, 'account');
}

const DEFAULT_COLOR = '#5B5BD6';

/** Màu ARGB số nguyên có dấu của Android (-49056) → '#FF4060' */
export function ivyColorToHex(color: number): string {
  if (!color) return DEFAULT_COLOR;
  const rgb = (color >>> 0) & 0xffffff;
  return `#${rgb.toString(16).padStart(6, '0').toUpperCase()}`;
}

const TYPE_MAP: Record<string, TransactionType> = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer',
};

const FREQUENCY_MAP: Record<string, Frequency> = {
  DAY: 'daily',
  WEEK: 'weekly',
  MONTH: 'monthly',
  YEAR: 'yearly',
};

/** Số tiền Ivy là số thực (3000000.0) → số nguyên đồng, luôn dương */
const toMoney = (value: number) => Math.round(Math.abs(value));

export type IvySettingsPatch = Partial<
  Pick<
    SettingsState,
    | 'themePreference'
    | 'amoled'
    | 'userName'
    | 'safetyThreshold'
    | 'transfersAsIncomeExpense'
    | 'hideBalance'
    | 'startDayOfMonth'
  >
>;

export type IvyImportStats = {
  accounts: number;
  categories: number;
  tags: number;
  income: number;
  expense: number;
  transfer: number;
  /** Các khoản "sắp tới" Ivy sinh sẵn (dateTime = null) — không import thành giao dịch */
  upcomingSkipped: number;
  schedules: number;
  activeSchedules: number;
  /** Bản ghi Ivy đánh dấu đã xoá */
  deletedSkipped: number;
  uncategorized: number;
  untitled: number;
  /** Giao dịch trỏ tới quy tắc định kỳ đã bị xoá → giữ giao dịch, bỏ liên kết */
  orphanRuleLinks: number;
  people: number;
  debts: number;
  budgets: number;
};

export type IvyImportPlan = {
  accounts: NewAccount[];
  categories: NewCategory[];
  tags: NewTag[];
  transactions: NewTransaction[];
  transactionTags: TransactionTag[];
  schedules: NewSchedule[];
  occurrences: NewScheduleOccurrence[];
  people: NewPerson[];
  debts: NewDebt[];
  debtRecords: NewDebtRecord[];
  budgets: NewBudget[];
  settings: IvySettingsPatch;
  balances: { accountId: string; name: string; balance: number; includeInBalance: boolean }[];
  totalBalance: number;
  /** Các kỳ sắp tới Ivy đã sinh sẵn, theo id lịch — để đối chiếu với kỳ JWP tự tính */
  ivyUpcoming: Record<string, DateString[]>;
  stats: IvyImportStats;
  warnings: string[];
};

export function ruleOf(schedule: NewSchedule): RecurrenceRule {
  return {
    startDate: schedule.startDate,
    frequency: schedule.frequency,
    interval: schedule.interval ?? 1,
    weekdays: schedule.weekdays ? schedule.weekdays.split(',').map(Number) : null,
    monthDay: schedule.monthDay ?? null,
    weekendRule: schedule.weekendRule ?? 'none',
    endType: schedule.endType ?? 'never',
    endDate: schedule.endDate ?? null,
    endCount: schedule.endCount ?? null,
  };
}

function mapSettings(backup: IvyBackup): IvySettingsPatch {
  const patch: IvySettingsPatch = {};
  const s = backup.settings[0];
  if (s?.theme) {
    if (s.theme === 'LIGHT') patch.themePreference = 'light';
    if (s.theme === 'DARK') patch.themePreference = 'dark';
    if (s.theme === 'AUTO') patch.themePreference = 'system';
    if (s.theme === 'AMOLED_DARK') Object.assign(patch, { themePreference: 'dark', amoled: true });
  }
  if (s?.name) patch.userName = s.name;
  if (s?.bufferAmount != null) patch.safetyThreshold = toMoney(s.bufferAmount);
  const prefs = backup.sharedPrefs ?? {};
  if (prefs.transfers_as_inc_exp != null) {
    patch.transfersAsIncomeExpense = prefs.transfers_as_inc_exp === 'true';
  }
  if (prefs.hide_current_balance != null) patch.hideBalance = prefs.hide_current_balance === 'true';
  const startDay = Number(prefs.start_date_of_month);
  if (Number.isInteger(startDay) && startDay >= 1 && startDay <= 31)
    patch.startDayOfMonth = startDay;
  return patch;
}

export function mapIvyBackup(backup: IvyBackup, now: number = Date.now()): IvyImportPlan {
  const warnings: string[] = [];
  const stats: IvyImportStats = {
    accounts: 0,
    categories: 0,
    tags: 0,
    income: 0,
    expense: 0,
    transfer: 0,
    upcomingSkipped: 0,
    schedules: 0,
    activeSchedules: 0,
    deletedSkipped: 0,
    uncategorized: 0,
    untitled: 0,
    orphanRuleLinks: 0,
    people: 0,
    debts: 0,
    budgets: 0,
  };

  // ── Ví & danh mục ──
  const accounts: NewAccount[] = backup.accounts
    .filter((a) => !a.isDeleted)
    .map((a) => ({
      id: a.id,
      name: a.name.trim() || 'Ví',
      color: ivyColorToHex(a.color),
      // Tên ví là ngân hàng / ví điện tử ("MB bank", "Ví Shoppe") → dùng logo thật
      icon: accountIcon(a.name, a.icon),
      orderNum: a.orderNum,
      includeInBalance: a.includeInBalance,
    }));
  const accountIds = new Set(accounts.map((a) => a.id));

  const categories: NewCategory[] = backup.categories
    .filter((c) => !c.isDeleted)
    .map((c) => ({
      id: c.id,
      name: c.name.trim() || 'Danh mục',
      color: ivyColorToHex(c.color),
      icon: mapIvyIcon(c.icon, 'category'),
      orderNum: c.orderNum,
    }));
  const categoryIds = new Set(categories.map((c) => c.id));
  const validCategory = (id: string | null | undefined) => (id && categoryIds.has(id) ? id : null);
  const validAccount = (id: string | null | undefined) => (id && accountIds.has(id) ? id : null);

  // ── Tag (gộp tag trùng tên không dấu) ──
  const tags: NewTag[] = [];
  const tagIdRemap = new Map<string, string>();
  const tagByKey = new Map<string, string>();
  for (const t of backup.tags.filter((t) => !t.isDeleted)) {
    const nameKey = normalizeForSearch(t.name);
    if (!nameKey) continue;
    const existing = tagByKey.get(nameKey);
    if (existing) {
      tagIdRemap.set(t.id, existing);
      continue;
    }
    tagByKey.set(nameKey, t.id);
    tagIdRemap.set(t.id, t.id);
    tags.push({ id: t.id, name: t.name.trim(), nameKey, color: ivyColorToHex(t.color) });
  }

  // ── Quy tắc định kỳ ──
  const rules = new Map<string, IvyPlannedRule>();
  for (const r of backup.plannedPaymentRules) {
    if (r.isDeleted) continue;
    if (!accountIds.has(r.accountId)) {
      warnings.push(`Bỏ qua 1 khoản định kỳ vì ví không tồn tại.`);
      continue;
    }
    rules.set(r.id, r);
  }

  // ── Khoản vay → liên kết giao dịch ──
  const loans = new Map(backup.loans.filter((l) => !l.isDeleted).map((l) => [l.id, l]));
  const loanRecords = new Map(
    backup.loanRecords.filter((r) => !r.isDeleted && loans.has(r.loanId)).map((r) => [r.id, r]),
  );

  // ── Giao dịch ──
  const transactions: NewTransaction[] = [];
  const ivyUpcoming: Record<string, DateString[]> = {};
  const orphanPlanned: NewSchedule[] = [];
  const paidByRule = new Map<string, NewTransaction[]>();
  const loanOpeningTx = new Map<string, string>();
  const loanRecordTx = new Map<string, string>();

  for (const t of backup.transactions) {
    if (t.isDeleted) {
      stats.deletedSkipped++;
      continue;
    }
    if (!accountIds.has(t.accountId)) {
      warnings.push(`Bỏ qua 1 giao dịch vì ví không tồn tại (${t.id.slice(0, 8)}).`);
      continue;
    }

    let type = TYPE_MAP[t.type];
    const title = (t.title ?? '').trim();

    // Khoản "sắp tới" Ivy sinh sẵn từ quy tắc: không phải giao dịch thật
    if (t.dateTime == null) {
      stats.upcomingSkipped++;
      const due = t.dueDate != null ? toVnDate(t.dueDate) : null;
      if (!due) continue;
      if (t.recurringRuleId && rules.has(t.recurringRuleId)) {
        (ivyUpcoming[t.recurringRuleId] ??= []).push(due);
      } else {
        // Khoản dự kiến không còn quy tắc → thành lịch "một lần"
        orphanPlanned.push({
          id: t.id,
          type: type === 'transfer' ? 'expense' : type,
          amount: toMoney(t.amount),
          accountId: t.accountId,
          categoryId: validCategory(t.categoryId),
          title,
          note: t.description ?? null,
          startDate: due,
          frequency: 'once',
        });
      }
      continue;
    }

    let toAccountId: string | null = null;
    if (type === 'transfer') {
      toAccountId = validAccount(t.toAccountId);
      if (!toAccountId) {
        warnings.push(`1 chuyển khoản thiếu ví nhận → ghi thành khoản chi.`);
        type = 'expense';
      }
    }
    if (t.categoryId && !categoryIds.has(t.categoryId)) {
      warnings.push(`1 giao dịch trỏ tới danh mục không tồn tại → "Chưa phân loại".`);
    }

    const tx: NewTransaction = {
      id: t.id,
      type,
      amount: toMoney(t.amount),
      accountId: t.accountId,
      toAccountId,
      toAmount: toAccountId ? toMoney(t.toAmount ?? t.amount) : null,
      categoryId: type === 'transfer' ? null : validCategory(t.categoryId),
      title,
      titleKey: normalizeForSearch(title),
      note: t.description?.trim() || null,
      date: t.dateTime,
    };

    if (t.recurringRuleId) {
      if (rules.has(t.recurringRuleId)) {
        tx.scheduleId = t.recurringRuleId;
        tx.scheduleDueDate = toVnDate(t.paidForDateTime ?? t.dueDate ?? t.dateTime);
        const list = paidByRule.get(t.recurringRuleId) ?? [];
        list.push(tx);
        paidByRule.set(t.recurringRuleId, list);
      } else {
        stats.orphanRuleLinks++;
      }
    }

    if (t.loanRecordId && loanRecords.has(t.loanRecordId)) {
      tx.debtId = loanRecords.get(t.loanRecordId)!.loanId;
      loanRecordTx.set(t.loanRecordId, t.id);
    } else if (t.loanId && loans.has(t.loanId)) {
      tx.debtId = t.loanId;
      if (!loanOpeningTx.has(t.loanId)) loanOpeningTx.set(t.loanId, t.id);
    }

    stats[type]++;
    if (!tx.categoryId && type !== 'transfer') stats.uncategorized++;
    if (!title) stats.untitled++;
    transactions.push(tx);
  }

  // ── Lịch thu chi từ quy tắc định kỳ ──
  const schedules: NewSchedule[] = [];
  const occurrences: NewScheduleOccurrence[] = [];
  const today = todayVn(now);

  for (const rule of rules.values()) {
    const upcoming = [...new Set(ivyUpcoming[rule.id] ?? [])].sort();
    ivyUpcoming[rule.id] = upcoming;
    const paid = (paidByRule.get(rule.id) ?? []).sort((a, b) =>
      (a.scheduleDueDate ?? '').localeCompare(b.scheduleDueDate ?? ''),
    );
    const start = rule.startDate != null ? toVnDate(rule.startDate) : (upcoming[0] ?? today);
    let type = TYPE_MAP[rule.type];
    if (type === 'transfer') {
      warnings.push('1 khoản định kỳ là chuyển khoản (Ivy không hỗ trợ) → ghi thành khoản chi.');
      type = 'expense';
    }

    const schedule: NewSchedule = {
      id: rule.id,
      type,
      amount: toMoney(rule.amount),
      accountId: rule.accountId,
      categoryId: validCategory(rule.categoryId),
      title: (rule.title ?? '').trim(),
      note: rule.description?.trim() || null,
      startDate: start,
      frequency: rule.oneTime ? 'once' : (FREQUENCY_MAP[rule.intervalType ?? 'MONTH'] ?? 'monthly'),
      interval: Math.max(1, Math.round(rule.intervalN ?? 1)),
      active: upcoming.length > 0,
    };

    if (rule.oneTime) {
      // Khoản một lần bị dời ngày trong Ivy: ngày thật nằm ở khoản sắp tới
      if (upcoming[0]) schedule.startDate = upcoming[0];
      if (!upcoming.length && paid[0]) {
        occurrences.push({
          scheduleId: rule.id,
          dueDate: schedule.startDate,
          status: 'paid',
          transactionId: paid[0].id,
          amount: paid[0].amount !== schedule.amount ? paid[0].amount : null,
        });
        paid[0].scheduleDueDate = schedule.startDate;
      }
      schedules.push(schedule);
      continue;
    }

    // Các kỳ trước kỳ sắp tới đầu tiên: khớp với giao dịch đã trả, kỳ còn lại coi như đã bỏ qua
    const until = upcoming[0] ? addDays(upcoming[0], -1) : today;
    const pastDates = until >= start ? generateOccurrences(ruleOf(schedule), start, until) : [];
    const matched = new Map<DateString, NewTransaction>();
    const leftovers: NewTransaction[] = [];
    for (const tx of paid) {
      const date = tx.scheduleDueDate!;
      if (pastDates.includes(date) && !matched.has(date)) matched.set(date, tx);
      else leftovers.push(tx);
    }
    for (const date of pastDates) {
      if (!matched.has(date) && leftovers.length) matched.set(date, leftovers.shift()!);
    }
    for (const date of pastDates) {
      const tx = matched.get(date);
      if (tx) tx.scheduleDueDate = date;
      occurrences.push({
        scheduleId: rule.id,
        dueDate: date,
        status: tx ? 'paid' : 'skipped',
        transactionId: tx?.id ?? null,
        amount: tx && tx.amount !== schedule.amount ? tx.amount : null,
      });
    }

    if (upcoming.length) {
      const computed = generateOccurrences(ruleOf(schedule), upcoming[0], upcoming.at(-1)!);
      if (computed.join() !== upcoming.join()) {
        warnings.push(
          `Lịch "${schedule.title || 'không tên'}": kỳ JWP tính ra khác với Ivy (${computed.length} so với ${upcoming.length} kỳ).`,
        );
      }
    }
    schedules.push(schedule);
  }
  schedules.push(...orphanPlanned.map((s) => ({ ...s, active: true })));
  stats.schedules = schedules.length;
  stats.activeSchedules = schedules.filter((s) => s.active).length;

  // ── Tag gắn với giao dịch ──
  const txIds = new Set(transactions.map((t) => t.id));
  const tagLinks = new Map<string, TransactionTag>();
  for (const a of backup.tagAssociations) {
    const tagId = tagIdRemap.get(a.tagId);
    if (a.isDeleted || !tagId || !txIds.has(a.associatedId)) continue;
    tagLinks.set(`${a.associatedId}:${tagId}`, { transactionId: a.associatedId, tagId });
  }

  // ── Sổ nợ ──
  const people: NewPerson[] = [];
  const personByKey = new Map<string, string>();
  const debts: NewDebt[] = [];
  for (const loan of loans.values()) {
    const nameKey = normalizeForSearch(loan.name) || 'khong-ten';
    let personId = personByKey.get(nameKey);
    if (!personId) {
      personId = `ivy-person-${nameKey.replace(/\s+/g, '-')}`;
      personByKey.set(nameKey, personId);
      people.push({ id: personId, name: loan.name.trim() || 'Không tên', nameKey });
    }
    const openingTx = loanOpeningTx.get(loan.id);
    debts.push({
      id: loan.id,
      personId,
      direction: loan.type === 'LEND' ? 'lent' : 'borrowed',
      amount: toMoney(loan.amount),
      date: loan.dateTime ?? transactions.find((t) => t.id === openingTx)?.date ?? now,
      note: loan.note?.trim() || null,
      accountId: validAccount(loan.accountId),
      transactionId: openingTx ?? null,
    });
  }
  const debtRecords: NewDebtRecord[] = [...loanRecords.values()].map((r) => ({
    id: r.id,
    debtId: r.loanId,
    type: r.interest ? 'interest' : r.loanRecordType === 'INCREASE' ? 'increase' : 'repay',
    amount: toMoney(r.amount),
    date: r.dateTime ?? now,
    note: r.note?.trim() || null,
    accountId: validAccount(r.accountId),
    transactionId: loanRecordTx.get(r.id) ?? null,
  }));

  // ── Ngân sách ──
  const idList = (serialized: string | null | undefined, valid: Set<string>) => {
    const ids = (serialized ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => valid.has(s));
    return ids.length ? ids.join(',') : null;
  };
  const budgets: NewBudget[] = backup.budgets
    .filter((b) => !b.isDeleted)
    .map((b, index) => ({
      id: b.id,
      name: b.name.trim() || 'Ngân sách',
      amount: toMoney(b.amount),
      categoryIds: idList(b.categoryIdsSerialized, categoryIds),
      accountIds: idList(b.accountIdsSerialized, accountIds),
      orderNum: index,
    }));

  // ── Số dư (giống cách Ivy tính: tổng các giao dịch) ──
  const balanceMap = computeBalances(
    accounts.map((a) => a.id),
    transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      accountId: t.accountId,
      toAccountId: t.toAccountId,
      toAmount: t.toAmount,
    })),
  );
  const balances = [...accounts]
    .sort((a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0))
    .map((a) => ({
      accountId: a.id,
      name: a.name,
      balance: balanceMap.get(a.id) ?? 0,
      includeInBalance: a.includeInBalance ?? true,
    }));

  Object.assign(stats, {
    accounts: accounts.length,
    categories: categories.length,
    tags: tags.length,
    people: people.length,
    debts: debts.length,
    budgets: budgets.length,
  });

  return {
    accounts,
    categories,
    tags,
    transactions,
    transactionTags: [...tagLinks.values()],
    schedules,
    occurrences,
    people,
    debts,
    debtRecords,
    budgets,
    settings: mapSettings(backup),
    balances,
    totalBalance: balances.reduce((sum, b) => (b.includeInBalance ? sum + b.balance : sum), 0),
    ivyUpcoming,
    stats,
    warnings: [...new Set(warnings)],
  };
}
