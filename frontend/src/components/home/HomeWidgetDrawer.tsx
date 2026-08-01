import { Check, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  HOME_WIDGET_CATEGORY_ORDER,
  type HomeWidgetCategory,
  type HomeWidgetId,
  type HomeWidgetMeta,
} from "../../lib/home-workspace";
import { AppIcon } from "../ui/AppIcon";

type HomeWidgetDrawerProps = {
  open: boolean;
  catalog: HomeWidgetMeta[];
  isHidden: (id: HomeWidgetId) => boolean;
  onToggle: (id: HomeWidgetId) => void;
  onClose: () => void;
};

export function HomeWidgetDrawer({
  open,
  catalog,
  isHidden,
  onToggle,
  onClose,
}: HomeWidgetDrawerProps) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? catalog.filter((item) => item.label.toLowerCase().includes(q))
      : catalog;

    const sections: Array<{ category: HomeWidgetCategory; items: HomeWidgetMeta[] }> =
      [];
    for (const category of HOME_WIDGET_CATEGORY_ORDER) {
      const items = matched.filter((item) => item.category === category);
      if (items.length > 0) {
        sections.push({ category, items });
      }
    }
    return sections;
  }, [catalog, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="home-widget-drawer" role="dialog" aria-modal="true" aria-label="Widgets">
      <button
        type="button"
        className="home-widget-drawer__backdrop"
        aria-label="Close widgets"
        onClick={onClose}
      />
      <aside className="home-widget-drawer__panel">
        <header className="home-widget-drawer__head">
          <h2 className="home-widget-drawer__title">Widgets</h2>
          <button
            type="button"
            className="home-widget-drawer__icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <AppIcon icon={X} size="sm" className="text-current" />
          </button>
        </header>

        <label className="home-widget-drawer__search">
          <AppIcon icon={Search} size="sm" className="text-current" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            data-drawer-initial-focus
          />
        </label>

        <div className="home-widget-drawer__divider" aria-hidden="true" />

        <div className="home-widget-drawer__sections">
          {grouped.map((section) => (
            <section key={section.category} className="home-widget-drawer__section">
              <h3 className="home-widget-drawer__section-title">
                {section.category}
              </h3>
              <ul className="home-widget-drawer__list">
                {section.items.map((item) => {
                  const visible = !isHidden(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={[
                          "home-widget-drawer__row",
                          visible ? "is-visible" : "is-hidden",
                        ].join(" ")}
                        onClick={() => onToggle(item.id)}
                      >
                        <span
                          className="home-widget-drawer__row-mark"
                          aria-hidden="true"
                        >
                          {visible ? (
                            <AppIcon icon={Check} size="sm" className="text-current" />
                          ) : (
                            <AppIcon icon={Plus} size="sm" className="text-current" />
                          )}
                        </span>
                        <span className="home-widget-drawer__row-label">
                          {item.label}
                        </span>
                        <span className="sr-only">
                          {visible ? `Hide ${item.label}` : `Show ${item.label}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {grouped.length === 0 ? (
          <p className="home-widget-drawer__empty">No widgets match.</p>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
