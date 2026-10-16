// Hộp "Chờ xác nhận": các giao dịch app tự đọc được từ thông báo / SMS ngân hàng. Bấm Ghi để mở form điền sẵn.
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Button, Card, Chip, EmptyState, Screen } from '@/components/ui';
import { BankMark } from '@/components/ui/BankMark';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { getAccountBalance, listAccounts } from '@/features/accounts/repository';
import { listCategories } from '@/features/categories/repository';
import { useMoneyFormat } from '@/features/settings';
import { BANKS } from '@/lib/banks';
import { formatDate, toVnDate, toVnTime } from '@/lib/date';
import { toAppIcon } from '@/lib/icons';

import { usePendingCaptures } from '../hooks';
import { dismissCapture, setCaptureAccount } from '../repository';
import { dismissCaptures, type PendingPair, type PendingSingle } from '../transfers';

export function InboxScreen() {
  const { data: pending } = usePendingCaptures();
  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));
  const { data: categories = [] } = useLiveData(['categories'], () => listCategories(db));
  const count = pending ? pending.pairs.length + pending.singles.length : 0;

  return (
    <Screen title="Chờ xác nhận">
      <AppText color="textMuted">
        Giao dịch app tự đọc từ thông báo / SMS ngân hàng. Kiểm tra rồi bấm Ghi — app mở form đã
        điền sẵn số tiền, ví và nội dung.
      </AppText>

      {pending && count === 0 ? (
        <Card>
          <EmptyState
            icon="mail-open-outline"
            title="Không có giao dịch nào đang chờ"
            description="Khi ngân hàng báo biến động số dư, giao dịch sẽ hiện ở đây."
            action={
              <Button
                title="Cài đặt tự đọc"
                variant="secondary"
                icon="settings-outline"
                onPress={() => router.push('/settings/capture')}
              />
            }
          />
        </Card>
      ) : null}

      {pending?.pairs.map((p) => (
        <TransferCard key={p.out.capture.id} pair={p} accounts={accounts} />
      ))}
      {pending?.singles.map((p) => (
        <CaptureCard key={p.capture.id} item={p} accounts={accounts} categories={categories} />
      ))}
    </Screen>
  );
}

/** Hai thông báo ngược chiều, cùng số tiền, sát nhau → một lần chuyển giữa 2 ví của bạn */
function TransferCard({
  pair,
  accounts,
}: {
  pair: PendingPair;
  accounts: { id: string; name: string }[];
}) {
  const format = useMoneyFormat();
  const { out, in: into, duplicateOf } = pair;
  const name = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '?';
  const when = `${formatDate(toVnDate(out.capture.postedAt))} ${toVnTime(out.capture.postedAt)}`;

  const record = () =>
    router.push({
      pathname: '/transaction/new',
      params: {
        type: 'transfer',
        amount: String(out.capture.amount ?? 0),
        accountId: out.capture.accountId ?? undefined,
        toAccountId: into.capture.accountId ?? undefined,
        title: 'Chuyển tiền giữa ví',
        date: String(out.capture.postedAt),
        captureId: `${out.capture.id},${into.capture.id}`,
      },
    });

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="label" color="textMuted">
            CHUYỂN TIỀN GIỮA VÍ CỦA BẠN
          </AppText>
          <AppText
            variant="heading"
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {format.money(out.capture.amount ?? 0)}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {name(out.capture.accountId)} → {name(into.capture.accountId)}
          </AppText>
        </View>
        <AppText variant="caption" color="textMuted">
          {when}
        </AppText>
      </View>
      <AppText variant="caption" color="textMuted">
        Hai thông báo (một trừ, một cộng) cùng số tiền, sát nhau → gộp thành một lần chuyển tiền,
        không tính là chi tiêu hay thu nhập.
      </AppText>
      {duplicateOf ? (
        <AppText variant="caption" color="warning">
          Có vẻ bạn đã ghi lần chuyển này rồi.
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Ghi chuyển khoản" icon="checkmark" size="sm" onPress={record} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={duplicateOf ? 'Đã ghi rồi' : 'Bỏ qua'}
            variant="secondary"
            size="sm"
            onPress={() => dismissCaptures(db, [out.capture.id, into.capture.id])}
          />
        </View>
      </View>
    </Card>
  );
}

function CaptureCard({
  item,
  accounts,
  categories,
}: {
  item: PendingSingle;
  accounts: { id: string; name: string; color: string; icon: string | null; isCredit: boolean }[];
  categories: { id: string; name: string }[];
}) {
  const format = useMoneyFormat();
  const { capture: c, duplicateOf, guess, ownerHint } = item;
  const guessedCategory = guess ? categories.find((x) => x.id === guess.categoryId) : undefined;
  const bank = BANKS.find((b) => b.code === c.bankCode) ?? null;
  const income = c.type === 'income';
  const accountId = c.accountId;
  const appBalance = accountId ? getAccountBalance(db, accountId) : null;
  const balanceDiff =
    c.balanceAfter != null && appBalance != null ? c.balanceAfter - appBalance : null;
  const when = `${formatDate(toVnDate(c.postedAt))} ${toVnTime(c.postedAt)}`;

  const record = () =>
    router.push({
      pathname: '/transaction/new',
      params: {
        type: c.type ?? 'expense',
        amount: String(c.amount ?? 0),
        ...(accountId ? { accountId } : {}),
        title: c.content || c.counterparty || '',
        ...(guessedCategory ? { categoryId: guessedCategory.id } : {}),
        date: String(c.postedAt),
        captureId: c.id,
      },
    });

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {bank ? <BankMark bank={bank} size={40} /> : null}
        <View style={{ flex: 1 }}>
          <AppText
            variant="heading"
            color={income ? 'income' : 'expense'}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {income ? '+' : '−'}
            {format.money(c.amount ?? 0)}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={2}>
            {[c.content, c.counterparty].filter(Boolean).join(' · ') || 'Không có nội dung'}
          </AppText>
        </View>
        <AppText variant="caption" color="textMuted">
          {when}
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {accounts
          .filter((a) => !a.isCredit)
          .map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              icon={toAppIcon(a.icon, 'wallet-outline')}
              color={a.color}
              selected={accountId === a.id}
              onPress={() => setCaptureAccount(db, c.id, a.id)}
            />
          ))}
      </ScrollView>

      {guessedCategory && guess ? (
        <AppText variant="caption" color="textMuted">
          Danh mục: <AppText variant="caption">{guessedCategory.name}</AppText>{' '}
          {guess.source === 'rule'
            ? `(theo quy tắc “${guess.rule?.pattern ?? ''}”${guess.rule?.autoAccept ? ', tự ghi' : ''})`
            : '(trước giờ hay dùng cho nội dung này)'}
        </AppText>
      ) : null}
      {duplicateOf ? (
        <AppText variant="caption" color="warning">
          Có vẻ bạn đã ghi giao dịch này rồi (cùng số tiền, cùng giờ).
        </AppText>
      ) : null}
      {balanceDiff != null && balanceDiff !== 0 && accountId ? (
        <AppText variant="caption" color="textMuted">
          Số dư theo ngân hàng {format.money(c.balanceAfter!)} · trong app{' '}
          {format.money(appBalance!)} (chênh {balanceDiff > 0 ? '+' : ''}
          {format.money(balanceDiff)}).{' '}
          <AppText
            variant="caption"
            color="primary"
            onPress={() =>
              router.push({
                pathname: '/account/adjust',
                params: { id: accountId, actual: String(c.balanceAfter) },
              })
            }
          >
            Đối chiếu
          </AppText>
        </AppText>
      ) : null}

      {ownerHint ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" color="primary">
            Có tên bạn trong nội dung — có thể là chuyển từ/đến ví khác của chính bạn.
          </AppText>
          <Button
            title="Ghi là chuyển khoản"
            variant="secondary"
            size="sm"
            icon="swap-horizontal"
            onPress={() =>
              router.push({
                pathname: '/transaction/new',
                params: {
                  type: 'transfer',
                  amount: String(c.amount ?? 0),
                  // Chi → ví này là nơi gửi; thu → ví này là nơi nhận. Ví còn lại bạn chọn trong form.
                  ...(c.type === 'income'
                    ? { toAccountId: accountId ?? undefined }
                    : { accountId: accountId ?? undefined }),
                  title: 'Chuyển tiền giữa ví',
                  date: String(c.postedAt),
                  captureId: c.id,
                },
              })
            }
          />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Ghi giao dịch"
            icon="checkmark"
            size="sm"
            onPress={record}
            disabled={!accountId && accounts.length === 0}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={duplicateOf ? 'Đã ghi rồi' : 'Bỏ qua'}
            variant="secondary"
            size="sm"
            onPress={() => dismissCapture(db, c.id)}
          />
        </View>
      </View>
    </Card>
  );
}
