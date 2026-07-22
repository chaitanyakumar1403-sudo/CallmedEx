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

  const getStatusBadge = (status: string) => {
    switch(status) {
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
                          {o.status === 'confirmed' && (
                            <button onClick={() => updateOrderStatus(o.id, 'preparing')} style={{ background: '#f59e0b', color: '#fff', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Approve & Pack</button>
                          )}
                          {o.status === 'preparing' && (
                            <button onClick={() => updateOrderStatus(o.id, 'out_for_delivery')} style={{ background: '#8b5cf6', color: '#fff', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Dispatch Order</button>
                          )}
                          {o.status === 'out_for_delivery' && (
                            <button onClick={() => updateOrderStatus(o.id, 'delivered')} style={{ background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Mark Delivered</button>
                          )}
                          {o.status === 'delivered' && <span style={{ color: '#64748b' }}>Completed</span>}
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
                  <h2 style={{ fontSize: '20px', margin: '0 0 20px 0', color: '#f8fafc' }}>Add Medicine</h2>
                  <form onSubmit={handleAddInventory} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input type="text" placeholder="Medicine Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff' }} />
                    <input type="text" placeholder="Description/Dosage" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff' }} />
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <input type="number" placeholder="Price (₹)" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} required style={{ flex: 1, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff' }} />
                      <input type="number" placeholder="Stock Qty" value={newItem.stock_quantity || ''} onChange={e => setNewItem({...newItem, stock_quantity: parseInt(e.target.value)})} required style={{ flex: 1, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff' }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1' }}>
                      <input type="checkbox" checked={newItem.is_prescription_required} onChange={e => setNewItem({...newItem, is_prescription_required: e.target.checked})} />
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
      </div>
    </div>
  );
}
