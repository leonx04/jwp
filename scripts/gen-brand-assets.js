// Sinh toàn bộ tài nguyên thương hiệu JWP từ MỘT nguồn hình học duy nhất (file này):
//   assets/brand/logo.svg · mark.svg · mark-monochrome.svg      (nguồn vector)
//   assets/icon.png (1024², iOS — vuông kín, không trong suốt)
//   assets/android-icon-{foreground,background,monochrome}.png  (adaptive icon 1024² = 108dp)
//   assets/android-icon-notification.png (96², trắng trên nền trong suốt — icon thông báo)
//   assets/splash-icon.png (ô bo góc + CHẤM VÀNG; chữ J được vẽ tiếp bằng hiệu ứng mở app)
//   assets/favicon.png (48²)
//   src/components/brand/logoGeometry.ts (toạ độ cho BrandLogo / AppIntro vẽ bằng react-native-svg → khớp splash)
//
// Ý tưởng logo "Dòng lương": chữ J là một dòng chảy bắt đầu từ chấm vàng hổ phách (ngày nhận lương), trượt xuống,
// uốn thành móc J rồi tan thành ba giọt nhỏ dần (tiền chia vào các khoản chi). Nền chàm đậm → tím, ánh ngọc ở góc dưới.
// Chạy: node scripts/gen-brand-assets.js [--preview <đường-dẫn.png>]
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const BRAND = path.join(ASSETS, 'brand');
const GEOMETRY_TS = path.join(ROOT, 'src/components/brand/logoGeometry.ts');

const CANVAS = 1024;
/** Bán kính bo góc ô logo (~22,5% — gần mặt nạ icon iOS) */
const TILE_RADIUS = 230;
const COLORS = {
  from: '#2A1E9E', // chàm đậm (góc trên trái)
  to: '#7C3AED', // tím (góc dưới phải)
  glow: '#38BDF8', // ánh ngọc ở góc dưới trái (gợi nước chảy)
  glowOpacity: 0.26,
  highlightOpacity: 0.16,
  mark: '#FFFFFF',
  amber: '#FFC857', // chấm lương
  droplets: [0.92, 0.66, 0.4],
};

// ── Hình học mark, tính theo "đơn vị mark" (hộp 100×100, tâm 50,50 sau khi dịch cho cân) ─────────────
const STROKE = 12;
/** Đầu dòng chảy (chấm vàng) */
const HEAD = { cx: 62, cy: 20, r: 8.5 };
/** Thân J: từ dưới chấm vàng, thẳng xuống, cung 1/4 vòng tròn bán kính 20, rồi đuôi ngang sang trái */
const J = { x: 62, y0: 30, y1: 54, arcR: 20, tailTo: 33 };
J.length = J.y1 - J.y0 + (Math.PI / 2) * J.arcR + (J.x - J.arcR - J.tailTo);
/** Ba giọt nhỏ dần nối tiếp đuôi J (tiền tan ra các khoản chi) */
const DROPS = [
  { cx: 21.5, cy: 74, r: 3.6 },
  { cx: 14, cy: 74, r: 2.6 },
  { cx: 8, cy: 74, r: 1.8 },
];
// Hộp bao x: 6,2 → 70,5; y: 11,5 → 79,5  ⇒ tâm (38,35; 45,5) → dịch về (50; 50)
const SHIFT = { x: 11.65, y: 4.25 };
/** Khe hở giữa chấm vàng và thân J ở bản đơn sắc */
const MONO_GAP = 2.5;

const round = (n) => Math.round(n * 100) / 100;

/** Đổi hình học sang toạ độ pixel: mark-đơn-vị (ux,uy) → (ox + (ux+dx-50)·k, oy + (uy+dy-50)·k) */
function layout({ k, ox = CANVAS / 2, oy = CANVAS / 2 }) {
  const X = (u) => round(ox + (u + SHIFT.x - 50) * k);
  const Y = (u) => round(oy + (u + SHIFT.y - 50) * k);
  const r = round(J.arcR * k);
  const d = `M${X(J.x)} ${Y(J.y0)} V${Y(J.y1)} A${r} ${r} 0 0 1 ${X(J.x - J.arcR)} ${Y(J.y1 + J.arcR)} H${X(J.tailTo)}`;
  return {
    j: { d, width: round(STROKE * k), length: round(J.length * k) },
    head: { cx: X(HEAD.cx), cy: Y(HEAD.cy), r: round(HEAD.r * k) },
    drops: DROPS.map((p) => ({ cx: X(p.cx), cy: Y(p.cy), r: round(p.r * k) })),
    gapR: round((HEAD.r + MONO_GAP) * k),
  };
}

// ── Nền ô: gradient chéo + quầng sáng góc trên trái + ánh ngọc góc dưới trái. (x0, size) = vùng nhìn thấy ──
function tileDefs(id, x0 = 0, size = CANVAS) {
  const at = (t) => round(x0 + (t / CANVAS) * size);
  const len = (t) => round((t / CANVAS) * size);
  return `
    <linearGradient id="${id}-bg" x1="${at(0)}" y1="${at(0)}" x2="${at(CANVAS)}" y2="${at(CANVAS)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${COLORS.from}"/>
      <stop offset="1" stop-color="${COLORS.to}"/>
    </linearGradient>
    <radialGradient id="${id}-hl" cx="${at(250)}" cy="${at(140)}" r="${len(720)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="${COLORS.highlightOpacity}"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-gl" cx="${at(160)}" cy="${at(940)}" r="${len(640)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${COLORS.glow}" stop-opacity="${COLORS.glowOpacity}"/>
      <stop offset="1" stop-color="${COLORS.glow}" stop-opacity="0"/>
    </radialGradient>`;
}
const tileFill = (id, attrs) =>
  `<rect ${attrs} fill="url(#${id}-bg)"/><rect ${attrs} fill="url(#${id}-hl)"/><rect ${attrs} fill="url(#${id}-gl)"/>`;

const dropEls = (g, color, opacities = COLORS.droplets) =>
  g.drops
    .map((p, i) => `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${color}" fill-opacity="${opacities[i]}"/>`)
    .join('\n  ');

/** Mark nhiều màu: thân J trắng + chấm vàng ở đầu + ba giọt mờ dần */
function markColor(g, { color = COLORS.mark, amber = COLORS.amber, withJ = true } = {}) {
  const stroke = withJ
    ? `<path d="${g.j.d}" fill="none" stroke="${color}" stroke-width="${g.j.width}" stroke-linecap="round" stroke-linejoin="round"/>
  ${dropEls(g, color)}`
    : '';
  return `
  ${stroke}
  <circle cx="${g.head.cx}" cy="${g.head.cy}" r="${g.head.r}" fill="${amber}"/>`;
}

/** Mark đơn sắc (icon theo chủ đề / thông báo): một màu, thân J bị cắt khe hở quanh chấm đầu */
function markMono(id, g, color = '#FFFFFF', size = CANVAS, { drops = true } = {}) {
  return `
  <defs>
    <mask id="${id}-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="#FFFFFF"/>
      <circle cx="${g.head.cx}" cy="${g.head.cy}" r="${g.gapR}" fill="#000000"/>
    </mask>
  </defs>
  <path d="${g.j.d}" fill="none" stroke="${color}" stroke-width="${g.j.width}" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id}-gap)"/>
  <circle cx="${g.head.cx}" cy="${g.head.cy}" r="${g.head.r}" fill="${color}"/>
  ${drops ? dropEls(g, color, [1, 1, 1]) : ''}`;
}

const svgDoc = (body, size = CANVAS) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}\n</svg>\n`;

// ── Các bố cục ───────────────────────────────────────────────────────────────────────────────
/** Tỉ lệ mark trong ô logo 1024 (iOS icon, splash, favicon) */
const K_TILE = 9;
/** Adaptive icon: vùng an toàn ~61% canvas → mark nhỏ hơn để không bị launcher cắt */
const K_ADAPTIVE = 6.4;

const tileLayout = layout({ k: K_TILE });
const adaptiveLayout = layout({ k: K_ADAPTIVE });

const svgs = {
  /** Logo đầy đủ: ô bo góc */
  logo: svgDoc(`
  <defs>${tileDefs('logo')}</defs>
  ${tileFill('logo', `width="${CANVAS}" height="${CANVAS}" rx="${TILE_RADIUS}"`)}
  ${markColor(tileLayout)}`),
  /** Khung hình ĐẦU của hiệu ứng mở app: ô + chấm vàng (chữ J được vẽ tiếp bằng hoạt hình) */
  splash: svgDoc(`
  <defs>${tileDefs('splash')}</defs>
  ${tileFill('splash', `width="${CANVAS}" height="${CANVAS}" rx="${TILE_RADIUS}"`)}
  ${markColor(tileLayout, { withJ: false })}`),
  /** iOS: vuông kín, không bo góc (hệ điều hành tự cắt) */
  icon: svgDoc(`
  <defs>${tileDefs('icon')}</defs>
  ${tileFill('icon', `width="${CANVAS}" height="${CANVAS}"`)}
  ${markColor(tileLayout)}`),
  /** Mark tô màu thương hiệu trên nền trong suốt (dùng trên nền sáng) */
  mark: svgDoc(`
  <defs>${tileDefs('mark')}</defs>
  ${markColor(tileLayout, { color: COLORS.from })}`),
  markMono: svgDoc(markMono('mono', tileLayout)),
  adaptiveBackground: svgDoc(`
  <defs>${tileDefs('abg', CANVAS / 6, (CANVAS * 2) / 3)}</defs>
  ${tileFill('abg', `width="${CANVAS}" height="${CANVAS}"`)}`),
  adaptiveForeground: svgDoc(markColor(adaptiveLayout)),
  adaptiveMonochrome: svgDoc(markMono('amono', adaptiveLayout)),
};

/** Icon thông báo 96²: chỉ J + chấm (ba giọt nhỏ sẽ nhoè ở cỡ thanh trạng thái), phóng to cho dễ đọc */
function notificationSvg(size = 96) {
  const k = (size * (21 / 24)) / 68;
  const g = layout({ k, ox: size / 2, oy: size / 2 });
  return svgDoc(markMono('notif', g, '#FFFFFF', size, { drops: false }), size);
}

async function render(svg, file, { size = CANVAS, opaque = false } = {}) {
  let img = sharp(Buffer.from(svg), { density: 72 * (size > CANVAS ? size / CANVAS : 1) });
  if (size !== CANVAS) img = img.resize(size, size, { kernel: 'lanczos3' });
  if (opaque) img = img.flatten({ background: COLORS.from }).removeAlpha();
  await img.png({ compressionLevel: 9 }).toFile(path.join(ASSETS, file));
  console.log('  ✓', `assets/${file}`);
}

function writeGeometryTs() {
  const g = tileLayout;
  const source = `// FILE SINH TỰ ĐỘNG bởi scripts/gen-brand-assets.js — đừng sửa tay, sửa script rồi chạy lại.
// Hình học logo "Dòng lương" trong hệ toạ độ ${CANVAS}×${CANVAS}, khớp từng điểm với assets/splash-icon.png.

export const LOGO_CANVAS = ${CANVAS};

export const LOGO = {
  radius: ${TILE_RADIUS},
  gradient: { from: '${COLORS.from}', to: '${COLORS.to}' },
  highlight: { cx: 250, cy: 140, r: 720, opacity: ${COLORS.highlightOpacity} },
  glow: { cx: 160, cy: 940, r: 640, color: '${COLORS.glow}', opacity: ${COLORS.glowOpacity} },
  amber: '${COLORS.amber}',
  head: { cx: ${g.head.cx}, cy: ${g.head.cy}, r: ${g.head.r} },
  j: { d: '${g.j.d}', width: ${g.j.width}, length: ${g.j.length} },
  drops: [
${g.drops.map((p, i) => `    { cx: ${p.cx}, cy: ${p.cy}, r: ${p.r}, opacity: ${COLORS.droplets[i]} },`).join('\n')}
  ],
} as const;
`;
  fs.mkdirSync(path.dirname(GEOMETRY_TS), { recursive: true });
  fs.writeFileSync(GEOMETRY_TS, source);
  console.log('  ✓', path.relative(ROOT, GEOMETRY_TS).replace(/\\/g, '/'));
}

// ── Ảnh xem trước (không thuộc app): icon, adaptive (tròn / squircle), themed, splash sáng/tối ──
async function writePreview(file) {
  const png = (svg, size) =>
    sharp(Buffer.from(svg)).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
  const maskSvg = (shape, size) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${shape}</svg>`);
  async function adaptive(size, mask, fgSvg = svgs.adaptiveForeground, bgSvg = svgs.adaptiveBackground) {
    const full = Math.round((size * 108) / 72);
    const inset = Math.round((full - size) / 2);
    const stacked = await sharp(await png(bgSvg, full))
      .composite([{ input: await png(fgSvg, full) }])
      .png()
      .toBuffer();
    const layered = await sharp(stacked)
      .extract({ left: inset, top: inset, width: size, height: size })
      .png()
      .toBuffer();
    return sharp(layered)
      .composite([{ input: maskSvg(mask, size), blend: 'dest-in' }])
      .png()
      .toBuffer();
  }
  const S = 200;
  const circle = `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}"/>`;
  const squircle = `<rect width="${S}" height="${S}" rx="${S * 0.3}"/>`;
  const themedFg = svgs.adaptiveMonochrome.replace(/#FFFFFF/g, '#1D2B6B');
  const themedBg = svgDoc(`<rect width="${CANVAS}" height="${CANVAS}" fill="#D9DDF7"/>`);
  const splash = async (bg) =>
    sharp({ create: { width: 180, height: 360, channels: 4, background: bg } })
      .composite([{ input: await png(svgs.splash, 64), left: 58, top: 148 }])
      .png()
      .toBuffer();
  const W = 1560;
  const H = 560;
  const comps = [
    { input: await png(svgs.icon, 220), left: 20, top: 20 },
    { input: await adaptive(S, circle), left: 260, top: 20 },
    { input: await adaptive(S, squircle), left: 480, top: 20 },
    { input: await adaptive(S, circle, themedFg, themedBg), left: 700, top: 20 },
    { input: await png(svgs.mark, 200), left: 920, top: 20 },
    { input: await splash('#F4F6FA'), left: 1150, top: 20 },
    { input: await splash('#060A12'), left: 1350, top: 20 },
    { input: await png(svgs.logo, 48), left: 20, top: 270 },
    { input: await png(svgs.icon, 29), left: 80, top: 280 },
    { input: await adaptive(48, `<circle cx="24" cy="24" r="24"/>`), left: 120, top: 270 },
    { input: await png(svgs.markMono, 200), left: 260, top: 300 },
    { input: await png(notificationSvg(96), 24), left: 480, top: 300 },
    { input: await png(notificationSvg(96), 48), left: 520, top: 300 },
    { input: await png(notificationSvg(96), 96), left: 590, top: 300 },
    { input: await png(svgs.logo, 220), left: 760, top: 300 },
  ];
  await sharp({ create: { width: W, height: H, channels: 4, background: '#FFFFFF' } })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="250" y="290" width="460" height="220" rx="16" fill="#202124"/></svg>`,
        ),
        left: 0,
        top: 0,
      },
      ...comps,
    ])
    .png()
    .toFile(file);
  console.log('  ✓ preview →', file);
}

async function main() {
  fs.mkdirSync(BRAND, { recursive: true });
  fs.writeFileSync(path.join(BRAND, 'logo.svg'), svgs.logo);
  fs.writeFileSync(path.join(BRAND, 'mark.svg'), svgs.mark);
  fs.writeFileSync(path.join(BRAND, 'mark-monochrome.svg'), svgs.markMono);
  console.log('  ✓ assets/brand/{logo,mark,mark-monochrome}.svg');

  await render(svgs.icon, 'icon.png', { opaque: true });
  await render(svgs.adaptiveForeground, 'android-icon-foreground.png');
  await render(svgs.adaptiveBackground, 'android-icon-background.png', { opaque: true });
  await render(svgs.adaptiveMonochrome, 'android-icon-monochrome.png');
  await render(svgs.splash, 'splash-icon.png');
  await render(svgs.logo, 'favicon.png', { size: 48 });
  await sharp(Buffer.from(notificationSvg(96)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(ASSETS, 'android-icon-notification.png'));
  console.log('  ✓ assets/android-icon-notification.png');
  writeGeometryTs();

  const previewArg = process.argv.indexOf('--preview');
  if (previewArg > 0 && process.argv[previewArg + 1]) {
    await writePreview(path.resolve(process.argv[previewArg + 1]));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
