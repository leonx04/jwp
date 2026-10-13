// Chọn ví cho khoản nợ: một hàng chip cuộn ngang + lựa chọn "Không ghi vào ví".
import { ScrollView } from 'react-native';

import { Chip } from '@/components/ui';
import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';
import { listAccounts } from '@/features/accounts/repository';
import { toAppIcon } from '@/lib/icons';

type WalletChipsProps = {
  value: string | null;
  onChange: (accountId: string | null) => void;
};

export function WalletChips({ value, onChange }: WalletChipsProps) {
  const { data: accounts = [] } = useLiveData(['accounts'], () => listAccounts(db));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -16, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      <Chip
        label="Không ghi vào ví"
        icon="remove-circle-outline"
        selected={value === null}
        onPress={() => onChange(null)}
      />
      {accounts
        .filter((a) => !a.isCredit)
        .map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            icon={toAppIcon(a.icon, 'wallet-outline')}
            color={a.color}
            selected={value === a.id}
            onPress={() => onChange(a.id)}
          />
        ))}
    </ScrollView>
  );
}
