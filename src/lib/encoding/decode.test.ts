import { decodeText, detectEncoding } from './decode';

// Mẫu có tiếng Việt, ký tự ₫ và emoji (ngoài BMP) để kiểm tra đủ trường hợp
const SAMPLE = '{"name":"Quỹ du lịch Momo","amount":1500000,"note":"Cà phê ₫ 💸"}';

const utf8 = (text: string, bom = false) =>
  new Uint8Array([...(bom ? [0xef, 0xbb, 0xbf] : []), ...new TextEncoder().encode(text)]);

/** Mã hoá UTF-16: mỗi code unit của chuỗi JS thành 2 byte */
function utf16(text: string, bigEndian: boolean, bom: boolean): Uint8Array {
  const bytes: number[] = bom ? (bigEndian ? [0xfe, 0xff] : [0xff, 0xfe]) : [];
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    const hi = unit >> 8;
    const lo = unit & 0xff;
    bytes.push(...(bigEndian ? [hi, lo] : [lo, hi]));
  }
  return new Uint8Array(bytes);
}

const utf16le = (text: string, bom = true) => utf16(text, false, bom);
const utf16be = (text: string, bom = true) => utf16(text, true, bom);

describe('detectEncoding', () => {
  it.each([
    ['UTF-8 không BOM', utf8(SAMPLE), 'utf-8', 0],
    ['UTF-8 có BOM', utf8(SAMPLE, true), 'utf-8', 3],
    ['UTF-16LE có BOM', utf16le(SAMPLE), 'utf-16le', 2],
    ['UTF-16BE có BOM (backup Ivy)', utf16be(SAMPLE), 'utf-16be', 2],
    ['UTF-16LE không BOM', utf16le(SAMPLE, false), 'utf-16le', 0],
    ['UTF-16BE không BOM', utf16be(SAMPLE, false), 'utf-16be', 0],
  ] as const)('%s', (_name, bytes, encoding, bomLength) => {
    expect(detectEncoding(bytes)).toEqual({ encoding, bomLength });
  });
});

describe('decodeText', () => {
  it.each([
    ['UTF-8', utf8(SAMPLE)],
    ['UTF-8 BOM', utf8(SAMPLE, true)],
    ['UTF-16LE', utf16le(SAMPLE)],
    ['UTF-16BE', utf16be(SAMPLE)],
    ['UTF-16BE không BOM', utf16be(SAMPLE, false)],
  ])('%s → chuỗi gốc, không còn BOM, JSON đọc được', (_name, bytes) => {
    const { text } = decodeText(bytes);
    expect(text).toBe(SAMPLE);
    expect(JSON.parse(text).name).toBe('Quỹ du lịch Momo');
  });

  it('file lớn (vượt kích thước một khúc ghép chuỗi)', () => {
    const big = 'Tiền điện nước '.repeat(5000);
    expect(decodeText(utf16be(big)).text).toBe(big);
    expect(decodeText(utf8(big)).text).toBe(big);
  });

  it('byte UTF-8 hỏng → ký tự thay thế, không làm crash', () => {
    const { text } = decodeText(new Uint8Array([0x41, 0xc3, 0x42]));
    expect(text).toBe('A�B');
  });

  it('file rỗng', () => {
    expect(decodeText(new Uint8Array([])).text).toBe('');
  });
});
