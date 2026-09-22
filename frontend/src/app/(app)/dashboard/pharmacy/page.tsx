"use client";

/**
 * Pharmacy terminal — orders, inventory, delivery dispatch, profile.
 *
 * Everything shown is the pharmacy's own data from the API. The previous page
 * printed invoices with a hardcoded GSTIN, a fixed Rs 120 per line and a fixed
 * Rs 268.80 total, and its inventory form posted to columns that did not exist
 * (so nothing was ever saved). Presentation is class-based (foundation.css
 * `.cm-pharm*`) and gated by scripts/lint-ui.mjs.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import DashboardShell from "../components/DashboardShell";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import { Banner, Button, EmptyState, Field, Icon, Modal, Pill, Select, TextInput } from "@/components/ui";
import type { Tone } from "@/components/ui";
import {
  AlertTriangle, BarChart3, Boxes, CheckCircle2, ClipboardList, Download, FileSpreadsheet, FileText,
  Package, Pencil, Phone, Pill as PillIcon, Plus, Printer, Search, Trash2, Truck, Upload, User,
} from "@/components/ui/icons";
import { customConfirm } from "@/lib/customConfirm";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") || "" : "");
const authHeaders = (json = false): HeadersInit => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${getToken()}`,
});

const LOW_STOCK = 10;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

interface OrderItem { name: string; quantity: number }
interface Order {
  id: string;
  status: string;
  created_at?: string;
  medicines_list?: OrderItem[];
  prescription_url?: string | null;
  delivery_address?: string;
  total_cost?: number;
  patient_name?: string;
  patient_phone?: string;
}
interface InventoryItem {
  id: string;
  sku?: string;
  name: string;
  generic_name?: string;
  category?: string;
  price: number;
  stock_quantity: number;
  batch_number?: string;
  is_prescription_required: boolean;
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Awaiting confirmation", tone: "waiting" },
  confirmed: { label: "New order", tone: "active" },
  preparing: { label: "Packing", tone: "waiting" },
  out_for_delivery: { label: "Out for delivery", tone: "active" },
  delivered: { label: "Delivered", tone: "done" },
  cancelled: { label: "Cancelled", tone: "halted" },
};

// The one next step each order can take — mirrors the backend's _ORDER_FLOW.
const NEXT: Record<string, { to: string; label: string }> = {
  pending: { to: "confirmed", label: "Accept order" },
  confirmed: { to: "preparing", label: "Start packing" },
  preparing: { to: "out_for_delivery", label: "Hand to courier" },
  out_for_delivery: { to: "delivered", label: "Mark delivered" },
};
const CANCELLABLE = new Set(["pending", "confirmed", "preparing"]);
const OPEN = new Set(["pending", "confirmed", "preparing", "out_for_delivery"]);

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "confirmed", label: "New" },
  { id: "preparing", label: "Packing" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "orders", label: "Orders", icon: Package },
  { id: "inventory", label: "Inventory", icon: PillIcon },
  { id: "delivery", label: "Delivery Dispatch", icon: Truck },
  { id: "profile", label: "Profile", icon: User },
];

const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// ── Spreadsheet import ────────────────────────────────────────────────────
const TEMPLATE_ROWS = [
  { "Medicine Name": "Paracetamol 500mg Tablet", "Generic Name": "Paracetamol", "Category": "Tablet", "MRP": 24, "Stock Qty": 250, "Batch No": "PCM2409A", "SKU": "PCM-500", "Prescription Required": "No" },
  { "Medicine Name": "Amoxicillin 500mg Capsule", "Generic Name": "Amoxicillin", "Category": "Capsule", "MRP": 110, "Stock Qty": 80, "Batch No": "AMX2408C", "SKU": "AMX-500", "Prescription Required": "Yes" },
  { "Medicine Name": "Cetirizine 10mg Tablet", "Generic Name": "Cetirizine", "Category": "Tablet", "MRP": 30, "Stock Qty": 150, "Batch No": "CTZ2407B", "SKU": "CTZ-10", "Prescription Required": "No" },
  { "Medicine Name": "Metformin 500mg Tablet", "Generic Name": "Metformin", "Category": "Tablet", "MRP": 45, "Stock Qty": 200, "Batch No": "MTF2409D", "SKU": "MTF-500", "Prescription Required": "Yes" },
  { "Medicine Name": "ORS Powder Sachet", "Generic Name": "Oral Rehydration Salts", "Category": "Powder", "MRP": 22, "Stock Qty": 120, "Batch No": "ORS2406E", "SKU": "ORS-21", "Prescription Required": "No" },
];

const normKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
function pick(row: Record<string, unknown>, cands: string[]): unknown {
  for (const c of cands) {
    for (const [k, v] of Object.entries(row)) {
      if ((k === c || k.startsWith(`${c} `)) && v !== "" && v != null) return v;
    }
  }
  return undefined;
}
const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")));
const yes = (v: unknown) => ["yes", "y", "true", "1", "rx", "h", "h1", "schedule h"].includes(String(v ?? "").trim().toLowerCase());

interface ParsedRow {
  name: string; generic_name: string; category: string; price: number; stock_quantity: number;
  batch_number: string; sku: string; is_prescription_required: boolean;
}

function parseSheet(rows: Record<string, unknown>[]): { ok: ParsedRow[]; skipped: number } {
  const ok: ParsedRow[] = [];
  let skipped = 0;
  for (const raw of rows) {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) row[normKey(k)] = v;
    const name = String(pick(row, ["medicine name", "medicine", "product name", "product", "item name", "item", "drug", "brand", "name"]) ?? "").trim();
    const price = num(pick(row, ["mrp", "unit price", "selling price", "price", "rate"]));
    const stock = num(pick(row, ["stock qty", "stock quantity", "stock", "quantity", "qty", "units"]));
    if (!name || !(price > 0) || !(stock >= 0) || Number.isNaN(stock)) { skipped += 1; continue; }
    ok.push({
      name: name.slice(0, 200),
      generic_name: String(pick(row, ["generic name", "generic", "salt", "composition", "description"]) ?? "").trim(),
      category: String(pick(row, ["category", "form", "type"]) ?? "medicine").trim() || "medicine",
      price: Math.round(price * 100) / 100,
      stock_quantity: Math.floor(stock),
      batch_number: String(pick(row, ["batch no", "batch number", "batch"]) ?? "").trim(),
      sku: String(pick(row, ["sku", "item code", "product code", "code"]) ?? "").trim(),
      is_prescription_required: yes(pick(row, ["prescription required", "rx required", "rx", "schedule"])),
    });
  }
  return { ok, skipped };
}

const EMPTY_FORM = { name: "", generic_name: "", category: "Tablet", price: "", stock_quantity: "", batch_number: "", is_prescription_required: false };

export default function PharmacyDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

  const [orderFilter, setOrderFilter] = useState("open");
  const [orderQuery, setOrderQuery] = useState("");
  const [invQuery, setInvQuery] = useState("");

  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [importPreview, setImportPreview] = useState<{ file: string; rows: ParsedRow[]; skipped: number } | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/orders/incoming`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.success) setOrders(data.orders || []);
    } catch {
      /* next poll retries */
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/inventory`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.success) setInventory(data.inventory || []);
    } catch {
      setMsg({ tone: "urgent", text: "Could not load your inventory. Check your connection." });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/auth/me`, { headers: authHeaders() });
        const data = await res.json();
        if (data.success && data.data?.role === "pharmacy") setProfile(data.data);
      } catch {
        /* profile tab shows its own empty state */
      }
      await Promise.all([fetchOrders(), fetchInventory()]);
      setLoading(false);
    })();
    const t = setInterval(() => {
      if (document.visibilityState !== "hidden") fetchOrders();
    }, 15000);
    return () => clearInterval(t);
  }, [fetchOrders, fetchInventory]);

  // ── Orders ──────────────────────────────────────────────────────────────
  const moveOrder = async (o: Order, to: string) => {
    if (to === "cancelled" && !(await customConfirm(`Cancel order #${shortId(o.id)}? The patient will be told it was not fulfilled.`))) return;
    setBusyOrder(o.id);
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/orders/${o.id}/status`, {
        method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ status: to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: "urgent", text: data.detail || "Could not update the order." });
      } else {
        setMsg({ tone: "done", text: `Order #${shortId(o.id)} — ${STATUS[to]?.label || to}.` });
      }
      await fetchOrders();
    } catch {
      setMsg({ tone: "urgent", text: "Network error while updating the order." });
    } finally {
      setBusyOrder(null);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length, open: 0 };
    orders.forEach((o) => {
      c[o.status] = (c[o.status] || 0) + 1;
      if (OPEN.has(o.status)) c.open += 1;
    });
    return c;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderFilter === "open" ? !OPEN.has(o.status) : orderFilter !== "all" && o.status !== orderFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q)
        || (o.patient_name || "").toLowerCase().includes(q)
        || (o.patient_phone || "").includes(q)
        || (o.medicines_list || []).some((m) => m.name.toLowerCase().includes(q))
      );
    });
  }, [orders, orderFilter, orderQuery]);

  const printInvoice = (o: Order) => {
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) {
      setMsg({ tone: "waiting", text: "Allow pop-ups for this site to print the invoice." });
      return;
    }
    const p = profile || {};
    const items = (o.medicines_list || [])
      .map((m) => `<tr><td>${esc(m.name)}</td><td class="r">${esc(m.quantity)}</td></tr>`)
      .join("");
    const total = Number(o.total_cost || 0) > 0 ? inr(Number(o.total_cost)) : "To be confirmed at billing";
    w.document.write(`<!doctype html><html><head><title>Invoice ${esc(shortId(o.id))}</title>
<style>
  body { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: black; margin: 16px; }
  h1 { font-size: 15px; margin: 0 0 2px; } .m { color: dimgray; margin: 0; }
  hr { border: 0; border-top: 1px dashed gray; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; } td, th { padding: 3px 0; text-align: left; }
  .r { text-align: right; } .t { font-weight: bold; font-size: 13px; }
</style></head><body>
<h1>${esc(p.pharmacy_name || p.full_name || "Pharmacy")}</h1>
${p.address ? `<p class="m">${esc(p.address)}${p.city ? `, ${esc(p.city)}` : ""}</p>` : ""}
${p.drug_license_number ? `<p class="m">Drug Licence: ${esc(p.drug_license_number)}</p>` : ""}
${p.gst_number ? `<p class="m">GSTIN: ${esc(p.gst_number)}</p>` : ""}
<hr/>
<p class="m">Order: ${esc(shortId(o.id))}</p>
<p class="m">Date: ${esc(when(o.created_at))}</p>
${o.patient_name ? `<p class="m">Patient: ${esc(o.patient_name)}</p>` : ""}
${o.delivery_address ? `<p class="m">Deliver to: ${esc(o.delivery_address)}</p>` : ""}
<hr/>
<table><thead><tr><th>Item</th><th class="r">Qty</th></tr></thead><tbody>${items || `<tr><td colspan="2">No items listed</td></tr>`}</tbody></table>
<hr/>
<table><tr><td class="t">Total</td><td class="r t">${esc(total)}</td></tr></table>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  // ── Inventory ───────────────────────────────────────────────────────────
  const lowStock = useMemo(
    () => inventory.filter((i) => i.stock_quantity <= LOW_STOCK).sort((a, b) => a.stock_quantity - b.stock_quantity),
    [inventory]
  );
  const visibleInventory = useMemo(() => {
    const q = invQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((i) =>
      [i.name, i.generic_name, i.sku, i.category, i.batch_number].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [inventory, invQuery]);

  const openEditor = (item: InventoryItem | "new") => {
    setEditing(item);
    setForm(item === "new" ? EMPTY_FORM : {
      name: item.name,
      generic_name: item.generic_name || "",
      category: item.category || "medicine",
      price: String(item.price ?? ""),
      stock_quantity: String(item.stock_quantity ?? ""),
      batch_number: item.batch_number || "",
      is_prescription_required: item.is_prescription_required,
    });
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    const stock = Number(form.stock_quantity);
    if (!form.name.trim() || !(price > 0) || !(stock >= 0) || !Number.isInteger(stock)) {
      setMsg({ tone: "urgent", text: "Enter a medicine name, a price above zero and a whole-number stock quantity." });
      return;
    }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      generic_name: form.generic_name.trim(),
      category: form.category.trim() || "medicine",
      price,
      stock_quantity: stock,
      batch_number: form.batch_number.trim(),
      is_prescription_required: form.is_prescription_required,
    };
    try {
      const isNew = editing === "new";
      const res = await fetch(
        isNew ? `${apiBase}/api/pharmacy/inventory` : `${apiBase}/api/pharmacy/inventory/${(editing as InventoryItem).id}`,
        { method: isNew ? "POST" : "PATCH", headers: authHeaders(true), body: JSON.stringify(body) }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: "urgent", text: data.detail || "Could not save this medicine." });
        return;
      }
      setMsg({ tone: "done", text: `${body.name} ${isNew ? "added to" : "updated in"} inventory.` });
      setEditing(null);
      fetchInventory();
    } catch {
      setMsg({ tone: "urgent", text: "Network error — the medicine was not saved." });
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: InventoryItem) => {
    if (!(await customConfirm(`Remove ${item.name} from your inventory?`))) return;
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/inventory/${item.id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { tone: "done", text: `${item.name} removed.` } : { tone: "urgent", text: data.detail || "Could not remove it." });
      fetchInventory();
    } catch {
      setMsg({ tone: "urgent", text: "Network error — nothing was removed." });
    }
  };

  const downloadTemplate = (format: "xlsx" | "csv") => {
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_ROWS);
    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Medicines");
      XLSX.writeFile(wb, "CallMedex_Pharmacy_Inventory_Template.xlsx");
    } else {
      const blob = new Blob([XLSX.utils.sheet_to_csv(ws)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "CallMedex_Pharmacy_Inventory_Template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setMsg({ tone: "urgent", text: "That file is larger than 5 MB. Split it into smaller sheets." });
      return;
    }
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const { ok, skipped } = parseSheet(rows);
      if (ok.length === 0) {
        setMsg({ tone: "urgent", text: "No usable rows found. Each row needs a medicine name, a price and a stock quantity — download the sample to see the columns." });
        return;
      }
      if (ok.length > 5000) {
        setMsg({ tone: "urgent", text: `This sheet has ${ok.length} medicines; import at most 5,000 at a time.` });
        return;
      }
      setImportPreview({ file: file.name, rows: ok, skipped });
    } catch {
      setMsg({ tone: "urgent", text: "That file could not be read. Upload a .xlsx, .xls or .csv spreadsheet." });
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/inventory/bulk-import`, {
        method: "POST", headers: authHeaders(true), body: JSON.stringify({ items: importPreview.rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMsg({ tone: "urgent", text: data.detail || "The import failed. Nothing was added." });
        return;
      }
      setMsg({ tone: "done", text: data.message || `Imported ${data.count} medicines.` });
      setImportPreview(null);
      fetchInventory();
    } catch {
      setMsg({ tone: "urgent", text: "Network error during import. Nothing was added." });
    } finally {
      setImporting(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────
  const orderActions = (o: Order) => (
    <div className="cm-pharm-actions">
      {NEXT[o.status] && (
        <Button size="sm" onClick={() => moveOrder(o, NEXT[o.status].to)} loading={busyOrder === o.id}>
          {NEXT[o.status].label}
        </Button>
      )}
      {CANCELLABLE.has(o.status) && (
        <Button size="sm" variant="ghost" onClick={() => moveOrder(o, "cancelled")} disabled={busyOrder === o.id}>
          Cancel
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={() => printInvoice(o)} aria-label={`Print invoice for order ${shortId(o.id)}`}>
        <Icon as={Printer} size={14} /> Invoice
      </Button>
    </div>
  );

  const stockCell = (i: InventoryItem) => (
    <span className={i.stock_quantity === 0 ? "cm-pharm-stock--out" : i.stock_quantity <= LOW_STOCK ? "cm-pharm-stock--low" : ""}>
      {i.stock_quantity.toLocaleString("en-IN")}
    </span>
  );

  const kpis = [
    { label: "New orders", value: counts.confirmed || 0, sub: "Waiting to be packed", icon: ClipboardList, go: () => { setOrderFilter("confirmed"); setActiveTab("orders"); } },
    { label: "Packing", value: counts.preparing || 0, sub: "Being prepared", icon: Package, go: () => { setOrderFilter("preparing"); setActiveTab("orders"); } },
    { label: "Out for delivery", value: counts.out_for_delivery || 0, sub: "With the courier", icon: Truck, go: () => { setOrderFilter("out_for_delivery"); setActiveTab("orders"); } },
    { label: "Low stock", value: lowStock.length, sub: `${inventory.length} medicines in catalogue`, icon: AlertTriangle, warn: lowStock.length > 0, go: () => setActiveTab("inventory") },
  ];

  return (
    <DashboardShell
      role="pharmacy"
      title="Pharmacy Terminal"
      subtitle="Orders, stock and delivery dispatch"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="cm-pharm">
        {msg && <Banner tone={msg.tone} onDismiss={() => setMsg(null)}>{msg.text}</Banner>}

        {loading ? (
          <div className="cm-pharm-panel">
            <div className="cm-pharm-panel__body">Loading your pharmacy…</div>
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <>
                <div className="cm-pharm-kpis">
                  {kpis.map((k) => (
                    <button key={k.label} type="button" className="cm-pharm-kpi" onClick={k.go}>
                      <div>
                        <div className="cm-pharm-kpi__label">{k.label}</div>
                        <div className={`cm-pharm-kpi__value${k.warn ? " cm-pharm-kpi__value--warn" : ""}`}>{k.value}</div>
                        <div className="cm-pharm-kpi__sub">{k.sub}</div>
                      </div>
                      <span className="cm-pharm-kpi__icon"><Icon as={k.icon} size={20} /></span>
                    </button>
                  ))}
                </div>

                <div className="cm-pharm-grid">
                  <section className="cm-pharm-panel" aria-labelledby="ph-queue">
                    <header className="cm-pharm-panel__head">
                      <div>
                        <p className="cm-pharm-panel__eyebrow">Fulfilment queue</p>
                        <h2 id="ph-queue" className="cm-pharm-panel__title">Orders needing action</h2>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => { setOrderFilter("open"); setActiveTab("orders"); }}>
                        All orders
                      </Button>
                    </header>
                    {orders.filter((o) => NEXT[o.status]).length === 0 ? (
                      <div className="cm-pharm-panel__body">
                        <EmptyState icon={CheckCircle2} title="Nothing waiting" body="New orders from patients near you appear here the moment they are placed." />
                      </div>
                    ) : (
                      <ul className="cm-pharm-list">
                        {orders.filter((o) => NEXT[o.status]).slice(0, 6).map((o) => (
                          <li key={o.id} className="cm-pharm-list__row">
                            <div>
                              <div className="cm-pharm-cell__title">
                                #{shortId(o.id)} · {(o.medicines_list || []).length} item{(o.medicines_list || []).length === 1 ? "" : "s"}
                              </div>
                              <div className="cm-pharm-cell__sub">{[o.patient_name, when(o.created_at)].filter(Boolean).join(" · ")}</div>
                            </div>
                            <div className="cm-pharm-actions">
                              <Pill tone={STATUS[o.status]?.tone || "halted"}>{STATUS[o.status]?.label || o.status}</Pill>
                              <Button size="sm" onClick={() => moveOrder(o, NEXT[o.status].to)} loading={busyOrder === o.id}>
                                {NEXT[o.status].label}
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="cm-pharm-panel" aria-labelledby="ph-low">
                    <header className="cm-pharm-panel__head">
                      <div>
                        <p className="cm-pharm-panel__eyebrow">Stock</p>
                        <h2 id="ph-low" className="cm-pharm-panel__title">Low stock</h2>
                        <p className="cm-pharm-panel__desc">{LOW_STOCK} units or fewer.</p>
                      </div>
                    </header>
                    {lowStock.length === 0 ? (
                      <div className="cm-pharm-panel__body">
                        <EmptyState
                          icon={Boxes}
                          title={inventory.length === 0 ? "No medicines yet" : "Stock looks healthy"}
                          body={inventory.length === 0 ? "Add medicines or import your stock sheet from the Inventory tab." : undefined}
                          action={inventory.length === 0 ? <Button size="sm" onClick={() => setActiveTab("inventory")}>Open inventory</Button> : undefined}
                        />
                      </div>
                    ) : (
                      <ul className="cm-pharm-list">
                        {lowStock.slice(0, 8).map((i) => (
                          <li key={i.id} className="cm-pharm-list__row">
                            <div>
                              <div className="cm-pharm-cell__title">{i.name}</div>
                              <div className="cm-pharm-cell__sub">{i.generic_name || i.category}</div>
                            </div>
                            <div className="cm-pharm-actions">
                              {stockCell(i)}
                              <Button size="sm" variant="secondary" onClick={() => { setActiveTab("inventory"); openEditor(i); }}>
                                Restock
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </>
            )}

            {activeTab === "orders" && (
              <section className="cm-pharm-panel" aria-labelledby="ph-orders">
                <header className="cm-pharm-panel__head">
                  <div>
                    <p className="cm-pharm-panel__eyebrow">Orders</p>
                    <h2 id="ph-orders" className="cm-pharm-panel__title">Patient orders</h2>
                    <p className="cm-pharm-panel__desc">Orders routed to your pharmacy. Move each one along as you pack and dispatch it.</p>
                  </div>
                </header>
                <div className="cm-pharm-toolbar">
                  <div className="cm-pharm-filter" role="group" aria-label="Filter orders">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className="cm-pharm-filter__btn"
                        aria-pressed={orderFilter === f.id}
                        onClick={() => setOrderFilter(f.id)}
                      >
                        {f.label} <span className="cm-pharm-filter__n">{counts[f.id] || 0}</span>
                      </button>
                    ))}
                  </div>
                  <label className="cm-pharm-search">
                    <span className="cm-pharm-search__icon"><Icon as={Search} size={16} /></span>
                    <input
                      className="cm-input"
                      value={orderQuery}
                      onChange={(e) => setOrderQuery(e.target.value)}
                      placeholder="Search order, patient or medicine"
                      aria-label="Search orders"
                    />
                  </label>
                </div>
                {visibleOrders.length === 0 ? (
                  <div className="cm-pharm-panel__body">
                    <EmptyState
                      icon={Package}
                      title={orders.length === 0 ? "No orders yet" : "No orders match"}
                      body={orders.length === 0 ? "Orders placed by patients in your delivery area will appear here." : "Try another filter or search."}
                    />
                  </div>
                ) : (
                  <div className="cm-pharm-table-wrap">
                    <table className="cm-pharm-table">
                      <thead>
                        <tr>
                          <th scope="col">Order</th>
                          <th scope="col">Patient</th>
                          <th scope="col">Medicines</th>
                          <th scope="col">Prescription</th>
                          <th scope="col">Status</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOrders.map((o) => (
                          <tr key={o.id}>
                            <td>
                              <div className="cm-pharm-cell__mono">#{shortId(o.id)}</div>
                              <div className="cm-pharm-cell__sub">{when(o.created_at)}</div>
                            </td>
                            <td>
                              <div className="cm-pharm-cell__title">{o.patient_name || "Patient"}</div>
                              {o.patient_phone && (
                                <div className="cm-pharm-cell__sub"><Icon as={Phone} size={14} /> {o.patient_phone}</div>
                              )}
                              {o.delivery_address && <div className="cm-pharm-cell__sub">{o.delivery_address}</div>}
                            </td>
                            <td>
                              {(o.medicines_list || []).length > 0 ? (
                                <ul className="cm-pharm-items">
                                  {(o.medicines_list || []).map((m, idx) => (
                                    <li key={`${m.name}-${idx}`}>
                                      <span>{m.name}</span>
                                      <span className="cm-pharm-items__qty">× {m.quantity}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="cm-pharm-muted">From prescription</span>
                              )}
                            </td>
                            <td>
                              {o.prescription_url ? (
                                <a className="cm-pharm-link" href={o.prescription_url} target="_blank" rel="noopener noreferrer">
                                  <Icon as={FileText} size={14} /> View
                                </a>
                              ) : (
                                <span className="cm-pharm-muted">Not attached</span>
                              )}
                            </td>
                            <td><Pill tone={STATUS[o.status]?.tone || "halted"}>{STATUS[o.status]?.label || o.status}</Pill></td>
                            <td>{orderActions(o)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === "inventory" && (
              <section className="cm-pharm-panel" aria-labelledby="ph-inv">
                <header className="cm-pharm-panel__head">
                  <div>
                    <p className="cm-pharm-panel__eyebrow">Inventory</p>
                    <h2 id="ph-inv" className="cm-pharm-panel__title">Medicine catalogue</h2>
                    <p className="cm-pharm-panel__desc">
                      {inventory.length} medicine{inventory.length === 1 ? "" : "s"} · {lowStock.length} low on stock
                    </p>
                  </div>
                  <Button onClick={() => openEditor("new")}>
                    <Icon as={Plus} size={16} /> Add medicine
                  </Button>
                </header>

                <div className="cm-pharm-import">
                  <div>
                    <p className="cm-pharm-import__title"><Icon as={FileSpreadsheet} size={20} /> Import your stock sheet</p>
                    <p className="cm-pharm-import__desc">
                      Upload an Excel or CSV file with medicine name, MRP and stock quantity (generic name, category, batch, SKU and prescription flag are optional).
                      Rows matching an existing SKU or medicine name update its price and stock instead of duplicating it.
                    </p>
                  </div>
                  <div className="cm-pharm-actions">
                    <label className="cm-btn cm-btn--primary cm-btn--sm cm-pharm-file">
                      <Icon as={Upload} size={14} /> Import CSV / Excel <span className="cm-pharm-file__limit">≤5MB</span>
                      <input type="file" accept=".csv,.xlsx,.xls" onChange={onImportFile} aria-label="Import CSV or Excel stock sheet" />
                    </label>
                    <Button size="sm" variant="secondary" onClick={() => downloadTemplate("xlsx")}>
                      <Icon as={Download} size={14} /> Sample Excel (.xlsx)
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => downloadTemplate("csv")}>
                      <Icon as={Download} size={14} /> Sample CSV
                    </Button>
                  </div>
                </div>

                <div className="cm-pharm-toolbar">
                  <label className="cm-pharm-search">
                    <span className="cm-pharm-search__icon"><Icon as={Search} size={16} /></span>
                    <input
                      className="cm-input"
                      value={invQuery}
                      onChange={(e) => setInvQuery(e.target.value)}
                      placeholder="Search name, generic, SKU, batch"
                      aria-label="Search inventory"
                    />
                  </label>
                </div>

                {visibleInventory.length === 0 ? (
                  <div className="cm-pharm-panel__body">
                    <EmptyState
                      icon={PillIcon}
                      title={inventory.length === 0 ? "Your catalogue is empty" : "No medicines match"}
                      body={inventory.length === 0 ? "Add medicines one by one, or import your stock sheet above." : "Try a different search."}
                    />
                  </div>
                ) : (
                  <div className="cm-pharm-table-wrap">
                    <table className="cm-pharm-table">
                      <thead>
                        <tr>
                          <th scope="col">Medicine</th>
                          <th scope="col">Category</th>
                          <th scope="col">Batch</th>
                          <th scope="col" className="cm-pharm-table__num">MRP</th>
                          <th scope="col" className="cm-pharm-table__num">Stock</th>
                          <th scope="col">Rx</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleInventory.map((i) => (
                          <tr key={i.id}>
                            <td>
                              <div className="cm-pharm-cell__title">{i.name}</div>
                              <div className="cm-pharm-cell__sub">
                                {[i.generic_name, i.sku].filter(Boolean).join(" · ")}
                              </div>
                            </td>
                            <td>{i.category || <span className="cm-pharm-muted">—</span>}</td>
                            <td>{i.batch_number ? <span className="cm-pharm-cell__mono">{i.batch_number}</span> : <span className="cm-pharm-muted">—</span>}</td>
                            <td className="cm-pharm-table__num">{inr(i.price)}</td>
                            <td className="cm-pharm-table__num">{stockCell(i)}</td>
                            <td>{i.is_prescription_required ? <Pill tone="waiting">Rx</Pill> : <span className="cm-pharm-muted">OTC</span>}</td>
                            <td>
                              <div className="cm-pharm-actions">
                                <Button size="sm" variant="secondary" onClick={() => openEditor(i)} aria-label={`Edit ${i.name}`}>
                                  <Icon as={Pencil} size={14} /> Edit
                                </Button>
                                <Button size="sm" variant="ghost" iconOnly onClick={() => removeItem(i)} aria-label={`Remove ${i.name}`}>
                                  <Icon as={Trash2} size={16} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === "delivery" && (
              <ProviderDispatchTracker title="Pharmacy Delivery Dispatch" providerType="pharmacy_delivery" />
            )}

            {activeTab === "profile" && <DashboardProfile profile={profile} role="pharmacy" onProfileUpdated={setProfile} />}
          </>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add medicine" : "Edit medicine"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" form="ph-item-form" loading={saving}>
              {editing === "new" ? "Add to inventory" : "Save changes"}
            </Button>
          </>
        }
      >
        <form id="ph-item-form" className="cm-pharm-form" onSubmit={saveItem}>
          <div className="cm-pharm-form__full">
            <Field label="Medicine name" id="ph-name" required>
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Paracetamol 500mg Tablet" />
            </Field>
          </div>
          <Field label="Generic name" id="ph-generic">
            <TextInput value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} placeholder="e.g. Paracetamol" />
          </Field>
          <Field label="Category" id="ph-cat">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Drops", "Powder", "Device", "medicine"].map((c) => (
                <option key={c} value={c}>{c === "medicine" ? "Other" : c}</option>
              ))}
            </Select>
          </Field>
          <Field label="MRP (₹)" id="ph-price" required>
            <TextInput type="number" min={0.01} step="0.01" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Stock quantity" id="ph-stock" required>
            <TextInput type="number" min={0} step={1} inputMode="numeric" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
          </Field>
          <Field label="Batch number" id="ph-batch">
            <TextInput value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
          </Field>
          <label className="cm-pharm-check">
            <input
              type="checkbox"
              checked={form.is_prescription_required}
              onChange={(e) => setForm({ ...form, is_prescription_required: e.target.checked })}
            />
            Prescription required (Schedule H / H1)
          </label>
        </form>
      </Modal>

      <Modal
        open={importPreview !== null}
        onClose={() => !importing && setImportPreview(null)}
        title="Review import"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportPreview(null)} disabled={importing}>Cancel</Button>
            <Button onClick={confirmImport} loading={importing}>
              Import {importPreview?.rows.length || 0} medicine{importPreview?.rows.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        {importPreview && (
          <>
            <div className="cm-pharm-summary">
              <span>File: <strong>{importPreview.file}</strong></span>
              <span>Ready: <strong>{importPreview.rows.length}</strong></span>
              {importPreview.skipped > 0 && <span>Skipped (missing name, price or stock): <strong>{importPreview.skipped}</strong></span>}
            </div>
            <div className="cm-pharm-preview">
              <table className="cm-pharm-table">
                <thead>
                  <tr>
                    <th scope="col">Medicine</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="cm-pharm-table__num">MRP</th>
                    <th scope="col" className="cm-pharm-table__num">Stock</th>
                    <th scope="col">Rx</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.slice(0, 50).map((r, idx) => (
                    <tr key={`${r.name}-${idx}`}>
                      <td>
                        <div className="cm-pharm-cell__title">{r.name}</div>
                        <div className="cm-pharm-cell__sub">{[r.generic_name, r.sku, r.batch_number].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td>{r.category}</td>
                      <td className="cm-pharm-table__num">{inr(r.price)}</td>
                      <td className="cm-pharm-table__num">{r.stock_quantity}</td>
                      <td>{r.is_prescription_required ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importPreview.rows.length > 50 && (
              <p className="cm-pharm-panel__desc">Showing the first 50 of {importPreview.rows.length} rows.</p>
            )}
          </>
        )}
      </Modal>
    </DashboardShell>
  );
}
