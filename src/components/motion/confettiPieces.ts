// Kịch bản các mảnh pháo giấy (hàm thuần, tách riêng để test mà không cần thư viện hoạt hình).
export const CONFETTI_COLORS = ['#FFC857', '#7C3AED', '#38BDF8', '#34D399', '#FB7185', '#F59E0B'];

/** Số giả ngẫu nhiên cố định theo chỉ số: mỗi lần bắn đều cùng một "kịch bản", không nhấp nháy khi vẽ lại */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export type Piece = {
  vx: number;
  vy: number;
  spin: number;
  size: number;
  color: string;
  round: boolean;
};

export const confettiPieces = (count = 34): Piece[] =>
  Array.from({ length: count }, (_, i) => {
    const angle = (-90 + (rand(i, 1) - 0.5) * 120) * (Math.PI / 180); // quạt hướng lên
    const speed = 260 + rand(i, 2) * 300;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (rand(i, 3) - 0.5) * 900,
      size: 7 + rand(i, 4) * 7,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: rand(i, 5) > 0.7,
    };
  });
