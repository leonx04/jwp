import { and, eq, isNull, ne } from 'drizzle-orm';

import { people, tags, transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { normalizeForSearch } from '@/lib/text';

import { listDebtProposals } from '@/features/debts/queries';

import { attachTag, ensureTag } from './repository';
import { proposeTags, type TagProposal } from './suggest';

/** Gợi ý tag từ tiêu đề giao dịch (bỏ điều chỉnh số dư và giao dịch của Sổ nợ) */
export function listTagProposals(db: AppDatabase): TagProposal[] {
  const rows = db
    .select({ id: transactions.id, title: transactions.title, date: transactions.date })
    .from(transactions)
    .where(
      and(
        eq(transactions.isAdjustment, false),
        // Giao dịch vay / trả nợ đã có Sổ nợ lo, tiêu đề toàn tên người → không gợi ý tag
        isNull(transactions.debtId),
        ne(transactions.title, ''),
      ),
    )
    .all();
  const existing = new Set(
    db
      .select({ key: tags.nameKey })
      .from(tags)
      .all()
      .map((t) => t.key),
  );
  // Tên người trong Sổ nợ và từ vay / nợ không phải chủ đề chi tiêu
  const excludeWords = new Set(['no', 'vay', 'muon']);
  const names = [
    ...db
      .select({ name: people.name })
      .from(people)
      .all()
      .map((p) => p.name),
    // Cả những người app mới phát hiện từ giao dịch cũ nhưng chưa tạo trong Sổ nợ
    ...listDebtProposals(db).map((d) => d.personName),
  ];
  for (const name of names) {
    for (const w of normalizeForSearch(name).split(' ')) if (w.length >= 2) excludeWords.add(w);
  }
  return proposeTags(rows, { existingTagKeys: existing, excludeWords });
}

/** Tạo tag (hoặc dùng tag cùng tên) và gắn vào các giao dịch của gợi ý */
export function applyTagProposal(db: AppDatabase, proposal: TagProposal): number {
  return db.transaction((tx) => attachTag(tx, ensureTag(tx, proposal.name), proposal.txIds));
}
