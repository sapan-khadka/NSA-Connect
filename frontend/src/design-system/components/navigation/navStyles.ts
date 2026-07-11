/**
 * Shared navigation interaction classes (hover, active, focus).
 */

export const navFocusRingClass =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card";

export const navItemMotionClass =
  "transition-[background-color,color,transform,box-shadow,opacity] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none";

export const sidebarItemBaseClass = [
  "group relative ds-icon-label w-full gap-2.5 rounded-card px-2.5 py-2 text-sm font-medium text-foreground",
  navItemMotionClass,
  navFocusRingClass,
].join(" ");

export const sidebarItemActiveClass =
  "bg-badge-teal-bg font-semibold text-primary shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:transition-transform before:duration-200";

export const sidebarItemIdleClass =
  "hover:translate-x-0.5 hover:bg-surface-muted hover:text-foreground active:scale-[0.99] motion-reduce:active:scale-100";
