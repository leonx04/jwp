// Sinh icon vuông cho ngân hàng từ logo gốc (assets/banks/source/*.png, 831×311 dạng chữ dài):
// cắt lấy phần BIỂU TƯỢNG (nếu có) rồi canh giữa vào ô vuông nền trong suốt → assets/banks/icons/*.webp.
// Vẽ trung gian 192px rồi thu về 96px (lanczos) cho nét mịn; xuất WebP giữ kênh alpha (nhẹ hơn PNG nhiều).
// Đồng thời sinh src/lib/banks/logos.ts (require tĩnh để Metro đóng gói ảnh).
// Ảnh gốc assets/banks/source KHÔNG được đóng gói vào app (không file nào require tới).
// Chạy: node scripts/gen-bank-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets/banks/source');
const OUT = path.join(ROOT, 'assets/banks/icons');
/** Kích thước icon xuất ra — đủ nét cho ô logo ~40dp trên màn 3x */
const OUT_SIZE = 96;
/** Vẽ trung gian gấp đôi rồi mới thu nhỏ → khử răng cưa tốt hơn */
const SIZE = OUT_SIZE * 2;
const PAD = 15;

// Khung biểu tượng [x0, x1] hoặc [x0, x1, y0, y1] theo toạ độ ảnh gốc. Không có → dùng cả logo.
// Chỉ lấy các vùng liên thông nằm TRỌN trong khung → không dính nét chữ bên cạnh.
const CROPS = {
  ABB: [615, 768, 1, 131],
  BAB: [600, 720, 55, 165],
  BIDV: [543, 672, 61, 193],
  BVB: [439, 540, 82, 183],
  CAKE: [341, 584],
  EIB: [636, 730, 91, 185],
  HDB: [130, 700, 50, 205],
  HSBC: [132, 437],
  ICB: [596, 716, 80, 200],
  KLB: [52, 135],
  LPB: [804, 1005, 15, 181],
  MB: [176, 368],
  MSB: [132, 365],
  NAB: [101, 333],
  NCB: [178, 331, 63, 191],
  OCB: [153, 306],
  PVCB: [506, 638, 49, 191],
  SCVN: [538, 658, 63, 247],
  SEAB: [152, 261, 63, 172],
  SHBVN: [351, 466, 42, 157],
  SHB: [180, 310, 70, 190],
  STB: [80, 180, 100, 210],
  TCB: [609, 743, 111, 200],
  TPB: [132, 274],
  UOB: [86, 184],
  VBA: [76, 160],
  VCB: [520, 656, 53, 185],
  VCCB: [669, 744, 73, 147],
  VIETBANK: [362, 468, 63, 184],
  VIETTELMONEY: [122, 328],
  VNPTMONEY: [105, 382],
  VPB: [147, 284, 77, 191],
  WVN: [349, 481, 45, 177],
};

function isInk(p, x, y) {
  const i = (y * p.width + x) * 4;
  const d = p.data;
  if (d[i + 3] < 40) return false;
  return !(d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235);
}

// Gán nhãn vùng liên thông (8 hướng) cho các điểm có mực
function components(p) {
  const { width: w, height: h } = p;
  const label = new Int32Array(w * h).fill(-1);
  const boxes = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] >= 0 || !isInk(p, s % w, (s / w) | 0)) continue;
    const id = boxes.length;
    const box = { minX: w, maxX: 0, minY: h, maxY: 0 };
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const q = stack.pop();
      const x = q % w;
      const y = (q / w) | 0;
      box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (label[k] < 0 && isInk(p, nx, ny)) { label[k] = id; stack.push(k); }
        }
    }
    boxes.push(box);
  }
  return { label, boxes };
}

// Mặt nạ các điểm thuộc vùng liên thông nằm trọn trong khung + khung bao của chúng
function select(p, crop) {
  const { width: w, height: h } = p;
  const [x0, x1, y0 = 0, y1 = h - 1] = crop ?? [0, w - 1];
  const { label, boxes } = components(p);
  const keep = boxes.map((b) => b.minX >= x0 && b.maxX <= x1 && b.minY >= y0 && b.maxY <= y1);
  const mask = new Uint8Array(w * h);
  const box = { minX: Infinity, maxX: -1, minY: Infinity, maxY: -1 };
  for (let i = 0; i < w * h; i++) {
    if (label[i] < 0 || !keep[label[i]]) continue;
    mask[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
  }
  return { mask, box };
}

// Thu nhỏ vùng box vào ô SIZE×SIZE (lấy mẫu trung bình có alpha, nền trắng → trong suốt)
function render(p, { mask, box }) {
  const out = { width: SIZE, height: SIZE, data: Buffer.alloc(SIZE * SIZE * 4) };
  const bw = box.maxX - box.minX + 1;
  const bh = box.maxY - box.minY + 1;
  const scale = (SIZE - PAD * 2) / Math.max(bw, bh);
  const tw = Math.round(bw * scale);
  const th = Math.round(bh * scale);
  const ox = Math.round((SIZE - tw) / 2);
  const oy = Math.round((SIZE - th) / 2);
  const step = 1 / scale;
  for (let ty = 0; ty < th; ty++)
    for (let tx = 0; tx < tw; tx++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const sx0 = box.minX + tx * step;
      const sy0 = box.minY + ty * step;
      for (let yy = 0; yy < Math.max(1, step); yy++)
        for (let xx = 0; xx < Math.max(1, step); xx++) {
          const sx = Math.min(p.width - 1, Math.floor(sx0 + xx));
          const sy = Math.min(p.height - 1, Math.floor(sy0 + yy));
          const i = (sy * p.width + sx) * 4;
          // Điểm gần trắng trên nền logo coi như trong suốt
          const alpha = mask[sy * p.width + sx] ? p.data[i + 3] / 255 : 0;
          r += p.data[i] * alpha; g += p.data[i + 1] * alpha; b += p.data[i + 2] * alpha;
          a += alpha; n++;
        }
      const j = ((oy + ty) * SIZE + ox + tx) * 4;
      if (a > 0) {
        out.data[j] = r / a; out.data[j + 1] = g / a; out.data[j + 2] = b / a;
        out.data[j + 3] = Math.round((a / n) * 255);
      }
    }
  return out;
}

// Đọc PNG gốc thành mảng RGBA (cùng dạng { width, height, data } mà các hàm trên dùng)
async function readRgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

// RGBA SIZE×SIZE → WebP OUT_SIZE×OUT_SIZE, giữ alpha, chất lượng cao
function toWebp(img) {
  return sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
    .resize(OUT_SIZE, OUT_SIZE, { kernel: 'lanczos3' })
    .webp({ quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toBuffer();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // Xoá icon cũ (PNG đời trước / WebP lần trước) → không sót file thừa bị đóng gói
  for (const old of fs.readdirSync(OUT).filter((f) => /\.(png|webp)$/.test(f))) {
    fs.unlinkSync(path.join(OUT, old));
  }

  const codes = [];
  let total = 0;
  for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.png')).sort()) {
    const code = file.replace(/\.png$/, '');
    const png = await readRgba(path.join(SRC, file));
    const webp = await toWebp(render(png, select(png, CROPS[code])));
    fs.writeFileSync(path.join(OUT, `${code}.webp`), webp);
    total += webp.length;
    codes.push(code);
  }

  const lines = codes.map((c) => `  ${c}: require('../../../assets/banks/icons/${c}.webp'),`);
  fs.writeFileSync(
    path.join(ROOT, 'src/lib/banks/logos.ts'),
    `// Tự sinh bởi scripts/gen-bank-icons.js — không sửa tay.\n` +
      `// Icon vuông (biểu tượng ngân hàng, WebP ${OUT_SIZE}px) — require tĩnh để Metro đóng gói ảnh vào app.\n` +
      `export const BANK_LOGOS: Record<string, number> = {\n${lines.join('\n')}\n};\n`,
  );
  console.log(`Đã sinh ${codes.length} icon WebP (${(total / 1024).toFixed(1)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
