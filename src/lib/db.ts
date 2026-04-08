import Dexie, { type EntityTable } from "dexie";

export type LocationType = "yard" | "site";
export type LocationStatus = "active" | "inactive";
export type Category = "shoring" | "scaffold" | "meva-panels";
export type TransactionType = "add" | "subtract" | "transfer";

export interface Location {
  id?: number;
  name: string;
  type: LocationType;
  address?: string;
  status: LocationStatus;
  createdAt: Date;
}

export interface EquipmentItem {
  id?: number;
  name: string;
  category: Category;
  unit: string;
  description?: string;
  image?: Blob;
  parentId?: number;
}

export interface Inventory {
  id?: number;
  locationId: number;
  itemId: number;
  quantity: number;
}

export interface Transaction {
  id?: number;
  type: TransactionType;
  itemId: number;
  fromLocationId?: number;
  toLocationId?: number;
  quantity: number;
  date: Date;
  notes?: string;
}

export interface DeliveryOrder {
  id?: number;
  date: Date;
  fromLocationId: number;
  toLocationId: number;
  items: { itemId: number; name: string; unit: string; quantity: number }[];
  driverName?: string;
  notes?: string;
}

class AvemapDB extends Dexie {
  locations!: EntityTable<Location, "id">;
  equipmentItems!: EntityTable<EquipmentItem, "id">;
  inventory!: EntityTable<Inventory, "id">;
  transactions!: EntityTable<Transaction, "id">;
  deliveryOrders!: EntityTable<DeliveryOrder, "id">;

  constructor() {
    super("avemap");
    this.version(1).stores({
      locations: "++id, name, type, status",
      equipmentItems: "++id, name, category",
      inventory: "++id, locationId, itemId, [locationId+itemId]",
      transactions: "++id, type, itemId, fromLocationId, toLocationId, date",
    });

    // v2: added image blob to equipmentItems (no index needed)
    this.version(2).stores({});

    // v3: added delivery orders table
    this.version(3).stores({
      deliveryOrders: "++id, date, fromLocationId, toLocationId",
    });

    // v4: replace old equipment items with correct real-world catalog
    this.version(4).stores({}).upgrade(async (tx) => {
      // Clear old equipment, inventory & transactions (old item IDs are invalid)
      await tx.table("equipmentItems").clear();
      await tx.table("inventory").clear();
      await tx.table("transactions").clear();
      // Re-seed will happen via seedDatabase() on next load
    });

    // v5: add parentId for sub-components (variants)
    this.version(5).stores({
      equipmentItems: "++id, name, category, parentId",
    });

    // v6: seed scaffold sub-component variants for existing databases
    this.version(6).stores({}).upgrade(async (tx) => {
      const table = tx.table("equipmentItems");
      const allItems = await table.toArray();
      // Only add if no children exist yet
      if (allItems.some((i: EquipmentItem) => i.parentId)) return;
      const nameToItem = new Map<string, EquipmentItem>();
      allItems.forEach((i: EquipmentItem) => nameToItem.set(i.name, i));
      for (const [parentName, variants] of Object.entries(SEED_VARIANTS)) {
        const parent = nameToItem.get(parentName);
        if (!parent?.id) continue;
        for (const v of variants) {
          await table.add({
            name: v.name,
            category: parent.category,
            unit: parent.unit,
            description: v.description,
            parentId: parent.id,
          });
        }
      }
    });

    // v7: add shoring + aluminum beam variants for existing databases
    this.version(7).stores({}).upgrade(async (tx) => {
      const table = tx.table("equipmentItems");
      const allItems = await table.toArray();
      const nameToItem = new Map<string, EquipmentItem>();
      allItems.forEach((i: EquipmentItem) => nameToItem.set(i.name, i));
      const existingChildren = new Set(
        allItems.filter((i: EquipmentItem) => i.parentId).map((i: EquipmentItem) => `${i.parentId}-${i.name}`)
      );
      for (const [parentName, variants] of Object.entries(SEED_VARIANTS)) {
        const parent = nameToItem.get(parentName);
        if (!parent?.id) continue;
        for (const v of variants) {
          if (existingChildren.has(`${parent.id}-${v.name}`)) continue;
          await table.add({
            name: v.name,
            category: parent.category,
            unit: parent.unit,
            description: v.description,
            parentId: parent.id,
          });
        }
      }
    });

    // v8: add diagonal braces variants for existing databases
    this.version(8).stores({}).upgrade(async (tx) => {
      const table = tx.table("equipmentItems");
      const allItems = await table.toArray();
      const nameToItem = new Map<string, EquipmentItem>();
      allItems.forEach((i: EquipmentItem) => nameToItem.set(i.name, i));
      const existingChildren = new Set(
        allItems.filter((i: EquipmentItem) => i.parentId).map((i: EquipmentItem) => `${i.parentId}-${i.name}`)
      );
      for (const [parentName, variants] of Object.entries(SEED_VARIANTS)) {
        const parent = nameToItem.get(parentName);
        if (!parent?.id) continue;
        for (const v of variants) {
          if (existingChildren.has(`${parent.id}-${v.name}`)) continue;
          await table.add({
            name: v.name,
            category: parent.category,
            unit: parent.unit,
            description: v.description,
            parentId: parent.id,
          });
        }
      }
    });
  }
}

export const db = new AvemapDB();

const SEED_EQUIPMENT: Omit<EquipmentItem, "id">[] = [
  // Shoring
  { name: "Post Shores", category: "shoring", unit: "pcs" },
  { name: "Aluminum Props", category: "shoring", unit: "pcs" },
  { name: "Aluminum Shoring Frame", category: "shoring", unit: "pcs" },
  { name: "Brace Frames", category: "shoring", unit: "pcs" },
  { name: "J Heads", category: "shoring", unit: "pcs" },
  { name: "Clips", category: "shoring", unit: "pcs" },
  { name: "20K/20KA Frame", category: "shoring", unit: "pcs", description: "Aluminum shoring frame, 20,000 lbs/frame capacity. Heights: 3.5/5/6 ft, Widths: 2/4 ft. ANSI A10.9" },

  // Scaffold — Ringlock System
  { name: "Standards (Verticals)", category: "scaffold", unit: "pcs" },
  { name: "Ledgers", category: "scaffold", unit: "pcs" },
  { name: "Double Ledgers & Trusses", category: "scaffold", unit: "pcs" },
  { name: "Truss Lattice Girder", category: "scaffold", unit: "pcs" },
  { name: "Diagonal Braces", category: "scaffold", unit: "pcs" },
  { name: "Slope Double Ledger", category: "scaffold", unit: "pcs" },
  { name: "Base Collars", category: "scaffold", unit: "pcs" },
  { name: "Screw Jacks", category: "scaffold", unit: "pcs" },
  { name: "Access Ladders", category: "scaffold", unit: "pcs" },
  { name: "Clamps", category: "scaffold", unit: "pcs" },
  { name: "Ladder Brackets", category: "scaffold", unit: "pcs" },
  { name: "Stair Tread", category: "scaffold", unit: "pcs" },
  { name: "System Side Brackets", category: "scaffold", unit: "pcs" },
  { name: "Outriggers", category: "scaffold", unit: "pcs" },
  { name: "Pins", category: "scaffold", unit: "pcs" },
  { name: "Toe Boards", category: "scaffold", unit: "pcs" },
  { name: "Safety Swing Gate", category: "scaffold", unit: "pcs" },

  // Scaffold — Frame System
  { name: "Steel Frames", category: "scaffold", unit: "pcs" },
  { name: "Cross-Braces", category: "scaffold", unit: "pcs" },
  { name: "Guard Rails & Posts", category: "scaffold", unit: "pcs" },
  { name: "Baseplates & Jacks", category: "scaffold", unit: "pcs" },
  { name: "Coupling Pins", category: "scaffold", unit: "pcs" },
  { name: "Casters", category: "scaffold", unit: "pcs" },
  { name: "Diagonal Goosers", category: "scaffold", unit: "pcs" },
  { name: "Frame Side Brackets", category: "scaffold", unit: "pcs" },
  { name: "Access Frames", category: "scaffold", unit: "pcs" },
  { name: "Hoists", category: "scaffold", unit: "pcs" },
  { name: "Adjustable Wall Ties", category: "scaffold", unit: "pcs" },

  // Scaffold — Aluminum & Decks
  { name: "Aluminum Beams", category: "scaffold", unit: "pcs" },
  { name: "Aluminum Stairway", category: "scaffold", unit: "pcs" },

  // MEVA Imperial Panels — 12' Height
  { name: "12' × 12\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-106-12, 235 lbs" },
  { name: "12' × 18\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-106-18, 334 lbs" },
  { name: "12' × 24\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-106-24, 433 lbs" },
  { name: "12' × 30\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-106-30" },
  { name: "12' × 36\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-106-36" },
  { name: "12' × 42\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-106-42" },
  { name: "12' × 48\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-106-48" },
  { name: "12' × 96\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-106-96" },

  // MEVA Imperial Panels — 8' Height
  { name: "8' × 12\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-104-12, 159 lbs" },
  { name: "8' × 18\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-104-18, 227 lbs" },
  { name: "8' × 24\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-104-24, 294 lbs" },
  { name: "8' × 30\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-104-30" },
  { name: "8' × 36\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-104-36" },
  { name: "8' × 42\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-104-42" },
  { name: "8' × 48\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-104-48" },
  { name: "8' × 96\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-104-96" },

  // MEVA Imperial Panels — 4' Height
  { name: "4' × 12\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-102-12, 82 lbs" },
  { name: "4' × 18\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-102-18, 117 lbs" },
  { name: "4' × 24\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-102-24, 151 lbs" },
  { name: "4' × 30\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-102-30" },
  { name: "4' × 36\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-102-36" },
  { name: "4' × 42\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-102-42" },
  { name: "4' × 48\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-102-48" },
  { name: "4' × 96\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-102-96" },

  // MEVA Imperial Panels — 2' Height
  { name: "2' × 12\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-100-12, 43 lbs" },
  { name: "2' × 18\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-100-18, 60 lbs" },
  { name: "2' × 24\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-100-24, 78 lbs" },
  { name: "2' × 30\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-100-30" },
  { name: "2' × 36\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-100-36" },
  { name: "2' × 42\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-100-42" },
  { name: "2' × 48\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-100-48" },
  { name: "2' × 96\" Panel", category: "meva-panels", unit: "pcs", description: "Ref 23-100-96" },

  // MEVA Imperial Corners — Outside
  { name: "Outside Corner 12'", category: "meva-panels", unit: "pcs", description: "Ref 23-306-00, 179 lbs" },
  { name: "Outside Corner 8'", category: "meva-panels", unit: "pcs", description: "Ref 23-306-10, 120.4 lbs" },
  { name: "Outside Corner 4'", category: "meva-panels", unit: "pcs", description: "Ref 23-306-20, 61.5 lbs" },
  { name: "Outside Corner 2'", category: "meva-panels", unit: "pcs", description: "Ref 23-306-25, 33.7 lbs" },

  // MEVA Imperial Corners — Inside
  { name: "Inside Corner 12'", category: "meva-panels", unit: "pcs", description: "Ref 23-306-80, 414.5 lbs" },
  { name: "Inside Corner 8'", category: "meva-panels", unit: "pcs", description: "Ref 23-306-85, 277.8 lbs" },
  { name: "Inside Corner 4'", category: "meva-panels", unit: "pcs", description: "Ref 23-306-90, 144.4 lbs" },
  { name: "Inside Corner 2'", category: "meva-panels", unit: "pcs", description: "Ref 23-306-95, 80 lbs" },

  // MEVA Imperial Corners — Articulated Outside
  { name: "Articulated Outside Corner 12'", category: "meva-panels", unit: "pcs", description: "Ref 23-307-00, 253.5 lbs" },
  { name: "Articulated Outside Corner 8'", category: "meva-panels", unit: "pcs", description: "Ref 23-307-10, 170.2 lbs" },
  { name: "Articulated Outside Corner 4'", category: "meva-panels", unit: "pcs", description: "Ref 23-307-20, 86.9 lbs" },

  // MEVA Imperial Corners — Articulated Inside
  { name: "Articulated Inside Corner 12'", category: "meva-panels", unit: "pcs", description: "Ref 23-307-50, 434.3 lbs" },
  { name: "Articulated Inside Corner 8'", category: "meva-panels", unit: "pcs", description: "Ref 23-307-60, 311.7 lbs" },
  { name: "Articulated Inside Corner 4'", category: "meva-panels", unit: "pcs", description: "Ref 23-307-70, 157.8 lbs" },

  // MEVA Imperial Stripping Corners
  { name: "Stripping Corner 12'", category: "meva-panels", unit: "pcs", description: "Ref 23-309-30, 488.7 lbs" },
  { name: "Stripping Corner 8'", category: "meva-panels", unit: "pcs", description: "Ref 23-309-40, 351.5 lbs" },
  { name: "Stripping Corner 4'", category: "meva-panels", unit: "pcs", description: "Ref 23-309-45, 197.9 lbs" },
  { name: "Stripping Corner Retract & Reset Tool", category: "meva-panels", unit: "pcs", description: "Ref 29-306-32, 14.6 lbs" },

  // MEVA Imperial Connectors & Accessories
  { name: "M Assembly Lock", category: "meva-panels", unit: "pcs", description: "Ref 29-400-71, 6.6 lbs" },
  { name: "Uni Assembly Lock 28", category: "meva-panels", unit: "pcs", description: "Ref 29-400-90, 8.6 lbs" },
  { name: "Flange Screw 18", category: "meva-panels", unit: "pcs", description: "Ref 29-401-10, 2.4 lbs" },
  { name: "Walkway Bracket 90°", category: "meva-panels", unit: "pcs", description: "Ref 29-106-00, 22 lbs" },
  { name: "Guardrail Post", category: "meva-panels", unit: "pcs", description: "Ref 29-106-75, 8 lbs" },
  { name: "Push-Pull Prop R460", category: "meva-panels", unit: "pcs", description: "Ref 29-109-60, 45.8 lbs" },
  { name: "Articulated Foot Plate", category: "meva-panels", unit: "pcs", description: "Ref 29-802-48, 5.1 lbs" },
  { name: "Formwork-Prop Connector", category: "meva-panels", unit: "pcs", description: "Ref 29-804-85, 3.6 lbs" },
  { name: "Alignment Rails 4ft", category: "meva-panels", unit: "pcs", description: "Ref 29-500-23, 44 lbs" },
  { name: "Alignment Rails 6ft", category: "meva-panels", unit: "pcs", description: "Ref 29-500-24, 66 lbs" },
];

// Sub-component variants keyed by parent name
export const SEED_VARIANTS: Record<string, { name: string; description?: string }[]> = {
  "Standards (Verticals)": [
    { name: "0.5m (1'-8\")", description: "U-RLV-0500, 3.0 kg (6.6 lbs)" },
    { name: "1m (3'-3\")", description: "U-RLV-1000, 5.6 kg (12.3 lbs)" },
    { name: "1.5m (4'-11\")", description: "U-RLV-1500, 8.3 kg (18.3 lbs)" },
    { name: "2m (6'-7\")", description: "U-RLV-2000, 10.9 kg (24.0 lbs)" },
    { name: "2.5m (8'-2\")", description: "U-RLV-2500, 13.3 kg (29.3 lbs)" },
    { name: "3m (9'-10\")", description: "U-RLV-3000, 15.7 kg (34.6 lbs)" },
  ],
  "Ledgers": [
    { name: "1' (0.305m)", description: "RL-10-305, 4.40 lbs" },
    { name: "1'4\" (0.40m)", description: "RL-14-040" },
    { name: "2'4\" (0.73m)", description: "RL-24-073" },
    { name: "2'5\" (0.75m)", description: "RL-25-075" },
    { name: "3' (0.91m)", description: "RL-30-091" },
    { name: "3'3\" (1.00m)", description: "RL-33-100" },
    { name: "4' (1.22m)", description: "RL-40-122" },
    { name: "5' (1.52m)", description: "RL-50-152" },
    { name: "6'9\" (2.07m)", description: "RL-69-207" },
  ],
  "Diagonal Braces": [
    { name: "5'2\" Brace", description: "Diagonal brace, hot-dip galvanized" },
    { name: "7' Brace", description: "Diagonal brace, hot-dip galvanized" },
  ],
  "Cross-Braces": [
    { name: "5' × 3' × 4'", description: "Tubular cross brace, hot-dip galvanized" },
    { name: "6' × 3' × 4'", description: "Tubular cross brace, hot-dip galvanized" },
  ],

  // Shoring — MULTIPROP Aluminium Slab Props
  "Aluminum Props": [
    { name: "MP 120 (0.80–1.20m)", description: "10.10 kg, 102 kN max load" },
    { name: "MP 250 (1.45–2.50m)", description: "15.40 kg, 99.3 kN max load" },
    { name: "MP 350 (1.95–3.50m)", description: "19.40 kg, 96 kN max load" },
    { name: "MP 480 (2.60–4.80m)", description: "24.80 kg, 94 kN max load" },
    { name: "MP 625 (4.30–6.25m)", description: "34.60 kg, 57.9 kN max load" },
  ],

  // Shoring — Aluminum Shoring Frames
  "Aluminum Shoring Frame": [
    { name: "3' × 4' Frame", description: "Aluminum shoring frame" },
    { name: "4' × 4' Frame", description: "Aluminum shoring frame" },
    { name: "5' × 4' Frame", description: "Aluminum shoring frame" },
    { name: "6' × 4' Frame", description: "Aluminum shoring frame" },
    { name: "8' × 4' Frame", description: "Aluminum shoring frame" },
  ],

  // Shoring — Brace Frames (crossbraces for aluminum frame system)
  "Brace Frames": [
    { name: "5' × 24\" Crossbrace", description: "Hot-dip galvanized" },
    { name: "5' × 48\" Crossbrace", description: "Hot-dip galvanized" },
    { name: "7' × 24\" Crossbrace", description: "Hot-dip galvanized" },
    { name: "7' × 48\" Crossbrace", description: "Hot-dip galvanized" },
  ],

  // Scaffold — Aluminum Beams (standard stringer lengths)
  "Aluminum Beams": [
    { name: "10.5' (3.2m)", description: "HL Stringer, 46 lbs / A-Stringer, 61 lbs" },
    { name: "12' (3.7m)", description: "HL Stringer, 53 lbs / A-Stringer, 70 lbs" },
    { name: "14' (4.3m)", description: "HL Stringer, 62 lbs / A-Stringer, 81 lbs" },
    { name: "16' (4.9m)", description: "HL Stringer, 70 lbs / A-Stringer, 93 lbs" },
    { name: "18' (5.5m)", description: "HL Stringer, 79 lbs / A-Stringer, 104 lbs" },
    { name: "21' (6.4m)", description: "HL Stringer, 92 lbs / A-Stringer, 122 lbs" },
  ],
};

export async function seedDatabase() {
  const items = await db.equipmentItems.toArray();

  // Detect stale data: old format used "Panel 2'x2'" or lacked the × character
  const isStale =
    items.length > 0 &&
    !items.some((i) => /^\d+'\s*[×xX]\s*\d+[""]\s*Panel$/i.test(i.name));

  if (items.length === 0 || isStale) {
    // Clear old data and re-seed
    await db.equipmentItems.clear();
    await db.inventory.clear();
    await db.transactions.clear();

    // Pass 1: add top-level items
    await db.equipmentItems.bulkAdd(SEED_EQUIPMENT);

    // Pass 2: add variants as children
    const allItems = await db.equipmentItems.toArray();
    const nameToId = new Map<string, number>();
    allItems.forEach((i) => nameToId.set(i.name, i.id!));

    const childItems: Omit<EquipmentItem, "id">[] = [];
    for (const [parentName, variants] of Object.entries(SEED_VARIANTS)) {
      const parentId = nameToId.get(parentName);
      if (!parentId) continue;
      const parent = allItems.find((i) => i.id === parentId)!;
      for (const v of variants) {
        childItems.push({
          name: v.name,
          category: parent.category,
          unit: parent.unit,
          description: v.description,
          parentId,
        });
      }
    }
    if (childItems.length > 0) {
      await db.equipmentItems.bulkAdd(childItems);
    }

    // Create default yard location (only if none exist)
    const locCount = await db.locations.count();
    if (locCount === 0) {
      await db.locations.add({
        name: "Main Yard",
        type: "yard",
        address: "",
        status: "active",
        createdAt: new Date(),
      });
    }
  }
}
