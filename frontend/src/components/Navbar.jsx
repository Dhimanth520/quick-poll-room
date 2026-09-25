import { Link, NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-white/45 backdrop-blur-lg">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow-md shadow-violet-600/30 transition-transform duration-200 group-hover:-translate-y-0.5">
            Q
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-800 transition-colors duration-200 group-hover:text-violet-700 sm:text-base">
            Quick-Poll Room
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              [
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:outline-none",
                isActive ? "text-violet-700" : "text-slate-600",
              ].join(" ")
            }
          >
            New poll
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
