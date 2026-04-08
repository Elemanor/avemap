"use client";

import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db";

const categories: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "shoring", label: "Shoring" },
  { value: "scaffold", label: "Scaffold" },
  { value: "meva-panels", label: "Imperial Frames" },
];

interface CategoryTabsProps {
  value: Category | "all";
  onChange: (value: Category | "all") => void;
}

export function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-fit">
      {categories.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer",
            value === cat.value
              ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
