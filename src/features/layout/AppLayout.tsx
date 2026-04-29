import { useState, useEffect, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SearchPalette } from "@/features/search/SearchPalette";

/**
 * Top-level layout for authenticated routes. Renders the sidebar and a
 * main content area.
 *
 * Supports two usage patterns:
 *   1. As a React Router parent route — renders child routes via <Outlet />
 *   2. As a wrapper component — renders provided children (used for the
 *      authenticated dashboard at "/")
 *
 * The Cmd+K (or Ctrl+K) shortcut is wired here so it works app-wide.
 * The SearchPalette implements the actual search UX.
 */
export function AppLayout({ children }: { children?: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex w-full min-h-screen text-zinc-900 font-sans bg-white">
      <Sidebar onSearch={() => setSearchOpen(true)} />
      <main className="flex-1 min-w-0">
        {children ?? <Outlet />}
      </main>
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
}
