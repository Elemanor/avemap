"use client";

import { useInit } from "@/hooks/use-db";
import { Sidebar, BottomNav } from "@/components/nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useInit();

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
          <p className="text-sm text-zinc-500">Loading AVEMAP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-20 lg:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
