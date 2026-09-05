"use client";
import { useState, useCallback, useEffect } from "react";

/**
 * LocationPicker — Reusable GPS auto-detect + manual address component.
 * 
 * Features:
 * - Browser geolocation auto-detect (navigator.geolocation)
 * - Reverse geocoding via Nominatim (OpenStreetMap — free, no API key needed)
 * - Manual address override with text input
 * - Returns { lat, lng, address, city, pincode } to parent
 * 
 * Usage:
 *   <LocationPicker onLocationSelect={(loc) => setLocation(loc)} />
 */

interface LocationData {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  source: "gps" | "manual";
}

interface LocationPickerProps {
  onLocationSelect: (location: LocationData) => void;
  initialAddress?: string;
  label?: string;
  required?: boolean;
  compact?: boolean;
}

export default function LocationPicker({
  onLocationSelect,
  initialAddress = "",
  label = "Your Location",
  required = false,
  compact = false,
}: LocationPickerProps) {
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [error, setError] = useState("");
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [manualAddress, setManualAddress] = useState(initialAddress);
  const [showManual, setShowManual] = useState(false);

  // Reverse geocode using Geoapify (with Nominatim fallback if no API key)
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<Partial<LocationData>> => {
    const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || "";
    try {
      let data: any;
      if (geoapifyKey) {
        // Geoapify Reverse Geocoding
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${geoapifyKey}&format=json`
        );
        const json = await res.json();
        const result = json.results?.[0] || {};
        return {
          address: result.formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          city: result.city || result.town || result.village || result.county || "",
          state: result.state || "",
          pincode: result.postcode || "",
        };
      } else {
        // Fallback: Nominatim (free, no API key)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "CallMedex/2.0",
            },
          }
        );
        data = await res.json();
        const addr = data.address || {};
        return {
          address: data.display_name || "",
          city: addr.city || addr.town || addr.village || addr.county || "",
          state: addr.state || "",
          pincode: addr.postcode || "",
        };
      }
    } catch (e) {
      console.error("Reverse geocode failed:", e);
      return {
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        city: "",
        state: "",
        pincode: "",
      };
    }
  }, []);

  // Forward geocode for manual address input (Geoapify with Nominatim fallback)
  const forwardGeocode = useCallback(async (query: string): Promise<Partial<LocationData>> => {
    const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || "";
    try {
      if (geoapifyKey) {
        const encoded = encodeURIComponent(query.trim());
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/search?text=${encoded}&country=India&apiKey=${geoapifyKey}&format=json`
        );
        const json = await res.json();
        const result = json.results?.[0];
        if (result && result.lat && result.lon) {
          return {
            lat: result.lat,
            lng: result.lon,
            city: result.city || result.town || result.village || result.county || "",
            state: result.state || "",
            pincode: result.postcode || "",
          };
        }
      }

      // Nominatim forward geocoding fallback
      const encoded = encodeURIComponent(`${query.trim()}, India`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=in&limit=1&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "CallMedex/2.0",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          const addr = item.address || {};
          return {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            city: addr.city || addr.town || addr.village || addr.county || "",
            state: addr.state || "",
            pincode: addr.postcode || "",
          };
        }
      }
    } catch (e) {
      console.warn("Forward geocode error:", e);
    }
    return { lat: 0, lng: 0, city: "", state: "", pincode: "" };
  }, []);

  // Process geolocation coordinates and notify parent
  const processCoordinates = useCallback(async (latitude: number, longitude: number) => {
    const geocoded = await reverseGeocode(latitude, longitude);
    const loc: LocationData = {
      lat: latitude,
      lng: longitude,
      address: geocoded.address || "",
      city: geocoded.city || "",
      state: geocoded.state || "",
      pincode: geocoded.pincode || "",
      source: "gps",
    };

    setLocationData(loc);
    setDetected(true);
    setDetecting(false);
    setError("");
    onLocationSelect(loc);
  }, [reverseGeocode, onLocationSelect]);

  // Auto-detect location with progressive fallback ladder
  const handleDetect = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setDetecting(true);
    setError("");

    // Stage 1: Try High Accuracy GPS with 8s deadline
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await processCoordinates(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setDetecting(false);
          setError("Location permission denied. Please enter your address manually.");
          setShowManual(true);
          return;
        }

        // Stage 2: Fallback to coarse network/Wi-Fi positioning (succeeds indoors on mobile in <1.5s)
        navigator.geolocation.getCurrentPosition(
          async (fallbackPosition) => {
            await processCoordinates(fallbackPosition.coords.latitude, fallbackPosition.coords.longitude);
          },
          (fallbackErr) => {
            setDetecting(false);
            switch (fallbackErr.code) {
              case fallbackErr.PERMISSION_DENIED:
                setError("Location permission denied. Please enter your address manually.");
                break;
              case fallbackErr.POSITION_UNAVAILABLE:
                setError("Location unavailable. Please enter your address manually.");
                break;
              case fallbackErr.TIMEOUT:
                setError("Location request timed out. Please try again or enter manually.");
                break;
              default:
                setError("Could not detect location. Please enter manually.");
            }
            setShowManual(true);
          },
          {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 300000, // Accept cached network fix up to 5 min old
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }, [processCoordinates]);

  // Manual address submit with forward geocoding resolution
  const handleManualSubmit = useCallback(async () => {
    if (!manualAddress.trim()) return;

    setDetecting(true);
    let lat = 0;
    let lng = 0;
    let city = "";
    let state = "";
    let pincode = "";

    // Extract pincode regex
    const pincodeMatch = manualAddress.match(/\b\d{6}\b/);
    if (pincodeMatch) {
      pincode = pincodeMatch[0];
    }

    try {
      const geo = await forwardGeocode(manualAddress);
      if (geo.lat && geo.lng) {
        lat = geo.lat;
        lng = geo.lng;
        if (geo.city) city = geo.city;
        if (geo.state) state = geo.state;
        if (geo.pincode && !pincode) pincode = geo.pincode;
      }
    } catch {
      // Fallback preserves address text
    }

    const loc: LocationData = {
      lat,
      lng,
      address: manualAddress.trim(),
      city,
      state,
      pincode,
      source: "manual",
    };

    setLocationData(loc);
    setDetected(true);
    setDetecting(false);
    setError("");
    onLocationSelect(loc);
  }, [manualAddress, forwardGeocode, onLocationSelect]);

  const containerStyle = compact
    ? { marginBottom: 16 }
    : {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #e2e8f0",
        marginBottom: 20,
      };

  return (
    <div style={containerStyle}>
      {!compact && (
        <label style={{
          display: "block",
          marginBottom: 10,
          fontWeight: 700,
          color: "#1e293b",
          fontSize: "0.9rem",
        }}>
          📍 {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
        </label>
      )}

      {/* Auto-detect button */}
      {!detected && !showManual && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleDetect}
            disabled={detecting}
            style={{
              backgroundColor: detecting ? "#e2e8f0" : "#0f4c81",
              color: detecting ? "#64748b" : "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontWeight: 600,
              cursor: detecting ? "wait" : "pointer",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
          >
            {detecting ? (
              <>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>📡</span>
                Detecting your location...
              </>
            ) : (
              <>📍 Use Current Location</>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowManual(true)}
            style={{
              backgroundColor: "transparent",
              color: "#64748b",
              border: "1px solid #d1d5db",
              padding: "10px 20px",
              borderRadius: 8,
              fontWeight: 500,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            ✏️ Enter Manually
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: 10,
          padding: "8px 14px",
          backgroundColor: "#fef2f2",
          color: "#991b1b",
          borderRadius: 8,
          fontSize: "0.8rem",
          border: "1px solid #fecaca",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Detected location display */}
      {detected && locationData && (
        <div style={{
          marginTop: 10,
          padding: "12px 16px",
          backgroundColor: "#f0fdf4",
          borderRadius: 10,
          border: "1px solid #bbf7d0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "#166534", fontSize: "0.85rem", marginBottom: 4 }}>
              ✅ Location Detected
            </div>
            <div style={{ color: "#15803d", fontSize: "0.8rem", lineHeight: 1.5, maxWidth: 400 }}>
              {locationData.address}
            </div>
            {locationData.city && (
              <div style={{ color: "#22c55e", fontSize: "0.75rem", marginTop: 4 }}>
                {locationData.city}{locationData.state ? `, ${locationData.state}` : ""}{locationData.pincode ? ` - ${locationData.pincode}` : ""}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setDetected(false); setLocationData(null); setShowManual(true); }}
            style={{
              background: "none",
              border: "none",
              color: "#15803d",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            ✏️ Change
          </button>
        </div>
      )}

      {/* Manual address input */}
      {showManual && !detected && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Enter your full address (area, city, pincode)"
              value={manualAddress}
              onChange={e => setManualAddress(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleManualSubmit(); } }}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: "0.9rem",
              }}
              required={required}
            />
            <button
              type="button"
              onClick={handleManualSubmit}
              style={{
                backgroundColor: "#0f4c81",
                color: "white",
                border: "none",
                padding: "10px 16px",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
              }}
            >
              Confirm
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setShowManual(false); setError(""); }}
            style={{
              marginTop: 8,
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            ← Back to auto-detect
          </button>
        </div>
      )}
    </div>
  );
}
