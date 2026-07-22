"use client";
import { useEffect, useRef, useState } from "react";

interface Marker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  icon?: string;
  pulse?: boolean;
}

interface GeoapifyMapProps {
  center?: { lat: number; lng: number };
  markers?: Marker[];
  routePoints?: { lat: number; lng: number }[];
  zoom?: number;
  height?: number | string;
  apiKey?: string;
  showRoute?: boolean;
  style?: React.CSSProperties;
}

const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || "";
const TILE_URL = DEFAULT_API_KEY
  ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${DEFAULT_API_KEY}`
  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function GeoapifyMap({
  center,
  markers = [],
  routePoints,
  zoom = 14,
  height = 400,
  apiKey,
  showRoute = false,
  style,
}: GeoapifyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const resolvedKey = apiKey || DEFAULT_API_KEY;
  const tileUrl = resolvedKey
    ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${resolvedKey}`
    : TILE_URL;

  // Load Leaflet dynamically (no npm dependency)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // Load CSS
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(cssLink);

    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Prevent re-init
    if (mapInstanceRef.current) return;

    const defaultCenter = center || (markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 17.7231, lng: 83.3013 });

    const map = L.map(mapContainerRef.current, {
      center: [defaultCenter.lat, defaultCenter.lng],
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: resolvedKey
        ? '© <a href="https://www.geoapify.com/">Geoapify</a> contributors'
        : '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    markersLayerRef.current.clearLayers();

    markers.forEach(m => {
      const iconHtml = m.icon
        ? `<div style="font-size:1.5rem;text-align:center;line-height:1">${m.icon}</div>`
        : `<div style="width:14px;height:14px;border-radius:50%;background:${m.color || '#e53e3e'};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);${m.pulse ? 'animation:geoapify-pulse 1.5s infinite;' : ''}"></div>`;

      const icon = L.divIcon({
        html: iconHtml,
        className: "geoapify-custom-marker",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(markersLayerRef.current);
      if (m.label) {
        marker.bindTooltip(m.label, {
          permanent: false,
          direction: "top",
          offset: [0, -12],
          className: "geoapify-tooltip",
        });
      }
    });

    // Auto-fit bounds
    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (markers.length === 1) {
      mapInstanceRef.current.setView([markers[0].lat, markers[0].lng], zoom);
    }
  }, [markers, leafletLoaded]);

  // Draw route
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current || !showRoute) return;
    const L = (window as any).L;
    if (!L) return;

    routeLayerRef.current.clearLayers();

    if (!routePoints || routePoints.length < 2) return;

    // If Geoapify key is available, fetch actual route
    if (resolvedKey && routePoints.length === 2) {
      const [from, to] = routePoints;
      fetch(
        `https://api.geoapify.com/v1/routing?waypoints=${from.lat},${from.lng}|${to.lat},${to.lng}&mode=drive&apiKey=${resolvedKey}`
      )
        .then(r => r.json())
        .then(data => {
          if (data.features && data.features.length > 0) {
            const coords = data.features[0].geometry.coordinates[0].map(
              (c: [number, number]) => [c[1], c[0]]
            );
            const routeLine = L.polyline(coords, {
              color: "#1a2b4a",
              weight: 4,
              opacity: 0.8,
              dashArray: "10, 6",
            });
            routeLayerRef.current.addLayer(routeLine);
          }
        })
        .catch(console.error);
    } else {
      // Fallback: straight line
      const latLngs = routePoints.map(p => [p.lat, p.lng]);
      const routeLine = L.polyline(latLngs, {
        color: "#1a2b4a",
        weight: 3,
        opacity: 0.6,
        dashArray: "8, 8",
      });
      routeLayerRef.current.addLayer(routeLine);
    }
  }, [routePoints, showRoute, leafletLoaded, resolvedKey]);

  return (
    <>
      <style>{`
        .geoapify-custom-marker { background: transparent !important; border: none !important; }
        .geoapify-tooltip {
          background: var(--color-navy, #1a2b4a) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 4px 10px !important;
          font-size: 0.78rem !important;
          font-weight: 600 !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
        }
        .geoapify-tooltip::before {
          border-top-color: var(--color-navy, #1a2b4a) !important;
        }
        @keyframes geoapify-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: typeof height === "number" ? `${height}px` : height,
          borderRadius: 12,
          overflow: "hidden",
          border: "1.5px solid var(--color-gray-200, #e2e8f0)",
          boxShadow: "var(--shadow-md, 0 4px 6px rgba(0,0,0,0.07))",
          ...style,
        }}
      >
        {!leafletLoaded && (
          <div style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            backgroundColor: "var(--color-gray-50, #f8fafc)",
            color: "var(--color-gray-400, #94a3b8)", fontSize: "0.9rem",
          }}>
            Loading map...
          </div>
        )}
      </div>
    </>
  );
}
