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

describe('parseReceipt — MoMo chuyển tiền tới tài khoản ngân hàng', () => {
  // Chữ OCR: nhãn và giá trị thành các dòng riêng, đúng thứ tự đọc trên màn hình
  const lines = [
    'Chi Tiết Giao Dịch',
    'THANH TOÁN CHO NGUYEN THI',
    'NGOC HUE (SHB)',
    '-20.000đ',
    'Trạng thái',
    'Thành công',
    'Thời gian',
    '07:13 - 11/10/2026',
    'Quá trình giao dịch',
    'Mã giao dịch',
    '151086811171',
    'Tài khoản/thẻ',
    'MBBank',
    'Tổng phí',
    'Miễn phí',
    'Danh mục',
    'Sức khỏe',
    'Số thẻ/TK',
    'SQ1184X743R5',
    'Ngân hàng',
    'Ngân hàng TMCP Sài',
    'Gòn - Hà Nội',
    'Người nhận',
    'NGUYEN THI NGOC',
    'HUE',
    'Số tiền',
    '20.000đ',
    'Tin nhắn',
    'NGUYEN XUAN DUNG',
    'chuyen tien qua MoMo',
  ];

  it('đọc đủ số tiền, thời gian, mã, nội dung và người nhận', () => {
    const r = parseReceipt(lines.join('\n'), null, { now: Date.UTC(2026, 9, 12, 12, 0) });
    expect(r.amount).toBe(20_000);
    expect(r.type).toBe('expense');
    expect(r.transactionRef).toBe('151086811171');
    // 07:13 11/10/2026 giờ VN = 00:13 UTC
    expect(r.date).toBe(Date.UTC(2026, 9, 11, 0, 13));
    expect(r.content).toBe('NGUYEN XUAN DUNG chuyen tien qua MoMo');
    expect(r.counterparty).toBe('Nguyen Thi Ngoc Hue');
    expect(r.fee).toBe(0);
  });

  it('ví của mình là MB, bên kia là SHB', () => {
    const r = parseReceipt(lines.join('\n'), null, { now: Date.UTC(2026, 9, 12, 12, 0) });
    expect(r.bankCode).toBe('MB');
    expect(r.counterpartyBankCode).toBe('SHB');
  });
});
