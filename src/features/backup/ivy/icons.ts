// Ánh xạ tên icon của Ivy Wallet ('fooddrink', 'ic_vue_shop_bag1'...) sang Ionicons.
import {
  DEFAULT_ACCOUNT_ICON,
  DEFAULT_CATEGORY_ICON,
  type IconName,
  type McIcon,
} from '@/lib/icons';

const EXACT: Record<string, IconName> = {
  cash: 'cash-outline',
  wallet: 'wallet-outline',
  bank: 'business-outline',
  creditcard: 'card-outline',
  bills: 'receipt-outline',
  fooddrink: 'fast-food-outline',
  shopping: 'cart-outline',
  groceries: 'basket-outline',
  loan: 'swap-horizontal-outline',
  work: 'briefcase-outline',
  family: 'people-outline',
  coffee: 'cafe-outline',
  orderfood: 'restaurant-outline',
  orderfood2: 'restaurant-outline',
  atom: 'planet-outline',
  ic_vue_design_scissors: 'cut-outline',
  ic_vue_shop_bag1: 'bag-handle-outline',
  ic_vue_messages_msg_favorite: 'chatbubble-ellipses-outline',
};

// Đoán theo từ khoá cho các icon chưa có trong bảng trên (Ivy có hàng trăm icon)
const KEYWORDS: [RegExp, IconName | McIcon][] = [
  [/food|eat|restaurant|meal|lunch|dinner/, 'restaurant-outline'],
  [/coffee|cafe|tea|drink/, 'cafe-outline'],
  [/beer|wine|bar|alcohol/, 'beer-outline'],
  [/shop|bag|cart|store|market/, 'bag-handle-outline'],
  [/fuel|gas|petrol/, 'mci:gas-station'],
  [/car|vehicle|auto/, 'car-outline'],
  [/bus|transport|taxi|metro/, 'bus-outline'],
  [/bike|bicycle|motor/, 'bicycle-outline'],
  [/plane|flight|travel|trip|vacation/, 'airplane-outline'],
  [/house|home|rent/, 'home-outline'],
  [/bill|receipt|invoice/, 'receipt-outline'],
  [/electric|power|bolt|energy/, 'flash-outline'],
  [/water/, 'water-outline'],
  [/wifi|internet|network/, 'wifi-outline'],
  [/phone|mobile|call/, 'phone-portrait-outline'],
  [/health|medic|doctor|pill|hospital/, 'medkit-outline'],
  [/sport|gym|fitness|workout/, 'barbell-outline'],
  [/beauty|cosmetic|makeup/, 'color-palette-outline'],
  [/scissor|hair|barber/, 'cut-outline'],
  [/cloth|shirt|fashion/, 'shirt-outline'],
  [/gift|present/, 'gift-outline'],
  [/pet|dog|cat/, 'paw-outline'],
  [/school|education|study|book|course/, 'school-outline'],
  [/work|job|salary|office|business/, 'briefcase-outline'],
  [/code|program|dev|computer|laptop/, 'laptop-outline'],
  [/game/, 'game-controller-outline'],
  [/movie|film|cinema/, 'film-outline'],
  [/music|song/, 'musical-notes-outline'],
  [/family|people|friend/, 'people-outline'],
  [/love|heart/, 'heart-outline'],
  [/loan|debt|borrow|lend/, 'swap-horizontal-outline'],
  [/invest|stock|crypto|bitcoin|chart/, 'trending-up-outline'],
  [/saving|piggy|safe/, 'save-outline'],
  [/tax|document|paper/, 'document-text-outline'],
  [/message|chat/, 'chatbubble-ellipses-outline'],
  [/star/, 'star-outline'],
];

export function mapIvyIcon(
  name: string | null | undefined,
  kind: 'account' | 'category',
): IconName | McIcon {
  const fallback = kind === 'account' ? DEFAULT_ACCOUNT_ICON : DEFAULT_CATEGORY_ICON;
  const key = (name ?? '').trim().toLowerCase();
  if (!key) return fallback;
  if (EXACT[key]) return EXACT[key];
  return KEYWORDS.find(([pattern]) => pattern.test(key))?.[1] ?? fallback;
}
