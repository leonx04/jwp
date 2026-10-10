// Đối chiếu với file backup Ivy THẬT của chủ app (dữ liệu cá nhân, không commit).
// Tự bỏ qua nếu không tìm thấy file. Đường dẫn: biến môi trường JWP_IVY_BACKUP
// hoặc mặc định ../Base/IvyWalletBackup_*/data*.json
import fs from 'node:fs';
import path from 'node:path';

import { getAccountBalances, totalBalance } from '@/features/accounts/queries';
import { generateOccurrences } from '@/lib/recurrence';
import { createTestDb } from '@/test/testDb';

import { mapIvyBackup, ruleOf } from './mapper';
import { readIvyBackup } from './read';
import { verifyIvyImport, writeIvyImport } from './writer';

function findRealBackup(): string | null {
  if (process.env.JWP_IVY_BACKUP) return process.env.JWP_IVY_BACKUP;
  const base = path.resolve(__dirname, '../../../../../Base');
  if (!fs.existsSync(base)) return null;
  for (const dir of fs.readdirSync(base).filter((d) => d.startsWith('IvyWalletBackup_'))) {
    const file = fs.readdirSync(path.join(base, dir)).find((f) => /^data.*\.json$/.test(f));
    if (file) return path.join(base, dir, file);
  }
  return null;
}

const file = findRealBackup();
const describeReal = file ? describe : describe.skip;

// Đáp án đã được chủ app xác nhận khớp với app Ivy Wallet (11/10/2026)
const EXPECTED_BALANCES: Record<string, number> = {
  'Tiền mặt': 2_000,
  'TP Bank': 935,
  Techcombank: 400,
  'Ví Shoppe': 10_000,
  'MB bank': 60_279,
  Momo: 0,
  'Quỹ du lịch Momo': 100_000,
};

describeReal('backup Ivy thật', () => {
  const NOW = Date.UTC(2026, 9, 11, 3, 0);
  const read = readIvyBackup(new Uint8Array(fs.readFileSync(file!)));
  const plan = mapIvyBackup(read.backup, NOW);

  it('mã hoá UTF-16BE, đủ số lượng', () => {
    expect(read.encoding).toBe('utf-16be');
    expect(plan.stats).toMatchObject({
      accounts: 7,
      categories: 18,
      // 495 giao dịch = 352 giao dịch thật + 143 khoản sắp tới Ivy sinh sẵn
      expense: 406 - 143,
      income: 51,
      transfer: 38,
      upcomingSkipped: 143,
      schedules: 6,
    });
  });

  it('số dư từng ví khớp app Ivy', () => {
    expect(Object.fromEntries(plan.balances.map((b) => [b.name, b.balance]))).toEqual(
      EXPECTED_BALANCES,
    );
    expect(plan.totalBalance).toBe(173_614);
  });

  it('kỳ JWP tự tính khớp đúng 143 kỳ sắp tới của Ivy', () => {
    let total = 0;
    for (const schedule of plan.schedules) {
      const upcoming = plan.ivyUpcoming[schedule.id] ?? [];
      total += upcoming.length;
      if (!upcoming.length) continue;
      const computed = generateOccurrences(ruleOf(schedule), upcoming[0], upcoming.at(-1)!);
      expect(computed).toEqual(upcoming);
    }
    expect(total).toBe(143);
    expect(plan.warnings.filter((w) => w.includes('khác với Ivy'))).toEqual([]);
  });

  it('ghi vào DB: số dư trong DB khớp, import lại không trùng', async () => {
    const db = createTestDb();
    writeIvyImport(db, plan);
    expect(totalBalance(await getAccountBalances(db))).toBe(173_614);
    expect((await verifyIvyImport(db, plan)).ok).toBe(true);
    const again = writeIvyImport(db, plan);
    expect(again.transactions.inserted).toBe(0);
  });
});
