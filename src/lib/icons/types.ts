import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icon lưu trong DB: tên Ionicons, hoặc logo ngân hàng / ví điện tử dạng 'bank:<CODE>' */
export type AppIcon = IconName | `bank:${string}`;
