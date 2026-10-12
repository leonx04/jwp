// Bộ icon chọn lọc (Ionicons, ưu tiên nét mảnh "-outline") xếp theo nhóm chi tiêu của người Việt.
// keywords: tiếng Việt KHÔNG dấu + tiếng Anh, chữ thường → tìm kiếm không phân biệt dấu.
// Mỗi icon chỉ nằm trong một nhóm; test kiểm tra mọi tên đều có trong Ionicons.
import type { IconName, McIcon } from './types';

export type IconEntry = {
  name: IconName | McIcon;
  /** Tên ngắn tiếng Việt (có dấu) — dùng cho trợ năng và dòng mô tả */
  label: string;
  /** Từ khoá không dấu, chữ thường, cách nhau bởi khoảng trắng */
  keywords: string;
};

export type IconGroup = {
  key: string;
  /** Tên nhóm tiếng Việt */
  label: string;
  icons: readonly IconEntry[];
};

const e = (name: IconName | McIcon, label: string, keywords: string): IconEntry => ({
  name,
  label,
  keywords,
});

export const ICON_GROUPS: readonly IconGroup[] = [
  {
    key: 'food',
    label: 'Ăn uống',
    icons: [
      e('restaurant-outline', 'Ăn uống', 'an uong com quan an nha hang bun pho an trua an toi com van phong food restaurant meal'),
      e('fast-food-outline', 'Đồ ăn nhanh', 'do an nhanh banh mi ga ran burger an vat giao do an grabfood shopeefood fast food snack'),
      e('cafe-outline', 'Cà phê', 'ca phe cafe coffee tra highlands starbucks phuc long cong cafe ban be'),
      e('pint-outline', 'Trà sữa, đồ uống', 'tra sua do uong nuoc ngot sinh to nuoc ep drink bubble tea smoothie'),
      e('beer-outline', 'Bia, nhậu', 'bia nhau beer bar quan nhau'),
      e('wine-outline', 'Rượu vang', 'ruou vang ruou wine tiec party'),
      e('pizza-outline', 'Pizza', 'pizza do an tay fast food'),
      e('ice-cream-outline', 'Kem, tráng miệng', 'kem trang mieng che banh ngot ice cream dessert'),
      e('nutrition-outline', 'Rau củ, trái cây', 'rau cu trai cay hoa qua an chay an kieng healthy fruit vegetable'),
      e('fish-outline', 'Hải sản', 'hai san ca tom cua oc seafood fish'),
      e('egg-outline', 'Bữa sáng', 'bua sang an sang trung xoi breakfast egg'),
      e('basket-outline', 'Đi chợ', 'di cho thuc pham rau thit cho market grocery bach hoa xanh'),
    ],
  },
  {
    key: 'transport',
    label: 'Đi lại',
    icons: [
      e('mci:gas-station', 'Đổ xăng', 'xang xe do xang xe may petrol fuel gas station cay xang tram xang'),
      e('speedometer-outline', 'Bảo dưỡng xe', 'bao duong sua xe thay nhot rua xe dong ho km speedometer maintenance'),
      e('bicycle-outline', 'Xe máy, xe đạp', 'xe may xe dap xe dien motorbike bicycle bike'),
      e('car-outline', 'Ô tô', 'o to xe hoi xe oto car'),
      e('car-sport-outline', 'Grab, taxi', 'grab taxi be xanh sm gojek goi xe xe om cong nghe ride'),
      e('bus-outline', 'Xe buýt, xe khách', 'xe buyt xe khach bus coach'),
      e('subway-outline', 'Metro', 'metro tau dien tau dien ngam subway'),
      e('train-outline', 'Tàu hoả', 'tau hoa tau duong sat train railway'),
      e('airplane-outline', 'Máy bay', 'may bay ve may bay chuyen bay flight airplane vietjet vietnam airlines'),
      e('boat-outline', 'Tàu thuyền, phà', 'tau thuyen pha ca no boat ferry'),
      e('walk-outline', 'Đi bộ', 'di bo walk'),
      e('key-outline', 'Gửi xe', 'gui xe ve xe trong giu xe bai do xe parking chia khoa key'),
      e('build-outline', 'Sửa xe, bảo dưỡng', 'sua xe bao duong thay nhot rua xe va xe repair maintenance'),
      e('battery-charging-outline', 'Sạc xe điện', 'sac xe dien tram sac vinfast pin ev charging'),
      e('trail-sign-outline', 'Phí cầu đường', 'phi cau duong tram thu phi bot etc toll'),
      e('navigate-outline', 'Chuyến đi', 'chuyen di di xa dinh vi navigate gps trip'),
    ],
  },
  {
    key: 'home',
    label: 'Nhà cửa & hoá đơn',
    icons: [
      e('home-outline', 'Nhà, thuê nhà', 'nha thue nha tien nha nha cua phong tro cho thue home rent'),
      e('bed-outline', 'Nội thất, phòng ngủ', 'noi that giuong phong ngu nem do gia dung khach san homestay bed furniture'),
      e('receipt-outline', 'Hoá đơn', 'hoa don bill thanh toan receipt invoice'),
      e('flash-outline', 'Tiền điện', 'tien dien dien evn electricity power'),
      e('water-outline', 'Tiền nước', 'tien nuoc nuoc sinh hoat water'),
      e('flame-outline', 'Gas, bếp', 'gas binh gas bep nau an lau nuong flame'),
      e('wifi-outline', 'Internet', 'internet wifi mang cap quang fpt viettel vnpt'),
      e('phone-portrait-outline', 'Điện thoại, nạp tiền', 'dien thoai nap tien nap the the cao sim vi dien tu phone top up mobile'),
      e('call-outline', 'Cước gọi', 'cuoc goi goi dien cuoc dien thoai tra sau call'),
      e('cellular-outline', 'Gói data 4G/5G', 'goi cuoc data 3g 4g 5g mang di dong cellular'),
      e('tv-outline', 'Truyền hình', 'truyen hinh tv k+ truyen hinh cap netflix fpt play television'),
      e('snow-outline', 'Điều hoà', 'dieu hoa may lanh air conditioner tu lanh'),
      e('bulb-outline', 'Đèn, điện gia dụng', 'den bong den chieu sang do dien gia dung bulb light'),
      e('leaf-outline', 'Cây cảnh, làm vườn', 'cay canh lam vuon hoa cay xanh garden plant'),
      e('construct-outline', 'Sửa nhà', 'sua chua sua nha tho sua chua xay dung construct repair'),
      e('hammer-outline', 'Dụng cụ, đồ gia dụng', 'dung cu do gia dung do nghe hammer tool'),
      e('brush-outline', 'Dọn dẹp, giúp việc', 'don dep giup viec ve sinh lau nha cleaning'),
      e('trash-outline', 'Phí rác', 'phi rac thu gom rac ve sinh trash'),
    ],
  },
  {
    key: 'shopping',
    label: 'Mua sắm',
    icons: [
      e('cart-outline', 'Mua online, siêu thị', 'gio hang mua online shopee lazada tiki tiktok shop sieu thi winmart coopmart cart'),
      e('bag-handle-outline', 'Mua sắm', 'mua sam shopping tui do'),
      e('bag-outline', 'Túi xách, phụ kiện', 'tui xach phu kien bag accessories'),
      e('bag-check-outline', 'Đơn hàng', 'don hang da mua dat hang order'),
      e('cube-outline', 'Giao hàng, ship', 'giao hang ship phi ship cod van chuyen buu kien package delivery'),
      e('pricetags-outline', 'Khuyến mãi, săn sale', 'khuyen mai giam gia san sale voucher ma giam gia discount'),
      e('shirt-outline', 'Quần áo', 'quan ao thoi trang ao do mac clothes fashion shirt'),
      e('footsteps-outline', 'Giày dép', 'giay dep giay the thao shoes footwear'),
      e('glasses-outline', 'Kính mắt', 'kinh mat kinh can glasses'),
      e('watch-outline', 'Đồng hồ', 'dong ho dong ho thong minh smartwatch watch'),
      e('color-palette-outline', 'Mỹ phẩm', 'my pham trang diem son makeup cosmetics lam dep'),
      e('desktop-outline', 'Máy tính, đồ điện tử', 'may tinh pc man hinh do dien tu dien may computer electronics'),
      e('tablet-portrait-outline', 'Máy tính bảng', 'may tinh bang ipad tablet'),
      e('headset-outline', 'Tai nghe, âm thanh', 'tai nghe loa am thanh headphone speaker'),
      e('hardware-chip-outline', 'Linh kiện, công nghệ', 'linh kien cong nghe phu kien dien tu chip gadget'),
    ],
  },
  {
    key: 'health',
    label: 'Sức khoẻ & làm đẹp',
    icons: [
      e('medkit-outline', 'Thuốc, y tế', 'thuoc y te nha thuoc tu thuoc so cuu medicine pharmacy medkit'),
      e('medical-outline', 'Khám bệnh, bệnh viện', 'kham benh benh vien phong kham bac si medical hospital doctor'),
      e('bandage-outline', 'Băng gạc, sơ cứu', 'bang gac so cuu vet thuong bandage'),
      e('thermometer-outline', 'Ốm sốt', 'om sot cam cum thermometer sick'),
      e('pulse-outline', 'Xét nghiệm, khám định kỳ', 'xet nghiem kham suc khoe dinh ky tim mach checkup pulse'),
      e('fitness-outline', 'Sức khoẻ', 'suc khoe khoe manh health fitness'),
      e('barbell-outline', 'Gym', 'gym tap ta the hinh barbell workout'),
      e('body-outline', 'Yoga, thể dục', 'yoga the duc aerobic boi loi chay bo body'),
      e('eye-outline', 'Mắt', 'mat kham mat nhan khoa eye'),
      e('ear-outline', 'Tai mũi họng', 'tai mui hong ent ear'),
      e('flask-outline', 'Thực phẩm chức năng', 'thuc pham chuc nang vitamin bo sung supplement'),
      e('cut-outline', 'Cắt tóc', 'cat toc lam toc salon barber goi dau cut hair'),
      e('sparkles-outline', 'Spa, làm đẹp', 'spa lam dep massage skincare cham soc da nail lam mong beauty'),
    ],
  },
  {
    key: 'family',
    label: 'Gia đình & con cái',
    icons: [
      e('people-outline', 'Gia đình', 'gia dinh nguoi nha family'),
      e('people-circle-outline', 'Biếu bố mẹ', 'bieu bo me bieu ong ba cha me phung duong parents'),
      e('school-outline', 'Học phí', 'hoc phi truong hoc giao duc con cai di hoc school tuition education'),
      e('happy-outline', 'Con cái, em bé', 'con cai em be tre em sua bim bim sua tre con kid baby'),
      e('balloon-outline', 'Sinh nhật, đồ chơi', 'sinh nhat do choi tre em bong bay birthday toy'),
      e('extension-puzzle-outline', 'Đồ chơi', 'do choi xep hinh lego puzzle toy'),
      e('woman-outline', 'Vợ, mẹ', 'vo me phu nu chi gai woman wife mother'),
      e('man-outline', 'Chồng, bố', 'chong bo dan ong anh trai man husband father'),
      e('person-outline', 'Cá nhân', 'ca nhan ban than person personal'),
      e('paw-outline', 'Thú cưng', 'thu cung cho meo thuc an thu cung thu y pet dog cat'),
    ],
  },
  {
    key: 'social',
    label: 'Xã hội & hiếu hỉ',
    icons: [
      e('mail-outline', 'Hiếu hỉ, phong bì', 'hieu hi phong bi mung cuoi dam cuoi dam hoi dam gio tien mung envelope wedding'),
      e('heart-outline', 'Tình yêu, hẹn hò', 'tinh yeu hen ho nguoi yeu ky niem love date heart'),
      e('gift-outline', 'Quà tặng', 'qua tang qua sinh nhat tang qua gift present'),
      e('rose-outline', 'Tặng hoa', 'tang hoa hoa tuoi valentine 8/3 20/10 rose flower'),
      e('flower-outline', 'Phúng viếng', 'phung vieng vong hoa dam hieu tang le vieng funeral'),
      e('chatbubbles-outline', 'Gặp gỡ bạn bè', 'gap go ban be di choi hop lop tu tap cafe ban be friends hang out'),
      e('hand-left-outline', 'Từ thiện, ủng hộ', 'tu thien ung ho quyen gop cong duc charity donate'),
    ],
  },
  {
    key: 'fun',
    label: 'Giải trí & du lịch',
    icons: [
      e('film-outline', 'Xem phim', 'xem phim rap phim cgv lotte cinema movie film'),
      e('ticket-outline', 'Vé sự kiện', 've su kien ve concert show ve xem phim ticket event'),
      e('game-controller-outline', 'Game', 'game choi game nap game steam playstation gaming'),
      e('dice-outline', 'Board game', 'board game boardgame xuc xac tro choi dice'),
      e('musical-notes-outline', 'Âm nhạc', 'am nhac nhac spotify apple music music'),
      e('mic-outline', 'Karaoke', 'karaoke hat micro mic'),
      e('logo-youtube', 'YouTube', 'youtube premium video'),
      e('logo-tiktok', 'TikTok', 'tiktok video'),
      e('football-outline', 'Bóng đá', 'bong da da bong san bong football soccer the thao sport'),
      e('basketball-outline', 'Bóng rổ', 'bong ro basketball the thao sport'),
      e('tennisball-outline', 'Tennis, pickleball', 'tennis pickleball cau long the thao vot sport'),
      e('golf-outline', 'Golf', 'golf the thao sport'),
      e('trophy-outline', 'Giải đấu', 'giai dau thi dau cup trophy'),
      e('earth-outline', 'Du lịch', 'du lich nuoc ngoai di choi xa travel world tour'),
      e('map-outline', 'Phượt, chuyến đi', 'phuot ban do chuyen di tour map trip'),
      e('compass-outline', 'Khám phá', 'kham pha trai nghiem compass explore'),
      e('camera-outline', 'Chụp ảnh', 'chup anh may anh studio photo camera'),
      e('sunny-outline', 'Nghỉ dưỡng, biển', 'nghi duong bien resort nghi mat sunny beach vacation'),
      e('bonfire-outline', 'Cắm trại, dã ngoại', 'cam trai da ngoai picnic camping bonfire'),
      e('planet-outline', 'Sở thích', 'so thich vu tru hobby planet'),
    ],
  },
  {
    key: 'work',
    label: 'Học tập & công việc',
    icons: [
      e('book-outline', 'Sách', 'sach truyen doc sach book'),
      e('language-outline', 'Ngoại ngữ', 'ngoai ngu tieng anh ielts toeic hoc tieng language'),
      e('easel-outline', 'Khoá học', 'khoa hoc hoc them lop hoc day hoc course class'),
      e('ribbon-outline', 'Chứng chỉ, học bổng', 'chung chi hoc bong giai thuong certificate scholarship'),
      e('pencil-outline', 'Văn phòng phẩm', 'van phong pham but vo dung cu hoc tap stationery'),
      e('newspaper-outline', 'Báo, tạp chí', 'bao tap chi tin tuc newspaper magazine'),
      e('briefcase-outline', 'Công việc, lương', 'cong viec luong di lam cong tac work salary job'),
      e('business-outline', 'Công ty, văn phòng', 'cong ty van phong toa nha doanh nghiep company office'),
      e('laptop-outline', 'Laptop', 'laptop may tinh xach tay lam viec dien tu'),
      e('code-slash-outline', 'Lập trình, IT', 'lap trinh code it phan mem software developer'),
      e('cloud-outline', 'Phần mềm, lưu trữ', 'phan mem luu tru dam may icloud google drive chatgpt subscription cloud'),
      e('document-text-outline', 'Giấy tờ, hồ sơ', 'giay to ho so cong chung thu tuc hanh chinh document'),
      e('calculator-outline', 'Kế toán', 'ke toan tinh toan so sach calculator accounting'),
      e('print-outline', 'In ấn, photo', 'in an photo copy print'),
      e('megaphone-outline', 'Quảng cáo, marketing', 'quang cao marketing chay ads facebook ads megaphone'),
    ],
  },
  {
    key: 'finance',
    label: 'Tài chính',
    icons: [
      e('wallet-outline', 'Ví tiền', 'vi tien wallet'),
      e('cash-outline', 'Tiền mặt', 'tien mat cash money'),
      e('card-outline', 'Thẻ, thẻ tín dụng', 'the the tin dung the ngan hang the ghi no card credit debit'),
      e('library-outline', 'Ngân hàng, thuế', 'ngan hang thue nha nuoc co quan bank tax'),
      e('qr-code-outline', 'Thanh toán QR', 'thanh toan qr quet ma vietqr qr code'),
      e('swap-horizontal-outline', 'Chuyển khoản', 'chuyen khoan chuyen tien transfer'),
      e('calendar-number-outline', 'Trả góp', 'tra gop hang thang ky han installment'),
      e('hourglass-outline', 'Trả sau', 'tra sau mua truoc tra sau paylater spaylater bnpl'),
      e('repeat-outline', 'Định kỳ, đăng ký', 'dinh ky dang ky hang thang thue bao subscription recurring'),
      e('arrow-up-circle-outline', 'Cho vay', 'cho vay cho muon lend loan'),
      e('arrow-down-circle-outline', 'Đi vay', 'di vay vay tien muon tien no borrow debt'),
      e('checkmark-done-circle-outline', 'Trả nợ', 'tra no tat toan da tra repay'),
      e('remove-circle-outline', 'Phí ngân hàng', 'phi phi ngan hang phi giao dich phi dich vu phi thuong nien khau tru fee'),
      e('shield-checkmark-outline', 'Bảo hiểm', 'bao hiem bhyt bhxh nhan tho bao hiem xe insurance'),
      e('save-outline', 'Tiết kiệm', 'tiet kiem gui tiet kiem quy de danh saving'),
      e('lock-closed-outline', 'Két, quỹ khẩn cấp', 'ket sat quy khan cap du phong tiet kiem co ky han emergency fund'),
      e('trending-up-outline', 'Đầu tư', 'dau tu loi nhuan sinh loi invest growth'),
      e('trending-down-outline', 'Thua lỗ', 'thua lo lo giam gia loss'),
      e('stats-chart-outline', 'Chứng khoán', 'chung khoan co phieu stock trading'),
      e('pie-chart-outline', 'Quỹ, ngân sách', 'quy dau tu ngan sach phan bo budget fund'),
      e('diamond-outline', 'Vàng, trang sức', 'vang trang suc kim cuong tai san sjc pnj gold jewelry'),
      e('logo-bitcoin', 'Tiền mã hoá', 'tien ma hoa tien ao bitcoin crypto'),
      e('logo-usd', 'Ngoại tệ', 'ngoai te do la usd dollar doi tien'),
    ],
  },
  {
    key: 'income',
    label: 'Thu nhập',
    icons: [
      e('star-outline', 'Thưởng', 'thuong bonus thuong tet luong thang 13'),
      e('medal-outline', 'Thưởng KPI', 'thuong kpi thanh tich hoa hong medal'),
      e('storefront-outline', 'Bán hàng, kinh doanh', 'ban hang kinh doanh cua hang shop tap hoa store'),
      e('rocket-outline', 'Thu nhập phụ, freelance', 'thu nhap phu freelance lam them du an side project'),
      e('analytics-outline', 'Lãi, cổ tức', 'lai tien lai lai suat co tuc lai tiet kiem interest dividend'),
      e('refresh-circle-outline', 'Hoàn tiền', 'hoan tien cashback refund hoan lai'),
      e('mail-open-outline', 'Lì xì, quà nhận', 'li xi tien mung qua nhan duoc mung tuoi tet lucky money'),
      e('thumbs-up-outline', 'Tiền tip, hoa hồng', 'tien tip tien boa hoa hong affiliate tip commission'),
      e('enter-outline', 'Tiền vào', 'tien vao nhan tien thu tien receive income'),
      e('add-circle-outline', 'Thu khác', 'thu khac thu nhap khac other income'),
    ],
  },
  {
    key: 'other',
    label: 'Khác',
    icons: [
      e('pricetag-outline', 'Danh mục', 'danh muc nhan tag category'),
      e('shapes-outline', 'Linh tinh', 'linh tinh vat dung misc'),
      e('flag-outline', 'Mục tiêu', 'muc tieu ke hoach goal flag'),
      e('calendar-outline', 'Sự kiện', 'su kien lich hen event calendar'),
      e('warning-outline', 'Phạt, vi phạm', 'phat phat nguoi vi pham giao thong phat tien fine'),
      e('chatbubble-ellipses-outline', 'Tin nhắn', 'tin nhan sms message'),
      e('help-circle-outline', 'Chưa rõ', 'chua ro chua phan loai unknown'),
      e('ellipsis-horizontal-circle-outline', 'Khác', 'khac other'),
    ],
  },
];

/** Toàn bộ icon (phẳng) theo thứ tự nhóm */
export const ICON_CHOICES: readonly (IconName | McIcon)[] = ICON_GROUPS.flatMap((g) => g.icons.map((i) => i.name));

type IndexedEntry = IconEntry & { group: string };

const BY_NAME = new Map<string, IndexedEntry>(
  ICON_GROUPS.flatMap((g) => g.icons.map((i) => [i.name, { ...i, group: g.key }] as const)),
);

/** Thông tin icon trong bộ chọn (tên tiếng Việt, nhóm); null nếu icon ngoài bộ */
export function iconInfo(name: string | null | undefined): IndexedEntry | null {
  return (name && BY_NAME.get(name)) || null;
}
