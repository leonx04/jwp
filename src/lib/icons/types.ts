import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icon của bộ MaterialCommunityIcons (cho thứ Ionicons không có, vd bơm xăng): 'mci:gas-station' */
export type McIcon = `mci:${string}`;

/** Icon lưu trong DB: tên Ionicons, 'mci:<tên>', hoặc logo ngân hàng / ví điện tử dạng 'bank:<CODE>' */
export type AppIcon = IconName | McIcon | `bank:${string}`;
