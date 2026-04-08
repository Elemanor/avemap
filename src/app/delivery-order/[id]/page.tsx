"use client";

import { use } from "react";
import Image from "next/image";
import { Printer } from "lucide-react";
import {
  useDeliveryOrder,
  useLocation,
  useEquipmentItems,
} from "@/hooks/use-db";

function padDO(id: number): string {
  return String(id).padStart(5, "0");
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  shoring: "Shoring",
  scaffold: "System Scaffold",
  "meva-panels": "Imperial Frames & Accessories",
};

const CATEGORY_ORDER = ["shoring", "scaffold", "meva-panels"];

export default function DeliveryOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const doId = parseInt(id);
  const { data: order, loading } = useDeliveryOrder(doId);
  const { data: fromLocation } = useLocation(order?.fromLocationId ?? 0);
  const { data: toLocation } = useLocation(order?.toLocationId ?? 0);
  const { data: allItems } = useEquipmentItems();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-500">Loading delivery order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-500">Delivery order not found.</p>
      </div>
    );
  }

  // Build lookup of transferred quantities
  const transferredQty = new Map<number, number>();
  order.items.forEach((i) => transferredQty.set(i.itemId, i.quantity));

  // Group ALL equipment by category
  const grouped = new Map<string, { id: number; name: string; unit: string; qty: number }[]>();
  CATEGORY_ORDER.forEach((cat) => grouped.set(cat, []));

  (allItems ?? []).forEach((item) => {
    const list = grouped.get(item.category) ?? [];
    list.push({
      id: item.id!,
      name: item.name,
      unit: item.unit,
      qty: transferredQty.get(item.id!) ?? 0,
    });
    grouped.set(item.category, list);
  });

  const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0.4in 0.5in; size: letter; }
          .do-page { font-size: 10.5px; }
        }
      `}</style>

      <div className="do-page max-w-[820px] mx-auto p-8 print:p-0 print:max-w-none text-zinc-900 print:text-black">
        {/* Print button bar */}
        <div className="no-print mb-6 flex gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print Delivery Order
          </button>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

        {/* ===== HEADER ===== */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-red-600 print:border-red-600">
          <div className="flex items-center gap-4">
            <Image
              src="/avema-logo.svg"
              alt="AVEMA"
              width={140}
              height={79}
              className="h-14 w-auto print:h-12"
              priority
            />
            <div className="border-l-2 border-zinc-200 print:border-gray-300 pl-4">
              <h1 className="text-lg font-bold tracking-tight leading-tight">
                MJR Construction
              </h1>
              <p className="text-[11px] text-zinc-500 print:text-gray-500">
                Formwork & Scaffolding
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block border-2 border-zinc-900 print:border-black rounded px-4 py-2">
              <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-zinc-500 print:text-gray-500 leading-tight">
                Delivery Order
              </p>
              <p className="text-2xl font-black font-mono leading-tight tracking-tight">
                {padDO(order.id!)}
              </p>
            </div>
            <p className="text-[11px] text-zinc-500 print:text-gray-600 mt-1.5">
              {formatDate(order.date)}
            </p>
          </div>
        </div>

        {/* ===== FROM / TO ===== */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-zinc-200 print:border-gray-300 rounded-lg px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 print:text-gray-400">
                Ship From
              </p>
            </div>
            <p className="font-bold text-[14px]">{fromLocation?.name ?? "—"}</p>
            {fromLocation?.address && (
              <p className="text-[11px] text-zinc-500 print:text-gray-600 mt-0.5 leading-snug">
                {fromLocation.address}
              </p>
            )}
          </div>
          <div className="border border-zinc-200 print:border-gray-300 rounded-lg px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 print:text-gray-400">
                Ship To
              </p>
            </div>
            <p className="font-bold text-[14px]">{toLocation?.name ?? "—"}</p>
            {toLocation?.address && (
              <p className="text-[11px] text-zinc-500 print:text-gray-600 mt-0.5 leading-snug">
                {toLocation.address}
              </p>
            )}
          </div>
        </div>

        {/* ===== FULL EQUIPMENT TABLE ===== */}
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="bg-red-600 print:bg-red-600 text-white px-3 py-1 rounded-t text-[10px] font-bold uppercase tracking-[0.15em]">
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              <table className="w-full border-collapse border-x border-zinc-200 print:border-gray-300">
                <thead>
                  <tr className="bg-zinc-50 print:bg-gray-50 border-b border-zinc-200 print:border-gray-300">
                    <th className="text-left py-1 px-3 text-[9px] font-bold uppercase tracking-wider text-zinc-400 print:text-gray-400">
                      Item
                    </th>
                    <th className="text-center py-1 px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 print:text-gray-400 w-14">
                      Unit
                    </th>
                    <th className="text-center py-1 px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 print:text-gray-400 w-16">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-100 print:border-gray-200 ${
                        item.qty > 0
                          ? "bg-red-50/50 print:bg-red-50/40"
                          : ""
                      }`}
                    >
                      <td className={`py-1 px-3 text-[11px] ${item.qty > 0 ? "font-semibold" : "text-zinc-500 print:text-gray-500"}`}>
                        {item.name}
                      </td>
                      <td className="py-1 px-2 text-[11px] text-center text-zinc-400 print:text-gray-400">
                        {item.unit}
                      </td>
                      <td className="py-1 px-2 text-center font-mono">
                        {item.qty > 0 ? (
                          <span className="text-[12px] font-black text-red-700 print:text-red-700">
                            {item.qty}
                          </span>
                        ) : (
                          <span className="text-zinc-200 print:text-gray-200 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Total */}
        <div className="flex justify-end mb-4">
          <div className="bg-zinc-900 print:bg-black text-white px-5 py-1.5 rounded text-[12px] font-bold tracking-wide">
            TOTAL: {totalQty} pcs
          </div>
        </div>

        {/* ===== NOTES ===== */}
        {order.notes && (
          <div className="mb-4 border border-zinc-200 print:border-gray-300 rounded-lg px-4 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 print:text-gray-400 mb-0.5">
              Notes
            </p>
            <p className="text-[11px] text-zinc-700 print:text-gray-700 whitespace-pre-wrap leading-relaxed">
              {order.notes}
            </p>
          </div>
        )}

        {/* ===== SIGNATURES ===== */}
        <div className="mt-6 grid grid-cols-3 gap-x-8 gap-y-6">
          {/* Driver */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 print:text-gray-400 mb-0.5">
              Driver
            </p>
            <div className="border-b-2 border-zinc-300 print:border-gray-400 pb-1 min-h-[24px] text-[12px] font-medium">
              {order.driverName || ""}
            </div>
          </div>

          {/* Sent by */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 print:text-gray-400 mb-0.5">
              Sent by
            </p>
            <div className="border-b-2 border-zinc-300 print:border-gray-400 pb-1 min-h-[24px]" />
            <p className="text-[9px] text-zinc-400 print:text-gray-400 mt-0.5">Signature</p>
          </div>

          {/* Received by */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400 print:text-gray-400 mb-0.5">
              Received by
            </p>
            <div className="border-b-2 border-zinc-300 print:border-gray-400 pb-1 min-h-[24px]" />
            <p className="text-[9px] text-zinc-400 print:text-gray-400 mt-0.5">Signature</p>
          </div>

          {/* Date lines */}
          <div>
            <div className="border-b-2 border-zinc-300 print:border-gray-400 pb-1 min-h-[20px]" />
            <p className="text-[9px] text-zinc-400 print:text-gray-400 mt-0.5">Date</p>
          </div>
          <div>
            <div className="border-b-2 border-zinc-300 print:border-gray-400 pb-1 min-h-[20px]" />
            <p className="text-[9px] text-zinc-400 print:text-gray-400 mt-0.5">Date</p>
          </div>
          <div>
            <div className="border-b-2 border-zinc-300 print:border-gray-400 pb-1 min-h-[20px]" />
            <p className="text-[9px] text-zinc-400 print:text-gray-400 mt-0.5">Date</p>
          </div>
        </div>
      </div>
    </>
  );
}
