import { parseReceipt } from './parse';

const NOW = Date.UTC(2026, 9, 12, 12, 0);

describe('parseReceipt', () => {
  it('biên lai chuyển khoản ngân hàng', () => {
    const text = [
      'Chuyển tiền thành công',
      '1.500.000 VND',
      'Người nhận',
      'NGUYEN VAN A',
      'Ngân hàng',
      'Vietcombank',
      'Nội dung',
      'tien an trua',
      'Thời gian',
      '12/10/2026 18:14',
      'Mã giao dịch',
      'FT26285123456789',
    ].join('\n');
    const r = parseReceipt(text, null, { now: NOW });
    expect(r.amount).toBe(1_500_000);
    expect(r.type).toBe('expense');
    expect(r.transactionRef).toContain('FT26285123456789');
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('nhận ra khoản thu khi nhận tiền', () => {
    const text = ['Bạn đã nhận được tiền', '+250.000đ', 'Từ TRAN THI B', '12/10/2026 09:00'].join('\n');
    const r = parseReceipt(text, null, { now: NOW });
    expect(r.amount).toBe(250_000);
    expect(r.type).toBe('income');
  });

  it('không có số tiền thì không đoán bừa', () => {
    const r = parseReceipt('Xin chào\nCảm ơn quý khách', null, { now: NOW });
    expect(r.amount).toBeUndefined();
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('bỏ qua ngày ở tương lai xa (đọc sai)', () => {
    const r = parseReceipt('Thanh toán thành công\n50.000đ\n12/10/2030 18:14', null, { now: NOW });
    expect(r.date == null || r.date <= NOW + 86_400_000).toBe(true);
  });
});
