/**
 * Bỏ dấu tiếng Việt + chữ thường, dùng cho tìm kiếm / gợi ý không phân biệt dấu.
 *   'Cà Phê Sữa Đá' → 'ca phe sua da'
 */
export function removeDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // các dấu thanh / dấu mũ sau khi tách NFD
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Chuẩn hoá để so khớp: bỏ dấu, chữ thường, gộp khoảng trắng. */
export function normalizeForSearch(input: string): string {
  return removeDiacritics(input).toLowerCase().replace(/\s+/g, ' ').trim();
}
