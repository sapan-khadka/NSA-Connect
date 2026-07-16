/**
 * Universal Details Panel — domain-agnostic composition primitives.
 *
 * The panel never knows Event / Member / Task / Finance / Announcement.
 * Pass content via children and typed props only.
 */

export { DetailsPanel } from "./DetailsPanel";
export { DetailsHeader } from "./DetailsHeader";
export { DetailsHero } from "./DetailsHero";
export { DetailsMetadata } from "./DetailsMetadata";
export type { DetailsMetadataItem } from "./DetailsMetadata";
export { DetailsSection } from "./DetailsSection";
export { DetailsStats } from "./DetailsStats";
export type { DetailsStatItem } from "./DetailsStats";
export { DetailsProgress } from "./DetailsProgress";
export type { DetailsProgressProps } from "./DetailsProgress";
export { DetailsTimeline } from "./DetailsTimeline";
export type { DetailsTimelineItem } from "./DetailsTimeline";
export {
  DetailsActions,
  DetailsActionButton,
  detailsActionClass,
} from "./DetailsActions";
export { DetailsEmptyState } from "./DetailsEmptyState";
export { DetailsSkeleton } from "./DetailsSkeleton";
