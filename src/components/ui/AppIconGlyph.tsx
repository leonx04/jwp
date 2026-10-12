// Vẽ một glyph icon từ AppIcon: Ionicons, hoặc 'mci:<tên>' (MaterialCommunityIcons — vd bơm xăng).
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { AppIcon, IconName } from '@/lib/icons';

export function AppIconGlyph({
  icon,
  size,
  color,
}: {
  icon: AppIcon;
  size: number;
  color: string;
}) {
  if (icon.startsWith('mci:')) {
    return (
      <MaterialCommunityIcons
        name={icon.slice(4) as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
        size={size}
        color={color}
      />
    );
  }
  return <Ionicons name={icon as IconName} size={size} color={color} />;
}
