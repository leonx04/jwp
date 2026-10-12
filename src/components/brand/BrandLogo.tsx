// Logo JWP dạng vector (react-native-svg) — cùng hình học với assets/splash-icon.png
// (logoGeometry.ts do scripts/gen-brand-assets.js sinh ra) → nối tiếp màn chờ native không bị "nhảy".
// Vẽ đồng bộ ngay khung hình đầu (không như <Image> phải giải mã ảnh) nên dùng được cho hiệu ứng mở app.
import { memo } from 'react';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { LOGO, LOGO_CANVAS } from './logoGeometry';

type BrandLogoProps = {
  /** Cạnh ô logo (dp) */
  size: number;
};

export const BrandLogo = memo(function BrandLogo({ size }: BrandLogoProps) {
  const { gradient, highlight, backCoin, frontCoin, j } = LOGO;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}`}>
      <Defs>
        <LinearGradient
          id="jwpTile"
          x1="0"
          y1="0"
          x2={LOGO_CANVAS}
          y2={LOGO_CANVAS}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={gradient.from} />
          <Stop offset="1" stopColor={gradient.to} />
        </LinearGradient>
        <RadialGradient
          id="jwpGlow"
          cx={highlight.cx}
          cy={highlight.cy}
          r={highlight.r}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={highlight.opacity} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={LOGO_CANVAS} height={LOGO_CANVAS} rx={LOGO.radius} fill="url(#jwpTile)" />
      <Rect width={LOGO_CANVAS} height={LOGO_CANVAS} rx={LOGO.radius} fill="url(#jwpGlow)" />
      <Circle
        cx={backCoin.cx}
        cy={backCoin.cy}
        r={backCoin.r}
        fill="#FFFFFF"
        fillOpacity={backCoin.opacity}
      />
      <Circle cx={frontCoin.cx} cy={frontCoin.cy} r={frontCoin.r} fill="#FFFFFF" />
      {/* Chữ J "khoét" trên đồng xu: tô lại đúng màu nền + quầng sáng (ảnh PNG dùng mask, kết quả như nhau) */}
      {['url(#jwpTile)', 'url(#jwpGlow)'].map((stroke) => (
        <Path
          key={stroke}
          d={j.d}
          fill="none"
          stroke={stroke}
          strokeWidth={j.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
});
