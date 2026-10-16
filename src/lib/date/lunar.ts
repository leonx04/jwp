// Âm lịch Việt Nam — thuật toán của Hồ Ngọc Đức (https://www.informatik.uni-leipzig.de/~duc/amlich/),
// tính theo múi giờ UTC+7 (khác lịch Trung Quốc UTC+8 ở vài năm, vd Tết 1985, 2007).
// Hàm thuần, không phụ thuộc múi giờ của máy.
import { t } from '@/lib/i18n';
import { parseDate, type DateString } from './vn';

export type LunarDate = {
  day: number;
  month: number;
  year: number;
  /** Tháng nhuận */
  leap: boolean;
};

const VN_TIMEZONE = 7;
const DR = Math.PI / 180;

/** Số ngày Julius của một ngày dương lịch */
function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  const jd =
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161) {
    // Trước lịch Gregory (15/10/1582) → lịch Julius
    return dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

/** Ngày (số Julius) của lần sóc thứ k tính từ 1/1/1900, theo giờ địa phương */
function newMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * DR);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3; // dị thường trung bình Mặt Trời
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3; // dị thường trung bình Mặt Trăng
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3; // đối số vĩ độ Mặt Trăng
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * DR) + 0.0021 * Math.sin(2 * DR * M);
  c1 = c1 - 0.4068 * Math.sin(Mpr * DR) + 0.0161 * Math.sin(DR * 2 * Mpr);
  c1 -= 0.0004 * Math.sin(DR * 3 * Mpr);
  c1 = c1 + 0.0104 * Math.sin(DR * 2 * F) - 0.0051 * Math.sin(DR * (M + Mpr));
  c1 = c1 - 0.0074 * Math.sin(DR * (M - Mpr)) + 0.0004 * Math.sin(DR * (2 * F + M));
  c1 = c1 - 0.0004 * Math.sin(DR * (2 * F - M)) - 0.0006 * Math.sin(DR * (2 * F + Mpr));
  c1 = c1 + 0.001 * Math.sin(DR * (2 * F - Mpr)) + 0.0005 * Math.sin(DR * (2 * Mpr + M));
  const deltaT =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Math.floor(jd1 + c1 - deltaT + 0.5 + timeZone / 24);
}

/** Cung hoàng đạo (0–11, mỗi cung 30°) của Mặt Trời lúc 0h giờ địa phương ngày `jdn` */
function sunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let dl = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(DR * M);
  dl += (0.019993 - 0.000101 * T) * Math.sin(DR * 2 * M) + 0.00029 * Math.sin(DR * 3 * M);
  let L = (L0 + dl) * DR;
  L -= Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}

/** Ngày bắt đầu tháng 11 âm lịch (tháng chứa Đông chí) của năm dương lịch `yy` */
function lunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  const nm = newMoonDay(k, timeZone);
  return sunLongitude(nm, timeZone) >= 9 ? newMoonDay(k - 1, timeZone) : nm;
}

/** Vị trí tháng nhuận (tính từ sau tháng 11) trong năm âm có 13 tháng */
function leapMonthOffset(a11: number, timeZone: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number;
  let i = 1;
  let arc = sunLongitude(newMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = sunLongitude(newMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Dương lịch → âm lịch theo múi giờ `timeZone` (mặc định Việt Nam UTC+7) */
export function solarToLunar(
  dd: number,
  mm: number,
  yy: number,
  timeZone: number = VN_TIMEZONE,
): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) monthStart = newMoonDay(k, timeZone);

  let a11 = lunarMonth11(yy, timeZone);
  let b11 = a11;
  let year: number;
  if (a11 >= monthStart) {
    year = yy;
    a11 = lunarMonth11(yy - 1, timeZone);
  } else {
    year = yy + 1;
    b11 = lunarMonth11(yy + 1, timeZone);
  }

  const day = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11, timeZone);
    if (diff >= leapDiff) {
      month = diff + 10;
      leap = diff === leapDiff;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) year -= 1;
  return { day, month, year, leap };
}

// Lịch tháng gọi lại cùng ngày nhiều lần khi đổi tháng qua lại → nhớ kết quả (giới hạn kích thước)
const cache = new Map<DateString, LunarDate>();
const CACHE_LIMIT = 800;

/** Ngày dương 'YYYY-MM-DD' → ngày âm lịch Việt Nam */
export function toLunar(date: DateString): LunarDate {
  const hit = cache.get(date);
  if (hit) return hit;
  const { year, month, day } = parseDate(date);
  const lunar = solarToLunar(day, month, year);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(date, lunar);
  return lunar;
}

/** Nhãn gọn cho ô lịch: mùng 1 → '1/9' (tháng nhuận '1/6N'), ngày khác → '15' */
export function lunarLabel(date: DateString): string {
  const { day, month, leap } = toLunar(date);
  return day === 1 ? `1/${month}${leap ? 'N' : ''}` : String(day);
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

/** Tên năm âm lịch theo can chi: 2026 → 'Bính Ngọ' */
export function lunarYearName(year: number): string {
  return `${CAN[(((year + 6) % 10) + 10) % 10]} ${CHI[(((year + 8) % 12) + 12) % 12]}`;
}

/** '2026-09-25' → 'Rằm tháng 8 năm Bính Ngọ' · 'Mùng 1 tháng 6 nhuận năm Ất Tỵ' · '23 tháng Chạp…' */
export function formatLunar(date: DateString): string {
  const { day, month, year, leap } = toLunar(date);
  const dayText =
    day === 15 ? 'Rằm' : day <= 10 ? t('Mùng {day}', { day }) : t('Ngày {day}', { day });
  const monthText = month === 1 ? 'Giêng' : month === 12 ? 'Chạp' : String(month);
  return `${dayText} tháng ${monthText}${leap ? ' nhuận' : ''} năm ${lunarYearName(year)}`;
}
