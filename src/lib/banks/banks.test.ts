import fs from 'node:fs';
import path from 'node:path';

import { BANKS, bankFromIcon, bankIcon, detectBank } from './index';

describe('nhận diện ngân hàng từ tên ví', () => {
  it.each([
    ['MB bank', 'MB'],
    ['MBBank', 'MB'],
    ['TP Bank', 'TPB'],
    ['TPBank Tiết kiệm', 'TPB'],
    ['Techcombank', 'TCB'],
    ['Vietcombank lương', 'VCB'],
    ['Momo', 'MOMO'],
    ['Quỹ du lịch Momo', 'MOMO'],
    ['Ví Shoppe', 'SHOPEEPAY'],
    ['ShopeePay', 'SHOPEEPAY'],
    ['Zalo Pay', 'ZALOPAY'],
    ['Thẻ Sacombank', 'STB'],
    ['Ngân hàng Quân Đội', 'MB'],
    ['LienVietPostBank', 'LPB'],
    ['Viettel Money', 'VIETTELMONEY'],
  ])('%s → %s', (name, code) => {
    expect(detectBank(name)?.code).toBe(code);
  });

  it.each([['Tiền mặt'], ['Quỹ du lịch'], ['Ví'], [''], ['Heo đất'], ['Combo']])(
    'không nhận nhầm: "%s"',
    (name) => {
      expect(detectBank(name)).toBeNull();
    },
  );

  it('lưu / đọc icon', () => {
    expect(bankFromIcon(bankIcon('MB'))?.name).toBe('MB Bank');
    expect(bankFromIcon('wallet-outline')).toBeNull();
  });

  it('mọi ngân hàng có logo (trừ ví dùng huy hiệu chữ), mã không trùng', () => {
    const dir = path.join(__dirname, '../../../assets/banks');
    for (const bank of BANKS) {
      if (bank.monogram) continue;
      expect(fs.existsSync(path.join(dir, `${bank.code}.png`))).toBe(true);
    }
    expect(new Set(BANKS.map((b) => b.code)).size).toBe(BANKS.length);
  });
});
