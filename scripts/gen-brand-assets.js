// Sinh toàn bộ tài nguyên thương hiệu JWP từ MỘT nguồn hình học duy nhất (file này):
//   assets/brand/logo.svg · mark.svg · mark-monochrome.svg      (nguồn vector)
//   assets/icon.png (1024², iOS — vuông kín, không trong suốt)
//   assets/android-icon-{foreground,background,monochrome}.png  (adaptive icon 1024² = 108dp)
//   assets/android-icon-notification.png (96², trắng trên nền trong suốt — icon thông báo)
//   assets/splash-icon.png (ô bo góc, trong suốt bên ngoài) · assets/favicon.png (48²)
//   src/components/brand/logoGeometry.ts (toạ độ cho BrandLogo vẽ bằng react-native-svg → khớp splash)
// Ý tưởng logo: hai đồng xu xếp chồng (tiết kiệm, tích luỹ) — đồng xu trước khắc chữ "J" khoét rỗng,
// trên ô vuông bo góc chuyển màu chàm → tím (bình tĩnh, đáng tin).
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
  from: '#5B5BF6', // chàm sáng (góc trên trái)
  to: '#7C3AED', // tím (góc dưới phải)
  mark: '#FFFFFF',
  highlightOpacity: 0.18,
  backCoinOpacity: 0.3,
};

// ── Hình học mark, tính theo "đơn vị mark" (hộp 100×100, tâm 50,50) ────────────────────────────
const FRONT = { cx: 45, cy: 45, r: 38 };
const BACK = { cx: 57, cy: 56, r: 38 };
/** Khe hở giữa hai đồng xu ở bản đơn sắc (để tách hình lưỡi liềm của đồng xu sau) */
const MONO_GAP = 4;
const J_WIDTH = 11;
/** Chữ J canh giữa đồng xu trước: gạch ngang trên → thân dọc → móc nửa vòng tròn */
function jPathUnits() {
  const { cx, cy } = FRONT;
  return [
    ['M', cx - 3, cy - 16],
    ['H', cx + 11],
    ['V', cy + 6],
    ['A', 11, cx - 11, cy + 6],
  ];
}

const round = (n) => Math.round(n * 100) / 100;

/** Đổi hình học sang toạ độ pixel: mark-đơn-vị (ux,uy) → (ox + (ux-50)·k, oy + (uy-50)·k) */
function layout({ k, ox = CANVAS / 2, oy = CANVAS / 2 }) {
  const X = (u) => round(ox + (u - 50) * k);
  const Y = (u) => round(oy + (u - 50) * k);
  const d = jPathUnits()
    .map(([cmd, ...a]) => {
      if (cmd === 'M') return `M${X(a[0])} ${Y(a[1])}`;
      if (cmd === 'H') return `H${X(a[0])}`;
      if (cmd === 'V') return `V${Y(a[0])}`;
      const r = round(a[0] * k);
      return `A${r} ${r} 0 0 1 ${X(a[1])} ${Y(a[2])}`;
    })
    .join(' ');
  return {
    front: { cx: X(FRONT.cx), cy: Y(FRONT.cy), r: round(FRONT.r * k) },
    back: { cx: X(BACK.cx), cy: Y(BACK.cy), r: round(BACK.r * k) },
    gapR: round((FRONT.r + MONO_GAP) * k),
    j: { d, width: round(J_WIDTH * k) },
  };
}

// ── Nền ô: gradient chéo + quầng sáng góc trên trái. (x0, size) = vùng "nhìn thấy" của ô ────────
function tileDefs(id, x0 = 0, size = CANVAS) {
  const at = (t) => round(x0 + (t / CANVAS) * size);
  return `
    <linearGradient id="${id}-bg" x1="${at(0)}" y1="${at(0)}" x2="${at(CANVAS)}" y2="${at(CANVAS)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${COLORS.from}"/>
      <stop offset="1" stop-color="${COLORS.to}"/>
    </linearGradient>
    <radialGradient id="${id}-hl" cx="${at(280)}" cy="${at(160)}" r="${round((760 / CANVAS) * size)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="${COLORS.highlightOpacity}"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>`;
}
const tileFill = (id, attrs) =>
  `<rect ${attrs} fill="url(#${id}-bg)"/><rect ${attrs} fill="url(#${id}-hl)"/>`;

/**
 * Mark nhiều màu: đồng xu sau mờ + đồng xu trước có chữ J khoét rỗng (mask → trong suốt thật,
 * để lớp foreground của adaptive icon không lệch với lớp nền khi launcher tạo hiệu ứng thị sai).
 * Đồng xu sau bị cắt phần nằm dưới đồng xu trước → chữ J lộ đúng màu nền, tương phản rõ.
 */
function markColor(id, g, { color = COLORS.mark, backOpacity = COLORS.backCoinOpacity } = {}) {
  return `
  <defs>
    <mask id="${id}-j" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS}" height="${CANVAS}">
      <rect width="${CANVAS}" height="${CANVAS}" fill="#FFFFFF"/>
      <path d="${g.j.d}" fill="none" stroke="#000000" stroke-width="${g.j.width}" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
    <mask id="${id}-under" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS}" height="${CANVAS}">
      <rect width="${CANVAS}" height="${CANVAS}" fill="#FFFFFF"/>
      <circle cx="${g.front.cx}" cy="${g.front.cy}" r="${g.front.r - 2}" fill="#000000"/>
    </mask>
  </defs>
  <circle cx="${g.back.cx}" cy="${g.back.cy}" r="${g.back.r}" fill="${color}" fill-opacity="${backOpacity}" mask="url(#${id}-under)"/>
  <circle cx="${g.front.cx}" cy="${g.front.cy}" r="${g.front.r}" fill="${color}" mask="url(#${id}-j)"/>`;
}

/** Mark đơn sắc: một màu đặc, đồng xu sau thành hình lưỡi liềm tách bằng khe hở */
function markMono(id, g, color = '#FFFFFF', size = CANVAS) {
  return `
  <defs>
    <mask id="${id}-j" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="#FFFFFF"/>
      <path d="${g.j.d}" fill="none" stroke="#000000" stroke-width="${g.j.width}" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
    <mask id="${id}-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="#FFFFFF"/>
      <circle cx="${g.front.cx}" cy="${g.front.cy}" r="${g.gapR}" fill="#000000"/>
    </mask>
  </defs>
  <circle cx="${g.back.cx}" cy="${g.back.cy}" r="${g.back.r}" fill="${color}" mask="url(#${id}-gap)"/>
  <circle cx="${g.front.cx}" cy="${g.front.cy}" r="${g.front.r}" fill="${color}" mask="url(#${id}-j)"/>`;
}

const svgDoc = (body, size = CANVAS) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}\n</svg>\n`;

// ── Các bố cục ───────────────────────────────────────────────────────────────────────────────
/** Tỉ lệ mark trong ô logo 1024 (iOS icon, splash, favicon) */
const K_TILE = 6;
/** Adaptive icon: vùng nhìn thấy 72dp/108dp = 2/3 canvas → cùng tỉ lệ thị giác như iOS (hơi to hơn chút) */
const K_ADAPTIVE = 4.1;

const tileLayout = layout({ k: K_TILE });
const adaptiveLayout = layout({ k: K_ADAPTIVE });

const svgs = {
  /** Logo đầy đủ: ô bo góc (dùng cho splash, favicon, tài liệu) */
  logo: svgDoc(`
  <defs>${tileDefs('logo')}</defs>
  ${tileFill('logo', `width="${CANVAS}" height="${CANVAS}" rx="${TILE_RADIUS}"`)}
  ${markColor('logo', tileLayout)}`),
  /** iOS: vuông kín, không bo góc (hệ điều hành tự cắt) */
  icon: svgDoc(`
  <defs>${tileDefs('icon')}</defs>
  ${tileFill('icon', `width="${CANVAS}" height="${CANVAS}"`)}
  ${markColor('icon', tileLayout)}`),
  /** Mark tô màu thương hiệu trên nền trong suốt (dùng trên nền sáng / trung tính) */
  mark: svgDoc(`
  <defs>${tileDefs('mark')}</defs>
  ${markColor('mark', tileLayout, { color: 'url(#mark-bg)', backOpacity: 0.35 })}`),
  markMono: svgDoc(markMono('mono', tileLayout)),
  adaptiveBackground: svgDoc(`
  <defs>${tileDefs('abg', CANVAS / 6, (CANVAS * 2) / 3)}</defs>
  ${tileFill('abg', `width="${CANVAS}" height="${CANVAS}"`)}`),
  adaptiveForeground: svgDoc(markColor('afg', adaptiveLayout)),
  adaptiveMonochrome: svgDoc(markMono('amono', adaptiveLayout)),
};

/**
 * Icon thông báo 96² (24dp × 4): chỉ đồng xu trước + chữ J — ở cỡ thanh trạng thái, hình lưỡi liềm
 * của đồng xu sau bị nhoè. Đồng xu lấp vùng hiển thị 22/24dp, nét J dày hơn chút cho dễ đọc.
 */
function notificationSvg(size = 96) {
  const k = (size * (22 / 24)) / (2 * FRONT.r);
  const g = layout({ k, ox: size / 2 + (50 - FRONT.cx) * k, oy: size / 2 + (50 - FRONT.cy) * k });
  const jWidth = round(J_WIDTH * 1.15 * k);
  return svgDoc(
    `
  <defs>
    <mask id="notif-j" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="#FFFFFF"/>
      <path d="${g.j.d}" fill="none" stroke="#000000" stroke-width="${jWidth}" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>
  <circle cx="${g.front.cx}" cy="${g.front.cy}" r="${g.front.r}" fill="#FFFFFF" mask="url(#notif-j)"/>`,
    size,
  );
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
// Hình học logo trong hệ toạ độ ${CANVAS}×${CANVAS}, khớp từng điểm với assets/splash-icon.png.

export const LOGO_CANVAS = ${CANVAS};

export const LOGO = {
  radius: ${TILE_RADIUS},
  gradient: { from: '${COLORS.from}', to: '${COLORS.to}' },
  highlight: { cx: 280, cy: 160, r: 760, opacity: ${COLORS.highlightOpacity} },
  backCoin: { cx: ${g.back.cx}, cy: ${g.back.cy}, r: ${g.back.r}, opacity: ${COLORS.backCoinOpacity} },
  frontCoin: { cx: ${g.front.cx}, cy: ${g.front.cy}, r: ${g.front.r} },
  j: { d: '${g.j.d}', width: ${g.j.width} },
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
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${shape}</svg>`,
    );
  /** Ghép adaptive: nền + foreground (108dp) → cắt vùng 72dp ở giữa → áp mặt nạ */
  async function adaptive(size, mask, fgSvg = svgs.adaptiveForeground, bgSvg = svgs.adaptiveBackground) {
    const full = Math.round((size * 108) / 72);
    const inset = Math.round((full - size) / 2);
    // sharp chạy extract TRƯỚC composite trong cùng pipeline → tách làm hai bước
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
  const themedFg = svgs.adaptiveMonochrome.replace(/#FFFFFF/g, '#1D4B2E');
  const themedBg = svgDoc(`<rect width="${CANVAS}" height="${CANVAS}" fill="#CDEBD3"/>`);

  // Màn splash giả lập tỉ lệ 1/2 (máy 360×720dp, ô logo 128dp ở giữa)
  const splash = async (bg) =>
    sharp({ create: { width: 180, height: 360, channels: 4, background: bg } })
      .composite([{ input: await png(svgs.logo, 64), left: 58, top: 148 }])
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
  ];
  await sharp({ create: { width: W, height: H, channels: 4, background: '#FFFFFF' } })
    .composite([
      // nền tối cho bản đơn sắc + icon thông báo
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
  await render(svgs.logo, 'splash-icon.png');
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
