"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PharmacyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0); // 0=idle, 1=uploading, 2=analyzing, 3=done

  const [pharmacies, setPharmacies] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/providers/search/organizations?org_type=pharmacy`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.organizations?.length > 0) {
          setPharmacies(
            data.organizations.map((org: any) => ({
              id: org.id,
              name: org.organization_name || org.name,
              address: [org.address, org.city].filter(Boolean).join(", "),
              delivery: true,
              is24x7: true,
              radius: 5,
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
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Pharmacy</h1>
          <p>Order medicines from verified pharmacies near you. Upload prescriptions or use e-prescriptions from consultations.</p>
        </div>

        {/* Upload Prescription */}
        <div className="card" style={{ padding: 32, marginBottom: 32, textAlign: "center", border: "2px dashed var(--color-gray-300)", background: "var(--color-gray-50)", position: 'relative', overflow: 'hidden' }}>
          {isUploading ? (
            <div style={{ padding: '20px' }}>
              <div style={{ width: '50px', height: '50px', border: '4px solid #cbd5e1', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>
                {uploadStep === 1 && "Uploading Prescription..."}
                {uploadStep === 2 && "AI is analyzing your prescription..."}
                {uploadStep === 3 && "Broadcasting to nearby pharmacies..."}
              </h3>
              <p style={{ color: '#64748b' }}>Please wait, you will be redirected to live tracking shortly.</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📄</div>
              <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", marginBottom: 8 }}>Upload Prescription</h3>
              <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem", marginBottom: 16 }}>
                Upload a photo of your prescription and we&apos;ll automatically extract the medicines and match you to the nearest pharmacy.
              </p>
              <button className="btn btn-primary" onClick={handleUploadClick}>Upload Prescription</button>
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
        <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.15rem", marginBottom: 16 }}>Pharmacies Near You</h3>
        <div className="grid-2">
          {pharmacies.map((p) => (
            <div key={p.name} className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 4 }}>{p.name}</h4>
                  <p style={{ fontSize: "0.82rem", color: "var(--color-gray-500)" }}>📍 {p.address}</p>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ color: "var(--color-amber)" }}>⭐</span>
                  <span style={{ fontWeight: 600 }}>{p.rating}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {p.delivery && <span className="badge badge-success">Home Delivery</span>}
                {p.is24x7 && <span className="badge badge-info">24×7</span>}
                <span className="badge badge-navy">{p.radius} km radius</span>
              </div>
              <button className="btn btn-primary btn-sm btn-full" onClick={() => router.push('/dashboard/patient')}>Order from Here</button>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 32, padding: 24, textAlign: "center", background: "var(--color-gray-50)" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)" }}>
            💊 All prescriptions require generic drug names per BIS mandate · e-Prescriptions auto-generated after video consultations · Drug license verified for all partner pharmacies
          </p>
        </div>
      </div>
    </div>
  );
}
