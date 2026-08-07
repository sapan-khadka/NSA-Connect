import { GripVertical, MoreHorizontal } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  WIDGET_SIZE_PRESET_LABEL,
  getHomeWidgetMeta,
  type HomeWidgetId,
  type ResizeHandle,
  type WidgetDensity,
  type WidgetSizePreset,
} from "../../lib/home-workspace";
import { AppIcon } from "../ui/AppIcon";

function homeWeightFor(id: HomeWidgetId): "hero" | "medium" | "light" {
  if (id === "featured") {
    return "hero";
  }
  if (id === "tasks" || id === "inbox" || id === "activity" || id === "overview") {
    return "medium";
  }
  return "light";
}

type HomeWidgetShellProps = {
  id: HomeWidgetId;
  density: WidgetDensity;
  style: CSSProperties;
  collapsed?: boolean;
  active?: boolean;
  selected?: boolean;
  isCustomizing?: boolean;
  sizePreset?: WidgetSizePreset;
  sizeLabel?: string | null;
  screenWidth?: number;
  screenHeight?: number;
  onSelect: () => void;
  onEnterCustomize: () => void;
  onToggleCollapsed: () => void;
  onHide: () => void;
  onCycleSize: () => void;
  onDragPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onResizePointerDown: (
    handle: ResizeHandle,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  children: ReactNode;
};

export function HomeWidgetShell({
  id,
  density,
  style,
  collapsed = false,
  active = false,
  selected = false,
  isCustomizing = false,
  sizePreset = "md",
  sizeLabel = null,
  screenWidth,
  screenHeight,
  onSelect,
  onEnterCustomize,
  onToggleCollapsed,
  onHide,
  onCycleSize,
  onDragPointerDown,
  onResizePointerDown,
  children,
}: HomeWidgetShellProps) {
  const meta = getHomeWidgetMeta(id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const cssVars = {
    ...style,
    ...(screenWidth != null ? { ["--hw" as string]: `${screenWidth}px` } : {}),
    ...(screenHeight != null ? { ["--hh" as string]: `${screenHeight}px` } : {}),
  } as CSSProperties;

  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(false);
    if (!isCustomizing) {
      onEnterCustomize();
    }
    onSelect();
    onDragPointerDown(event);
  }

  return (
    <div
      ref={rootRef}
      className={[
        "home-widget",
        collapsed ? "is-collapsed" : "",
        active ? "is-active" : "",
        selected ? "is-selected" : "",
        isCustomizing ? "is-customizing" : "",
        menuOpen ? "is-menu-open" : "",
        `is-density-${density}`,
      ]
        .filter(Boolean)
        .join(" ")}
      data-widget={id}
      data-home-weight={homeWeightFor(id)}
      data-density={density}
      style={cssVars}
      onPointerDown={isCustomizing ? onSelect : undefined}
    >
      <div className="home-widget__chrome">
        <button
          type="button"
          className="home-widget__drag"
          aria-label={`Move ${meta.label}`}
          title="Drag to move"
          onPointerDown={startDrag}
        >
          <AppIcon icon={GripVertical} size="sm" className="text-current" />
        </button>

        <button
          type="button"
          className="home-widget__menu-btn"
          aria-label={`${meta.label} options`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <AppIcon icon={MoreHorizontal} size="sm" className="text-current" />
        </button>

        {menuOpen ? (
          <div className="home-widget__menu" id={menuId} role="menu">
            <button
              type="button"
              role="menuitem"
              onPointerDown={startDrag}
            >
              Move
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                onEnterCustomize();
                onSelect();
                onCycleSize();
                setMenuOpen(false);
              }}
            >
              Resize
              <span>{WIDGET_SIZE_PRESET_LABEL[sizePreset]}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapsed();
                setMenuOpen(false);
              }}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              onClick={(event) => {
                event.stopPropagation();
                onHide();
                setMenuOpen(false);
              }}
            >
              Hide
            </button>
          </div>
        ) : null}
      </div>

      {isCustomizing && sizeLabel ? (
        <div className="home-widget__size-badge" aria-live="polite">
          {sizeLabel}
        </div>
      ) : null}

      {collapsed ? (
        <div className="home-widget__collapsed">
          <p className="home-widget__collapsed-title">{meta.label}</p>
          {isCustomizing ? (
            <button
              type="button"
              className="home-widget__collapsed-action"
              onClick={onToggleCollapsed}
            >
              Expand
            </button>
          ) : null}
        </div>
      ) : (
        <div className="home-widget__body">{children}</div>
      )}

      {!collapsed ? (
        <button
          type="button"
          className="home-widget__resize home-widget__resize--se"
          aria-label={`Resize ${meta.label}`}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setMenuOpen(false);
            if (!isCustomizing) {
              onEnterCustomize();
            }
            onSelect();
            onResizePointerDown("se", event);
          }}
        />
      ) : null}
    </div>
  );
}
