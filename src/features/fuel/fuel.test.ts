import {
  formatFuelNote,
  isFuelText,
  litersFor,
  mergeFuelNote,
  parseFuelNote,
  priceChangeText,
  stripFuelNote,
} from './fuel';

describe('đổ xăng', () => {
  it('nhận ra tiêu đề / danh mục xăng', () => {
    expect(isFuelText('Đổ xăng')).toBe(true);
    expect(isFuelText('Đổ Xăng 50k')).toBe(true);
    expect(isFuelText('Xăng xe')).toBe(true);
    expect(isFuelText('Cà phê sáng')).toBe(false);
    expect(isFuelText(null)).toBe(false);
  });

  it('tính số lít', () => {
    expect(litersFor(60_000, 21_350)).toBe(2.81);
    expect(litersFor(60_000, 0)).toBe(0);
  });

  it('ghi và đọc lại dòng giá xăng', () => {
    const line = formatFuelNote(21_350, 2.81);
    expect(line).toBe('⛽ 21.350đ/lít · 2,81 lít');
    expect(parseFuelNote(line)).toEqual({ price: 21_350, liters: 2.81 });
    expect(parseFuelNote('Không có')).toBeNull();
  });

  it('ghép / bỏ dòng ⛽ mà giữ ghi chú của người dùng', () => {
    const merged = mergeFuelNote('trạm Petrolimex', { price: 21_350, liters: 2.81 });
    expect(merged).toBe('⛽ 21.350đ/lít · 2,81 lít\ntrạm Petrolimex');
    expect(stripFuelNote(merged)).toBe('trạm Petrolimex');
    // đổi giá → thay dòng cũ, không nhân đôi
    expect(mergeFuelNote(merged, { price: 21_800, liters: 2.75 })).toBe(
      '⛽ 21.800đ/lít · 2,75 lít\ntrạm Petrolimex',
    );
    expect(mergeFuelNote(merged, null)).toBe('trạm Petrolimex');
  });

  it('so với lần trước', () => {
    expect(priceChangeText(21_800, 21_350)).toBe('Tăng 450đ/lít so với lần đổ trước');
    expect(priceChangeText(21_050, 21_350)).toBe('Giảm 300đ/lít so với lần đổ trước');
    expect(priceChangeText(21_350, 21_350)).toBe('Bằng giá lần đổ trước');
  });
});
