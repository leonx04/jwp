// Nhận diện mã hoá file văn bản + giải mã thành chuỗi.
// Cần vì backup Ivy Wallet là UTF-16 Big-Endian; file từ app khác thường là UTF-8.
// Tự viết thay vì TextDecoder vì Hermes (engine JS của React Native) chỉ hỗ trợ UTF-8.

export type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be';

export type DetectedEncoding = {
  encoding: TextEncoding;
  /** Số byte BOM ở đầu file (0 nếu không có) */
  bomLength: number;
};

export function detectEncoding(bytes: Uint8Array): DetectedEncoding {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: 'utf-8', bomLength: 3 };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: 'utf-16be', bomLength: 2 };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: 'utf-16le', bomLength: 2 };

  // Không có BOM: văn bản ASCII (như JSON bắt đầu bằng '{') mã hoá UTF-16 sẽ có byte 0 xen kẽ
  if (bytes.length >= 2) {
    if (bytes[0] === 0 && bytes[1] !== 0) return { encoding: 'utf-16be', bomLength: 0 };
    if (bytes[0] !== 0 && bytes[1] === 0) return { encoding: 'utf-16le', bomLength: 0 };
  }
  return { encoding: 'utf-8', bomLength: 0 };
}

const CHUNK = 8192; // String.fromCharCode(...mảng quá lớn) sẽ tràn stack → ghép theo từng khúc

function fromCodeUnits(units: Uint16Array | number[]): string {
  let out = '';
  for (let i = 0; i < units.length; i += CHUNK) {
    out += String.fromCharCode(...Array.from(units.slice(i, i + CHUNK)));
  }
  return out;
}

function decodeUtf16(bytes: Uint8Array, start: number, bigEndian: boolean): string {
  const length = Math.floor((bytes.length - start) / 2);
  const units = new Uint16Array(length);
  for (let i = 0; i < length; i++) {
    const a = bytes[start + i * 2];
    const b = bytes[start + i * 2 + 1];
    units[i] = bigEndian ? (a << 8) | b : (b << 8) | a;
  }
  return fromCodeUnits(units);
}

const REPLACEMENT = 0xfffd;

function decodeUtf8(bytes: Uint8Array, start: number): string {
  const units: number[] = [];
  let i = start;
  while (i < bytes.length) {
    const b0 = bytes[i];
    let codePoint: number;
    let size: number;
    if (b0 < 0x80) {
      codePoint = b0;
      size = 1;
    } else if (b0 >= 0xc2 && b0 < 0xe0) {
      codePoint = b0 & 0x1f;
      size = 2;
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      codePoint = b0 & 0x0f;
      size = 3;
    } else if (b0 >= 0xf0 && b0 < 0xf5) {
      codePoint = b0 & 0x07;
      size = 4;
    } else {
      units.push(REPLACEMENT);
      i += 1;
      continue;
    }

    let valid = i + size <= bytes.length;
    for (let k = 1; valid && k < size; k++) {
      const next = bytes[i + k];
      if ((next & 0xc0) !== 0x80) valid = false;
      else codePoint = (codePoint << 6) | (next & 0x3f);
    }
    if (!valid) {
      units.push(REPLACEMENT);
      i += 1;
      continue;
    }

    if (codePoint > 0xffff) {
      // Ký tự ngoài BMP (emoji) → cặp surrogate
      const offset = codePoint - 0x10000;
      units.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    } else {
      units.push(codePoint);
    }
    i += size;
  }
  return fromCodeUnits(units);
}

/** Giải mã bytes thành chuỗi, tự nhận diện mã hoá và bỏ BOM. */
export function decodeText(bytes: Uint8Array): { text: string; encoding: TextEncoding } {
  const { encoding, bomLength } = detectEncoding(bytes);
  const text =
    encoding === 'utf-8'
      ? decodeUtf8(bytes, bomLength)
      : decodeUtf16(bytes, bomLength, encoding === 'utf-16be');
  return { text, encoding };
}
