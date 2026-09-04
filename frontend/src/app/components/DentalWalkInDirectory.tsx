"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  Clock,
  Star,
  CheckCircle2,
  X,
  Filter,
  Sparkles,
  Search,
  Building2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";

export interface DentalOffer {
  provider_id: string;
  provider_kind: "dentist" | "dental_clinic";
  center_name: string;
  doctor_name: string;
  qualification: string;
  dental_license_number?: string;
  address: string;
  city: string;
  state: string;
  rating: number | null;
  reviews_count: number;
  turnaround_hours: number;
  mrp: number;
  callmedex_price: number;
  savings: number;
  discount_pct: number;
  modality: "clinic";
  duration: string;
  verified: boolean;
  is_live?: boolean;
}

export interface DentalService {
  id: string;
  slug: string;
  name: string;
  category: string;
  sub_category: string;
  billing_class: string;
  duration: string;
  benchmark_mrp: number;
  min_price: number | null;
  max_savings: number;
  description: string;
  preparation?: string;
  modality: "clinic";
  offers_count: number;
  offers: DentalOffer[];
}

interface DentalWalkInDirectoryProps {
  onBookingCreated?: () => void;
  lang?: string;
}

const DENTAL_CATEGORY_TABS = [
  { key: "all", label: "All Procedures (19)" },
  { key: "Diagnostic & Preventive", label: "Preventive & Diagnostic" },
  { key: "Restorative & Endodontics", label: "Restorative & RCT" },
  { key: "Prosthodontics", label: "Crowns & Dentures" },
  { key: "Periodontics", label: "Periodontal Care" },
  { key: "Oral & Maxillofacial Surgery", label: "Oral Surgery" },
  { key: "Orthodontics", label: "Orthodontics & Aligners" },
] as const;

export default function DentalWalkInDirectory({
  onBookingCreated,
  lang = "en",
}: DentalWalkInDirectoryProps) {
  const [services, setServices] = useState<DentalService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"price" | "rating">("price");

  // Booking Modal State
  const [bookingModal, setBookingModal] = useState<{
    service: DentalService;
    offer: DentalOffer;
  } | null>(null);
  const [bookingDate, setBookingDate] = useState<string>("");
  const [bookingSlot, setBookingSlot] = useState<string>("Morning (10:00 AM - 01:00 PM)");
  const [bookingNotes, setBookingNotes] = useState<string>("");
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    async function loadDentalServices() {
      try {
        setLoading(true);
        setError(null);
        const url = cityFilter
          ? `${apiBase}/api/marketplace/dental/services?city=${encodeURIComponent(cityFilter)}`
          : `${apiBase}/api/marketplace/dental/services`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch dental services");
        const data = await res.json();
        if (data.success && Array.isArray(data.services)) {
          setServices(data.services);
          if (data.services.length > 0 && !selectedServiceId) {
            setSelectedServiceId(data.services[0].id);
          }
        }
      } catch (err: any) {
        console.error("Error loading dental services:", err);
        setError("Unable to load dental clinic services. Please retry.");
      } finally {
        setLoading(false);
      }
    }

    loadDentalServices();
  }, [apiBase, cityFilter]);

  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      const catMatch = selectedCategory === "all" || svc.sub_category === selectedCategory || svc.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const searchMatch = !q ||
        svc.name.toLowerCase().includes(q) ||
        (svc.description || "").toLowerCase().includes(q) ||
        (svc.sub_category || "").toLowerCase().includes(q);
      return catMatch && searchMatch;
    });
  }, [services, selectedCategory, searchQuery]);

  useEffect(() => {
    if (filteredServices.length > 0) {
      if (!filteredServices.some((s) => s.id === selectedServiceId)) {
        setSelectedServiceId(filteredServices[0].id);
      }
    }
  }, [filteredServices, selectedServiceId]);

  const activeService = useMemo(() => {
    return filteredServices.find((s) => s.id === selectedServiceId) || filteredServices[0] || null;
  }, [filteredServices, selectedServiceId]);

  const sortedOffers = useMemo(() => {
    if (!activeService) return [];
    const list = [...activeService.offers];
    if (sortBy === "price") {
      list.sort((a, b) => a.callmedex_price - b.callmedex_price);
    } else if (sortBy === "rating") {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return list;
  }, [activeService, sortBy]);

  const handleBookWalkIn = async () => {
    if (!bookingModal || !bookingDate) {
      toast.error("Please select a preferred walk-in date");
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast.error("Please sign in as a patient to schedule a dental appointment");
      return;
    }

    setSubmittingBooking(true);
    try {
      const res = await fetch(`${apiBase}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider_id: bookingModal.offer.provider_id,
          provider_type: "dentist",
          service_type: "dental",
          slot_id: `walkin|${bookingDate}|${bookingSlot.replace(/\s+/g, "")}`,
          notes: `${bookingModal.service.name} (Walk-In) at ${bookingModal.offer.center_name} [${bookingSlot}]${bookingNotes ? ` · Note: ${bookingNotes}` : ""}`,
          total_price: bookingModal.offer.callmedex_price,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          `Walk-in appointment confirmed at ${bookingModal.offer.center_name} for ${bookingModal.service.name}`
        );
        setBookingModal(null);
        setBookingDate("");
        setBookingNotes("");
        if (onBookingCreated) {
          onBookingCreated();
        }
      } else {
        toast.error(data.detail || data.message || "Failed to schedule appointment");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error while scheduling appointment");
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--cm-surface)",
        borderRadius: "var(--cm-radius)",
        border: "1px solid var(--cm-line)",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
          borderBottom: "1px solid var(--cm-line)",
          paddingBottom: "16px",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "9999px",
              background: "#eff6ff",
              color: "#0369a1",
              fontSize: "0.75rem",
              fontWeight: 700,
              marginBottom: "8px",
              border: "1px solid #bae6fd",
            }}
          >
            <Clinical3DIcon name="dental" size={16} />
            <span>100% In-Clinic Walk-In Protocol · 19 Canonical Procedures</span>
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "var(--cm-ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Dental Practice &amp; Oral Care Clinics
          </h3>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "0.85rem",
              color: "var(--cm-ink-3)",
            }}
          >
            Compare verified dental surgeons, consult BDS/MDS specialists, and book standardized dental treatments with transparent clinic pricing.
          </p>
        </div>

        {/* Filters / Sort / Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: "var(--cm-ink-3)" }} />
            <input
              type="text"
              placeholder="Search RCT, scaling, crowns, aligners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "6px 12px 6px 30px",
                borderRadius: "8px",
                border: "1px solid var(--cm-line)",
                background: "var(--cm-surface-2)",
                fontSize: "0.8rem",
                color: "var(--cm-ink)",
                outline: "none",
                width: "220px",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--cm-line)",
              background: "var(--cm-surface-2)",
              fontSize: "0.8rem",
            }}
          >
            <Filter size={14} style={{ color: "var(--cm-ink-3)" }} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--cm-ink)",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
                fontSize: "0.8rem",
              }}
            >
              <option value="price">Sort: Lowest Tariff</option>
              <option value="rating">Sort: Highest Rating</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--cm-ink-3)" }}>
          <div style={{ margin: "0 auto 12px", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clinical3DIcon name="dental" size={38} glow />
          </div>
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>
            Loading verified dental clinics &amp; procedure tariffs...
          </p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: "20px",
            backgroundColor: "var(--cm-urgent-surface)",
            color: "var(--cm-urgent)",
            borderRadius: "8px",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      ) : (
        <>
          {/* Category Navigation */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              paddingBottom: "10px",
              marginBottom: "10px",
              scrollbarWidth: "none",
            }}
          >
            {DENTAL_CATEGORY_TABS.map((cat) => {
              const isCatActive = selectedCategory === cat.key;
              const count = services.filter((s) => {
                if (cat.key === "all") return true;
                return s.sub_category === cat.key || s.category === cat.key;
              }).length;

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: "9999px",
                    border: isCatActive
                      ? "1px solid var(--cm-navy)"
                      : "1px solid var(--cm-line)",
                    background: isCatActive ? "var(--cm-navy)" : "var(--cm-surface)",
                    color: isCatActive ? "#ffffff" : "var(--cm-ink-2)",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{cat.label}</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "1px 6px",
                      borderRadius: "9999px",
                      background: isCatActive ? "rgba(255, 255, 255, 0.25)" : "var(--cm-surface-3)",
                      color: isCatActive ? "#ffffff" : "var(--cm-ink-3)",
                      fontWeight: 800,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Procedure Tabs Rail */}
          {filteredServices.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--cm-ink-3)", fontSize: "0.88rem" }}>
              No dental procedures match "{searchQuery}".
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                paddingBottom: "12px",
                marginBottom: "16px",
                scrollbarWidth: "thin",
              }}
            >
              {filteredServices.map((svc) => {
                const isSelected = svc.id === selectedServiceId;
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => setSelectedServiceId(svc.id)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "9999px",
                      border: isSelected
                        ? "1px solid var(--cm-navy)"
                        : "1px solid var(--cm-line)",
                      background: isSelected ? "var(--cm-navy)" : "var(--cm-surface-2)",
                      color: isSelected ? "#ffffff" : "var(--cm-ink-2)",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{svc.name}</span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        background: isSelected
                          ? "rgba(255, 255, 255, 0.2)"
                          : svc.offers_count > 0
                          ? "var(--cm-done-surface)"
                          : "var(--cm-surface-3)",
                        color: isSelected
                          ? "#ffffff"
                          : svc.offers_count > 0
                          ? "var(--cm-done)"
                          : "var(--cm-ink-3)",
                        fontWeight: 800,
                      }}
                    >
                      {svc.offers_count > 0
                        ? `${svc.offers_count} Clinic${svc.offers_count > 1 ? "s" : ""} · ₹${svc.min_price}`
                        : "No clinic yet"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Procedure Summary */}
          {activeService && (
            <div
              style={{
                backgroundColor: "var(--cm-surface-2)",
                borderRadius: "10px",
                border: "1px solid var(--cm-line)",
                padding: "14px 18px",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "1rem",
                      fontWeight: 800,
                      color: "var(--cm-ink)",
                    }}
                  >
                    {activeService.name}
                  </h4>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "var(--cm-surface-3)",
                      color: "var(--cm-ink-2)",
                      fontWeight: 600,
                    }}
                  >
                    {activeService.duration}
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "#eff6ff",
                      color: "#0369a1",
                      fontWeight: 700,
                      border: "1px solid #bae6fd",
                    }}
                  >
                    100% In-Clinic Walk-In
                  </span>
                </div>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "0.8rem",
                    color: "var(--cm-ink-3)",
                    maxWidth: "650px",
                  }}
                >
                  {activeService.description}
                </p>
                {activeService.preparation && (
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: "0.78rem",
                      color: "var(--cm-active)",
                      fontWeight: 600,
                    }}
                  >
                    Instructions: {activeService.preparation}
                  </p>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)" }}>
                  Benchmark MRP: ₹{activeService.benchmark_mrp}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: activeService.offers_count > 0 ? "var(--cm-done)" : "var(--cm-ink-3)",
                    fontWeight: 700,
                  }}
                >
                  {activeService.offers_count > 0
                    ? `Available from ₹${activeService.min_price}`
                    : "Awaiting partner clinic enrollment"}
                </div>
              </div>
            </div>
          )}

          {/* Clinics Offer List */}
          {activeService && (
            <div>
              {sortedOffers.length === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    backgroundColor: "var(--cm-surface-2)",
                    borderRadius: "10px",
                    border: "1px dashed var(--cm-line)",
                  }}
                >
                  <Building2 size={32} style={{ margin: "0 auto 8px", color: "var(--cm-ink-3)" }} />
                  <h4 style={{ margin: "0 0 4px 0", color: "var(--cm-ink)", fontSize: "0.95rem" }}>
                    No Registered Dental Clinics Listed Yet for {activeService.name}
                  </h4>
                  <p style={{ margin: 0, color: "var(--cm-ink-3)", fontSize: "0.82rem" }}>
                    Dental surgeons enrolled in your city will automatically appear here with their verified tariffs.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {sortedOffers.map((offer) => (
                    <div
                      key={offer.provider_id}
                      style={{
                        backgroundColor: "var(--cm-surface)",
                        borderRadius: "10px",
                        border: "1px solid var(--cm-line)",
                        padding: "16px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "16px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "260px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                            {offer.center_name}
                          </h4>
                          {offer.verified && (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: "var(--cm-done-surface)",
                                color: "var(--cm-done)",
                                fontWeight: 700,
                                border: "1px solid var(--cm-done-line)",
                              }}
                            >
                              Verified Dental Partner
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: "0.85rem", color: "var(--cm-ink-2)", fontWeight: 600, marginTop: "2px" }}>
                          {offer.doctor_name} · <span style={{ color: "var(--cm-ink-3)" }}>{offer.qualification}</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "6px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--cm-ink-3)" }}>
                            <MapPin size={14} />
                            <span>{offer.address ? `${offer.address}, ` : ""}{offer.city}</span>
                          </div>
                          {offer.dental_license_number && (
                            <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)" }}>
                              Reg: <strong>{offer.dental_license_number}</strong>
                            </div>
                          )}
                          {offer.rating !== null && (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "#f59e0b", fontWeight: 700 }}>
                              <Star size={14} fill="#f59e0b" />
                              <span>{offer.rating.toFixed(1)}</span>
                              <span style={{ color: "var(--cm-ink-3)", fontWeight: 400 }}>({offer.reviews_count})</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                            <span style={{ fontSize: "0.82rem", textDecoration: "line-through", color: "var(--cm-ink-3)" }}>
                              ₹{offer.mrp}
                            </span>
                            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--cm-done)" }}>
                              ₹{offer.callmedex_price}
                            </span>
                          </div>
                          {offer.savings > 0 && (
                            <div style={{ fontSize: "0.75rem", color: "var(--cm-done)", fontWeight: 700 }}>
                              Save ₹{offer.savings} ({Math.round(offer.discount_pct)}% off)
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setBookingModal({ service: activeService, offer })}
                          style={{
                            padding: "9px 20px",
                            borderRadius: "8px",
                            border: "none",
                            background: "var(--cm-navy)",
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: "0 2px 4px rgba(0, 43, 73, 0.15)",
                          }}
                        >
                          Book Walk-In
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Walk-In Appointment Booking Dialog */}
      {bookingModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "14px",
              padding: "28px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clinical3DIcon name="dental" size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                    Schedule Dental Walk-In Visit
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--cm-ink-3)" }}>
                    {bookingModal.offer.center_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cm-ink-3)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Treatment Summary Pill */}
            <div
              style={{
                backgroundColor: "var(--cm-surface-2)",
                borderRadius: "8px",
                padding: "12px 16px",
                border: "1px solid var(--cm-line)",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)" }}>Procedure:</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--cm-ink)" }}>
                  {bookingModal.service.name}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)" }}>Attending Surgeon:</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--cm-ink)" }}>
                  {bookingModal.offer.doctor_name} ({bookingModal.offer.qualification})
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)" }}>Modality:</span>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0284c7" }}>
                  100% In-Clinic Walk-In
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--cm-line)", paddingTop: "6px", marginTop: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--cm-ink)" }}>Payable Fee:</span>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--cm-done)" }}>
                  ₹{bookingModal.offer.callmedex_price}
                </span>
              </div>
            </div>

            {/* Preferred Walk-In Date */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", fontWeight: 700, color: "var(--cm-ink)" }}>
                Preferred Appointment Date
              </label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--cm-line-strong)",
                  fontSize: "0.9rem",
                  color: "var(--cm-ink)",
                  outline: "none",
                }}
                required
              />
            </div>

            {/* Preferred Arrival Window */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", fontWeight: 700, color: "var(--cm-ink)" }}>
                Preferred Arrival Window
              </label>
              <select
                value={bookingSlot}
                onChange={(e) => setBookingSlot(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--cm-line-strong)",
                  fontSize: "0.9rem",
                  color: "var(--cm-ink)",
                  outline: "none",
                }}
              >
                <option value="Morning (10:00 AM - 01:00 PM)">Morning (10:00 AM - 01:00 PM)</option>
                <option value="Afternoon (02:00 PM - 05:00 PM)">Afternoon (02:00 PM - 05:00 PM)</option>
                <option value="Evening (05:00 PM - 08:30 PM)">Evening (05:00 PM - 08:30 PM)</option>
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", fontWeight: 700, color: "var(--cm-ink)" }}>
                Notes for the Dentist (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Tooth pain in upper left molar, previous filling chipped"
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--cm-line-strong)",
                  fontSize: "0.9rem",
                  color: "var(--cm-ink)",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setBookingModal(null)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--cm-surface-2)",
                  color: "var(--cm-ink)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBookWalkIn}
                disabled={submittingBooking || !bookingDate}
                style={{
                  padding: "9px 22px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--cm-navy)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: submittingBooking || !bookingDate ? "not-allowed" : "pointer",
                  opacity: submittingBooking || !bookingDate ? 0.6 : 1,
                }}
              >
                {submittingBooking ? "Booking..." : "Confirm Walk-In"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
