// FILE SINH TỰ ĐỘNG bởi scripts/gen-brand-assets.js — đừng sửa tay, sửa script rồi chạy lại.
// Hình học logo "Dòng lương" trong hệ toạ độ 1024×1024, khớp từng điểm với assets/splash-icon.png.

export const LOGO_CANVAS = 1024;

export const LOGO = {
  radius: 230,
  gradient: { from: '#2A1E9E', to: '#7C3AED' },
  highlight: { cx: 250, cy: 140, r: 720, opacity: 0.16 },
  glow: { cx: 160, cy: 940, r: 640, color: '#38BDF8', opacity: 0.26 },
  amber: '#FFC857',
  head: { cx: 724.85, cy: 280.25, r: 76.5 },
  j: { d: 'M724.85 370.25 V586.25 A180 180 0 0 1 544.85 766.25 H463.85', width: 108, length: 579.74 },
  drops: [
    { cx: 360.35, cy: 766.25, r: 32.4, opacity: 0.92 },
    { cx: 292.85, cy: 766.25, r: 23.4, opacity: 0.66 },
    { cx: 238.85, cy: 766.25, r: 16.2, opacity: 0.4 },
  ],
} as const;
