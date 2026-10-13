import { asc, eq } from 'drizzle-orm';

import { debtRecords, debts, people, type Debt, type DebtRecord, type Person } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { DateString } from '@/lib/date';

import { amountsOf, debtStatus, summarize, type DebtAmounts, type DebtStatus } from './compute';

export type DebtItem = DebtAmounts & {
  debt: Debt;
  person: Person;
  /** Mới nhất trước */
  records: DebtRecord[];
  status: DebtStatus;
  daysToDue: number | null;
  direction: Debt['direction'];
};

function build(debt: Debt, person: Person, records: DebtRecord[], today: DateString): DebtItem {
  const amounts = amountsOf(debt.amount, records);
  const { status, daysToDue } = debtStatus(
    { closedAt: debt.closedAt, dueDate: debt.dueDate },
    amounts.remaining,
    today,
  );
  const sorted = [...records].sort((a, b) => b.date - a.date);
  return {
    ...amounts,
    debt,
    person,
    records: sorted,
    status,
    daysToDue,
    direction: debt.direction,
  };
}

export function listDebts(db: AppDatabase, today: DateString): DebtItem[] {
  const rows = db
    .select({ debt: debts, person: people })
    .from(debts)
    .innerJoin(people, eq(people.id, debts.personId))
    .orderBy(asc(debts.date))
    .all();
  const byDebt = new Map<string, DebtRecord[]>();
  for (const r of db.select().from(debtRecords).all()) {
    const list = byDebt.get(r.debtId);
    if (list) list.push(r);
    else byDebt.set(r.debtId, [r]);
  }
  return rows.map(({ debt, person }) => build(debt, person, byDebt.get(debt.id) ?? [], today));
}

export function getDebtItem(db: AppDatabase, id: string, today: DateString): DebtItem | null {
  return listDebts(db, today).find((d) => d.debt.id === id) ?? null;
}

export type PersonGroup = {
  person: Person;
  items: DebtItem[];
  /** Tôi nợ người này */
  owe: number;
  /** Người này nợ tôi */
  owed: number;
  /** Dương = họ nợ tôi, âm = tôi nợ họ */
  net: number;
  overdue: number;
};

/** Gom theo người: người còn nợ (nhiều nhất) lên trước, người đã xong xuống cuối */
export function groupByPerson(items: readonly DebtItem[]): PersonGroup[] {
  const map = new Map<string, DebtItem[]>();
  for (const it of items) {
    const list = map.get(it.person.id);
    if (list) list.push(it);
    else map.set(it.person.id, [it]);
  }
  return [...map.values()]
    .map((list) => ({ person: list[0].person, items: list, ...summarize(list) }))
    .sort((a, b) => {
      const aActive = a.owe + a.owed > 0 ? 1 : 0;
      const bActive = b.owe + b.owed > 0 ? 1 : 0;
      return (
        bActive - aActive ||
        Math.abs(b.net) - Math.abs(a.net) ||
        a.person.name.localeCompare(b.person.name, 'vi')
      );
    });
}
