import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

type PageTransitionProps = {
  children: ReactNode;
};

/**
 * Lightweight route enter animation for the main canvas.
 * Respects `prefers-reduced-motion`. Does not alter page content.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = regionRef.current;
    if (!node) {
      return;
    }
    node.classList.remove("ds-page-transition--run");
    // Force reflow so the enter animation restarts on each navigation.
    void node.offsetWidth;
    node.classList.add("ds-page-transition--run");
  }, [location.pathname, location.search]);

  return (
    <div
      ref={regionRef}
      className="ds-page-transition"
      data-pathname={location.pathname}
    >
      {children}
    </div>
  );
}
