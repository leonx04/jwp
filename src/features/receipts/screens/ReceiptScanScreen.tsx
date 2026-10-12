// Nhập giao dịch từ ảnh biên lai: chọn ảnh / dán từ clipboard → OCR trên máy → duyệt → lưu hàng loạt.
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, View } from 'react-native';

import { showSnackbar } from '@/components/feedback/snackbarStore';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  MoneyField,
  Screen,
  SectionTitle,
  SwitchRow,
  TextField,
} from '@/components/ui';
import { db } from '@/db';
import { listAccounts } from '@/features/accounts/repository';
import { listCategories, saveCategory } from '@/features/categories/repository';
import { suggestTitles } from '@/features/suggestions/engine';
import { detectBank } from '@/lib/banks';
import { normalizeForSearch } from '@/lib/text';
import { findByExternalRef, saveTransaction } from '@/features/transactions/repository';
import { toAppIcon } from '@/lib/icons';

import { ocrAvailable, recognizeText } from '../../../../modules/jwp-ocr';
import { parseReceipt } from '../parse';

type Draft = {
  /** Ảnh gốc để đối chiếu */
  uri: string;
  key: string;
  include: boolean;
  duplicate: boolean;
  type: 'expense' | 'income';
  amount: number;
  title: string;
  /** Người nhận / người chuyển — lưu vào ghi chú */
  counterparty: string;
  date: number;
  accountId: string | null;
  categoryId: string | null;
  /** Danh mục ghi trên biên lai (vd "Sức khỏe") — gợi ý gán hoặc tạo mới */
  categoryHint: string;
  ref: string | null;
  confidence: number;
};

let counter = 0;

/** 'bank:MB' → 'MB' */
const bankOf = (icon: string | null) => (icon?.startsWith('bank:') ? icon.slice(5) : null);

type CategoryList = ReturnType<typeof listCategories>;

/** Danh mục của app khớp với tên trên biên lai: trùng tên, hoặc một tên chứa tên kia */
function matchCategory(hint: string, categories: CategoryList): string | null {
  const key = normalizeForSearch(hint);
  if (!key) return null;
  const hit =
    categories.find((c) => normalizeForSearch(c.name) === key) ??
    categories.find((c) => {
      const name = normalizeForSearch(c.name);
      return name.length >= 3 && (name.includes(key) || key.includes(name));
    });
  return hit?.id ?? null;
}

async function recognizeUri(
  uri: string,
  accounts: ReturnType<typeof listAccounts>,
  categories: CategoryList,
): Promise<Draft | null> {
  const ocr = await recognizeText(uri);
  const parsed = parseReceipt(ocr.text, ocr.lines);
  // Chỉ ở bản debug: ghi chữ OCR + kết quả để chỉnh bộ đọc theo biên lai thật
  if (__DEV__) console.log('[OCR]', JSON.stringify({ text: ocr.text, parsed }));
  if (!parsed.amount) return null;
  const ref = parsed.transactionRef ?? null;
  // Ví chi ra: lấy từ dòng "Tài khoản/thẻ" trên biên lai (MoMo) → khớp logo ngân hàng hoặc tên ví
  const account =
    accounts.find(
      (a) =>
        parsed.bankCode &&
        (bankOf(a.icon) === parsed.bankCode || detectBank(a.name)?.code === parsed.bankCode),
    ) ??
    accounts[0] ??
    null;
  const type = parsed.type ?? 'expense';
  const title = parsed.content ?? parsed.counterparty ?? '';
  // Danh mục: ưu tiên danh mục ghi trên biên lai (MoMo), sau đó đến gợi ý theo lịch sử
  const categoryHint = parsed.category ?? '';
  const categoryId =
    matchCategory(categoryHint, categories) ??
    suggestTitles(db, { type, query: title, amount: parsed.amount, limit: 1 })[0]?.categoryId ??
    null;
  return {
    key: `r${++counter}`,
    uri,
    include: true,
    duplicate: ref ? findByExternalRef(db, ref) != null : false,
    type: parsed.type ?? 'expense',
    amount: parsed.amount,
    // Tiêu đề = nội dung chuyển tiền; tên người nhận chỉ để ghi chú
    title: parsed.content ?? parsed.counterparty ?? '',
    counterparty: parsed.counterparty ?? '',
    date: parsed.date ?? Date.now(),
    accountId: account?.id ?? null,
    categoryId,
    categoryHint,
    ref,
    confidence: parsed.confidence,
  };
}

export function ReceiptScanScreen() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const accounts = listAccounts(db);
  const [categories, setCategories] = useState(() => listCategories(db));

  const process = async (uris: string[]) => {
    setBusy(true);
    try {
      const found: Draft[] = [];
      let miss = 0;
      for (const uri of uris) {
        const draft = await recognizeUri(uri, accounts, categories);
        if (draft) found.push({ ...draft, include: !draft.duplicate });
        else miss++;
      }
      setDrafts((prev) => [...prev, ...found]);
      setSkipped((n) => n + miss);
    } catch (error) {
      Alert.alert('Không đọc được ảnh', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const pickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 1,
    });
    if (!result.canceled) await process(result.assets.map((a) => a.uri));
  };

  const pasteClipboard = async () => {
    if (!(await Clipboard.hasImageAsync())) {
      showSnackbar({
        text: 'Clipboard chưa có ảnh. Hãy sao chép ảnh biên lai trước.',
        tone: 'default',
      });
      return;
    }
    const image = await Clipboard.getImageAsync({ format: 'png' });
    if (!image) return;
    const base64 = image.data.replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const file = new File(Paths.cache, `clipboard-${Date.now()}.png`);
    file.create();
    file.write(bytes);
    await process([file.uri]);
  };

  const patch = (key: string, change: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...change } : d)));

  const selected = drafts.filter((d) => d.include && d.accountId && d.amount > 0);

  const saveAll = () => {
    try {
      for (const d of selected) {
        saveTransaction(db, {
          type: d.type,
          amount: d.amount,
          accountId: d.accountId!,
          categoryId: d.categoryId,
          title: d.title,
          note:
            d.counterparty && d.counterparty !== d.title
              ? `Người ${d.type === 'income' ? 'chuyển' : 'nhận'}: ${d.counterparty}`
              : null,
          date: d.date,
          externalRef: d.ref,
        });
      }
      showSnackbar({ text: `Đã lưu ${selected.length} giao dịch`, tone: 'success' });
      router.back();
    } catch (error) {
      Alert.alert('Chưa lưu được', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen
      title="Nhập từ ảnh biên lai"
      footer={
        drafts.length ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Button
              title={`Lưu ${selected.length} giao dịch`}
              icon="checkmark"
              disabled={!selected.length}
              onPress={saveAll}
            />
          </View>
        ) : undefined
      }
    >
      {!ocrAvailable ? (
        <Card>
          <AppText color="textMuted">
            Quét ảnh cần bản cài riêng của JWP (không chạy trong Expo Go).
          </AppText>
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <AppText variant="caption" color="textMuted">
          Ảnh được đọc ngay trên máy, không gửi đi đâu. Chọn nhiều ảnh cùng lúc để nhập hàng loạt.
        </AppText>
        <Button
          title="Chọn ảnh từ thư viện"
          icon="images-outline"
          disabled={busy}
          onPress={pickGallery}
        />
        <Button
          title="Dán ảnh từ clipboard"
          icon="clipboard-outline"
          variant="secondary"
          disabled={busy}
          onPress={pasteClipboard}
        />
        {busy ? <ActivityIndicator /> : null}
      </Card>

      {skipped ? (
        <AppText variant="caption" color="warning">
          {skipped} ảnh không tìm thấy số tiền nên bị bỏ qua.
        </AppText>
      ) : null}

      {drafts.length ? (
        <>
          <SectionTitle tone="section">{`Kiểm tra lại · ${drafts.length}`}</SectionTitle>
          {drafts.map((d) => (
            <Card key={d.key} style={{ gap: 10 }}>
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Phóng to ảnh biên lai"
                onPress={() => setZoomUri(d.uri)}
              >
                <Image
                  source={{ uri: d.uri }}
                  resizeMode="cover"
                  style={{ width: '100%', height: 140, borderRadius: 12 }}
                />
                <AppText variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                  Bấm vào ảnh để phóng to
                </AppText>
              </Pressable>
              <SwitchRow
                title={d.type === 'expense' ? 'Khoản chi' : 'Khoản thu'}
                subtitle={
                  d.duplicate
                    ? 'Có vẻ đã nhập rồi (trùng mã giao dịch)'
                    : d.confidence < 0.5
                      ? 'Đọc chưa chắc chắn, hãy kiểm tra'
                      : undefined
                }
                value={d.include}
                onValueChange={(include) => patch(d.key, { include })}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Chip
                  label="Chi"
                  selected={d.type === 'expense'}
                  onPress={() => patch(d.key, { type: 'expense' })}
                />
                <Chip
                  label="Thu"
                  selected={d.type === 'income'}
                  onPress={() => patch(d.key, { type: 'income' })}
                />
              </View>
              <MoneyField
                keyboardType="numeric"
                label="Số tiền"
                value={d.amount}
                onChange={(amount) => patch(d.key, { amount })}
              />
              <TextField
                label="Tiêu đề"
                value={d.title}
                onChangeText={(title) => patch(d.key, { title })}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    icon={toAppIcon(a.icon, 'wallet-outline')}
                    color={a.color}
                    selected={d.accountId === a.id}
                    onPress={() => patch(d.key, { accountId: a.id })}
                  />
                ))}
              </View>
              <AppText variant="label" color="textMuted">
                Danh mục
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {d.categoryHint && !d.categoryId ? (
                  <Chip
                    label={`Tạo danh mục "${d.categoryHint}"`}
                    icon="add"
                    onPress={() => {
                      const id = saveCategory(db, {
                        name: d.categoryHint,
                        color: '#7C3AED',
                        icon: 'pricetag-outline',
                      });
                      setCategories(listCategories(db));
                      patch(d.key, { categoryId: id, categoryHint: '' });
                    }}
                  />
                ) : null}
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    icon={c.icon ? toAppIcon(c.icon, 'pricetag-outline') : undefined}
                    color={c.color}
                    selected={d.categoryId === c.id}
                    onPress={() =>
                      patch(d.key, { categoryId: d.categoryId === c.id ? null : c.id })
                    }
                  />
                ))}
              </View>
            </Card>
          ))}
        </>
      ) : (
        <Card>
          <EmptyState
            icon="scan-outline"
            title="Chưa có ảnh nào"
            description="Chụp màn hình biên lai chuyển khoản / ví điện tử rồi chọn ảnh ở trên."
          />
        </Card>
      )}
      <Modal
        visible={zoomUri != null}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomUri(null)}
      >
        <Pressable
          onPress={() => setZoomUri(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}
        >
          {zoomUri ? (
            <Image
              source={{ uri: zoomUri }}
              resizeMode="contain"
              style={{ width: '100%', height: '90%' }}
            />
          ) : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}
