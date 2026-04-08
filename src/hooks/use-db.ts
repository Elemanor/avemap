"use client";

import { useState, useEffect, useCallback } from "react";
import {
  db,
  seedDatabase,
  type Location,
  type EquipmentItem,
  type Inventory,
  type Transaction,
  type DeliveryOrder,
  type Category,
  type TransactionType,
} from "@/lib/db";

// Generic hook for live queries
function useLiveQuery<T>(queryFn: () => Promise<T>, deps: unknown[] = []): {
  data: T | undefined;
  loading: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    queryFn().then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, refresh };
}

export function useInit() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    seedDatabase().then(() => setReady(true));
  }, []);
  return ready;
}

export function useLocations() {
  return useLiveQuery(() => db.locations.orderBy("name").toArray());
}

export function useLocation(id: number) {
  return useLiveQuery(() => db.locations.get(id), [id]);
}

export function useEquipmentImage(itemId: number | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    db.equipmentItems.get(itemId).then((item) => {
      if (item?.image) {
        objectUrl = URL.createObjectURL(item.image);
        setUrl(objectUrl);
      } else {
        setUrl(null);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemId]);

  return url;
}

export function useEquipmentImages(itemIds: number[]): Map<number, string> {
  const [urls, setUrls] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (itemIds.length === 0) {
      setUrls(new Map());
      return;
    }
    const objectUrls: string[] = [];
    const key = itemIds.join(",");
    db.equipmentItems
      .where("id")
      .anyOf(itemIds)
      .toArray()
      .then((items) => {
        const map = new Map<number, string>();
        items.forEach((item) => {
          if (item.image && item.id) {
            const u = URL.createObjectURL(item.image);
            objectUrls.push(u);
            map.set(item.id, u);
          }
        });
        setUrls(map);
      });
    return () => {
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds.join(",")]);

  return urls;
}

export function useEquipmentItems(category?: Category) {
  return useLiveQuery(
    () =>
      category
        ? db.equipmentItems.where("category").equals(category).toArray()
        : db.equipmentItems.orderBy("category").toArray(),
    [category]
  );
}

export function useInventoryAtLocation(locationId: number) {
  return useLiveQuery(
    () => db.inventory.where("locationId").equals(locationId).toArray(),
    [locationId]
  );
}

export function useTransactions(limit?: number) {
  return useLiveQuery(
    () =>
      db.transactions
        .orderBy("date")
        .reverse()
        .limit(limit ?? 1000)
        .toArray(),
    [limit]
  );
}

// Mutations
export async function addLocation(
  loc: Omit<Location, "id" | "createdAt">
): Promise<number> {
  const id = await db.locations.add({ ...loc, createdAt: new Date() });
  return id as number;
}

export async function updateLocation(
  id: number,
  changes: Partial<Location>
): Promise<void> {
  await db.locations.update(id, changes);
}

export async function deleteLocation(id: number): Promise<void> {
  await db.transaction("rw", db.locations, db.inventory, db.transactions, async () => {
    await db.inventory.where("locationId").equals(id).delete();
    await db.locations.delete(id);
  });
}

export async function addEquipmentItem(
  item: Omit<EquipmentItem, "id">
): Promise<number> {
  const id = await db.equipmentItems.add(item);
  return id as number;
}

export async function updateEquipmentItem(
  id: number,
  changes: Partial<EquipmentItem>
): Promise<void> {
  await db.equipmentItems.update(id, changes);
}

export async function deleteEquipmentItem(id: number): Promise<void> {
  await db.transaction("rw", db.equipmentItems, db.inventory, db.transactions, async () => {
    // Find children
    const children = await db.equipmentItems.where("parentId").equals(id).toArray();
    for (const child of children) {
      await db.inventory.where("itemId").equals(child.id!).delete();
      await db.transactions.where("itemId").equals(child.id!).delete();
      await db.equipmentItems.delete(child.id!);
    }
    // Delete parent
    await db.inventory.where("itemId").equals(id).delete();
    await db.transactions.where("itemId").equals(id).delete();
    await db.equipmentItems.delete(id);
  });
}

export async function addSubItem(
  parentId: number,
  name: string,
  description?: string
): Promise<number> {
  const parent = await db.equipmentItems.get(parentId);
  if (!parent) throw new Error("Parent item not found");
  const id = await db.equipmentItems.add({
    name,
    category: parent.category,
    unit: parent.unit,
    description,
    parentId,
  });
  return id as number;
}

export async function adjustInventory(
  locationId: number,
  itemId: number,
  quantity: number,
  type: "add" | "subtract",
  notes?: string
): Promise<void> {
  await db.transaction("rw", db.inventory, db.transactions, async () => {
    const existing = await db.inventory
      .where("[locationId+itemId]")
      .equals([locationId, itemId])
      .first();

    if (existing) {
      const newQty =
        type === "add"
          ? existing.quantity + quantity
          : Math.max(0, existing.quantity - quantity);
      await db.inventory.update(existing.id!, { quantity: newQty });
    } else if (type === "add") {
      await db.inventory.add({ locationId, itemId, quantity });
    }

    await db.transactions.add({
      type,
      itemId,
      fromLocationId: type === "subtract" ? locationId : undefined,
      toLocationId: type === "add" ? locationId : undefined,
      quantity,
      date: new Date(),
      notes,
    });
  });
}

export async function transferEquipment(
  fromLocationId: number,
  toLocationId: number,
  itemId: number,
  quantity: number,
  notes?: string
): Promise<void> {
  await db.transaction("rw", db.inventory, db.transactions, async () => {
    // Subtract from source
    const source = await db.inventory
      .where("[locationId+itemId]")
      .equals([fromLocationId, itemId])
      .first();

    if (source) {
      const newQty = Math.max(0, source.quantity - quantity);
      await db.inventory.update(source.id!, { quantity: newQty });
    }

    // Add to destination
    const dest = await db.inventory
      .where("[locationId+itemId]")
      .equals([toLocationId, itemId])
      .first();

    if (dest) {
      await db.inventory.update(dest.id!, {
        quantity: dest.quantity + quantity,
      });
    } else {
      await db.inventory.add({
        locationId: toLocationId,
        itemId,
        quantity,
      });
    }

    await db.transactions.add({
      type: "transfer" as TransactionType,
      itemId,
      fromLocationId,
      toLocationId,
      quantity,
      date: new Date(),
      notes,
    });
  });
}

// Aggregate helpers
export async function getInventorySummaryForLocation(
  locationId: number
): Promise<{ totalItems: number; totalQuantity: number }> {
  const items = await db.inventory
    .where("locationId")
    .equals(locationId)
    .toArray();
  return {
    totalItems: items.filter((i) => i.quantity > 0).length,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

export async function getLastActivityForLocation(
  locationId: number
): Promise<Date | null> {
  const tx = await db.transactions
    .where("fromLocationId")
    .equals(locationId)
    .or("toLocationId")
    .equals(locationId)
    .reverse()
    .sortBy("date");
  return tx.length > 0 ? tx[0].date : null;
}

// Delivery Orders
export async function createDeliveryOrder(
  data: Omit<DeliveryOrder, "id">
): Promise<number> {
  const id = await db.deliveryOrders.add(data);
  return id as number;
}

export function useDeliveryOrder(id: number) {
  return useLiveQuery(() => db.deliveryOrders.get(id), [id]);
}
