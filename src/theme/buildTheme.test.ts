import { buildTheme } from './buildTheme';
import { contrastRatio, mix, withAlpha } from './color';
import { ACCENT_KEYS } from './palettes';

const MODES = [
  { name: 'sáng', dark: false, amoled: false },
  { name: 'tối', dark: true, amoled: false },
  { name: 'AMOLED', dark: true, amoled: true },
];

describe('buildTheme', () => {
  it('AMOLED dùng nền đen tuyền, chỉ có tác dụng ở chế độ tối', () => {
    expect(buildTheme({ dark: true, amoled: true, accent: 'indigo' }).colors.background).toBe(
      '#000000',
    );
    const light = buildTheme({ dark: false, amoled: true, accent: 'indigo' });
    expect(light.amoled).toBe(false);
    expect(light.colors.background).not.toBe('#000000');
  });

  // Đảm bảo mọi tổ hợp chế độ × màu chủ đạo đều đọc được (chuẩn WCAG)
  describe.each(MODES)('chế độ $name', ({ dark, amoled }) => {
    it.each(ACCENT_KEYS)('màu %s đủ tương phản', (accent) => {
      const { colors } = buildTheme({ dark, amoled, accent });
      // Chữ trên nút màu chủ đạo
      expect(contrastRatio(colors.primary, colors.onPrimary)).toBeGreaterThanOrEqual(3);
      // Màu chủ đạo làm chữ / icon trên nền (link, tab đang chọn)
      expect(contrastRatio(colors.primary, colors.surface)).toBeGreaterThanOrEqual(3);
      // Số dư trên thẻ gradient (chữ lớn)
      expect(contrastRatio(colors.gradient[0], colors.onGradient)).toBeGreaterThanOrEqual(3);
    });

    it('chữ chính, chữ phụ, thu, chi đọc được trên nền thẻ', () => {
      const { colors } = buildTheme({ dark, amoled, accent: 'indigo' });
      expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.income, colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.expense, colors.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('dock đảo màu và snackbar đọc được', () => {
      const { colors } = buildTheme({ dark, amoled, accent: 'indigo' });
      expect(contrastRatio(colors.onInverseSurface, colors.inverseSurface)).toBeGreaterThanOrEqual(
        7,
      );
      expect(contrastRatio(colors.inverseMuted, colors.inverseSurface)).toBeGreaterThanOrEqual(3);
      // Nền snackbar gần #16181F ở mọi chế độ
      expect(contrastRatio(colors.onToast, '#16181F')).toBeGreaterThanOrEqual(7);
      for (const accent of ACCENT_KEYS) {
        const action = buildTheme({ dark, amoled, accent }).colors.toastAction;
        expect(contrastRatio(action, '#16181F')).toBeGreaterThanOrEqual(3);
      }
    });
  });
});

describe('color utils', () => {
  it('mix', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#FF4060', '#FF4060', 0.3)).toBe('#FF4060');
  });

  it('withAlpha', () => {
    expect(withAlpha('#5B5BD6', 1)).toBe('#5B5BD6FF');
    expect(withAlpha('#5B5BD6', 0)).toBe('#5B5BD600');
  });

  it('contrastRatio đen/trắng = 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
  });
});
