// Cấu trúc file backup Ivy Wallet (kiểm tra bằng zod trước khi ghi vào DB).
// Ivy (kotlinx.serialization) KHÔNG ghi các trường có giá trị mặc định vào file
// → trường vắng mặt phải hiểu theo mặc định của Ivy (vd orderNum = 0, includeInBalance = true).
import { z } from 'zod';

const id = z.string().min(1);
const optStr = z.string().nullish();
const optNum = z.number().nullish();

/** Thời điểm: Ivy ghi mili giây; bản cũ có thể là chuỗi ISO */
const instant = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    if (value == null) return null;
    const ms = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  });

const txType = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);

export const ivyAccountSchema = z.object({
  id,
  name: z.string(),
  currency: optStr,
  color: z.number().default(0),
  icon: optStr,
  orderNum: z.number().default(0),
  includeInBalance: z.boolean().default(true),
  isDeleted: z.boolean().default(false),
});

export const ivyCategorySchema = z.object({
  id,
  name: z.string(),
  color: z.number().default(0),
  icon: optStr,
  orderNum: z.number().default(0),
  isDeleted: z.boolean().default(false),
});

export const ivyTransactionSchema = z.object({
  id,
  accountId: id,
  type: txType,
  amount: z.number(),
  toAccountId: optStr,
  toAmount: optNum,
  title: optStr,
  description: optStr,
  dateTime: instant,
  categoryId: optStr,
  dueDate: instant,
  recurringRuleId: optStr,
  paidForDateTime: instant,
  loanId: optStr,
  loanRecordId: optStr,
  isDeleted: z.boolean().default(false),
});

export const ivyPlannedRuleSchema = z.object({
  id,
  startDate: instant,
  intervalN: optNum,
  intervalType: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).nullish(),
  oneTime: z.boolean().default(false),
  type: txType,
  accountId: id,
  amount: z.number().default(0),
  categoryId: optStr,
  title: optStr,
  description: optStr,
  isDeleted: z.boolean().default(false),
});

export const ivySettingsSchema = z.object({
  theme: optStr,
  currency: optStr,
  bufferAmount: optNum,
  name: optStr,
});

export const ivyTagSchema = z.object({
  id,
  name: z.string(),
  color: z.number().default(0),
  isDeleted: z.boolean().default(false),
});

export const ivyTagAssociationSchema = z.object({
  tagId: id,
  associatedId: id,
  isDeleted: z.boolean().default(false),
});

export const ivyBudgetSchema = z.object({
  id,
  name: z.string(),
  amount: z.number(),
  categoryIdsSerialized: optStr,
  accountIdsSerialized: optStr,
  isDeleted: z.boolean().default(false),
});

export const ivyLoanSchema = z.object({
  id,
  name: z.string(),
  amount: z.number(),
  /** BORROW: tôi đi vay (tôi nợ) · LEND: tôi cho vay (họ nợ tôi) */
  type: z.enum(['BORROW', 'LEND']),
  accountId: optStr,
  note: optStr,
  dateTime: instant,
  isDeleted: z.boolean().default(false),
});

export const ivyLoanRecordSchema = z.object({
  id,
  loanId: id,
  amount: z.number(),
  note: optStr,
  dateTime: instant,
  interest: z.boolean().default(false),
  accountId: optStr,
  /** DECREASE: trả bớt (mặc định với backup cũ) · INCREASE: vay thêm */
  loanRecordType: z.enum(['INCREASE', 'DECREASE']).default('DECREASE'),
  isDeleted: z.boolean().default(false),
});

export const ivyBackupSchema = z.object({
  accounts: z.array(ivyAccountSchema),
  transactions: z.array(ivyTransactionSchema),
  categories: z.array(ivyCategorySchema).default([]),
  plannedPaymentRules: z.array(ivyPlannedRuleSchema).default([]),
  settings: z.array(ivySettingsSchema).default([]),
  sharedPrefs: z.record(z.string(), z.string()).nullish(),
  tags: z.array(ivyTagSchema).default([]),
  tagAssociations: z.array(ivyTagAssociationSchema).default([]),
  budgets: z.array(ivyBudgetSchema).default([]),
  loans: z.array(ivyLoanSchema).default([]),
  loanRecords: z.array(ivyLoanRecordSchema).default([]),
});

export type IvyBackup = z.infer<typeof ivyBackupSchema>;
export type IvyTransaction = z.infer<typeof ivyTransactionSchema>;
export type IvyPlannedRule = z.infer<typeof ivyPlannedRuleSchema>;
