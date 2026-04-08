"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Box,
  Layers,
  LayoutGrid,
  Camera,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
import { ImageUpload } from "@/components/ui/image-upload";
import {
  useEquipmentItems,
  useEquipmentImages,
  addEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem,
  addSubItem,
} from "@/hooks/use-db";
import { db, SEED_VARIANTS, type Category, type EquipmentItem } from "@/lib/db";

/** Convert item name to a static image path fallback (from /public/products/) */
function getStaticImage(name: string, category: Category): string | undefined {
  if (category === "meva-panels") {
    const n = name.toLowerCase();
    if (n.includes("outside corner") && n.includes("articulated")) return "/products/meva-panels/articulated-corner.svg";
    if (n.includes("inside corner") && n.includes("articulated")) return "/products/meva-panels/articulated-corner.svg";
    if (n.includes("outside corner")) return "/products/meva-panels/outside-corner.svg";
    if (n.includes("inside corner")) return "/products/meva-panels/inside-corner.svg";
    if (n.includes("stripping corner")) return "/products/meva-panels/stripping-corner.svg";
    if (n.includes("push-pull prop")) return "/products/meva-panels/push-pull-prop.svg";
    if (n.includes("panel")) return "/products/meva-panels/imperial-panel.jpg";
    // Connectors & accessories fallback
    if (
      n.includes("lock") || n.includes("screw") || n.includes("bracket") ||
      n.includes("post") || n.includes("connector") || n.includes("plate") ||
      n.includes("rail") || n.includes("tool")
    ) return "/products/meva-panels/accessory.svg";
    return "/products/meva-panels/imperial-panel.jpg";
  }
  if (category !== "scaffold" && category !== "shoring") return undefined;
  const slug = name
    .toLowerCase()
    .replace(/[()&]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const folder = category === "scaffold" ? "scaffold" : "shoring";
  return `/products/${folder}/${slug}.jpg`;
}

export default function EquipmentPage() {
  const { data: items, refresh } = useEquipmentItems();
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<EquipmentItem | null>(null);

  const [name, setName] = useState("");
  const [cat, setCat] = useState<Category>("shoring");
  const [unit, setUnit] = useState("pcs");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<Blob | undefined>(undefined);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [variantParentId, setVariantParentId] = useState<number | null>(null);
  const [variantName, setVariantName] = useState("");

  const imageUrls = useEquipmentImages(
    (items ?? []).map((i) => i.id!).filter(Boolean)
  );

  // Track total quantities per item
  const [totals, setTotals] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (!items) return;
    db.inventory.toArray().then((inv) => {
      const map = new Map<number, number>();
      inv.forEach((i) => {
        map.set(i.itemId, (map.get(i.itemId) ?? 0) + i.quantity);
      });
      setTotals(map);
    });
  }, [items]);

  // Build parent→children map
  const childrenMap = new Map<number, EquipmentItem[]>();
  (items ?? []).forEach((item) => {
    if (item.parentId) {
      const list = childrenMap.get(item.parentId) ?? [];
      list.push(item);
      childrenMap.set(item.parentId, list);
    }
  });

  const filtered = (items ?? []).filter((item) => {
    // Only show top-level items
    if (item.parentId) return false;
    const matchesCat = category === "all" || item.category === category;
    if (!matchesCat) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    // Match parent name or any child name
    if (item.name.toLowerCase().includes(q)) return true;
    const children = childrenMap.get(item.id!) ?? [];
    return children.some((c) => c.name.toLowerCase().includes(q));
  });

  function openAdd() {
    setEditing(null);
    setName("");
    setCat("shoring");
    setUnit("pcs");
    setDescription("");
    setImage(undefined);
    setShowDialog(true);
  }

  function openEdit(item: EquipmentItem) {
    setEditing(item);
    setName(item.name);
    setCat(item.category);
    setUnit(item.unit);
    setDescription(item.description ?? "");
    setImage(item.image);
    setShowDialog(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    const data = {
      name,
      category: cat,
      unit,
      description: description || undefined,
      image,
    };
    if (editing?.id) {
      await updateEquipmentItem(editing.id, data);
    } else {
      await addEquipmentItem(data);
    }
    setShowDialog(false);
    refresh();
  }

  async function handleDelete(id: number) {
    const children = childrenMap.get(id) ?? [];
    const childMsg = children.length > 0 ? ` and its ${children.length} variant(s)` : "";
    if (confirm(`Delete this equipment item${childMsg}? All inventory and transaction records will also be removed.`)) {
      await deleteEquipmentItem(id);
      refresh();
    }
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAddVariant(parentId: number) {
    setVariantParentId(parentId);
    setVariantName("");
    setShowVariantDialog(true);
  }

  async function handleAddVariant() {
    if (!variantParentId || !variantName.trim()) return;
    await addSubItem(variantParentId, variantName.trim());
    setVariantName("");
    refresh();
  }

  async function handleAddSuggested(parentId: number, variant: { name: string; description?: string }) {
    await addSubItem(parentId, variant.name, variant.description);
    refresh();
  }

  // Group by category
  const grouped = new Map<Category, EquipmentItem[]>();
  filtered.forEach((item) => {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  });

  const categoryLabels: Record<Category, string> = {
    shoring: "Shoring",
    scaffold: "System Scaffold",
    "meva-panels": "Imperial Frames",
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipment Catalog</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage all equipment types by category
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <CategoryTabs value={category} onChange={setCategory} />
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No equipment found"
          description={
            search
              ? "Try a different search or category."
              : "Add your first equipment item."
          }
          action={
            !search ? (
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            ) : undefined
          }
        />
      ) : (
        Array.from(grouped.entries()).map(([catKey, catItems]) => {
          const FallbackIcon =
            catKey === "shoring" ? Box : catKey === "scaffold" ? Layers : LayoutGrid;
          return (
            <div key={catKey} className="space-y-4">
              <h2 className="text-sm font-medium text-zinc-500 px-1">
                {categoryLabels[catKey]} ({catItems.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {catItems.map((item) => {
                  const imgUrl = imageUrls.get(item.id!) || getStaticImage(item.name, item.category);
                  const total = totals.get(item.id!) ?? 0;
                  const children = childrenMap.get(item.id!) ?? [];
                  const hasChildren = children.length > 0;
                  const isExpanded = expanded.has(item.id!);

                  return (
                    <React.Fragment key={item.id}>
                      <div
                        className={`group/tile cursor-pointer rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-md transition-all ${isExpanded ? "border-blue-400 shadow-md" : "border-zinc-200 dark:border-zinc-700 hover:border-blue-400"}`}
                        onClick={() => hasChildren ? toggleExpand(item.id!) : openEdit(item)}
                      >
                        <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative">
                          {imgUrl ? (
                            <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <FallbackIcon className="h-10 w-10 text-zinc-300 dark:text-zinc-600 group-hover/tile:text-zinc-400 transition-colors" />
                          )}
                          {!imgUrl && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity bg-black/5">
                              <Camera className="h-6 w-6 text-zinc-500" />
                            </div>
                          )}
                          {/* Delete button */}
                          <button
                            className="absolute top-1.5 left-1.5 h-6 w-6 rounded bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id!); }}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {/* Edit button (for items with children) */}
                          {hasChildren && (
                            <button
                              className="absolute bottom-1.5 left-1.5 h-6 w-6 rounded bg-zinc-800/70 text-white flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity hover:bg-zinc-800 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          <div className={`absolute top-1.5 right-1.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${total > 0 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"}`}>
                            {total}
                          </div>
                          {/* Variant count badge */}
                          {hasChildren && (
                            <div className="absolute bottom-1.5 right-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                              {children.length} var.
                            </div>
                          )}
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="flex items-center gap-1">
                            {hasChildren && (
                              isExpanded
                                ? <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
                                : <ChevronRight className="h-3 w-3 text-zinc-400 shrink-0" />
                            )}
                            <p className="text-xs font-medium leading-tight truncate" title={item.name}>
                              {item.name}
                            </p>
                          </div>
                          {item.description && catKey === "meva-panels" && (
                            <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Expanded sub-items — visual square grid */}
                      {isExpanded && (
                        <div className="col-span-full rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              Variants of {item.name}
                            </p>
                            <Button size="sm" variant="outline" onClick={() => openAddVariant(item.id!)}>
                              <Plus className="h-3 w-3" />
                              Add Variant
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                            {children.map((child) => {
                              const childTotal = totals.get(child.id!) ?? 0;
                              const shortLabel = child.name.replace(/\s*\(.*\)$/, "");
                              const childImg = imageUrls.get(child.id!) || imgUrl;
                              return (
                                <div
                                  key={child.id}
                                  className="group/sub cursor-pointer rounded-md border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden hover:border-blue-400 transition-all"
                                  onClick={() => openEdit(child)}
                                  title={child.name}
                                >
                                  <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                                    {childImg ? (
                                      <img src={childImg} alt={child.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <FallbackIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                                      </div>
                                    )}
                                    <button
                                      className="absolute top-1 left-1 h-5 w-5 rounded bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover/sub:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer z-10"
                                      onClick={(e) => { e.stopPropagation(); handleDelete(child.id!); }}
                                      title="Delete variant"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                    <div className={cn(
                                      "absolute top-1 right-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded z-10",
                                      childTotal > 0 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                                    )}>
                                      {childTotal}
                                    </div>
                                  </div>
                                  <div className="px-1.5 py-1.5">
                                    <p className="text-xs font-semibold text-center leading-tight truncate">
                                      {shortLabel}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogClose onClose={() => setShowDialog(false)} />
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Equipment" : "Add Equipment"}
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Photo</label>
            <ImageUpload value={image} onChange={setImage} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              placeholder="e.g. Adjustable Props"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Category
              </label>
              <Select
                value={cat}
                onChange={(e) => setCat(e.target.value as Category)}
              >
                <option value="shoring">Shoring</option>
                <option value="scaffold">Scaffold</option>
                <option value="meva-panels">Imperial Frames</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Unit</label>
              <Input
                placeholder="e.g. pcs, ft, sets"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Description{" "}
              <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <Input
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {editing ? "Save Changes" : "Add Item"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add Variant Dialog — Smart Chip Picker */}
      <Dialog open={showVariantDialog} onOpenChange={setShowVariantDialog}>
        <DialogClose onClose={() => setShowVariantDialog(false)} />
        <DialogHeader>
          <DialogTitle>Add Variant</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          {(() => {
            const parentItem = (items ?? []).find((i) => i.id === variantParentId);
            const suggestions = parentItem ? (SEED_VARIANTS[parentItem.name] ?? []) : [];
            const existingNames = new Set(
              (variantParentId ? (childrenMap.get(variantParentId) ?? []) : []).map((c) => c.name)
            );
            const hasSuggestions = suggestions.length > 0;
            const parentImg = parentItem
              ? (imageUrls.get(parentItem.id!) || getStaticImage(parentItem.name, parentItem.category))
              : undefined;

            return (
              <>
                {hasSuggestions && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Predefined Sizes</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {suggestions.map((s) => {
                        const alreadyAdded = existingNames.has(s.name);
                        return (
                          <button
                            key={s.name}
                            type="button"
                            disabled={alreadyAdded}
                            className={cn(
                              "relative flex items-center gap-2.5 rounded-lg border-2 p-2.5 min-h-[4rem] transition-all cursor-pointer text-left",
                              alreadyAdded
                                ? "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 cursor-default"
                                : "border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-500 hover:shadow-sm"
                            )}
                            onClick={() => {
                              if (!alreadyAdded && variantParentId) {
                                handleAddSuggested(variantParentId, s);
                              }
                            }}
                          >
                            {alreadyAdded && (
                              <div className="absolute top-1.5 right-1.5">
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              </div>
                            )}
                            <div className="h-10 w-10 rounded bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                              {parentImg ? (
                                <img src={parentImg} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className={cn(
                                "text-sm font-semibold leading-tight truncate",
                                alreadyAdded && "line-through text-zinc-400"
                              )}>
                                {s.name}
                              </span>
                              {s.description && (
                                <span className="text-[10px] text-zinc-500 mt-0.5 leading-tight truncate">
                                  {s.description}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {hasSuggestions ? "Or enter custom size" : "Variant Name"}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 1m, 2m, 3m"
                      value={variantName}
                      onChange={(e) => setVariantName(e.target.value)}
                      autoFocus={!hasSuggestions}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddVariant(); }}
                      className="flex-1"
                    />
                    <Button onClick={handleAddVariant} disabled={!variantName.trim()} size="sm">
                      Add
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowVariantDialog(false)}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
