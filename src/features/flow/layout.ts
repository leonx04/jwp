// Dòng chảy đồng lương (sơ đồ Sankey 2 cột): bên trái là tiền vào (thu nhập, + phần "từ số dư" nếu chi vượt thu),
// bên phải là tiền đi đâu (các danh mục lớn nhất, "Khác", và "Còn lại"). Hàm thuần: chỉ tính hình học.
export type FlowItem = { key: string; name: string; color: string; amount: number };

export type FlowNode = { key: string; name: string; color: string; amount: number; y: number; h: number };
export type FlowLink = {
  color: string;
  /** Đoạn trên cột trái: [y, cao] */
  from: [number, number];
  /** Đoạn trên cột phải */
  to: [number, number];
};

export type FlowLayout = {
  left: FlowNode[];
  right: FlowNode[];
  links: FlowLink[];
  /** Tổng tiền đi ra (chi) và tiền còn lại / thiếu hụt */
  expense: number;
  remaining: number;
};

export type FlowInput = {
  income: number;
  /** Chi theo danh mục (đã gộp) */
  expenses: FlowItem[];
  height: number;
  gap?: number;
  /** Số danh mục hiện riêng, phần còn lại gom vào "Khác" */
  topN?: number;
  labels?: { income: string; shortfall: string; other: string; remaining: string };
  colors?: { income: string; shortfall: string; other: string; remaining: string };
};

const DEFAULT_LABELS = { income: 'Thu nhập', shortfall: 'Từ số dư', other: 'Khác', remaining: 'Còn lại' };
const DEFAULT_COLORS = { income: '#16A34A', shortfall: '#EF4444', other: '#94A3B8', remaining: '#22C55E' };

export function layoutFlow(input: FlowInput): FlowLayout | null {
  const { income, height, gap = 6, topN = 6 } = input;
  const labels = { ...DEFAULT_LABELS, ...input.labels };
  const colors = { ...DEFAULT_COLORS, ...input.colors };
  const sorted = input.expenses.filter((e) => e.amount > 0).sort((a, b) => b.amount - a.amount);
  const expense = sorted.reduce((s, e) => s + e.amount, 0);
  if (income <= 0 && expense <= 0) return null;

  const head = sorted.slice(0, topN);
  const restSum = sorted.slice(topN).reduce((s, e) => s + e.amount, 0);
  const rightItems: FlowItem[] = [...head];
  if (restSum > 0) rightItems.push({ key: '__other', name: labels.other, color: colors.other, amount: restSum });
  const remaining = income - expense;
  if (remaining > 0) {
    rightItems.push({ key: '__remaining', name: labels.remaining, color: colors.remaining, amount: remaining });
  }

  const total = Math.max(income, expense);
  const usable = Math.max(0, height - gap * (rightItems.length - 1));
  const k = usable / total;

  // Cột phải: xếp từ trên xuống, cách nhau `gap`
  let y = 0;
  const right: FlowNode[] = rightItems.map((item) => {
    const node = { ...item, y, h: item.amount * k };
    y += node.h + gap;
    return node;
  });

  // Cột trái: liền khối, nguồn đầu là thu nhập rồi tới phần thiếu
  const sources: FlowItem[] = [];
  if (income > 0) sources.push({ key: '__income', name: labels.income, color: colors.income, amount: income });
  if (expense > income) {
    sources.push({ key: '__shortfall', name: labels.shortfall, color: colors.shortfall, amount: expense - income });
  }
  let ly = 0;
  const left: FlowNode[] = sources.map((s) => {
    const node = { ...s, y: ly, h: s.amount * k };
    ly += node.h;
    return node;
  });

  // Nối: duyệt các đích từ trên xuống, rút dần từ các nguồn theo thứ tự
  const links: FlowLink[] = [];
  let si = 0;
  let used = 0; // đã dùng của nguồn si
  for (const dst of right) {
    if (dst.key === '__remaining') {
      // Phần còn lại chỉ lấy từ thu nhập (luôn còn dư ở nguồn đầu)
    }
    let need = dst.amount;
    let dy = dst.y;
    while (need > 1e-9 && si < left.length) {
      const src = left[si];
      const take = Math.min(need, src.amount - used);
      if (take > 1e-9) {
        const h = take * k;
        links.push({ color: dst.color, from: [src.y + used * k, h], to: [dy, h] });
        dy += h;
        used += take;
        need -= take;
      }
      if (used >= src.amount - 1e-9) {
        si++;
        used = 0;
      }
    }
  }

  return { left, right, links, expense, remaining };
}

/** Đường cong dải nối từ (x0, [y, h]) tới (x1, [y, h]) */
export function ribbonPath(x0: number, from: [number, number], x1: number, to: [number, number]): string {
  const xm = (x0 + x1) / 2;
  const [sy, sh] = from;
  const [dy, dh] = to;
  return [
    `M${x0},${sy}`,
    `C${xm},${sy} ${xm},${dy} ${x1},${dy}`,
    `L${x1},${dy + dh}`,
    `C${xm},${dy + dh} ${xm},${sy + sh} ${x0},${sy + sh}`,
    'Z',
  ].join(' ');
}
