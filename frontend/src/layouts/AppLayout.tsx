import { NavLink, Outlet } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-accent font-medium"
    : "text-gray-600 hover:text-primary transition-colors";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="text-lg font-bold text-primary">
            NSA Connect
          </NavLink>
          <ul className="flex gap-6 text-sm">
            <li>
              <NavLink to="/" end className={navLinkClass}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/events" className={navLinkClass}>
                Events
              </NavLink>
            </li>
            <li>
              <NavLink to="/members" className={navLinkClass}>
                Members
              </NavLink>
            </li>
            <li>
              <NavLink to="/finance" className={navLinkClass}>
                Finance
              </NavLink>
            </li>
            <li>
              <NavLink to="/login" className={navLinkClass}>
                Login
              </NavLink>
            </li>
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <Outlet />
      </main>
    </div>
  );
}
