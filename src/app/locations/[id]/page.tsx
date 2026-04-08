"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Minus,
  ArrowLeftRight,
  Package,
  Search,
  Box,
  Layers,
  LayoutGrid,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { CategoryTabs } from "@/components/category-tabs";
import { EmptyState } from "@/components/empty-state";
import {
  useLocation,
  useInventoryAtLocation,
  useEquipmentItems,
  useEquipmentImages,
  adjustInventory,
  deleteEquipmentItem,
} from "@/hooks/use-db";
import type { Category, EquipmentItem, Inventory } from "@/lib/db";

function getStaticImage(name: string, category: Category): string | undefined {
  if (category === "meva-panels") return "/products/meva-panels/imperial-panel.jpg";
  if (category !== "scaffold" && category !== "shoring") return undefined;
  const slug = name
    .toLowerCase()
    .replace(/[()&]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const folder = category === "scaffold" ? "scaffold" : "shoring";
  return `/products/${folder}/${slug}.jpg`;
}

export default function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const locationId = parseInt(id);
  const { data: location } = useLocation(locationId);
  const { data: inventory, refresh: refreshInventory } =
    useInventoryAtLocation(locationId);
  const { data: allItems, refresh: refreshItems } = useEquipmentItems();

  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const imageUrls = useEquipmentImages(
    (allItems ?? []).map((i) => i.id!).filter(Boolean)
  );

  const itemMap = new Map<number, EquipmentItem>();
  allItems?.forEach((i) => itemMap.set(i.id!, i));

  const invMap = new Map<number, Inventory>();
  inventory?.forEach((inv) => invMap.set(inv.itemId, inv));

  // Build parent→children map
  const childrenMap = new Map<number, EquipmentItem[]>();
  (allItems ?? []).forEach((item) => {
    if (item.parentId) {
      const list = childrenMap.get(item.parentId) ?? [];
      list.push(item);
      childrenMap.set(item.parentId, list);
    }
  });

  // Filter: only top-level items, match search on parent or child name
  const displayItems = (allItems ?? []).filter((item) => {
    if (item.parentId) return false;
    const matchesCategory = category === "all" || item.category === category;
    if (!matchesCategory) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    if (item.name.toLowerCase().includes(q)) return true;
    const children = childrenMap.get(item.id!) ?? [];
    return children.some((c) => c.name.toLowerCase().includes(q));
  });

  function openAdjust(item: EquipmentItem, type: "add" | "subtract") {
    setSelectedItem(item);
    setAdjustType(type);
    setQuantity("");
    setNotes("");
    setShowAdjust(true);
  }

  async function handleAdjust() {
    if (!selectedItem?.id || !quantity) return;
    const qty = parseInt(quantity);
    if (qty <= 0) return;
    await adjustInventory(locationId, selectedItem.id, qty, adjustType, notes || undefined);
    setShowAdjust(false);
    refreshInventory();
  }

  async function handleDelete(id: number) {
    const children = childrenMap.get(id) ?? [];
    const childMsg = children.length > 0 ? ` and its ${children.length} variant(s)` : "";
    if (confirm(`Delete this equipment item${childMsg}? All inventory and transaction records will also be removed.`)) {
      await deleteEquipmentItem(id);
      refreshItems();
      refreshInventory();
    }
  }

  if (!location) {
    return (
      <div className="p-4 lg:p-8">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/locations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Locations
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {location.name}
              </h1>
              <Badge variant="secondary">{location.type}</Badge>
            </div>
            {location.address && (
              <p className="text-zinc-500 text-sm mt-1">{location.address}</p>
            )}
          </div>
          <Link href={`/transfer?from=${locationId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transfer
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
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

      {/* Inventory Grid */}
      {displayItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No matching items"
          description="Try a different search term or category."
        />
      ) : (
        <div className="space-y-4">
          {(() => {
            // Group items into sections: consecutive standalone items share a grid,
            // parents with children get their own section
            const sections: ({ type: "grid"; items: EquipmentItem[] } | { type: "parent"; item: EquipmentItem; children: EquipmentItem[] })[] = [];
            displayItems.forEach((item) => {
              const children = childrenMap.get(item.id!) ?? [];
              if (children.length > 0) {
                sections.push({ type: "parent", item, children });
              } else {
                const last = sections[sections.length - 1];
                if (last && last.type === "grid") {
                  last.items.push(item);
                } else {
                  sections.push({ type: "grid", items: [item] });
                }
              }
            });

            return sections.map((section, sIdx) => {
              if (section.type === "parent") {
                const { item, children } = section;
                const totalChildQty = children.reduce((sum, c) => sum + (invMap.get(c.id!)?.quantity ?? 0), 0);
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{item.name}</h3>
                        <span className="text-xs text-zinc-500">
                          Total: {totalChildQty} {item.unit}
                        </span>
                      </div>
                      <button
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                        onClick={() => handleDelete(item.id!)}
                        title="Delete item and variants"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {children.map((child) => {
                        const childQty = invMap.get(child.id!)?.quantity ?? 0;
                        return (
                          <div
                            key={child.id}
                            className={`group/tile rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden ${childQty === 0 ? "opacity-50" : ""}`}
                          >
                            <div className="px-2.5 py-2 relative">
                              <button
                                className="absolute top-1 right-1 h-5 w-5 rounded bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                                onClick={() => handleDelete(child.id!)}
                                title="Delete variant"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                              <p className="text-xs font-medium leading-tight truncate pr-5" title={child.name}>
                                {child.name}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openAdjust(child, "subtract")}
                                  disabled={childQty === 0}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="font-mono font-semibold text-sm">
                                  {childQty}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openAdjust(child, "add")}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Grid of standalone items
              return (
                <div key={`grid-${sIdx}`} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {section.items.map((item) => {
                    const inv = invMap.get(item.id!);
                    const qty = inv?.quantity ?? 0;
                    const imgUrl = imageUrls.get(item.id!) || getStaticImage(item.name, item.category);
                    const FallbackIcon =
                      item.category === "shoring"
                        ? Box
                        : item.category === "scaffold"
                          ? Layers
                          : LayoutGrid;
                    return (
                      <div
                        key={item.id}
                        className={`group/tile rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden ${qty === 0 ? "opacity-50" : ""}`}
                      >
                        <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative">
                          {imgUrl ? (
                            <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <FallbackIcon className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                          )}
                          <button
                            className="absolute top-1.5 left-1.5 h-6 w-6 rounded bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                            onClick={() => handleDelete(item.id!)}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <Badge variant="outline" className="absolute top-1.5 right-1.5 text-[10px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
                            {item.category === "meva-panels" ? "Imperial" : item.category}
                          </Badge>
                        </div>
                        <div className="px-2.5 py-2">
                          <p className="text-xs font-medium leading-tight truncate" title={item.name}>
                            {item.name}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openAdjust(item, "subtract")}
                              disabled={qty === 0}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-mono font-semibold text-sm">
                              {qty}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openAdjust(item, "add")}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Adjust Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogClose onClose={() => setShowAdjust(false)} />
        <DialogHeader>
          <DialogTitle>
            {adjustType === "add" ? "Add" : "Remove"} {selectedItem?.name}
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Quantity
            </label>
            <Input
              type="number"
              min="1"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Notes{" "}
              <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="e.g. Delivered by truck, PO#123"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAdjust(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdjust}
            disabled={!quantity || parseInt(quantity) <= 0}
            variant={adjustType === "subtract" ? "destructive" : "default"}
          >
            {adjustType === "add" ? "Add" : "Remove"} {quantity || 0}{" "}
            {selectedItem?.unit}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
