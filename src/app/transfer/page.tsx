"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeftRight,
  Check,
  Package,
  Search,
  Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CategoryTabs } from "@/components/category-tabs";
import { EmptyState } from "@/components/empty-state";
import {
  useLocations,
  useInventoryAtLocation,
  useEquipmentItems,
  transferEquipment,
  createDeliveryOrder,
} from "@/hooks/use-db";
import type { Category, EquipmentItem, Inventory } from "@/lib/db";

function TransferPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedFrom = searchParams.get("from");

  const { data: locations } = useLocations();
  const { data: allItems } = useEquipmentItems();

  const [fromId, setFromId] = useState<string>(preselectedFrom ?? "");
  const [toId, setToId] = useState<string>("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<
    Map<number, { quantity: number; item: EquipmentItem }>
  >(new Map());
  const [notes, setNotes] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [done, setDone] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [creatingDO, setCreatingDO] = useState(false);

  const fromLocationId = fromId ? parseInt(fromId) : 0;
  const { data: sourceInventory, refresh: refreshSource } =
    useInventoryAtLocation(fromLocationId);

  const itemMap = new Map<number, EquipmentItem>();
  allItems?.forEach((i) => itemMap.set(i.id!, i));

  const invMap = new Map<number, Inventory>();
  sourceInventory?.forEach((inv) => invMap.set(inv.itemId, inv));

  // Build parent→children map
  const childrenMap = new Map<number, EquipmentItem[]>();
  (allItems ?? []).forEach((item) => {
    if (item.parentId) {
      const list = childrenMap.get(item.parentId) ?? [];
      list.push(item);
      childrenMap.set(item.parentId, list);
    }
  });

  // Items available at source with quantity > 0
  const availableItems = (allItems ?? []).filter((item) => {
    const inv = invMap.get(item.id!);
    if (!inv || inv.quantity <= 0) return false;
    const matchesCat = category === "all" || item.category === category;
    const matchesSearch =
      !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Group available items: parent headers for sub-items
  type DisplayEntry = { type: "header"; name: string } | { type: "item"; item: EquipmentItem };
  const displayEntries: DisplayEntry[] = [];
  const seenParents = new Set<number>();
  availableItems.forEach((item) => {
    if (item.parentId) {
      if (!seenParents.has(item.parentId)) {
        seenParents.add(item.parentId);
        const parent = itemMap.get(item.parentId);
        if (parent) displayEntries.push({ type: "header", name: parent.name });
      }
      displayEntries.push({ type: "item", item });
    } else {
      // Only show standalone parents (not parent headers for items already listed as children)
      const children = childrenMap.get(item.id!) ?? [];
      const hasAvailableChildren = children.some((c) => {
        const inv = invMap.get(c.id!);
        return inv && inv.quantity > 0;
      });
      if (!hasAvailableChildren) {
        displayEntries.push({ type: "item", item });
      }
      // If it has available children, they'll add the header themselves
    }
  });

  /** Get display name: prefix with parent name for sub-items */
  function getDisplayName(item: EquipmentItem): string {
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      return parent ? `${parent.name} - ${item.name}` : item.name;
    }
    return item.name;
  }

  const activeLocations =
    locations?.filter((l) => l.status === "active") ?? [];

  function toggleItem(item: EquipmentItem) {
    const next = new Map(selected);
    if (next.has(item.id!)) {
      next.delete(item.id!);
    } else {
      next.set(item.id!, { quantity: 1, item });
    }
    setSelected(next);
  }

  function updateQuantity(itemId: number, qty: number) {
    const next = new Map(selected);
    const entry = next.get(itemId);
    if (entry) {
      const maxQty = invMap.get(itemId)?.quantity ?? 0;
      entry.quantity = Math.max(1, Math.min(qty, maxQty));
      next.set(itemId, entry);
    }
    setSelected(next);
  }

  async function handleTransfer() {
    if (!fromId || !toId || selected.size === 0) return;
    setTransferring(true);
    try {
      for (const [itemId, { quantity }] of selected.entries()) {
        await transferEquipment(
          parseInt(fromId),
          parseInt(toId),
          itemId,
          quantity,
          notes || undefined
        );
      }
      setDone(true);
      refreshSource();
    } finally {
      setTransferring(false);
    }
  }

  async function handlePrintDO() {
    setCreatingDO(true);
    try {
      const doItems = Array.from(selected.entries()).map(([itemId, { quantity, item }]) => ({
        itemId,
        name: getDisplayName(item),
        unit: item.unit,
        quantity,
      }));
      const doId = await createDeliveryOrder({
        date: new Date(),
        fromLocationId: parseInt(fromId),
        toLocationId: parseInt(toId),
        items: doItems,
        driverName: driverName || undefined,
        notes: notes || undefined,
      });
      window.open(`/delivery-order/${doId}`, "_blank");
    } finally {
      setCreatingDO(false);
    }
  }

  if (done) {
    const fromLoc = locations?.find((l) => l.id === parseInt(fromId));
    const toLoc = locations?.find((l) => l.id === parseInt(toId));
    return (
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Transfer Complete</h2>
            <p className="text-sm text-zinc-500 mb-1">
              {selected.size} item type{selected.size > 1 ? "s" : ""}{" "}
              transferred
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              {fromLoc?.name} → {toLoc?.name}
            </p>

            <div className="w-full max-w-xs mb-4 text-left">
              <label className="text-sm font-medium mb-1.5 block">
                Driver Name (optional)
              </label>
              <Input
                placeholder="Enter driver name..."
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setDone(false);
                  setSelected(new Map());
                  setNotes("");
                  setDriverName("");
                }}
              >
                New Transfer
              </Button>
              <Button variant="outline" onClick={() => router.push("/transactions")}>
                View History
              </Button>
              <Button onClick={handlePrintDO} disabled={creatingDO}>
                <Printer className="h-4 w-4" />
                {creatingDO ? "Creating..." : "Print Delivery Order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transfer Equipment</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Move equipment between locations
        </p>
      </div>

      {/* Source → Destination */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="grid sm:grid-cols-[1fr,auto,1fr] gap-3 items-end">
            <div>
              <label className="text-sm font-medium mb-1.5 block">From</label>
              <Select
                value={fromId}
                onChange={(e) => {
                  setFromId(e.target.value);
                  setSelected(new Map());
                }}
              >
                <option value="">Select source...</option>
                {activeLocations.map((loc) => (
                  <option key={loc.id} value={loc.id!.toString()}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-center py-2">
              <ArrowRight className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">To</label>
              <Select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
              >
                <option value="">Select destination...</option>
                {activeLocations
                  .filter((l) => l.id!.toString() !== fromId)
                  .map((loc) => (
                    <option key={loc.id} value={loc.id!.toString()}>
                      {loc.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Item Selection */}
      {fromId ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <CategoryTabs value={category} onChange={setCategory} />
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {availableItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No equipment available"
              description="This location has no equipment to transfer."
            />
          ) : (
            <div className="space-y-2">
              {displayEntries.map((entry, idx) => {
                if (entry.type === "header") {
                  return (
                    <p key={`hdr-${idx}`} className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-3 pb-1 px-1">
                      {entry.name}
                    </p>
                  );
                }
                const item = entry.item;
                const inv = invMap.get(item.id!);
                const maxQty = inv?.quantity ?? 0;
                const sel = selected.get(item.id!);
                const isSelected = !!sel;
                return (
                  <Card
                    key={item.id}
                    className={
                      isSelected
                        ? "border-zinc-900 dark:border-zinc-100"
                        : ""
                    }
                  >
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <button
                        onClick={() => toggleItem(item)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100"
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-white dark:text-zinc-900" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {item.parentId ? item.name : getDisplayName(item)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Available: {maxQty} {item.unit}
                          </p>
                        </div>
                      </button>
                      {isSelected && (
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <Input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={sel.quantity}
                            onChange={(e) =>
                              updateQuantity(item.id!, parseInt(e.target.value) || 1)
                            }
                            className="w-20 h-8 text-center"
                          />
                          <span className="text-xs text-zinc-500">
                            / {maxQty}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Transfer Summary */}
          {selected.size > 0 && (
            <Card className="sticky bottom-20 lg:bottom-4">
              <CardContent className="py-4 px-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {selected.size} item type{selected.size > 1 ? "s" : ""}{" "}
                    selected
                  </p>
                  <p className="text-sm text-zinc-500">
                    Total:{" "}
                    {Array.from(selected.values()).reduce(
                      (s, v) => s + v.quantity,
                      0
                    )}{" "}
                    pcs
                  </p>
                </div>
                <Textarea
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
                <Button
                  className="w-full"
                  onClick={handleTransfer}
                  disabled={!toId || transferring}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  {transferring
                    ? "Transferring..."
                    : !toId
                    ? "Select destination"
                    : "Confirm Transfer"}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          icon={ArrowLeftRight}
          title="Select a source location"
          description="Choose where you want to transfer equipment from."
        />
      )}
    </div>
  );
}

export default function TransferPage() {
  return (
    <Suspense>
      <TransferPageInner />
    </Suspense>
  );
}
