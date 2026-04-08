"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin,
  Package,
  ArrowLeftRight,
  Clock,
  Plus,
  ChevronRight,
  Warehouse,
  HardHat,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useLocations,
  useTransactions,
  useEquipmentItems,
} from "@/hooks/use-db";
import {
  db,
  type Location,
  type EquipmentItem,
  type Transaction,
} from "@/lib/db";
import { timeAgo } from "@/lib/utils";

interface LocationSummary {
  location: Location;
  totalItems: number;
  totalQuantity: number;
}

export default function DashboardPage() {
  const { data: locations } = useLocations();
  const { data: transactions } = useTransactions(10);
  const { data: items } = useEquipmentItems();
  const [summaries, setSummaries] = useState<LocationSummary[]>([]);

  useEffect(() => {
    if (!locations) return;
    Promise.all(
      locations
        .filter((l) => l.status === "active")
        .map(async (location) => {
          const inv = await db.inventory
            .where("locationId")
            .equals(location.id!)
            .toArray();
          return {
            location,
            totalItems: inv.filter((i) => i.quantity > 0).length,
            totalQuantity: inv.reduce((s, i) => s + i.quantity, 0),
          };
        })
    ).then(setSummaries);
  }, [locations]);

  const itemMap = new Map<number, EquipmentItem>();
  items?.forEach((i) => itemMap.set(i.id!, i));

  const locationMap = new Map<number, Location>();
  locations?.forEach((l) => locationMap.set(l.id!, l));

  const activeLocations = locations?.filter((l) => l.status === "active") ?? [];
  const totalEquipment = summaries.reduce((s, l) => s + l.totalQuantity, 0);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Equipment overview across all locations
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={MapPin}
          label="Active Sites"
          value={activeLocations.length}
        />
        <StatCard
          icon={Package}
          label="Total Equipment"
          value={totalEquipment}
        />
        <StatCard
          icon={HardHat}
          label="Item Types"
          value={items?.length ?? 0}
        />
        <StatCard
          icon={ArrowLeftRight}
          label="Transactions"
          value={transactions?.length ?? 0}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/locations">
          <Button variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5" />
            Add Location
          </Button>
        </Link>
        <Link href="/transfer">
          <Button variant="outline" size="sm">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transfer Equipment
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Location Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Locations</h2>
            <Link
              href="/locations"
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              View all
            </Link>
          </div>
          {summaries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-zinc-500">
                No active locations yet.{" "}
                <Link href="/locations" className="text-zinc-900 underline dark:text-zinc-100">
                  Add one
                </Link>
              </CardContent>
            </Card>
          ) : (
            summaries.map((s) => (
              <Link key={s.location.id} href={`/locations/${s.location.id}`}>
                <Card className="hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer">
                  <CardContent className="flex items-center justify-between py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        {s.location.type === "yard" ? (
                          <Warehouse className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        ) : (
                          <MapPin className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{s.location.name}</p>
                        <p className="text-xs text-zinc-500">
                          {s.totalItems} items &middot; {s.totalQuantity} pcs
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        {/* Recent Transactions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent Activity</h2>
            <Link
              href="/transactions"
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              View all
            </Link>
          </div>
          {!transactions || transactions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-zinc-500">
                No transactions yet. Start by adding equipment to a location.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 8).map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  itemMap={itemMap}
                  locationMap={locationMap}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4 px-4">
        <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
        </div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({
  tx,
  itemMap,
  locationMap,
}: {
  tx: Transaction;
  itemMap: Map<number, EquipmentItem>;
  locationMap: Map<number, Location>;
}) {
  const item = itemMap.get(tx.itemId);
  const from = tx.fromLocationId ? locationMap.get(tx.fromLocationId) : null;
  const to = tx.toLocationId ? locationMap.get(tx.toLocationId) : null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <Badge
            variant={
              tx.type === "add"
                ? "success"
                : tx.type === "subtract"
                ? "destructive"
                : "secondary"
            }
            className="shrink-0 text-[10px] uppercase tracking-wider"
          >
            {tx.type}
          </Badge>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {item?.name ?? "Unknown"} &times; {tx.quantity}
            </p>
            <p className="text-xs text-zinc-500 truncate">
              {tx.type === "transfer"
                ? `${from?.name ?? "?"} → ${to?.name ?? "?"}`
                : tx.type === "add"
                ? to?.name ?? ""
                : from?.name ?? ""}
            </p>
          </div>
        </div>
        <span className="text-xs text-zinc-400 shrink-0 ml-2">
          {timeAgo(tx.date)}
        </span>
      </CardContent>
    </Card>
  );
}
