// Logo JWP "Dòng lương" dạng vector (react-native-svg) — cùng hình học với assets/splash-icon.png
// (logoGeometry.ts do scripts/gen-brand-assets.js sinh ra) → nối tiếp màn chờ native không bị "nhảy".
// Vẽ đồng bộ ngay khung hình đầu (không như <Image> phải giải mã ảnh) nên dùng được cho hiệu ứng mở app.
import { memo, type ReactNode } from 'react';
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

/** Nền ô logo: chàm đậm → tím, quầng sáng góc trên, ánh ngọc góc dưới */
export function LogoTile() {
  const { gradient, highlight, glow } = LOGO;
  return (
    <>
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
        <RadialGradient
          id="jwpAqua"
          cx={glow.cx}
          cy={glow.cy}
          r={glow.r}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity} />
          <Stop offset="1" stopColor={glow.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={LOGO_CANVAS} height={LOGO_CANVAS} rx={LOGO.radius} fill="url(#jwpTile)" />
      <Rect width={LOGO_CANVAS} height={LOGO_CANVAS} rx={LOGO.radius} fill="url(#jwpGlow)" />
      <Rect width={LOGO_CANVAS} height={LOGO_CANVAS} rx={LOGO.radius} fill="url(#jwpAqua)" />
    </>
  );
}

export function LogoSvg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}`}>
      {children}
    </Svg>
  );
}

type BrandLogoProps = {
  /** Cạnh ô logo (dp) */
  size: number;
};

export const BrandLogo = memo(function BrandLogo({ size }: BrandLogoProps) {
  const { j, head, drops, amber } = LOGO;
  return (
    <LogoSvg size={size}>
      <LogoTile />
      <Path
        d={j.d}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={j.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {drops.map((p) => (
        <Circle key={p.cx} cx={p.cx} cy={p.cy} r={p.r} fill="#FFFFFF" fillOpacity={p.opacity} />
      ))}
      <Circle cx={head.cx} cy={head.cy} r={head.r} fill={amber} />
    </LogoSvg>
  );
});
