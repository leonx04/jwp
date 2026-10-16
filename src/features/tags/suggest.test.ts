import { vnDateToMs } from '@/lib/date';

import { proposeTags, type TagTx } from './suggest';

let n = 0;
const tx = (title: string, day: string): TagTx => ({
  id: `t${++n}`,
  title,
  date: vnDateToMs(day, '08:00'),
});
const days = (title: string, list: string[]) => list.map((d) => tx(title, d));

describe('proposeTags', () => {
  const data: TagTx[] = [
    ...days('Ăn sáng', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']),
    ...days('Ăn trưa', ['2026-09-01', '2026-09-02', '2026-09-03']),
    ...days('cà phê', ['2026-09-01', '2026-09-02', '2026-09-03']),
    ...days('mua nước', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']),
    ...days('uống nước', ['2026-09-05', '2026-09-06']),
    // nhiễu: mã ngân hàng, tiêu đề dài, quá ít lần
    ...days('MBCT RLTA37 DL25TRGW/659458', ['2026-09-01', '2026-09-02', '2026-09-03']),
    ...days('Sửa xe', ['2026-09-01', '2026-09-02']),
  ];

  it('gom các cụm lặp lại thành tag, cụm cụ thể thắng cụm chung', () => {
    const names = proposeTags(data).map((p) => p.name);
    expect(names).toContain('Ăn sáng');
    expect(names).toContain('Ăn trưa');
    expect(names).toContain('Cà phê');
    expect(names).toContain('Nước');
    expect(names).not.toContain('Ăn');
  });

  it('bỏ mã ngân hàng và cụm quá ít lần; đếm đúng số giao dịch', () => {
    const result = proposeTags(data);
    expect(result.some((p) => /mbct|rlta/i.test(p.name))).toBe(false);
    expect(result.some((p) => p.name === 'Sửa xe')).toBe(false);
    expect(result.find((p) => p.name === 'Ăn sáng')?.count).toBe(5);
    expect(result.find((p) => p.name === 'Nước')?.count).toBe(6);
  });

  it('không gợi ý lại tag đã có', () => {
    const result = proposeTags(data, { existingTagKeys: new Set(['an sang']) });
    expect(result.map((p) => p.name)).not.toContain('Ăn sáng');
  });

  it('không gắn nhầm tag có dấu vào chữ khác dấu, bỏ qua tiêu đề do ngân hàng sinh', () => {
    const rows: TagTx[] = [
      ...days('Mua băng keo', ['2026-09-01', '2026-09-02', '2026-09-03']),
      // "BANG" (= bằng) trong tin nhắn ngân hàng: không được dính vào tag "băng"
      ...days('RUT TIEN BANG QRC', ['2026-09-04', '2026-09-05', '2026-09-06']),
      ...days('Nguyen Xuan Dung chuyen tien', ['2026-09-04', '2026-09-05', '2026-09-06']),
    ];
    const proposals = proposeTags(rows);
    const tape = proposals.find((p) => p.name.toLowerCase().includes('băng'));
    expect(tape?.txIds).toHaveLength(3);
    expect(proposals.some((p) => p.samples.some((x) => /RUT TIEN|Nguyen/.test(x)))).toBe(false);
  });
});
