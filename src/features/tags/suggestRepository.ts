import { and, eq, ne } from 'drizzle-orm';

import { tags, transactions } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import { attachTag, ensureTag } from './repository';
import { proposeTags, type TagProposal } from './suggest';

/** Gợi ý tag từ tiêu đề mọi giao dịch (bỏ điều chỉnh số dư, giao dịch sổ nợ) */
export function listTagProposals(db: AppDatabase): TagProposal[] {
  const rows = db
    .select({ id: transactions.id, title: transactions.title, date: transactions.date })
    .from(transactions)
    .where(and(eq(transactions.isAdjustment, false), ne(transactions.title, '')))
    .all();
  const existing = new Set(
    db
      .select({ key: tags.nameKey })
      .from(tags)
      .all()
      .map((t) => t.key),
  );
  return proposeTags(rows, { existingTagKeys: existing });
}

/** Tạo tag (hoặc dùng tag cùng tên) và gắn vào các giao dịch của gợi ý */
export function applyTagProposal(db: AppDatabase, proposal: TagProposal): number {
  return db.transaction((tx) => attachTag(tx, ensureTag(tx, proposal.name), proposal.txIds));
}
