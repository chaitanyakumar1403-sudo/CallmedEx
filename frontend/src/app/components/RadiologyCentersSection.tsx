"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  ShieldCheck,
  MapPin,
  Clock,
  Star,
  Calendar,
  CheckCircle2,
  X,
  ChevronRight,
  Filter,
  Sparkles,
  Search,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

export interface DiagnosticOffer {
  provider_id: string;
  center_name: string;
  accreditation: string;
  address: string;
  city: string;
  rating: number;
  reviews_count: number;
  turnaround_hours: number;
  mrp: number;
  callmedex_price: number;
  savings: number;
  discount_pct: number;
  equipment_type: string;
  verified: boolean;
  is_live?: boolean;
}

export interface RadiologyService {
  id: string;
  slug: string;
  name: string;
  category: string;
  sub_category: string;
  typical_turnaround_hours: number;
  mrp: number;
  min_price: number;
  max_savings: number;
  preparation?: string;
  description?: string;
  offers_count: number;
  offers: DiagnosticOffer[];
}

interface RadiologyCentersSectionProps {
  onBookingCreated?: () => void;
  lang?: string;
}

export default function RadiologyCentersSection({
  onBookingCreated,
  lang = "en",
}: RadiologyCentersSectionProps) {
  const [services, setServices] = useState<RadiologyService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"price" | "rating" | "turnaround">("price");

  // Booking Modal State
  const [bookingModal, setBookingModal] = useState<{
    service: RadiologyService;
    offer: DiagnosticOffer;
  } | null>(null);
  const [bookingDate, setBookingDate] = useState<string>("");
  const [bookingSlot, setBookingSlot] = useState<string>("09:00 - 11:00");
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    async function loadRadiologyServices() {
      try {
        setLoading(true);
        setError(null);
        const url = cityFilter
          ? `${apiBase}/api/marketplace/radiology/services?city=${encodeURIComponent(cityFilter)}`
          : `${apiBase}/api/marketplace/radiology/services`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch radiology services");
        const data = await res.json();
        if (data.success && Array.isArray(data.services)) {
          setServices(data.services);
          if (data.services.length > 0 && !selectedServiceId) {
            setSelectedServiceId(data.services[0].id);
          }
        }
      } catch (err: any) {
        console.error("Error loading radiology services:", err);
        setError("Unable to load diagnostic center services. Please retry.");
      } finally {
        setLoading(false);
      }
    }

    loadRadiologyServices();
  }, [apiBase, cityFilter]);

  const activeService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0] || null;
  }, [services, selectedServiceId]);

  const sortedOffers = useMemo(() => {
    if (!activeService) return [];
    const list = [...activeService.offers];
    if (sortBy === "price") {
      list.sort((a, b) => a.callmedex_price - b.callmedex_price);
    } else if (sortBy === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "turnaround") {
      list.sort((a, b) => a.turnaround_hours - b.turnaround_hours);
    }
    return list;
  }, [activeService, sortBy]);

  const handleBookAppointment = async () => {
    if (!bookingModal || !bookingDate) {
      toast("Please select an appointment date");
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast("Please sign in as a patient to book appointments");
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
          provider_id: bookingModal.offer.provider_id || "diagnostic_center",
          provider_type: "organization",
          service_type: "imaging",
          slot_id: `diag|${bookingDate}|${bookingSlot.replace(/\s+/g, "")}`,
          notes: `${bookingModal.service.name} at ${bookingModal.offer.center_name} (${bookingSlot})`,
          total_price: bookingModal.offer.callmedex_price,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          `Appointment requested at ${bookingModal.offer.center_name} for ${bookingModal.service.name}`
        );
        setBookingModal(null);
        setBookingDate("");
        if (onBookingCreated) {
          onBookingCreated();
        }
      } else {
        toast.error(data.detail || data.message || "Failed to schedule appointment");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error while booking appointment");
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
              background: "var(--cm-active-surface)",
              color: "var(--cm-active)",
              fontSize: "0.75rem",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            <ShieldCheck size={14} />
            <span>AERB & NABL Certified Imaging Network</span>
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
            Radiology & Diagnostic Imaging Centers
          </h3>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "0.85rem",
              color: "var(--cm-ink-3)",
            }}
          >
            Compare verified diagnostic centers offering X-Ray, ECG, PFT &amp; specialized scans with transparent center-wise pricing.
          </p>
        </div>

        {/* Filters / Sort */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
              <option value="price">Sort: Lowest Price</option>
              <option value="rating">Sort: Highest Rating</option>
              <option value="turnaround">Sort: Fastest Reports</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--cm-ink-3)" }}>
          <Activity
            size={28}
            className="animate-spin"
            style={{ margin: "0 auto 10px", color: "var(--cm-active)" }}
          />
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>
            Loading diagnostic imaging services &amp; verified center rates...
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
          {/* Service Tabs Rail */}
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
            {services.map((svc) => {
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
                        : "var(--cm-done-surface)",
                      color: isSelected ? "#ffffff" : "var(--cm-done)",
                      fontWeight: 800,
                    }}
                  >
                    From ₹{svc.min_price}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Service Summary Bar */}
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
                    {activeService.typical_turnaround_hours}h Report Turnaround
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
                    Preparation: {activeService.preparation}
                  </p>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)" }}>
                  Standard Benchmark MRP: ₹{activeService.mrp}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--cm-done)",
                    fontWeight: 700,
                  }}
                >
                  Save up to ₹{activeService.max_savings} at Partner Centers
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Centers Comparison Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {sortedOffers.map((offer) => (
              <div
                key={offer.provider_id}
                style={{
                  backgroundColor: "var(--cm-surface)",
                  borderRadius: "12px",
                  border: "1px solid var(--cm-line)",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <div>
                  {/* Center Name & Accreditation */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "0.95rem",
                          color: "var(--cm-ink)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Building2 size={16} style={{ color: "var(--cm-active)" }} />
                        <span>{offer.center_name}</span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--cm-done)",
                          fontWeight: 700,
                          marginTop: "2px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <ShieldCheck size={12} />
                        <span>{offer.accreditation}</span>
                      </div>
                    </div>

                    {/* Rating Pill */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                        background: "var(--cm-surface-2)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--cm-ink)",
                        border: "1px solid var(--cm-line)",
                      }}
                    >
                      <Star size={12} fill="#eab308" color="#eab308" />
                      <span>{offer.rating}</span>
                      <span style={{ color: "var(--cm-ink-3)", fontSize: "0.7rem" }}>
                        ({offer.reviews_count})
                      </span>
                    </div>
                  </div>

                  {/* Address & Equipment */}
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--cm-ink-3)",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginBottom: "6px",
                    }}
                  >
                    <MapPin size={13} style={{ color: "var(--cm-ink-3)" }} />
                    <span>{offer.address}</span>
                  </div>

                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--cm-ink-2)",
                      backgroundColor: "var(--cm-surface-2)",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      marginBottom: "12px",
                      border: "1px solid var(--cm-line)",
                    }}
                  >
                    <strong>Equipment:</strong> {offer.equipment_type}
                  </div>
                </div>

                {/* Pricing & Booking Footer */}
                <div
                  style={{
                    borderTop: "1px dashed var(--cm-line)",
                    paddingTop: "12px",
                    marginTop: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--cm-ink-3)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span style={{ textDecoration: "line-through" }}>
                          MRP ₹{offer.mrp}
                        </span>
                        <span
                          style={{
                            color: "var(--cm-done)",
                            fontWeight: 700,
                            background: "var(--cm-done-surface)",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontSize: "0.7rem",
                          }}
                        >
                          {offer.discount_pct}% OFF
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: 900,
                          color: "var(--cm-navy)",
                          lineHeight: "1.2",
                        }}
                      >
                        ₹{offer.callmedex_price}
                      </div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--cm-done)",
                          fontWeight: 600,
                        }}
                      >
                        Save ₹{offer.savings} with CallMedex
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--cm-ink-3)",
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                          justifyContent: "flex-end",
                          marginBottom: "4px",
                        }}
                      >
                        <Clock size={12} />
                        <span>Report in {offer.turnaround_hours}h</span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--cm-active)",
                          fontWeight: 600,
                        }}
                      >
                        Verified Walk-In / Slot
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setBookingModal({
                        service: activeService,
                        offer: offer,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--cm-navy)",
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <span>Book Center Appointment</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Booking Modal */}
      {bookingModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--cm-surface)",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              border: "1px solid var(--cm-line)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color: "var(--cm-ink)",
                }}
              >
                Schedule Center Appointment
              </h3>
              <button
                type="button"
                onClick={() => setBookingModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--cm-ink-3)",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Selected Service & Center Card */}
            <div
              style={{
                backgroundColor: "var(--cm-surface-2)",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "18px",
                border: "1px solid var(--cm-line)",
              }}
            >
              <div
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  color: "var(--cm-ink)",
                  marginBottom: "2px",
                }}
              >
                {bookingModal.service.name}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--cm-active)",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                {bookingModal.offer.center_name}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--cm-ink-3)",
                  marginBottom: "10px",
                }}
              >
                {bookingModal.offer.address}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--cm-line)",
                  paddingTop: "8px",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "var(--cm-ink-2)" }}>
                  CallMedex Rate:
                </span>
                <span
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 900,
                    color: "var(--cm-navy)",
                  }}
                >
                  ₹{bookingModal.offer.callmedex_price}
                </span>
              </div>
            </div>

            {/* Date Selection */}
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--cm-ink-2)",
                  marginBottom: "6px",
                }}
              >
                Preferred Date
              </label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--cm-line)",
                  fontSize: "0.9rem",
                  background: "var(--cm-surface)",
                  color: "var(--cm-ink)",
                  outline: "none",
                }}
                required
              />
            </div>

            {/* Slot Selection */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--cm-ink-2)",
                  marginBottom: "6px",
                }}
              >
                Preferred Time Window
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {["08:00 - 11:00", "11:00 - 14:00", "15:00 - 18:00"].map((slot) => {
                  const isSlotSelected = bookingSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setBookingSlot(slot)}
                      style={{
                        padding: "8px 6px",
                        borderRadius: "8px",
                        border: isSlotSelected
                          ? "1.5px solid var(--cm-navy)"
                          : "1px solid var(--cm-line)",
                        background: isSlotSelected
                          ? "var(--cm-active-surface)"
                          : "var(--cm-surface-2)",
                        color: isSlotSelected ? "var(--cm-navy)" : "var(--cm-ink-2)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setBookingModal(null)}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "8px",
                  border: "1px solid var(--cm-line)",
                  background: "var(--cm-surface)",
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
                onClick={handleBookAppointment}
                disabled={!bookingDate || submittingBooking}
                style={{
                  flex: 1.5,
                  padding: "11px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--cm-navy)",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  cursor: !bookingDate || submittingBooking ? "not-allowed" : "pointer",
                  opacity: !bookingDate || submittingBooking ? 0.6 : 1,
                }}
              >
                {submittingBooking ? "Confirming..." : "Confirm Center Slot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
