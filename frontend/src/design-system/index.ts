export {
  colors,
  spacing,
  spacingScale,
  radii,
  shadows,
  motion,
  typography,
  layout,
} from "./tokens";
export type {
  ColorTokens,
  SpacingToken,
  RadiusToken,
  TypographySize,
} from "./tokens";

export { typeClass, fontFamilySans } from "./typography";
export type { TypeClassKey } from "./typography";

export { spaceClass, spacePx } from "./spacing";
export { cx } from "./cx";

/** CampusOS component library (canonical). Existing `components/ui/*` left intact. */
export {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Badge,
  Avatar,
  Divider,
  Skeleton,
  Spinner,
  fieldControlClassName,
} from "./components";

export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  CardProps,
  CardVariant,
  CardPadding,
  InputProps,
  TextareaProps,
  SelectProps,
  SelectOption,
  BadgeProps,
  BadgeVariant,
  BadgeSize,
  AvatarProps,
  AvatarSize,
  DividerProps,
  DividerOrientation,
  SkeletonProps,
  SkeletonVariant,
  SpinnerProps,
  SpinnerSize,
} from "./components";
