"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Plus,
  Warehouse,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import {
  useLocations,
  addLocation,
  updateLocation,
  deleteLocation,
} from "@/hooks/use-db";
import type { Location, LocationType } from "@/lib/db";

export default function LocationsPage() {
  const { data: locations, refresh } = useLocations();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("site");
  const [address, setAddress] = useState("");

  function openAdd() {
    setEditing(null);
    setName("");
    setType("site");
    setAddress("");
    setShowDialog(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setName(loc.name);
    setType(loc.type);
    setAddress(loc.address ?? "");
    setShowDialog(true);
    setMenuOpen(null);
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (editing?.id) {
      await updateLocation(editing.id, { name, type, address });
    } else {
      await addLocation({ name, type, address, status: "active" });
    }
    setShowDialog(false);
    refresh();
  }

  async function handleToggleStatus(loc: Location) {
    await updateLocation(loc.id!, {
      status: loc.status === "active" ? "inactive" : "active",
    });
    setMenuOpen(null);
    refresh();
  }

  async function handleDelete(id: number) {
    if (confirm("Delete this location and all its inventory?")) {
      await deleteLocation(id);
      setMenuOpen(null);
      refresh();
    }
  }

  const activeLocations =
    locations?.filter((l) => l.status === "active") ?? [];
  const inactiveLocations =
    locations?.filter((l) => l.status === "inactive") ?? [];

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage your yard and job sites
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      {!locations || locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add your yard or job sites to start tracking equipment."
          action={
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Location
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {activeLocations.map((loc) => (
              <LocationRow
                key={loc.id}
                loc={loc}
                menuOpen={menuOpen === loc.id}
                onMenuToggle={() =>
                  setMenuOpen(menuOpen === loc.id ? null : loc.id!)
                }
                onEdit={() => openEdit(loc)}
                onToggleStatus={() => handleToggleStatus(loc)}
                onDelete={() => handleDelete(loc.id!)}
              />
            ))}
          </div>

          {inactiveLocations.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-500 px-1">
                Inactive
              </h2>
              {inactiveLocations.map((loc) => (
                <LocationRow
                  key={loc.id}
                  loc={loc}
                  menuOpen={menuOpen === loc.id}
                  onMenuToggle={() =>
                    setMenuOpen(menuOpen === loc.id ? null : loc.id!)
                  }
                  onEdit={() => openEdit(loc)}
                  onToggleStatus={() => handleToggleStatus(loc)}
                  onDelete={() => handleDelete(loc.id!)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogClose onClose={() => setShowDialog(false)} />
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Location" : "Add Location"}
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              placeholder="e.g. Main Yard, 123 King St"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Type</label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as LocationType)}
            >
              <option value="yard">Yard</option>
              <option value="site">Job Site</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Address{" "}
              <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <Input
              placeholder="Street address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {editing ? "Save Changes" : "Add Location"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function LocationRow({
  loc,
  menuOpen,
  onMenuToggle,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  loc: Location;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative">
      <Card
        className={
          loc.status === "inactive" ? "opacity-60" : ""
        }
      >
        <CardContent className="flex items-center justify-between py-3 px-4">
          <Link
            href={`/locations/${loc.id}`}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              {loc.type === "yard" ? (
                <Warehouse className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              ) : (
                <MapPin className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{loc.name}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {loc.type}
                </Badge>
              </div>
              {loc.address && (
                <p className="text-xs text-zinc-500 truncate">{loc.address}</p>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <Link href={`/locations/${loc.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onMenuToggle}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onMenuToggle} />
          <div className="absolute right-4 top-12 z-50 w-44 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950 py-1">
            <button
              onClick={onEdit}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={onToggleStatus}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              {loc.status === "active" ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Deactivate
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Activate
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
