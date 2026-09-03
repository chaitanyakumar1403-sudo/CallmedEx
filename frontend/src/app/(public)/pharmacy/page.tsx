"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Pill, MapPin, Star, ShieldCheck, Clock, Truck, Loader2 } from "lucide-react";

export default function PharmacyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0); // 0=idle, 1=uploading, 2=analyzing, 3=done

  const [pharmacies, setPharmacies] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/pharmacy/search`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.pharmacies?.length > 0) {
          setPharmacies(
            data.pharmacies.map((p: any) => ({
              id: p.id,
              name: p.pharmacy_name || p.name || "Pharmacy",
              address: [p.address, p.city].filter(Boolean).join(", "),
              delivery: p.home_delivery ?? true,
              is24x7: p.available_24x7 ?? false,
              radius: p.service_radius_km ?? 5,
              rating: 4.8,
            }))
          );
        } else {
          setPharmacies([]);
        }
      })
      .catch(console.error);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      setUploadStep(1); // Uploading
      
      // Simulate file upload delay
      await new Promise(r => setTimeout(r, 1500));
      
      setUploadStep(2); // Analyzing with AI
      // Simulate OCR / AI extraction delay
      await new Promise(r => setTimeout(r, 2000));
      
      setUploadStep(3); // Creating Dispatch Request
      await requestPharmacyDispatch();
    }
  };

  const requestPharmacyDispatch = async () => {
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser.");
      setIsUploading(false);
      setUploadStep(0);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const token = localStorage.getItem("token");
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        try {
          // The simulated AI extracted notes:
          const aiExtractedNotes = `Urgent Pharmacy Request: Prescription Uploaded
Prescription URL: https://example.com/prescription_mock_123.jpg
Extracted Medicines:
- Paracetamol 500mg x10
- Amoxicillin 250mg x5
- Cough Syrup 100ml x1`;

          const res = await fetch(`${apiBase}/api/dispatch/request`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({
              patient_lat: position.coords.latitude,
              patient_lng: position.coords.longitude,
              patient_address: "Current GPS Location",
              provider_type: "pharmacy_delivery",
              service_subtype: "Prescription Medicines",
              notes: aiExtractedNotes
            })
          });
          const data = await res.json();
          if (data.dispatch_id) {
            localStorage.setItem("activeDispatchId", data.dispatch_id);
            // Route to patient dashboard to see live tracking
            router.push("/dashboard/patient");
          }
        } catch (e) {
          console.error(e);
          alert("Failed to request dispatch.");
          setIsUploading(false);
          setUploadStep(0);
        }
      },
      (error) => {
        alert(`Location access denied: ${error.message}`);
        setIsUploading(false);
        setUploadStep(0);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  return (
    <div className="section" style={{ background: "var(--cm-surface)", minHeight: "100vh" }}>
      <div className="container">
        <div className="section-title">
          <h1 style={{ color: "var(--cm-navy)" }}>Pharmacy &amp; Prescription Delivery</h1>
          <p>Order medicines from verified pharmacies near you. Upload prescriptions or use e-prescriptions from consultations.</p>
        </div>

        {/* Upload Prescription */}
        <div className="cm-card" style={{ padding: 36, marginBottom: 32, textAlign: "center", border: "2px dashed var(--cm-line-strong)", background: "var(--cm-surface-2)", position: 'relative', overflow: 'hidden', borderRadius: "var(--cm-radius)" }}>
          {isUploading ? (
            <div style={{ padding: '20px' }}>
              <div style={{ width: 48, height: 48, margin: "0 auto 16px auto", display: "grid", placeItems: "center" }}>
                <Loader2 size={36} className="cm-spin" style={{ color: "var(--cm-active)" }} />
              </div>
              <h3 style={{ margin: '0 0 10px 0', color: 'var(--cm-navy)', fontSize: "var(--cm-text-base)", fontWeight: 800 }}>
                {uploadStep === 1 && "Uploading Prescription..."}
                {uploadStep === 2 && "Clinical AI is analyzing your prescription..."}
                {uploadStep === 3 && "Broadcasting to nearby licensed pharmacies..."}
              </h3>
              <p style={{ color: 'var(--cm-ink-3)', fontSize: "var(--cm-text-xs)", margin: 0 }}>Please wait, you will be redirected to live tracking shortly.</p>
            </div>
          ) : (
            <>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", display: "grid", placeItems: "center", margin: "0 auto 16px auto", color: "var(--cm-active)" }}>
                <UploadCloud size={28} />
              </div>
              <h3 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, marginBottom: 8, color: "var(--cm-ink)" }}>Upload Doctor&apos;s Prescription</h3>
              <p style={{ color: "var(--cm-ink-2)", fontSize: "var(--cm-text-xs)", marginBottom: 20, maxWidth: 480, marginInline: "auto" }}>
                Upload a photo or PDF of your prescription. Our licensed pharmacist network extracts the generic formulation and routes to your nearest pharmacy for dispatch.
              </p>
              <button className="cm-btn cm-btn--primary" onClick={handleUploadClick}>Upload Prescription</button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*,.pdf" 
                style={{ display: 'none' }} 
              />
            </>
          )}
        </div>

        {/* Pharmacy List */}
        <h3 style={{ fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-navy)", marginBottom: 16 }}>Registered Pharmacies Near You</h3>
        {pharmacies.length > 0 ? (
        <div className="grid-2">
          {pharmacies.map((p) => (
            <div key={p.id || p.name} className="cm-card" style={{ padding: 24, border: "1px solid var(--cm-line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 4 }}>{p.name}</h4>
                  <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={12} /> {p.address}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", color: "var(--cm-waiting)" }}>
                  <Star size={14} fill="currentColor" />
                  <span style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)" }}>{p.rating}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {p.delivery && <span className="cm-pill cm-pill--done" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Truck size={12} /> Home Delivery</span>}
                {p.is24x7 && <span className="cm-pill cm-pill--active" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> 24×7</span>}
                <span className="cm-pill cm-pill--navy">{p.radius} km radius</span>
              </div>
              <button className="cm-btn cm-btn--primary cm-btn--sm" style={{ width: "100%" }} onClick={() => router.push('/dashboard/patient')}>Order from Here</button>
            </div>
          ))}
        </div>
        ) : (
          <div className="cm-card" style={{ padding: 40, textAlign: "center", border: "1px solid var(--cm-line)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--cm-surface-2)", color: "var(--cm-ink-3)", display: "grid", placeItems: "center", margin: "0 auto 12px auto" }}>
              <Pill size={24} />
            </div>
            <h4 style={{ color: "var(--cm-ink)", marginBottom: 8, fontSize: "var(--cm-text-base)", fontWeight: 800 }}>No Registered Pharmacies Yet</h4>
            <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", maxWidth: 440, margin: "0 auto" }}>
              Pharmacies registered on CallMedex will appear here. You can still upload a prescription above and our care coordinator will dispatch it to a verified local pharmacy.
            </p>
          </div>
        )}

        <div className="cm-card" style={{ marginTop: 32, padding: 20, textAlign: "center", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
          <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={16} style={{ color: "var(--cm-done)" }} /> All prescriptions require generic drug names per BIS mandate · e-Prescriptions auto-generated after video consultations · Drug license verified for all partner pharmacies
          </p>
        </div>
      </div>
    </div>
  );
}
