import { type ReactNode } from "react";
import { Link, NavLink } from "react-router";

import nsaEmblem from "../assets/nsa-emblem.png";

export function isGuestMarketingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email"
  );
}

type GuestChromeProps = {
  pathname: string;
  children: ReactNode;
};

export function GuestChrome({ pathname, children }: GuestChromeProps) {
  const loginCurrent = pathname === "/" || pathname === "/login";

  return (
    <div className="guest-shell">
      <GuestBackdrop />
      <header className="guest-header">
        <Link to="/" className="guest-brand">
          <span className="guest-brand-mark">
            <img src={nsaEmblem} alt="" width={40} height={40} />
          </span>
          <span>NSA Connect</span>
        </Link>
        <nav className="guest-nav" aria-label="Account">
          <NavLink
            to="/login"
            className={() =>
              ["guest-nav-link", loginCurrent ? "is-current" : ""].join(" ")
            }
          >
            Login
          </NavLink>
          <NavLink
            to="/register"
            className={({ isActive }) =>
              ["guest-nav-link", isActive ? "is-current" : ""].join(" ")
            }
          >
            Register
          </NavLink>
        </nav>
      </header>
      <main className="guest-main">{children}</main>
      <footer className="guest-footer">
        <p>© 2026 NSA Connect. All rights reserved.</p>
      </footer>
    </div>
  );
}

function GuestBackdrop() {
  return (
    <div className="guest-backdrop" aria-hidden="true">
      <svg
        className="guest-backdrop-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="none" stroke="#edc4cb" strokeWidth="1.15">
          <path d="M-60 390C160 270 280 540 500 400C720 260 880 530 1160 370C1360 260 1480 400 1620 330" />
          <path d="M-60 445C180 325 300 595 520 455C740 315 900 585 1180 425C1380 315 1500 455 1620 385" />
          <path d="M-60 500C200 380 320 650 540 510C760 370 920 640 1200 480C1400 370 1520 510 1620 440" />
          <path d="M-80 640C140 530 320 790 560 640C800 490 1000 760 1280 600C1460 500 1560 650 1680 580" />
          <path d="M-80 700C160 590 340 850 580 700C820 550 1020 820 1300 660C1480 560 1580 710 1680 640" />
          <path d="M-80 760C180 650 360 910 600 760C840 610 1040 880 1320 720C1500 620 1600 770 1680 700" />
        </g>
        <g fill="#d0d0d0">
          {Array.from({ length: 5 }, (_, row) =>
            Array.from({ length: 6 }, (_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={92 + col * 14}
                cy={248 + row * 14}
                r="1.2"
              />
            )),
          )}
        </g>
      </svg>
    </div>
  );
}
