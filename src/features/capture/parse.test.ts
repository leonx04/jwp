import { captureFingerprint, parseCapture, parseVnd, type RawCapture } from './parse';

const T = 1_760_000_000_000;
const notif = (sender: string, title: string, text: string): RawCapture => ({
  source: 'notification',
  sender,
  title,
  text,
  postedAt: T,
});
const sms = (sender: string, text: string): RawCapture => ({
  source: 'sms',
  sender,
  title: '',
  text,
  postedAt: T,
});

describe('parseVnd', () => {
  it.each([
    ['1.234.567', 1_234_567],
    ['1,234,567', 1_234_567],
    ['50.000', 50_000],
    ['50000', 50_000],
    ['1,234,567.00', 1_234_567],
    ['35.000', 35_000],
  ])('%s → %d', (raw, expected) => {
    expect(parseVnd(raw)).toBe(expected);
  });

  it('không phải số tiền → null', () => {
    expect(parseVnd('abc')).toBeNull();
    expect(parseVnd('')).toBeNull();
    expect(parseVnd('0')).toBeNull();
  });
});

describe('parseCapture — SMS ngân hàng', () => {
  it('MB: tiền vào có số dư và nội dung', () => {
    const p = parseCapture(
      sms(
        'MBBANK',
        'TK 0123456789 | GD: +500,000VND 12/10/26 10:01 | SD: 1,234,567VND | ND: NGUYEN VAN A chuyen tien',
      ),
    );
    expect(p).toMatchObject({
      type: 'income',
      amount: 500_000,
      balanceAfter: 1_234_567,
      content: 'NGUYEN VAN A chuyen tien',
      bankCode: 'MB',
    });
  });

  it('TPBank: tiền ra', () => {
    const p = parseCapture(
      sms(
        'TPBank',
        'TPBank: TK 0000***789 -50,000 VND luc 12/10/26 12:00. SD 934,567 VND. ND: Cafe sang',
      ),
    );
    expect(p).toMatchObject({
      type: 'expense',
      amount: 50_000,
      balanceAfter: 934_567,
      bankCode: 'TPB',
    });
    expect(p?.content).toBe('Cafe sang');
  });

  it('Techcombank: dấu + và "So du"', () => {
    const p = parseCapture(
      sms(
        'Techcombank',
        'TK 190***123: +1,200,000 VND luc 12/10/26 08:00. So du: 3,400 VND. Noi dung: Luong thang 9',
      ),
    );
    expect(p).toMatchObject({
      type: 'income',
      amount: 1_200_000,
      balanceAfter: 3_400,
      bankCode: 'TCB',
    });
    expect(p?.content).toBe('Luong thang 9');
  });

  it('số dư không bị nhầm thành số tiền giao dịch', () => {
    const p = parseCapture(
      sms('VCB', 'SD TK 0011**1234 -35,000 VND luc 12-10-2026 10:01:22. SD 1,000,000 VND.'),
    );
    expect(p?.amount).toBe(35_000);
    expect(p?.balanceAfter).toBe(1_000_000);
  });
});

describe('parseCapture — thông báo app', () => {
  it('MoMo nhận tiền', () => {
    const p = parseCapture(
      notif(
        'com.mservice.momotransfer',
        'Nhận tiền thành công',
        'Bạn đã nhận 50.000đ từ NGUYEN VAN A. Lời nhắn: tra tien an',
      ),
    );
    expect(p).toMatchObject({
      type: 'income',
      amount: 50_000,
      bankCode: 'MOMO',
      content: 'tra tien an',
    });
    expect(p?.counterparty).toBe('NGUYEN VAN A');
  });

  it('MoMo chuyển tiền', () => {
    const p = parseCapture(
      notif(
        'com.mservice.momotransfer',
        'Chuyển tiền thành công',
        'Bạn đã chuyển 120.000đ đến TRAN THI B.',
      ),
    );
    expect(p).toMatchObject({ type: 'expense', amount: 120_000, bankCode: 'MOMO' });
    expect(p?.counterparty).toBe('TRAN THI B');
  });

  it('MoMo thanh toán', () => {
    const p = parseCapture(
      notif(
        'com.mservice.momotransfer',
        'Thanh toán thành công',
        'Thanh toán 35.000đ cho Highlands Coffee',
      ),
    );
    expect(p).toMatchObject({ type: 'expense', amount: 35_000 });
  });

  it('thông báo MB có dấu +/−', () => {
    const p = parseCapture(
      notif(
        'com.mbmobile',
        'Biến động số dư',
        'TK 1234***890 +2,000,000 VND. Nội dung: Hoan tien. SD: 2,100,000 VND',
      ),
    );
    expect(p).toMatchObject({
      type: 'income',
      amount: 2_000_000,
      balanceAfter: 2_100_000,
      bankCode: 'MB',
    });
  });
});

describe('parseCapture — bỏ qua', () => {
  it('OTP và quảng cáo', () => {
    expect(
      parseCapture(sms('MBBANK', 'Ma OTP cua quy khach la 123456. Khong chia se ma nay.')),
    ).toBeNull();
    expect(
      parseCapture(
        notif(
          'com.mbmobile',
          'Ưu đãi',
          'Giảm 50.000đ khi thanh toán qua QR, khuyến mãi đến hết tháng',
        ),
      ),
    ).toBeNull();
  });

  it('không có số tiền', () => {
    expect(parseCapture(notif('com.mbmobile', 'Chào bạn', 'Chúc mừng sinh nhật'))).toBeNull();
  });
});

describe('captureFingerprint', () => {
  it('giống nhau trong cùng một phút, khác nhau khi nội dung khác', () => {
    const a = notif('x', 't', 'a');
    expect(captureFingerprint(a)).toBe(captureFingerprint({ ...a, postedAt: a.postedAt + 20_000 }));
    expect(captureFingerprint(a)).not.toBe(captureFingerprint({ ...a, text: 'b' }));
    expect(captureFingerprint(a)).not.toBe(
      captureFingerprint({ ...a, postedAt: a.postedAt + 120_000 }),
    );
  });
});
