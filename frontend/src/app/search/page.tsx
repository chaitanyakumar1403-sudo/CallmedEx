"use client";

import { useState, useEffect } from "react";

interface Organization {
  id: string;
  name?: string;
  organization_name?: string;
  organization_type?: string;
  type?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  address?: string;
  total_doctors?: number;
  doctors_count?: number;
  total_departments?: number;
  total_services?: number;
  services_count?: number;
  operating_hours?: string;
  is_verified?: boolean;
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [results, setResults] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Selected Provider Modal State
  const [selectedProvider, setSelectedProvider] = useState<Organization | null>(null);
  const [providerServices, setProviderServices] = useState<any[]>([]);
  const [providerPackages, setProviderPackages] = useState<any[]>([]);
  const [loadingProviderData, setLoadingProviderData] = useState(false);

  useEffect(() => {
    handleSearch();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setHasSearched(true);
    
    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/providers/search/organizations`);
      if (searchQuery) url.searchParams.append("q", searchQuery);
      if (locationQuery) url.searchParams.append("city", locationQuery);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setResults(data.organizations || []);
      } else {
        setResults([]);
      }
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderDetails = async (orgId: string) => {
    setLoadingProviderData(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/org-services/${orgId}`);
      const data = await res.json();
      if (data.success) {
        setProviderServices(data.data.services || []);
        setProviderPackages(data.data.packages || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProviderData(false);
    }
  };

  const openProviderModal = (org: Organization) => {
    setSelectedProvider(org);
    fetchProviderDetails(org.id);
  };

  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        
        {/* Search Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ color: "#1e293b", fontSize: "2.5rem", marginBottom: "12px", fontWeight: 800 }}>
            Find Hospitals, Clinics & Diagnostics
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem" }}>
            Search top-rated healthcare organizations, diagnostic centers, and clinics by name and location.
          </p>
        </div>

        {/* Search Box */}
        <div style={{ 
          backgroundColor: "white", 
          padding: "24px", 
          borderRadius: "16px", 
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          marginBottom: "40px"
        }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 300px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>
                Search by Name or Specialty
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "12px", fontSize: "1.2rem" }}>🔍</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Apollo Hospitals" 
                  style={{ 
                    width: "100%", padding: "12px 12px 12px 40px", 
                    borderRadius: "8px", border: "1px solid #cbd5e1",
                    fontSize: "1rem"
                  }} 
                />
              </div>
            </div>
            <div style={{ flex: "1 1 300px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>
                Location
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "12px", fontSize: "1.2rem" }}>📍</span>
                <input 
                  type="text" 
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="City, District, or Pincode" 
                  style={{ 
                    width: "100%", padding: "12px 12px 12px 40px", 
                    borderRadius: "8px", border: "1px solid #cbd5e1",
                    fontSize: "1rem"
                  }} 
                />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button 
                type="submit" 
                disabled={loading}
                style={{ 
                  padding: "12px 32px", backgroundColor: "#0f4c81", color: "white", 
                  border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "1rem",
                  cursor: loading ? "wait" : "pointer", height: "46px"
                }}
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        <div>
          <h2 style={{ fontSize: "1.2rem", color: "#334155", marginBottom: "20px" }}>
            {results.length} {results.length === 1 ? "Result" : "Results"} Found
          </h2>

          <div style={{ display: "grid", gap: "20px" }}>
            {results.map((org) => {
              const orgName = org.organization_name || org.name || "Healthcare Facility";
              const orgType = org.organization_type || org.type || "Facility";
              const fullLoc = [org.address, org.city, org.district || org.state].filter(Boolean).join(", ");
              const docsCount = org.doctors_count ?? org.total_doctors ?? 0;
              const svcsCount = org.services_count ?? 0;

              return (
                <div key={org.id} style={{ 
                  backgroundColor: "white", 
                  borderRadius: "12px", 
                  padding: "24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "1.4rem", color: "#0f172a" }}>{orgName}</h3>
                      <span style={{ 
                        backgroundColor: "#e0e7ff", color: "#3730a3", 
                        padding: "2px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700,
                        textTransform: "capitalize"
                      }}>
                        {orgType}
                      </span>
                    </div>
                    <div style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>📍</span> {fullLoc || org.city || "Visakhapatnam"}
                    </div>
                    <div style={{ display: "flex", gap: "16px", fontSize: "0.85rem", color: "#475569", flexWrap: "wrap" }}>
                      {docsCount > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span>👨‍⚕️</span> {docsCount} Doctors
                        </div>
                      )}
                      {svcsCount > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span>🧪</span> {svcsCount} Services
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span>✅</span> Verified Facility
                      </div>
                    </div>
                  </div>
                  <div>
                    <button onClick={() => openProviderModal(org)} style={{ 
                      padding: "10px 24px", backgroundColor: "#0284c7", color: "white", 
                      border: "none", borderRadius: "8px", fontWeight: 700,
                      cursor: "pointer", transition: "all 0.2s"
                    }}>
                      View Services
                    </button>
                  </div>
                </div>
              );
            })}
            
            {!loading && hasSearched && results.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "white", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                <span style={{ fontSize: "3rem", display: "block", marginBottom: "16px" }}>🏥</span>
                <h3 style={{ color: "#334155", margin: "0 0 8px 0" }}>No providers found</h3>
                <p style={{ color: "#64748b", margin: 0 }}>Try adjusting your search terms or location.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Provider Modal */}
      {selectedProvider && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ backgroundColor: "white", borderRadius: 12, padding: 32, width: "100%", maxWidth: 700, maxHeight: "85vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setSelectedProvider(null)} style={{ position: "absolute", top: 24, right: 24, background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }}>✕</button>
            
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>{selectedProvider.name || selectedProvider.organization_name}</h2>
              <span style={{ color: "#16a34a", fontSize: "1.2rem", background: "#dcfce7", padding: "2px 8px", borderRadius: 12 }}>✅ Verified</span>
            </div>
            <p style={{ color: "#64748b", margin: "0 0 24px 0", textTransform: "capitalize" }}>
              {selectedProvider.organization_type || selectedProvider.type} • {selectedProvider.address ? `${selectedProvider.address}, ` : ''}{selectedProvider.city}
            </p>

            {loadingProviderData ? (
              <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Loading services and packages...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {providerServices.length > 0 && (
                  <div>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>Available Services</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {providerServices.map(svc => (
                        <div key={svc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{svc.name}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>{svc.description}</div>
                            <div style={{ color: "#16a34a", fontWeight: 600, marginTop: 8 }}>₹{svc.price}</div>
                          </div>
                          <button onClick={() => {
                            setSelectedProvider(null);
                            window.location.href = `/booking?type=lab&org=${selectedProvider.id}&service=${svc.id}`;
                          }} style={{ padding: "8px 16px", backgroundColor: "#0284c7", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
                            Book Now
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {providerPackages.length > 0 && (
                  <div>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>Health Packages</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {providerPackages.map(pkg => (
                        <div key={pkg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, border: "1px solid #e2e8f0", borderRadius: 8, backgroundColor: "#f8fafc" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{pkg.name}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>{pkg.description}</div>
                            <div style={{ color: "#16a34a", fontWeight: 600, marginTop: 8 }}>₹{pkg.price}</div>
                          </div>
                          <button onClick={() => {
                            setSelectedProvider(null);
                            window.location.href = `/booking?type=lab&org=${selectedProvider.id}&package=${pkg.id}`;
                          }} style={{ padding: "8px 16px", backgroundColor: "#0284c7", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
                            Book Package
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {providerServices.length === 0 && providerPackages.length === 0 && (
                  <div style={{ textAlign: "center", padding: 20, color: "#64748b", backgroundColor: "#f8fafc", borderRadius: 8 }}>
                    No active services or packages found for this provider.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
