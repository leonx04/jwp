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
    expect(r.category).toBe('Sức khỏe');
  });

  it('ví của mình là MB, bên kia là SHB', () => {
    const r = parseReceipt(lines.join('\n'), null, { now: Date.UTC(2026, 9, 12, 12, 0) });
    expect(r.bankCode).toBe('MB');
    expect(r.counterpartyBankCode).toBe('SHB');
  });
});

describe('parseReceipt — MB Bank chi tiết giao dịch (có nền mờ phía sau)', () => {
  const NOW_MB = Date.UTC(2026, 9, 12, 12, 0);
  const lines = [
    'Chi tiết tài khoản',
    // Nền mờ phía sau cửa sổ chi tiết: các giao dịch khác, không được lấy nhầm
    'CASHIN-0377903208-OQCICRwlyA...',
    'TIỀN VÀO',
    '+680,000 VND',
    'VND-TGTT-THAI VIET MINH KHOI',
    '14:51',
    '09/10/2026',
    'TIỀN RA',
    '-60,000 VND',
    'CUSTOMER MOMO-',
    '07:48',
    // Cửa sổ chi tiết
    'Chi tiết giao dịch',
    '90,000 VND',
    'Chuyển khoản đến',
    'Tên tài khoản',
    'NGUYEN XUAN DUNG',
    'Số tài khoản',
    '0377903208',
    'Nội dung',
    'NGUYEN XUAN DUNG',
    'NGUYEN XUAN DUNG',
    'chuyen tien I2JQ2P BT/',
    '982357',
    'Thời gian',
    '08/10/2026 13:32:16',
    'Mã giao dịch',
    'FT26281321085434',
  ];

  it('đọc đúng số tiền 90,000, khoản chi, giờ có giây và mã FT…', () => {
    const r = parseReceipt(lines.join('\n'), null, { now: NOW_MB });
    expect(r.amount).toBe(90_000);
    expect(r.type).toBe('expense');
    expect(r.transactionRef).toBe('FT26281321085434');
    // 13:32:16 08/10/2026 giờ VN = 06:32:16 UTC
    expect(r.date).toBe(Date.UTC(2026, 9, 8, 6, 32, 16));
    expect(r.counterparty).toBe('Nguyen Xuan Dung');
  });

  it('nội dung là cả 4 dòng nội dung chuyển khoản', () => {
    const r = parseReceipt(lines.join('\n'), null, { now: NOW_MB });
    expect(r.content).toContain('chuyen tien I2JQ2P BT/');
    expect(r.content).toContain('982357');
  });
});
