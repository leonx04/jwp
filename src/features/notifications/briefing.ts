// Nội dung "báo cáo buổi sáng" (hàm thuần, test được).
// Thông báo cục bộ KHÔNG chạy code lúc hiện → phải tính sẵn nội dung cho vài ngày tới rồi hẹn giờ;
// mỗi lần mở app / dữ liệu đổi sẽ tính lại và thay các bản đã hẹn.
import type { TransactionType } from '@/db/schema';
import { incomeLabel, type DayAllowance } from '@/features/today/compute';
import { addDays, diffDays, formatDate, vnDateToMs, type DateString } from '@/lib/date';

export type BriefingWallet = { name: string; balance: number };

export type BriefingItem = {
  date: DateString;
  title: string;
  amount: number;
  type: TransactionType;
  overdue: boolean;
};

export type BriefingBill = {
  /** Tên ví trả sau */
  name: string;
  amount: number;
  dueDate: DateString;
  overdue: boolean;
  /** Kỳ sau — số tiền ước tính */
  estimate: boolean;
};

export type BriefingInput = {
  now: number;
  today: DateString;
  /** Giờ gửi 'HH:mm' (giờ VN) */
  time: string;
  /** Số ngày hẹn trước */
  count: number;
  wallets: readonly BriefingWallet[];
  /** Ước tính "được tiêu" từ hôm nay (projectAllowances), cần ≥ count + 1 ngày */
  days: readonly DayAllowance[];
  /** Khoản thu / chi theo lịch còn phải xử lý (không gồm bill ví trả sau) */
  items: readonly BriefingItem[];
  bills: readonly BriefingBill[];
  /** Định dạng tiền rút gọn */
  money: (amount: number) => string;
};

export type Briefing = {
  date: DateString;
  /** Thời điểm hiện (ms) */
  fireAt: number;
  title: string;
  body: string;
};

export const BRIEFING_TITLE = 'Chào buổi sáng ☀️';
const MAX_WALLETS = 4;
const MAX_ITEMS = 3;
/** Nhắc bill ví trả sau khi còn ≤ N ngày tới hạn */
const BILL_LOOKAHEAD_DAYS = 5;

function walletLine(wallets: readonly BriefingWallet[], money: BriefingInput['money']): string | null {
  const shown = wallets.filter((w) => w.balance !== 0);
  if (!shown.length) return null;
  const head = shown.slice(0, MAX_WALLETS).map((w) => `${w.name} ${money(w.balance)}`);
  const more = shown.length - MAX_WALLETS;
  return more > 0 ? `${head.join(' · ')} · +${more} ví` : head.join(' · ');
}

function allowanceLine(day: DayAllowance, money: BriefingInput['money']): string {
  const income = day.incomeOnDay ?? day.nextIncome;
  const spend = `Hôm nay được tiêu ~${money(day.allowance)}`;
  return income ? `${spend} · ${incomeLabel(income)}` : spend;
}

/** Khoản đến hạn ngày `date` + khoản trước đó chưa xử lý (tới ngày đó sẽ là quá hạn) */
function itemsLine(input: BriefingInput, date: DateString): string | null {
  const due = input.items.filter((i) => i.date <= date);
  if (!due.length) return null;
  const text = (i: BriefingItem) =>
    `${i.overdue || i.date < date ? 'quá hạn ' : ''}${i.title} ${i.type === 'income' ? '+' : ''}${input.money(i.amount)}`;
  const head = due.slice(0, MAX_ITEMS).map(text);
  const more = due.length - MAX_ITEMS;
  return `Hôm nay: ${head.join(' · ')}${more > 0 ? ` · +${more} khoản` : ''}`;
}

function billLines(input: BriefingInput, date: DateString): string[] {
  return input.bills
    // Quá hạn (kể cả bill tới ngày đó mới quá hạn) hoặc còn ≤ N ngày
    .filter((b) => b.amount > 0 && diffDays(date, b.dueDate) <= BILL_LOOKAHEAD_DAYS)
    .map((b) => {
      const amount = `${b.estimate ? '~' : ''}${input.money(b.amount)}`;
      if (b.overdue || b.dueDate < date) return `Bill ${b.name} ${amount} đã quá hạn ${formatDate(b.dueDate, false)}`;
      if (b.dueDate === date) return `Bill ${b.name} ${amount} hạn hôm nay`;
      return `Bill ${b.name} ${amount} hạn ${formatDate(b.dueDate, false)}`;
    });
}

/** Nội dung báo cáo cho ngày thứ `index` (0 = hôm nay) */
export function briefingForDay(input: BriefingInput, index: number): Omit<Briefing, 'fireAt'> {
  const day = input.days[index];
  const date = day?.date ?? addDays(input.today, index);
  const lines = [
    walletLine(input.wallets, input.money),
    day ? allowanceLine(day, input.money) : null,
    itemsLine(input, date),
    ...billLines(input, date),
  ].filter((line): line is string => !!line);
  return { date, title: BRIEFING_TITLE, body: lines.join('\n') };
}

/** Các báo cáo cần hẹn: `count` buổi sáng sắp tới (bỏ hôm nay nếu đã qua giờ gửi) */
export function buildMorningBriefings(input: BriefingInput): Briefing[] {
  const result: Briefing[] = [];
  for (let i = 0; i < input.days.length && result.length < input.count; i++) {
    const date = input.days[i].date;
    const fireAt = vnDateToMs(date, input.time);
    if (fireAt <= input.now) continue;
    const briefing = briefingForDay(input, i);
    if (briefing.body) result.push({ ...briefing, fireAt });
  }
  return result;
}
