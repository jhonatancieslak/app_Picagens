// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Ícones em traço (mesmos desenhos do protótipo v4) e o visto de sucesso (Font Awesome 6 "check").
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  size: number;
  color: string;
}

export const KeypadIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Rect x={5} y={3} width={14} height={18} rx={3} />
    <Path strokeLinecap="round" strokeWidth={2.6} d="M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M12 16h.01" />
  </Svg>
);

export const CameraIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <Circle cx={12} cy={13} r={3.5} />
  </Svg>
);

export const CloudIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 7.9" />
    <Path d="M12 13v8M9 18l3 3 3-3" />
  </Svg>
);

export const LockIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Rect x={5} y={11} width={14} height={10} rx={2} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);

export const ExitIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M10 4H5v16h5M9 12h11M16 8l4 4-4 4" />
  </Svg>
);

export const GearIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Circle cx={12} cy={12} r={3} />
    <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);

export const CheckIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 448 512">
    <Path
      fill={color}
      d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"
    />
  </Svg>
);

export const PhoneIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Rect x={6} y={2} width={12} height={20} rx={3} />
    <Path strokeLinecap="round" d="M11 18h2" />
  </Svg>
);

export const LocationIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <Circle cx={12} cy={9.5} r={2.5} />
  </Svg>
);

export const EntryIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 4h5v16h-5M3 12h11M10 8l4 4-4 4" />
  </Svg>
);

export const PauseIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <Path d="M9 6v12M15 6v12" />
  </Svg>
);

export const PlayIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </Svg>
);

export const HomeIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
    <Path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />
  </Svg>
);

export const ListIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Rect x={4} y={4} width={16} height={17} rx={2} />
    <Path strokeLinecap="round" d="M8 2v4M16 2v4M4 10h16M8 14h3M8 17h6" />
  </Svg>
);

export const UserIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Circle cx={12} cy={8} r={4} />
    <Path strokeLinecap="round" d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
  </Svg>
);

export const TabletIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Rect x={3} y={5} width={18} height={14} rx={2} />
    <Path strokeLinecap="round" strokeWidth={2.6} d="M12 16h.01" />
  </Svg>
);

export const KeyIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Circle cx={8} cy={15} r={4} />
    <Path d="M11 12l9-9M17 6l3 3" />
  </Svg>
);

export const MailIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Rect x={3} y={5} width={18} height={14} rx={2} />
    <Path d="M3 7l9 6 9-6" />
  </Svg>
);

export const QrIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Rect x={3} y={3} width={7} height={7} rx={1.5} />
    <Rect x={14} y={3} width={7} height={7} rx={1.5} />
    <Rect x={3} y={14} width={7} height={7} rx={1.5} />
    <Path d="M14 14h3v3M21 14v.01M17 21h4v-4M14 21v-3" />
  </Svg>
);

export const ClipboardIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
    <Rect x={8} y={3} width={8} height={4} rx={1.5} />
    <Path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
  </Svg>
);

export const ShieldIcon = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" />
    <Path d="M8.5 12l2.5 2.5 4.5-5" />
  </Svg>
);
