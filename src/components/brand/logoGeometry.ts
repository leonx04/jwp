// FILE SINH TỰ ĐỘNG bởi scripts/gen-brand-assets.js — đừng sửa tay, sửa script rồi chạy lại.
// Hình học logo trong hệ toạ độ 1024×1024, khớp từng điểm với assets/splash-icon.png.

export const LOGO_CANVAS = 1024;

export const LOGO = {
  radius: 230,
  gradient: { from: '#5B5BF6', to: '#7C3AED' },
  highlight: { cx: 280, cy: 160, r: 760, opacity: 0.18 },
  backCoin: { cx: 554, cy: 548, r: 228, opacity: 0.3 },
  frontCoin: { cx: 482, cy: 482, r: 228 },
  j: { d: 'M464 386 H548 V518 A66 66 0 0 1 416 518', width: 66 },
} as const;
