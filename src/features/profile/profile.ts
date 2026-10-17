// Cài đặt cá nhân bằng JSON: dán một đoạn JSON để đặt ngân sách (chu kỳ ngày lương…), dọn / đổi tên tag
// và vài tuỳ chọn ứng dụng — thay vì bấm từng mục. Chỉ KẾ HOẠCH trước (xem trước), bấm Áp dụng mới ghi.
// Ví dụ:
// { "settings": { "startDayOfMonth": 17 },
//   "budgets": [ { "name": "Đổ xăng", "startDay": 17, "weekendRule": "after" } ],
//   "tags": { "delete": ["Băng"], "rename": { "Chan ga": "Chân gà" } } }
import { tags, WEEKEND_RULES } from '@/db/schema';
import type { WeekendRule } from '@/lib/recurrence';
import type { AppDatabase } from '@/db/types';
import { parseIdList } from '@/features/budgets/compute';
import { listBudgetRows, saveBudget } from '@/features/budgets/repository';
import { listCategories } from '@/features/categories/repository';
import { listAccounts } from '@/features/accounts/repository';
import { deleteTag, ensureTag, saveTag } from '@/features/tags/repository';
import { parseMoney } from '@/lib/money';
import { normalizeForSearch } from '@/lib/text';

import type { SettingsState } from '../settings/store';

export type ProfileStep = { label: string; run: () => void };
export type ProfilePlan = {
  /** Lỗi cú pháp / cấu trúc: không áp dụng được gì */
  error: string | null;
  steps: ProfileStep[];
  /** Mục bị bỏ qua (không tìm thấy tên…) — không chặn các bước còn lại */
  warnings: string[];
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const key = (s: string) => normalizeForSearch(s);

const SETTING_RULES: Record<string, (v: unknown) => unknown | undefined> = {
  userName: (v) => (typeof v === 'string' ? v.trim() : undefined),
  startDayOfMonth: (v) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31 ? v : undefined),
  safetyThreshold: (v) => (Number.isInteger(v) && (v as number) >= 0 ? v : undefined),
  language: (v) => (v === 'system' || v === 'vi' || v === 'en' ? v : undefined),
  haptics: (v) => (typeof v === 'boolean' ? v : undefined),
  hideBalance: (v) => (typeof v === 'boolean' ? v : undefined),
  transfersAsIncomeExpense: (v) => (typeof v === 'boolean' ? v : undefined),
  suggestionsEnabled: (v) => (typeof v === 'boolean' ? v : undefined),
};

/** Số tiền: số nguyên, hoặc chuỗi kiểu "400k", "1tr2" */
function toAmount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : null;
  if (typeof v === 'string') {
    const n = parseMoney(v);
    return n && n > 0 ? n : null;
  }
  return null;
}

function toDay(v: unknown): number | null | undefined {
  if (v === null) return null;
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31 ? (v as number) : undefined;
}

export function planProfile(
  db: AppDatabase,
  text: string,
  updateSettings: (patch: Partial<SettingsState>) => void,
): ProfilePlan {
  const plan: ProfilePlan = { error: null, steps: [], warnings: [] };
  let root: unknown;
  try {
    root = JSON.parse(text.trim().replace(/^﻿/, ''));
  } catch {
    plan.error = 'Không đọc được JSON — kiểm tra dấu ngoặc, dấu phẩy và dấu ngoặc kép.';
    return plan;
  }
  if (!isObj(root)) {
    plan.error = 'JSON phải là một đối tượng { … }.';
    return plan;
  }
  const known = new Set(['settings', 'budgets', 'tags', 'version']);
  for (const k of Object.keys(root)) if (!known.has(k)) plan.warnings.push(`Bỏ qua mục "${k}" (chưa hỗ trợ).`);

  // ── settings ───────────────────────────────────────────────────────────────
  if (root.settings !== undefined) {
    if (!isObj(root.settings)) plan.warnings.push('"settings" phải là một đối tượng.');
    else {
      const patch: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(root.settings)) {
        const rule = SETTING_RULES[name];
        if (!rule) plan.warnings.push(`Cài đặt "${name}" không hỗ trợ.`);
        else if (rule(value) === undefined) plan.warnings.push(`Giá trị của "${name}" không hợp lệ.`);
        else patch[name] = rule(value);
      }
      if (Object.keys(patch).length) {
        plan.steps.push({
          label: `Cài đặt: ${Object.entries(patch)
            .map(([k, v]) => `${k} = ${String(v)}`)
            .join(', ')}`,
          run: () => updateSettings(patch as Partial<SettingsState>),
        });
      }
    }
  }

  // ── budgets ────────────────────────────────────────────────────────────────
  if (root.budgets !== undefined) {
    if (!Array.isArray(root.budgets)) plan.warnings.push('"budgets" phải là một danh sách [ … ].');
    else {
      const rows = listBudgetRows(db);
      const cats = listCategories(db);
      const accs = listAccounts(db);
      const idsOf = (names: unknown, list: { id: string; name: string }[], what: string): string[] | undefined => {
        if (names === undefined) return undefined;
        if (!Array.isArray(names)) {
          plan.warnings.push(`"${what}" phải là danh sách tên.`);
          return undefined;
        }
        const ids: string[] = [];
        for (const n of names) {
          const hit = list.find((x) => key(x.name) === key(String(n)));
          if (hit) ids.push(hit.id);
          else plan.warnings.push(`Không thấy ${what} "${String(n)}".`);
        }
        return ids;
      };

      root.budgets.forEach((raw, i) => {
        if (!isObj(raw) || typeof raw.name !== 'string' || !raw.name.trim()) {
          plan.warnings.push(`Ngân sách #${i + 1}: thiếu "name".`);
          return;
        }
        const name = raw.name.trim();
        const newName = typeof raw.newName === 'string' ? raw.newName.trim() : '';
        const existing = rows.find((r) => key(r.name) === key(name));
        const amount = raw.amount === undefined ? (existing?.amount ?? null) : toAmount(raw.amount);
        if (!amount) {
          plan.warnings.push(
            existing || raw.amount !== undefined
              ? `Ngân sách "${name}": "amount" không hợp lệ.`
              : `Ngân sách "${name}" chưa có — cần "amount" để tạo mới.`,
          );
          return;
        }
        let startDay: number | null | undefined = undefined;
        if (raw.startDay !== undefined) {
          startDay = toDay(raw.startDay);
          if (startDay === undefined) {
            plan.warnings.push(`Ngân sách "${name}": "startDay" phải từ 1 đến 31 (hoặc null).`);
            return;
          }
        }
        let weekendRule: WeekendRule | undefined;
        if (raw.weekendRule !== undefined) {
          if (!(WEEKEND_RULES as readonly unknown[]).includes(raw.weekendRule)) {
            plan.warnings.push(`Ngân sách "${name}": "weekendRule" chỉ nhận none | before | after.`);
            return;
          }
          weekendRule = raw.weekendRule as WeekendRule;
        }
        const categoryIds = idsOf(raw.categories, cats, 'danh mục');
        const accountIds = idsOf(raw.accounts, accs, 'ví');

        const finalStart = startDay !== undefined ? startDay : (existing?.startDay ?? null);
        const finalRule = weekendRule ?? existing?.weekendRule ?? 'none';
        const bits = [
          `${existing ? 'Cập nhật' : 'Tạo'} ngân sách "${name}"`,
          finalStart === null ? 'chu kỳ theo tháng chung' : `chu kỳ từ ngày ${finalStart}${finalRule === 'none' ? '' : finalRule === 'after' ? ' (cuối tuần dời sang thứ Hai)' : ' (cuối tuần lùi về thứ Sáu)'}`,
        ];
        plan.steps.push({
          label: bits.join(' · '),
          run: () =>
            void saveBudget(db, {
              id: existing?.id,
              // Khớp ngân sách có sẵn thì GIỮ tên cũ (có dấu); chỉ đổi tên khi JSON ghi rõ "newName"
              name: existing ? newName || existing.name : name,
              amount,
              startDay: finalStart,
              weekendRule: finalRule,
              categoryIds: categoryIds ?? parseIdList(existing?.categoryIds),
              accountIds: accountIds ?? parseIdList(existing?.accountIds),
            }),
        });
      });
    }
  }

  // ── tags ───────────────────────────────────────────────────────────────────
  if (root.tags !== undefined) {
    if (!isObj(root.tags)) plan.warnings.push('"tags" phải là một đối tượng { delete, rename, create }.');
    else {
      const all = () => db.select().from(tags).all();
      const find = (name: string) => all().find((t) => t.nameKey === key(name.replace(/^#+/, '')));

      for (const name of Array.isArray(root.tags.delete) ? root.tags.delete : []) {
        const tag = find(String(name));
        if (!tag) plan.warnings.push(`Không thấy tag "${String(name)}" để xoá.`);
        else
          plan.steps.push({
            label: `Xoá tag "${tag.name}" (giao dịch giữ nguyên)`,
            run: () => deleteTag(db, tag.id),
          });
      }
      if (isObj(root.tags.rename)) {
        for (const [from, to] of Object.entries(root.tags.rename)) {
          const tag = find(from);
          if (!tag || typeof to !== 'string' || !to.trim()) {
            plan.warnings.push(`Không đổi được tag "${from}".`);
            continue;
          }
          plan.steps.push({
            label: `Đổi tên tag "${tag.name}" → "${to.trim()}"`,
            run: () => void saveTag(db, { id: tag.id, name: to, color: tag.color }),
          });
        }
      }
      for (const name of Array.isArray(root.tags.create) ? root.tags.create : []) {
        if (typeof name !== 'string' || !name.trim()) continue;
        if (find(name)) continue;
        plan.steps.push({ label: `Tạo tag "${name.trim()}"`, run: () => void ensureTag(db, name) });
      }
    }
  }

  if (!plan.steps.length && !plan.warnings.length) plan.warnings.push('Không có gì để áp dụng.');
  return plan;
}

/** Ghi mọi bước: phần dữ liệu trong một transaction (lỗi giữa chừng thì hoàn lại) rồi mới đổi cài đặt */
export function applyPlan(db: AppDatabase, plan: ProfilePlan): number {
  if (plan.error) return 0;
  db.transaction(() => {
    for (const step of plan.steps) step.run();
  });
  return plan.steps.length;
}

/** Xuất cấu hình hiện tại ra JSON làm mẫu để sửa rồi dán lại */
export function exportProfile(db: AppDatabase, settings: SettingsState): string {
  const cats = listCategories(db);
  const accs = listAccounts(db);
  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name;
  const profile = {
    version: 1,
    settings: {
      userName: settings.userName,
      startDayOfMonth: settings.startDayOfMonth,
      safetyThreshold: settings.safetyThreshold,
      language: settings.language,
      haptics: settings.haptics,
      hideBalance: settings.hideBalance,
    },
    budgets: listBudgetRows(db).map((b) => ({
      name: b.name,
      amount: b.amount,
      startDay: b.startDay,
      weekendRule: b.weekendRule,
      categories: parseIdList(b.categoryIds).map((id) => nameOf(cats, id)).filter(Boolean),
      accounts: parseIdList(b.accountIds).map((id) => nameOf(accs, id)).filter(Boolean),
    })),
    tags: { delete: [] as string[], rename: {} as Record<string, string>, create: [] as string[] },
  };
  return JSON.stringify(profile, null, 2);
}
