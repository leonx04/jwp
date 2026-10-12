import {
  MAX_AMOUNT,
  applyKeypadKey,
  calcMoney,
  formatCompact,
  formatFlow,
  formatMoney,
  groupThousands,
  parseMoney,
} from './index';

// Trong test viết ' ' cho dễ đọc rồi đổi sang NBSP; '−' là dấu trừ chuẩn U+2212.
const nb = (text: string) => text.replace(/ /g, ' ');

describe('formatMoney', () => {
  it.each([
    [0, '0 ₫'],
    [850, '850 ₫'],
    [1_000, '1.000 ₫'],
    [1_500_000, '1.500.000 ₫'],
    [173_614, '173.614 ₫'],
    [-50_000, '−50.000 ₫'],
    [2_350_000_000, '2.350.000.000 ₫'],
  ])('%d → %s', (amount, expected) => {
    expect(formatMoney(amount)).toBe(nb(expected));
  });

  it('chỉ có một đơn vị, không bao giờ có phần ,00', () => {
    const text = formatMoney(1_500_000);
    expect(text).not.toMatch(/VN|,00|₫.*₫/);
  });

  it('dùng khoảng trắng không ngắt dòng trước ký hiệu', () => {
    expect(formatMoney(1_000)).toBe('1.000 ₫');
  });

  it.each([
    ['₫', '1.500.000 ₫'],
    ['đ', '1.500.000 đ'],
    ['VND', '1.500.000 VND'],
  ] as const)('ký hiệu %s', (symbol, expected) => {
    expect(formatMoney(1_500_000, { symbol })).toBe(nb(expected));
  });

  it('sign=always thêm dấu + khi dương, không thêm cho số 0', () => {
    expect(formatMoney(50_000, { sign: 'always' })).toBe(nb('+50.000 ₫'));
    expect(formatMoney(0, { sign: 'always' })).toBe(nb('0 ₫'));
  });

  it('làm tròn nếu lỡ nhận số thực (dữ liệu Ivy 3000000.0)', () => {
    expect(formatMoney(3_000_000.0)).toBe(nb('3.000.000 ₫'));
  });
});

describe('formatFlow', () => {
  it.each([
    ['expense', '−50.000 ₫'],
    ['income', '+50.000 ₫'],
    ['transfer', '50.000 ₫'],
  ] as const)('%s → %s', (flow, expected) => {
    expect(formatFlow(50_000, flow)).toBe(nb(expected));
  });

  it('không bị đổi dấu hai lần nếu lỡ truyền số âm', () => {
    expect(formatFlow(-50_000, 'expense')).toBe(nb('−50.000 ₫'));
  });
});

describe('formatCompact', () => {
  it.each([
    [0, '0 ₫'],
    [850, '850 ₫'],
    [999, '999 ₫'],
    [999.4, '999 ₫'],
    [1_000, '1k'],
    [1_500, '1,5k'],
    [1_234, '1.234 ₫'],
    [15_000, '15k'],
    [150_000, '150k'],
    [999_994, '999.994 ₫'],
    [999_999, '999.999 ₫'],
    [1_487_759, '1.487.759 ₫'],
    [1_000_000, '1Tr'],
    [1_500_000, '1,5Tr'],
    [1_250_000, '1,25Tr'],
    [1_005_000, '1.005.000 ₫'],
    [15_000_000, '15Tr'],
    [150_000_000, '150Tr'],
    [999_999_999, '999.999.999 ₫'],
    [1_000_000_000, '1 Tỷ'],
    [2_350_000_000, '2,35 Tỷ'],
    [1_234_000_000_000, '1.234 Tỷ'],
    [-1_500, '−1,5k'],
    [-1_500_000, '−1,5Tr'],
    [-2_350_000_000, '−2,35 Tỷ'],
  ])('%d → %s', (amount, expected) => {
    expect(formatCompact(amount)).toBe(nb(expected));
  });

  it('k / Tr viết liền, Tỷ cách bằng khoảng trắng không ngắt dòng', () => {
    expect(formatCompact(150_000)).toBe('150k');
    expect(formatCompact(1_500_000)).toBe('1,5Tr');
    expect(formatCompact(2_000_000_000)).toBe('2 Tỷ');
  });

  it('dấu: sign=always thêm "+", sign=never bỏ dấu', () => {
    expect(formatCompact(150_000, { sign: 'always' })).toBe('+150k');
    expect(formatCompact(-1_500_000, { sign: 'never' })).toBe('1,5Tr');
    expect(formatCompact(0, { sign: 'always' })).toBe(nb('0 ₫'));
  });

  it('dưới 1.000 vẫn kèm ký hiệu người dùng chọn, từ 1k trở lên thì không', () => {
    expect(formatCompact(850, { symbol: 'đ' })).toBe(nb('850 đ'));
    expect(formatCompact(1_500, { symbol: 'VND' })).toBe('1,5k');
  });

  it('không làm tròn: rút gọn xong đọc lại ra đúng số cũ', () => {
    for (const amount of [1_234, 1_487_759, 1_005_000, 999_999, 98_765, 2_350_001])
      expect(parseMoney(formatCompact(amount))).toBe(amount);
  });

  it('không bao giờ có ",0" thừa, tối đa 2 số lẻ', () => {
    for (const amount of [1_000, 20_000, 2_000_000, 10_000_000, 3_000_000_000, 1_234_560, 98_700]) {
      const text = formatCompact(amount);
      expect(text).not.toMatch(/,\d?0(?!\d)/);
      expect(text).not.toMatch(/,\d{3}/);
    }
  });

  it('không còn đơn vị cũ "N"', () => {
    expect(formatCompact(150_000)).not.toContain('N');
  });
});

describe('parseMoney', () => {
  it.each([
    ['1500000', 1_500_000],
    ['1.500.000', 1_500_000],
    ['1,500,000', 1_500_000],
    ['1 500 000', 1_500_000],
    ['1.500.000 ₫', 1_500_000],
    ['1.500.000đ', 1_500_000],
    ['1.500.000 VND', 1_500_000],
    ['1.500.000 VNĐ', 1_500_000],
    ['1.500.000,00 ₫', 1_500_000],
    ['1,500,000.00', 1_500_000],
    ['1.500', 1_500],
    ['150k', 150_000],
    ['150K', 150_000],
    ['150 nghìn', 150_000],
    ['150 ngàn', 150_000],
    ['1.5tr', 1_500_000],
    ['1,5tr', 1_500_000],
    ['1,5 Tr', 1_500_000],
    ['1,5Tr', 1_500_000],
    ['150Tr', 150_000_000],
    ['1,5k', 1_500],
    ['15k', 15_000],
    ['150 N', 150_000],
    ['1.15tr', 1_150_000],
    ['2 triệu', 2_000_000],
    ['1tr5', 1_500_000],
    ['1tr250', 1_250_000],
    ['2 tỷ', 2_000_000_000],
    ['2 tỉ', 2_000_000_000],
    ['2,35 Tỷ', 2_350_000_000],
    ['1.5m', 1_500_000],
    ['−50.000 ₫', -50_000],
    ['-50000', -50_000],
    ['+50000', 50_000],
    ['0', 0],
    ['2 tỷ đồng', 2_000_000_000],
  ])('%s → %d', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each([[''], ['abc'], ['1.5.0'], ['1.50.000'], ['1.5tr5'], ['tr'], ['1..5'], ['.5'], ['5.']])(
    'không hợp lệ: "%s" → null',
    (input) => {
      expect(parseMoney(input)).toBeNull();
    },
  );

  it('chặn số quá lớn', () => {
    expect(parseMoney('999.999.999.999')).toBe(MAX_AMOUNT);
    expect(parseMoney('1000 tỷ')).toBeNull();
  });

  it('đọc lại được đúng chuỗi do formatMoney / formatCompact tạo ra', () => {
    expect(parseMoney(formatMoney(0))).toBe(0);
    for (const amount of [850, 173_614, 1_500_000, 2_350_000_000]) {
      expect(parseMoney(formatMoney(amount))).toBe(amount);
      expect(parseMoney(formatMoney(-amount))).toBe(-amount);
    }
    for (const amount of [850, 1_000, 1_500, 15_000, 150_000, 1_000_000, 1_250_000, 150_000_000]) {
      expect(parseMoney(formatCompact(amount))).toBe(amount);
      expect(parseMoney(formatCompact(-amount))).toBe(-amount);
    }
    for (const amount of [1_000_000_000, 2_350_000_000]) {
      expect(parseMoney(formatCompact(amount))).toBe(amount);
      expect(parseMoney(formatCompact(-amount))).toBe(-amount);
    }
  });
});

describe('groupThousands', () => {
  it('chỉ phần số cho ô nhập tiền', () => {
    expect(groupThousands(1_500_000)).toBe('1.500.000');
    expect(groupThousands(0)).toBe('0');
  });
});

describe('applyKeypadKey', () => {
  const type = (keys: string[]) =>
    keys.reduce((value, key) => applyKeypadKey(value, key as never), 0);

  it('gõ 1500000 → 1.500.000', () => {
    expect(groupThousands(type(['1', '5', '0', '0', '0', '0', '0']))).toBe('1.500.000');
  });

  it('phím 000', () => {
    expect(type(['1', '5', '000'])).toBe(15_000);
  });

  it('không cho số 0 ở đầu', () => {
    expect(type(['0', '0', '5'])).toBe(5);
    expect(type(['000', '000'])).toBe(0);
  });

  it('xoá lùi', () => {
    expect(type(['1', '2', '3', 'backspace'])).toBe(12);
    expect(type(['backspace'])).toBe(0);
  });

  it('chặn khi vượt giới hạn, giữ nguyên số cũ', () => {
    expect(applyKeypadKey(MAX_AMOUNT, '9')).toBe(MAX_AMOUNT);
    expect(applyKeypadKey(1_000_000_000, '000')).toBe(1_000_000_000);
  });
});

describe('calcMoney', () => {
  it('cộng trừ nhân chia số nguyên', () => {
    expect(calcMoney(1_200_000, '+', 350_000)).toBe(1_550_000);
    expect(calcMoney(500_000, '-', 120_000)).toBe(380_000);
    expect(calcMoney(35_000, '×', 3)).toBe(105_000);
    expect(calcMoney(900_000, '÷', 3)).toBe(300_000);
  });

  it('không làm tròn: chia không hết, chia 0, âm, quá lớn → null', () => {
    expect(calcMoney(100, '÷', 3)).toBeNull();
    expect(calcMoney(100, '÷', 0)).toBeNull();
    expect(calcMoney(100, '-', 101)).toBeNull();
    expect(calcMoney(999_999_999_999, '+', 1)).toBeNull();
  });
});
