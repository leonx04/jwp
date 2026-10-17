// Lương gộp (gross) ⇄ thực nhận (net) theo quy định Việt Nam — CHỈ ƯỚC TÍNH, cho người làm công ăn lương.
//   • Bảo hiểm người lao động đóng: BHXH 8% + BHYT 1,5% + BHTN 1% (tổng 10,5%), có trần mức lương đóng.
//   • Thuế TNCN: thu nhập tính thuế = lương gộp − bảo hiểm − giảm trừ bản thân − giảm trừ người phụ thuộc,
//     rồi tính luỹ tiến 5 bậc (Luật 109/2025/QH15, hiệu lực từ 1/7/2026).
//   • Giảm trừ gia cảnh theo Nghị quyết 110/2025/UBTVQH15: 15,5 triệu / người nộp thuế, 6,2 triệu / người phụ thuộc.
// Các hằng số gom ở đầu file để cập nhật khi quy định đổi. Không tính phụ cấp miễn thuế, làm thêm giờ, thưởng riêng…

export const RULES = {
  /** Lương cơ sở dùng tính trần BHXH / BHYT (đồng) */
  baseSalary: 2_340_000,
  /** Lương tối thiểu vùng I dùng tính trần BHTN (đồng) */
  regionMinWage: 5_310_000,
  /** Trần = 20 lần mức tham chiếu */
  capMultiplier: 20,
  rates: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },
  selfDeduction: 15_500_000,
  dependentDeduction: 6_200_000,
  /** Bậc thuế theo thu nhập tính thuế THÁNG: [giới hạn trên, thuế suất]; bậc cuối không giới hạn */
  brackets: [
    [10_000_000, 0.05],
    [30_000_000, 0.1],
    [60_000_000, 0.2],
    [100_000_000, 0.3],
    [Infinity, 0.35],
  ] as const,
} as const;

export type NetBreakdown = {
  gross: number;
  bhxh: number;
  bhyt: number;
  bhtn: number;
  insurance: number;
  /** Thu nhập tính thuế (≥ 0) */
  taxable: number;
  pit: number;
  net: number;
};

/** Thuế luỹ tiến từng phần trên thu nhập tính thuế tháng */
export function progressiveTax(taxable: number): number {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of RULES.brackets) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return Math.round(tax);
}

export function grossToNet(gross: number, dependents = 0): NetBreakdown {
  const g = Math.max(0, Math.round(gross));
  const socialBase = Math.min(g, RULES.baseSalary * RULES.capMultiplier);
  const unemploymentBase = Math.min(g, RULES.regionMinWage * RULES.capMultiplier);
  const bhxh = Math.round(socialBase * RULES.rates.bhxh);
  const bhyt = Math.round(socialBase * RULES.rates.bhyt);
  const bhtn = Math.round(unemploymentBase * RULES.rates.bhtn);
  const insurance = bhxh + bhyt + bhtn;
  const taxable = Math.max(
    0,
    g - insurance - RULES.selfDeduction - Math.max(0, dependents) * RULES.dependentDeduction,
  );
  const pit = progressiveTax(taxable);
  return { gross: g, bhxh, bhyt, bhtn, insurance, taxable, pit, net: g - insurance - pit };
}

/** Lương gộp cần có để thực nhận `net` (tìm nhị phân vì net tăng đơn điệu theo gross) */
export function netToGross(net: number, dependents = 0): NetBreakdown {
  const target = Math.max(0, Math.round(net));
  let lo = target;
  let hi = target * 2 + 1_000_000;
  while (grossToNet(hi, dependents).net < target) hi *= 2;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (grossToNet(mid, dependents).net < target) lo = mid;
    else hi = mid;
  }
  return grossToNet(hi, dependents);
}
