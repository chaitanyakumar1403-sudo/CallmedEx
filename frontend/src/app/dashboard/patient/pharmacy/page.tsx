"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PharmacyDelivery() {
  const router = useRouter();
  const [medicines, setMedicines] = useState([{ name: '', quantity: 1 }]);
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState({ lat: 17.6868, lng: 83.2185 }); // Default Vizag
  const [status, setStatus] = useState('');
  const [orderId, setOrderId] = useState('');
  const [trackingStep, setTrackingStep] = useState(0);

  const detectLocation = () => {
    if (navigator.geolocation) {
      setStatus('Detecting GPS location & resolving address...');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoords({ lat, lng });
          
          try {
            // Reverse Geocoding using Geoapify (or fallback to Nominatim)
            const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || "";
            let displayName = "";
            if (geoapifyKey) {
              const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${geoapifyKey}&format=json`);
              const data = await res.json();
              displayName = data.results?.[0]?.formatted || "";
            } else {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
              const data = await res.json();
              displayName = data?.display_name || "";
            }
            if (displayName) {
              setAddress(displayName);
              setStatus('Exact address resolved successfully!');
            } else {
              setAddress(`GPS Detected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
              setStatus('Location detected (Address resolution failed).');
            }
          } catch (err) {
            setAddress(`GPS Detected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            setStatus('Location detected successfully!');
          }
        },
        () => setStatus('GPS detection failed. Please type address manually.')
      );
    } else {
      setStatus('Geolocation is not supported by your browser.');
    }
  };

  const addMedicine = () => setMedicines([...medicines, { name: '', quantity: 1 }]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Finding nearest pharmacy...');
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/pharmacy/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          medicines_list: medicines,
          delivery_address: address,
          patient_lat: coords.lat,
          patient_lng: coords.lng
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Order placed! Matched with Pharmacy ID: ${data.assigned_pharmacy_id || 'System'}`);
        setOrderId(data.order_id);
        setTrackingStep(1); // Initial state
      } else {
        setStatus(`Error: ${data.detail || 'Failed to place order'}`);
      }
    } catch (err) {
      setStatus('Network error');
    }
  };

  useEffect(() => {
    let interval: any;
    if (orderId) {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/pharmacy/track/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && data.order) {
            const statusMap: any = {
              'confirmed': 1,
              'preparing': 2,
              'out_for_delivery': 3,
              'delivered': 4
            };
            setTrackingStep(statusMap[data.order.status] || 0);
            if (data.order.status === 'delivered') clearInterval(interval);
          }
        } catch (err) {
          console.error("Polling error");
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [orderId]);

  const renderTracking = () => {
    const steps = [
      "Placing Order...", 
      "Order Confirmed & Pharmacy Matched", 
      "Pharmacist is preparing medicines", 
      "Delivery partner is on the way (Live ETA: 12 mins)", 
      "Delivered Successfully!"
    ];

    return (
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f7fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#1a2b4a' }}>Live Order Tracking</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {steps.map((step, idx) => {
            const isActive = idx === trackingStep;
            const isCompleted = idx < trackingStep;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ 
                  width: '24px', height: '24px', borderRadius: '50%', 
                  backgroundColor: isCompleted ? '#38a169' : (isActive ? '#3182ce' : '#cbd5e0'),
                  display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px'
                }}>
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span style={{ 
                  color: isCompleted ? '#2f855a' : (isActive ? '#2b6cb0' : '#a0aec0'),
                  fontWeight: isActive ? 'bold' : 'normal'
                }}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#f0f4f8', minHeight: '100vh', padding: '40px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '12px' }}>
        <h1 style={{ color: '#1a2b4a' }}>Pharmacy Dark-Store Delivery</h1>
        <p style={{ color: '#4a5568', marginBottom: '30px' }}>Upload your prescription or manually enter medicines. Our AI will route it to the nearest verified pharmacy.</p>
        
        <form onSubmit={handlePlaceOrder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0', color: '#2d3748' }}>Medicines</h3>
            {medicines.map((med, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input 
                  required 
                  placeholder="Medicine Name (e.g. Dolo 650)" 
                  value={med.name} 
                  onChange={e => {
                    const newMeds = [...medicines];
                    newMeds[idx].name = e.target.value;
                    setMedicines(newMeds);
                  }}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }} 
                />
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={med.quantity} 
                  onChange={e => {
                    const newMeds = [...medicines];
                    newMeds[idx].quantity = parseInt(e.target.value);
                    setMedicines(newMeds);
                  }}
                  style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }} 
                />
              </div>
            ))}
            <button type="button" onClick={addMedicine} style={{ padding: '8px 15px', borderRadius: '6px', backgroundColor: '#edf2f7', border: 'none', cursor: 'pointer', color: '#4a5568', fontWeight: 'bold' }}>+ Add Medicine</button>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
              <h3 style={{ margin: '0', color: '#2d3748' }}>Delivery Address</h3>
              <button 
                type="button" 
                onClick={detectLocation}
                style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#4a5568', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                📍 Detect My Location
              </button>
            </div>
            <textarea 
              required 
              rows={3} 
              placeholder="Full Address" 
              value={address} 
              onChange={e => setAddress(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }} 
            />
          </div>

          {!orderId && (
            <button type="submit" style={{ padding: '15px', borderRadius: '8px', backgroundColor: '#3182ce', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
              Place Order
            </button>
          )}
          
          {status && !orderId && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#ebf8ff', color: '#2b6cb0', borderRadius: '8px', fontWeight: 'bold' }}>
              {status}
            </div>
          )}
        </form>

        {orderId && renderTracking()}
      </div>
    </div>
  );
}
