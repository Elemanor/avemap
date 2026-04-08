"use client";

import { useState } from "react";
import {
  ClipboardList,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  useTransactions,
  useLocations,
  useEquipmentItems,
} from "@/hooks/use-db";
import type { TransactionType, Location, EquipmentItem, Transaction } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export default function TransactionsPage() {
  const { data: transactions } = useTransactions();
  const { data: locations } = useLocations();
  const { data: items } = useEquipmentItems();

  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const itemMap = new Map<number, EquipmentItem>();
  items?.forEach((i) => itemMap.set(i.id!, i));

  function getItemDisplayName(itemId: number): string {
    const item = itemMap.get(itemId);
    if (!item) return "Unknown Item";
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      return parent ? `${parent.name} - ${item.name}` : item.name;
    }
    return item.name;
  }

  const locationMap = new Map<number, Location>();
  locations?.forEach((l) => locationMap.set(l.id!, l));

  const filtered = (transactions ?? []).filter((tx) => {
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    if (locationFilter !== "all") {
      const locId = parseInt(locationFilter);
      if (tx.fromLocationId !== locId && tx.toLocationId !== locId) return false;
    }
    if (search) {
      const item = itemMap.get(tx.itemId);
      if (!item?.name.toLowerCase().includes(search.toLowerCase())) {
        if (!tx.notes?.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
      }
    }
    return true;
  });

  // Group by date
  const groups = new Map<string, Transaction[]>();
  filtered.forEach((tx) => {
    const dateKey = new Date(tx.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const list = groups.get(dateKey) ?? [];
    list.push(tx);
    groups.set(dateKey, list);
  });

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transaction History</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Full log of all equipment movements
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as TransactionType | "all")
          }
          className="w-auto"
        >
          <option value="all">All Types</option>
          <option value="add">Additions</option>
          <option value="subtract">Removals</option>
          <option value="transfer">Transfers</option>
        </Select>
        <Select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Locations</option>
          {(locations ?? []).map((loc) => (
            <option key={loc.id} value={loc.id!.toString()}>
              {loc.name}
            </option>
          ))}
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search items or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No transactions found"
          description={
            transactions?.length
              ? "Try adjusting your filters."
              : "Transactions will appear here when you add, remove, or transfer equipment."
          }
        />
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([dateKey, txList]) => (
            <div key={dateKey} className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-500 px-1 sticky top-0 bg-white dark:bg-zinc-950 py-1 z-10">
                {dateKey}
              </h2>
              {txList.map((tx) => {
                const item = itemMap.get(tx.itemId);
                const from = tx.fromLocationId
                  ? locationMap.get(tx.fromLocationId)
                  : null;
                const to = tx.toLocationId
                  ? locationMap.get(tx.toLocationId)
                  : null;

                return (
                  <Card key={tx.id}>
                    <CardContent className="flex items-start gap-3 py-3 px-4">
                      <div className="shrink-0 mt-0.5">
                        {tx.type === "add" && (
                          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <ArrowDownRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        )}
                        {tx.type === "subtract" && (
                          <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                        )}
                        {tx.type === "transfer" && (
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <ArrowLeftRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {getItemDisplayName(tx.itemId)}
                          </p>
                          <Badge
                            variant={
                              tx.type === "add"
                                ? "success"
                                : tx.type === "subtract"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px] uppercase tracking-wider shrink-0"
                          >
                            {tx.type === "add"
                              ? `+${tx.quantity}`
                              : tx.type === "subtract"
                              ? `-${tx.quantity}`
                              : tx.quantity}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {tx.type === "transfer"
                            ? `${from?.name ?? "?"} → ${to?.name ?? "?"}`
                            : tx.type === "add"
                            ? `Added to ${to?.name ?? "?"}`
                            : `Removed from ${from?.name ?? "?"}`}
                        </p>
                        {tx.notes && (
                          <p className="text-xs text-zinc-400 mt-1 italic">
                            {tx.notes}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 shrink-0">
                        {new Date(tx.date).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
