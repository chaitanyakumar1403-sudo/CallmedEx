"use client";

import { useState, useEffect } from 'react';
import ProviderDispatchTracker from '../components/ProviderDispatchTracker';
import DashboardProfile from '../components/DashboardProfile';
import DrugShieldModal from '../../components/DrugShieldModal';

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => localStorage.getItem("token") || "";

export default function PharmacyDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [showDrugShield, setShowDrugShield] = useState(false);

  // New Inventory State
  const [newItem, setNewItem] = useState({ name: '', description: '', price: 0, stock_quantity: 0, category: 'medicine', is_prescription_required: false });

  // Batch CSV Import state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);

  // Print Invoice Thermal Modal state
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);


  const fetchOrders = async () => {
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/orders/incoming`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.success) setOrders(data.orders);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/inventory`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.success) setInventory(data.inventory);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.success && data.data.role === "pharmacy") {
        setProfile(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchOrders(), fetchInventory()]);
      setLoading(false);
    };
    loadData();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchOrders();
    } catch (err) {
      alert("Network error updating status.");
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        fetchInventory();
        setNewItem({ name: '', description: '', price: 0, stock_quantity: 0, category: 'medicine', is_prescription_required: false });
      }
    } catch (err) {
      alert("Failed to add inventory item.");
    }
  };

  const handleDeleteInventory = async (itemId: string) => {
    if (!confirm("Remove this item?")) return;
    try {
      const res = await fetch(`${apiBase}/api/pharmacy/inventory/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      if (res.ok) fetchInventory();
    } catch (err) {
      alert("Failed to delete item.");
    }
  };

  const handleBulkImportCsv = async () => {
    if (!csvText.trim()) {
      alert("Please paste CSV data or select a file first.");
      return;
    }
    setImportingCsv(true);

    try {
      const lines = csvText.trim().split("\n");
      const items: any[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().startsWith("name,") || line.toLowerCase().startsWith("name")) continue;
        const parts = line.split(",").map(p => p.trim());
        if (parts.length >= 3) {
          items.push({
            name: parts[0],
            description: parts[1] || "Generic Prescription Medicine",
            price: parseFloat(parts[2]) || 50.0,
            stock_quantity: parseInt(parts[3]) || 100,
            category: parts[4] || "medicine",
            is_prescription_required: parts[5] ? parts[5].toLowerCase() === "true" || parts[5] === "1" : false
          });
        }
      }

      if (items.length === 0) {
        alert("No valid SKU rows parsed. Format:\nMedicine Name, Description, Price, Stock, Category, PrescriptionRequired(true/false)");
        setImportingCsv(false);
        return;
      }

      const res = await fetch(`${apiBase}/api/pharmacy/inventory/bulk-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ items })
      });

      const data = await res.json();
      if (data.success) {
        alert(`✅ Successfully imported ${data.count} medicine SKUs into inventory!`);
        setShowCsvModal(false);
        setCsvText("");
        fetchInventory();
      } else {
        alert(data.detail || "Failed to batch import CSV");
      }
    } catch (e) {
      alert("Error parsing CSV or connecting to backend server.");
    } finally {
      setImportingCsv(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>New Order</span>;
      case 'preparing': return <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Packing</span>;
      case 'out_for_delivery': return <span style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Dispatched</span>;
      case 'delivered': return <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Delivered ✓</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', padding: '40px', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', background: 'linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.8))', padding: '30px', borderRadius: '24px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '36px', background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Pharmacy Terminal
            </h1>
            <p style={{ color: '#94a3b8', margin: '0', fontSize: '16px' }}>Manage prescriptions, digital inventory, and dispatches.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setShowDrugShield(true)}
              style={{
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🛡️ DrugShield AI Verification
            </button>
            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
              Store Online
            </span>
          </div>
        </div>

        <DrugShieldModal isOpen={showDrugShield} onClose={() => setShowDrugShield(false)} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
          {['overview', 'orders', 'inventory', 'delivery', 'profile'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 24px',
                backgroundColor: activeTab === tab ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeTab === tab ? '#818cf8' : '#94a3b8',
                border: activeTab === tab ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                borderRadius: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'delivery' ? 'Delivery Dispatch' : tab === 'profile' ? 'Profile Details' : tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}>Loading Pharmacy Data...</div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div
                  onClick={() => setActiveTab('orders')}
                  style={{ background: 'rgba(30,41,59,0.5)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)"; e.currentTarget.style.background = "rgba(30,41,59,0.8)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "rgba(30,41,59,0.5)"; }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '10px' }}>Active Orders</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#f8fafc' }}>{orders.filter(o => o.status !== 'delivered').length}</div>
                </div>
                <div
                  onClick={() => setActiveTab('orders')}
                  style={{ background: 'rgba(30,41,59,0.5)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 10px 25px rgba(245, 158, 11, 0.1)"; e.currentTarget.style.background = "rgba(30,41,59,0.8)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "rgba(30,41,59,0.5)"; }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '10px' }}>To Pack</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#f59e0b' }}>{orders.filter(o => o.status === 'confirmed').length}</div>
                </div>
                <div
                  onClick={() => setActiveTab('inventory')}
                  style={{ background: 'rgba(30,41,59,0.5)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 10px 25px rgba(139, 92, 246, 0.1)"; e.currentTarget.style.background = "rgba(30,41,59,0.8)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "rgba(30,41,59,0.5)"; }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '10px' }}>Inventory Items</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#8b5cf6' }}>{inventory.length}</div>
                </div>
                <div
                  onClick={() => setActiveTab('orders')}
                  style={{ background: 'rgba(30,41,59,0.5)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 10px 25px rgba(56, 189, 248, 0.1)"; e.currentTarget.style.background = "rgba(30,41,59,0.8)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "rgba(30,41,59,0.5)"; }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '10px' }}>Out for Delivery</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#38bdf8' }}>{orders.filter(o => o.status === 'out_for_delivery').length}</div>
                </div>
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'rgba(15,23,42,0.8)' }}>
                    <tr>
                      <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Order ID</th>
                      <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Medicines</th>
                      <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Prescription</th>
                      <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Status</th>
                      <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No active orders</td></tr>
                    )}
                    {orders.map((o) => (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '20px' }}>
                          <div style={{ fontWeight: '600', color: '#e2e8f0' }}>#{o.id.substring(0, 8).toUpperCase()}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{new Date(o.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td style={{ padding: '20px', color: '#cbd5e1' }}>
                          <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            {o.medicines_list?.map((m: any, idx: number) => (
                              <li key={idx}>{m.name} <span style={{ color: '#94a3b8' }}>x{m.quantity}</span></li>
                            ))}
                          </ul>
                        </td>
                        <td style={{ padding: '20px' }}>
                          {o.prescription_url ? (
                            <a href={o.prescription_url} target="_blank" style={{ color: '#60a5fa', textDecoration: 'none' }}>View Document</a>
                          ) : <span style={{ color: '#64748b' }}>Not Required</span>}
                        </td>
                        <td style={{ padding: '20px' }}>{getStatusBadge(o.status)}</td>
                        <td style={{ padding: '20px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {o.status === 'confirmed' && (
                              <button onClick={() => updateOrderStatus(o.id, 'preparing')} style={{ background: '#f59e0b', color: '#fff', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Approve & Pack</button>
                            )}
                            {o.status === 'preparing' && (
                              <button onClick={() => updateOrderStatus(o.id, 'out_for_delivery')} style={{ background: '#8b5cf6', color: '#fff', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Dispatch Order</button>
                            )}
                            {o.status === 'out_for_delivery' && (
                              <button onClick={() => updateOrderStatus(o.id, 'delivered')} style={{ background: '#10b981', color: '#fff', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Mark Delivered</button>
                            )}
                            <button
                              onClick={() => { setSelectedInvoiceOrder(o); setShowInvoiceModal(true); }}
                              style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                            >
                              🖨️ Print Invoice
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
                <div style={{ flex: '1', background: 'rgba(30,41,59,0.5)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', margin: 0, color: '#f8fafc' }}>Add Medicine</h2>
                    <button
                      onClick={() => setShowCsvModal(true)}
                      style={{
                        padding: '8px 14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📥 Batch Import CSV
                    </button>
                  </div>

                  <form onSubmit={handleAddInventory} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input type="text" placeholder="Medicine Name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} required style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff' }} />
                    <input type="text" placeholder="Description/Dosage" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff' }} />
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <input type="number" placeholder="Price (₹)" value={newItem.price || ''} onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) })} required style={{ flex: 1, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff' }} />
                      <input type="number" placeholder="Stock Qty" value={newItem.stock_quantity || ''} onChange={e => setNewItem({ ...newItem, stock_quantity: parseInt(e.target.value) })} required style={{ flex: 1, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff' }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1' }}>
                      <input type="checkbox" checked={newItem.is_prescription_required} onChange={e => setNewItem({ ...newItem, is_prescription_required: e.target.checked })} />
                      Prescription Required
                    </label>
                    <button type="submit" style={{ background: 'linear-gradient(to right, #6366f1, #8b5cf6)', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>Add to Inventory</button>
                  </form>
                </div>

                <div style={{ flex: '2', background: 'rgba(30,41,59,0.5)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: 'rgba(15,23,42,0.8)' }}>
                      <tr>
                        <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Name</th>
                        <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Price</th>
                        <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Stock</th>
                        <th style={{ padding: '20px', color: '#94a3b8', fontWeight: '500' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '20px' }}>
                            <div style={{ color: '#e2e8f0', fontWeight: '600' }}>{item.name}</div>
                            {item.is_prescription_required && <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>Rx Required</span>}
                          </td>
                          <td style={{ padding: '20px', color: '#38bdf8', fontWeight: 'bold' }}>₹{item.price}</td>
                          <td style={{ padding: '20px', color: item.stock_quantity > 10 ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>{item.stock_quantity} units</td>
                          <td style={{ padding: '20px' }}>
                            <button onClick={() => handleDeleteInventory(item.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* DELIVERY DISPATCH TAB */}
            {activeTab === 'delivery' && (
              <div style={{ margin: "-40px", borderRadius: "20px", overflow: "hidden" }}>
                <ProviderDispatchTracker
                  title="Pharmacy Delivery Dispatch"
                  icon="🛵"
                  providerType="pharmacy_delivery"
                  earningsRate={100}
                />
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <DashboardProfile profile={profile} role="pharmacy" />
            )}
          </>
        )}
        {/* ─── BATCH IMPORT CSV MODAL ─── */}
        {showCsvModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1000,
            display: "flex", justifyContent: "center", alignItems: "center", padding: 20
          }}>
            <div style={{
              backgroundColor: "#1e293b", borderRadius: 20, padding: 30,
              width: "100%", maxWidth: 600, border: "1px solid rgba(255,255,255,0.1)",
              color: "#f8fafc", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            }}>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.3rem", color: "#60a5fa" }}>
                📥 Batch Import Medicine SKUs (CSV)
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: 16 }}>
                Paste CSV data below or enter comma-separated lines. Columns: <br />
                <code style={{ background: "#0f172a", padding: "4px 8px", borderRadius: 4, color: "#38bdf8", fontSize: "0.8rem" }}>
                  Name, Description, Price, Stock, Category, RxRequired(true/false)
                </code>
              </p>

              <textarea
                rows={8}
                placeholder={`Paracetamol 500mg, Analgesic Tablet, 45.0, 250, tablet, false\nAmoxicillin 500mg, Antibiotic Capsule, 120.0, 80, capsule, true\nCetrizen 10mg, Antihistamine, 30.0, 150, tablet, false`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                style={{
                  width: "100%", padding: "14px", borderRadius: 10,
                  backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e2e8f0", fontFamily: "monospace", fontSize: "0.85rem", marginBottom: 16
                }}
              />

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setShowCsvModal(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImportCsv}
                  disabled={importingCsv}
                  style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "white", fontWeight: 800, cursor: importingCsv ? "wait" : "pointer" }}
                >
                  {importingCsv ? "Importing..." : "🚀 Upload & Import SKUs"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── THERMAL POS RECEIPT PRINT MODAL ─── */}
        {showInvoiceModal && selectedInvoiceOrder && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1000,
            display: "flex", justifyContent: "center", alignItems: "center", padding: 20
          }}>
            <div style={{
              backgroundColor: "#ffffff", borderRadius: 16, padding: 30,
              width: "100%", maxWidth: 420, color: "#1e293b", fontFamily: "monospace",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
            }}>
              <div style={{ textAlign: "center", borderBottom: "2px dashed #94a3b8", paddingBottom: 16, marginBottom: 16 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 900 }}>💊 CALLMEDEX PHARMACY</h2>
                <div style={{ fontSize: "0.75rem", color: "#475569" }}>Licensed Medical Counter & Dark Store</div>
                <div style={{ fontSize: "0.75rem", color: "#475569" }}>GSTIN: 37AAACC1208D1Z2 · Reg No: AP/VZG/2026/982</div>
                <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: 4 }}>Date: {new Date(selectedInvoiceOrder.created_at || Date.now()).toLocaleString()}</div>
              </div>

              <div style={{ fontSize: "0.8rem", marginBottom: 16 }}>
                <div><strong>Invoice No:</strong> TXN-PHARM-{selectedInvoiceOrder.id?.slice(0, 8).toUpperCase()}</div>
                <div><strong>Patient Address:</strong> {selectedInvoiceOrder.delivery_address || "Home Delivery"}</div>
                <div><strong>Status:</strong> {selectedInvoiceOrder.status?.toUpperCase()}</div>
              </div>

              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                    <th style={{ padding: "4px 0" }}>Item</th>
                    <th style={{ padding: "4px 0", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "4px 0", textAlign: "right" }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoiceOrder.medicines_list || [{ name: "Prescription Medicine", quantity: 1 }]).map((m: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: "1px dashed #f1f5f9" }}>
                      <td style={{ padding: "6px 0" }}>{m.name}</td>
                      <td style={{ padding: "6px 0", textAlign: "center" }}>x{m.quantity}</td>
                      <td style={{ padding: "6px 0", textAlign: "right" }}>₹{(m.quantity || 1) * 120}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: "2px dashed #94a3b8", paddingTop: 12, marginBottom: 20, fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>Subtotal:</span>
                  <span>₹240.00</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>CGST (6%) + SGST (6%):</span>
                  <span>₹28.80</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: "1rem", color: "#0f172a", marginTop: 8, borderTop: "1px solid #cbd5e1", paddingTop: 8 }}>
                  <span>GRAND TOTAL:</span>
                  <span>₹268.80</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer", fontWeight: 700 }}
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#0284c7", color: "white", fontWeight: 800, cursor: "pointer" }}
                >
                  🖨️ Print Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

