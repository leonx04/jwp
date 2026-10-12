// "Hôm nay được tiêu bao nhiêu" — hàm thuần, test được.
//
// Mức chi an toàn của dự báo (forecast.safeDailySpend) tính từ số dư HIỆN TẠI, tức là đã trừ những gì
// tiêu hôm nay. Nếu lấy nó trừ tiếp "đã tiêu hôm nay" sẽ bị trừ hai lần (tiêu đúng mức vẫn báo "vượt").
// → Dựng lại số dư ĐẦU NGÀY (cộng trả phần đã tiêu hôm nay từ các ví tính vào tổng), chia đều cho số
// ngày tới kỳ thu tiếp theo → hạn mức hôm nay; còn lại = hạn mức − đã tiêu (gồm cả tiêu bằng ví trả sau).
import type { Forecast, ForecastEvent } from '@/features/forecast/forecast';
import { addDays, diffDays, type DateString } from '@/lib/date';

export type TodaySpending = {
  /** Đã tiêu hôm nay (khoản chi ngoài lịch; mua trả góp chỉ tính 1 kỳ), gồm cả ví trả sau */
  spent: number;
  /** Phần đã trừ vào tổng số dư (chi từ ví tính vào tổng) — để dựng lại số dư đầu ngày */
  balanceEffect: number;
};

export type IncomeInfo = {
  date: DateString;
  /** Số ngày từ hôm nay (0 = hôm nay) */
  days: number;
  title: string;
  amount: number;
};

export type Allowance = {
  /** Được tiêu mỗi ngày (≥ 0, làm tròn xuống) */
  perDay: number;
  /** Tiền còn dùng được tới kỳ thu tiếp theo (âm = thiếu) */
  available: number;
  /** Số ngày chia đều (≥ 1) */
  days: number;
  nextIncome: IncomeInfo | null;
};

const incomeInfo = (e: ForecastEvent, from: DateString): IncomeInfo => ({
  date: e.date,
  days: diffDays(from, e.date),
  title: e.occurrence.schedule.title,
  amount: e.occurrence.amount,
});

/**
 * Mức chi an toàn mỗi ngày tính từ ngày `day` (cùng công thức với computeForecast):
 * (số dư đầu ngày + khoản thu trước kỳ lương − khoản phải trả trước kỳ lương − ngưỡng an toàn) ÷ số ngày.
 */
export function dailyAllowance(
  forecast: Forecast,
  {
    day,
    startBalance,
    safetyThreshold = 0,
  }: { day: DateString; startBalance: number; safetyThreshold?: number },
): Allowance {
  const end = forecast.points[forecast.points.length - 1]?.date ?? day;
  const income = forecast.events.find((e) => e.occurrence.type === 'income' && e.date > day);
  const horizon = income ? income.date : end;
  let available = startBalance - safetyThreshold;
  for (const e of forecast.events) {
    if (e.date >= day && e.date < horizon) available += e.delta;
  }
  const days = Math.max(1, diffDays(day, horizon));
  return {
    perDay: Math.max(0, Math.floor(available / days)),
    available,
    days,
    nextIncome: income ? incomeInfo(income, day) : null,
  };
}

export type TodayStatus = {
  /** Hạn mức cả ngày hôm nay (tính từ số dư đầu ngày) */
  budget: number;
  spent: number;
  /** Còn được tiêu hôm nay (≥ 0) */
  left: number;
  /** Đã tiêu vượt hạn mức (≥ 0) */
  over: number;
  /** spent / budget, 0–1 */
  progress: number;
  /** Số ngày chia đều tới kỳ thu tiếp theo */
  days: number;
  /** Tiền còn dùng được tới kỳ thu (âm = không đủ trả các khoản sắp tới), ĐÃ trừ ngưỡng an toàn */
  available: number;
  /** Ngưỡng an toàn đang giữ lại (không được tiêu) */
  reserve: number;
  /** Kỳ thu tiếp theo (sau hôm nay) */
  nextIncome: IncomeInfo | null;
  /** Khoản thu đến hạn hôm nay chưa xác nhận */
  incomeToday: IncomeInfo | null;
};

export function computeToday({
  today,
  forecast,
  spending,
  safetyThreshold = 0,
}: {
  today: DateString;
  forecast: Forecast;
  spending: TodaySpending;
  safetyThreshold?: number;
}): TodayStatus {
  const allowance = dailyAllowance(forecast, {
    day: today,
    startBalance: forecast.startBalance + spending.balanceEffect,
    safetyThreshold,
  });
  const budget = allowance.perDay;
  const remaining = budget - spending.spent;
  const incomeEvent = forecast.events.find(
    (e) => e.occurrence.type === 'income' && e.date === today,
  );
  return {
    budget,
    spent: spending.spent,
    left: Math.max(0, remaining),
    over: Math.max(0, -remaining),
    progress: budget > 0 ? Math.min(1, spending.spent / budget) : spending.spent > 0 ? 1 : 0,
    days: allowance.days,
    available: allowance.available,
    reserve: safetyThreshold,
    nextIncome: allowance.nextIncome,
    incomeToday: incomeEvent ? incomeInfo(incomeEvent, today) : null,
  };
}

/** 'Còn 9 ngày tới lương' · 'Mai nhận lương' · 'Hôm nay nhận lương' (tên khoản thu nếu không phải lương) */
export function incomeLabel(info: IncomeInfo): string {
  const title = info.title.trim();
  const name = !title || /lương/i.test(title) ? 'lương' : title;
  if (info.days <= 0) return `Hôm nay nhận ${name}`;
  if (info.days === 1) return `Mai nhận ${name}`;
  return `Còn ${info.days} ngày tới ${name}`;
}

export type DayAllowance = {
  date: DateString;
  /** Được tiêu trong ngày đó (hôm nay: phần còn lại) */
  allowance: number;
  nextIncome: IncomeInfo | null;
  /** Có khoản thu đến hạn đúng ngày đó */
  incomeOnDay: IncomeInfo | null;
};

/**
 * Ước tính "được tiêu" cho hôm nay và `count − 1` ngày tiếp theo (dùng cho báo cáo buổi sáng hẹn trước).
 * Giả định mỗi ngày tiêu đúng mức được phép; số dư đầu ngày lấy từ dự báo dòng tiền.
 */
export function projectAllowances({
  today,
  forecast,
  status,
  count,
  safetyThreshold = 0,
}: {
  today: DateString;
  forecast: Forecast;
  status: TodayStatus;
  count: number;
  safetyThreshold?: number;
}): DayAllowance[] {
  const result: DayAllowance[] = [];
  const incomeOn = (date: DateString) => {
    const e = forecast.events.find((x) => x.occurrence.type === 'income' && x.date === date);
    return e ? incomeInfo(e, date) : null;
  };
  result.push({
    date: today,
    allowance: status.left,
    nextIncome: status.nextIncome,
    incomeOnDay: status.incomeToday,
  });
  // Tổng đã giả định tiêu từ giờ tới hết ngày trước đó
  let assumed = status.left;
  for (let k = 1; k < count; k++) {
    const date = addDays(today, k);
    const point = forecast.points[k - 1];
    if (!point) break;
    const a = dailyAllowance(forecast, {
      day: date,
      startBalance: point.balance - assumed,
      safetyThreshold,
    });
    result.push({
      date,
      allowance: a.perDay,
      nextIncome: a.nextIncome,
      incomeOnDay: incomeOn(date),
    });
    assumed += a.perDay;
  }
  return result;
}
