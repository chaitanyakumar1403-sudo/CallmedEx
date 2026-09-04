"use client";

import React from "react";

export type Clinical3DIconName =
  | "droplet"
  | "stethoscope"
  | "cross"
  | "nurse"
  | "delivery"
  | "truck"
  | "apple"
  | "dietitian"
  | "activity"
  | "physio"
  | "video"
  | "hospital"
  | "cashless"
  | "sparkles"
  | "ai"
  | "mic"
  | "voice"
  | "shield"
  | "drugshield"
  | "calendar"
  | "check"
  | "completed"
  | "pill"
  | "capsule"
  | "chart"
  | "records"
  | "user"
  | "patient"
  | "syringe"
  | "phlebo"
  | "fileText"
  | "briefing"
  | "pharmacy"
  | "staff";

export interface Clinical3DIconProps extends React.SVGProps<SVGSVGElement> {
  name: Clinical3DIconName;
  size?: number | "sm" | "md" | "lg" | "xl";
  className?: string;
  glow?: boolean;
}

const SIZE_MAP: Record<string, number> = {
  sm: 20,
  md: 28,
  lg: 36,
  xl: 48,
};

/**
 * Ultra-Rich 3D Clinical Icon System
 * Built with pure SVG radial/linear gradients, specular highlights, and multi-layered depth.
 * Zero external font/image dependencies, 0ms load, and razor-sharp clarity on high-DPI displays.
 */
export default function Clinical3DIcon({
  name,
  size = "md",
  className = "",
  glow = false,
  style,
  ...props
}: Clinical3DIconProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] || 28;
  const filterId = `c3d-glow-${name}`;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`c3d-icon c3d-icon--${name} ${className}`}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        filter: glow ? `drop-shadow(0 4px 10px rgba(15, 76, 129, 0.25))` : undefined,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        {/* Universal Specular Filter */}
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.18" />
        </filter>

        {/* 1. Droplet Gradients */}
        <linearGradient id="drop-grad" x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <radialGradient id="drop-spec" cx="24" cy="20" r="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* 2. Stethoscope Gradients */}
        <linearGradient id="steth-metal" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="35%" stopColor="#94a3b8" />
          <stop offset="70%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="steth-head" x1="26" y1="26" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        {/* 3. Cross / Nurse Gradients */}
        <linearGradient id="cross-grad" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="50%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
        <radialGradient id="cross-spec" cx="20" cy="18" r="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* 4. Delivery Van Gradients */}
        <linearGradient id="truck-body" x1="8" y1="14" x2="56" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="truck-cab" x1="38" y1="22" x2="56" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>

        {/* 5. Apple Gradients */}
        <linearGradient id="apple-grad" x1="14" y1="16" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
        <linearGradient id="leaf-grad" x1="32" y1="6" x2="48" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>

        {/* 6. Activity / Physio Wave Gradients */}
        <linearGradient id="act-wave" x1="6" y1="16" x2="58" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>

        {/* 7. Video Camera Gradients */}
        <linearGradient id="cam-body" x1="8" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* 8. Hospital / Cashless Gradients */}
        <linearGradient id="hosp-body" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>

        {/* 9. AI Neural Sparkle Gradients */}
        <linearGradient id="ai-star" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="40%" stopColor="#9333ea" />
          <stop offset="80%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>

        {/* 10. Neural Mic Gradients */}
        <linearGradient id="mic-grad" x1="20" y1="8" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="60%" stopColor="#7e22ce" />
          <stop offset="100%" stopColor="#581c87" />
        </linearGradient>

        {/* 11. DrugShield Gradients */}
        <linearGradient id="shield-grad" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="45%" stopColor="#059669" />
          <stop offset="80%" stopColor="#047857" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>

        {/* 12. Calendar Gradients */}
        <linearGradient id="cal-header" x1="10" y1="8" x2="54" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="cal-body" x1="10" y1="20" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>

        {/* 13. Pill Capsule Gradients */}
        <linearGradient id="pill-left" x1="12" y1="16" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="pill-right" x1="30" y1="24" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* 14. Chart Gradients */}
        <linearGradient id="chart-bar1" x1="14" y1="36" x2="24" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="chart-bar2" x1="27" y1="24" x2="37" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="chart-bar3" x1="40" y1="14" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* 15. Check Seal Gradients */}
        <linearGradient id="check-seal" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>

        {/* 16. User Avatar Gradients */}
        <linearGradient id="user-grad" x1="14" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="60%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>

        {/* 17. Syringe Gradients */}
        <linearGradient id="syr-body" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="60%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>

      {/* Render matching 3D iconography based on name */}
      {(name === "droplet") && (
        <g>
          {/* Ambient Ground Shadow */}
          <ellipse cx="32" cy="56" rx="16" ry="4" fill="#059669" fillOpacity="0.22" />
          {/* Main 3D Teardrop */}
          <path
            d="M32 6C32 6 12 30 12 42C12 53.0457 20.9543 58 32 58C43.0457 58 52 53.0457 52 42C52 30 32 6 32 6Z"
            fill="url(#drop-grad)"
          />
          {/* Dimensional Bevel Rim */}
          <path
            d="M32 9C32 9 15 31.5 15 42C15 51.5 22.5 55.5 32 55.5C41.5 55.5 49 51.5 49 42C49 31.5 32 9 32 9Z"
            fill="none"
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth="1.5"
          />
          {/* Specular Curved Highlight */}
          <ellipse cx="25" cy="34" rx="7" ry="12" transform="rotate(-25 25 34)" fill="url(#drop-spec)" />
          <circle cx="28" cy="22" r="3" fill="#ffffff" fillOpacity="0.8" />
          {/* Clinical Cross Accent Badge inside Drop */}
          <rect x="29.5" y="38" width="5" height="12" rx="2.5" fill="#ffffff" fillOpacity="0.9" />
          <rect x="26" y="41.5" width="12" height="5" rx="2.5" fill="#ffffff" fillOpacity="0.9" />
        </g>
      )}

      {(name === "stethoscope") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="3.5" fill="#0f172a" fillOpacity="0.18" />
          {/* Eartubes & Binaural Tube */}
          <path
            d="M20 12V24C20 31 25.5 36.5 32 36.5C38.5 36.5 44 31 44 24V12"
            fill="none"
            stroke="url(#steth-metal)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Ear tips */}
          <circle cx="18.5" cy="11.5" r="3.5" fill="#334155" />
          <circle cx="45.5" cy="11.5" r="3.5" fill="#334155" />
          {/* Y-Junction & Flexible Tube */}
          <path
            d="M32 36.5V45C32 49 36 52 41 50C45 48.5 48 44 48 39"
            fill="none"
            stroke="url(#steth-head)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Chestpiece Diaphragm */}
          <circle cx="48" cy="36" r="10" fill="url(#steth-head)" />
          <circle cx="48" cy="36" r="8" fill="url(#steth-metal)" fillOpacity="0.85" />
          <circle cx="48" cy="36" r="5" fill="#0284c7" />
          <circle cx="46" cy="34" r="2" fill="#ffffff" fillOpacity="0.75" />
        </g>
      )}

      {(name === "cross" || name === "nurse") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#e11d48" fillOpacity="0.2" />
          {/* 3D Shield Base */}
          <rect x="12" y="10" width="40" height="40" rx="12" fill="url(#cross-grad)" />
          <rect x="14" y="12" width="36" height="36" rx="10" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
          {/* Specular Bevel Arc */}
          <ellipse cx="24" cy="18" rx="12" ry="6" fill="url(#cross-spec)" />
          {/* Embossed White Medical Cross */}
          <rect x="27.5" y="19" width="9" height="22" rx="4.5" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
          <rect x="21" y="25.5" width="22" height="9" rx="4.5" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
          {/* Heart Emblem in Cross Center */}
          <path
            d="M32 32C32 32 30 29.5 28.5 29.5C27 29.5 26 30.5 26 31.8C26 33.2 27.5 34.6 32 37C36.5 34.6 38 33.2 38 31.8C38 30.5 37 29.5 35.5 29.5C34 29.5 32 32 32 32Z"
            fill="#e11d48"
          />
        </g>
      )}

      {(name === "delivery" || name === "truck") && (
        <g>
          <ellipse cx="32" cy="57" rx="22" ry="4" fill="#d97706" fillOpacity="0.22" />
          {/* Cargo Body */}
          <rect x="8" y="18" width="32" height="26" rx="5" fill="url(#truck-body)" />
          <rect x="10" y="20" width="28" height="22" rx="3" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.2" />
          {/* Cabin */}
          <path d="M40 25H48C51 25 54 28 55 31L56 36C56.5 38 56.5 44 54 44H40V25Z" fill="url(#truck-cab)" />
          {/* Cabin Window */}
          <path d="M42 27H48L52 33H42V27Z" fill="#e0f2fe" fillOpacity="0.9" />
          {/* Cross on Cargo Box */}
          <rect x="21.5" y="25" width="5" height="12" rx="2.5" fill="#ffffff" />
          <rect x="18" y="28.5" width="12" height="5" rx="2.5" fill="#ffffff" />
          {/* Wheels with chrome hubcaps */}
          <circle cx="20" cy="48" r="6" fill="#1e293b" />
          <circle cx="20" cy="48" r="3" fill="#cbd5e1" />
          <circle cx="46" cy="48" r="6" fill="#1e293b" />
          <circle cx="46" cy="48" r="3" fill="#cbd5e1" />
          {/* Speed Wind Streaks */}
          <line x1="2" y1="24" x2="6" y2="24" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="0" y1="32" x2="5" y2="32" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}

      {(name === "apple" || name === "dietitian") && (
        <g>
          <ellipse cx="32" cy="57" rx="16" ry="4" fill="#16a34a" fillOpacity="0.22" />
          {/* Apple Stem */}
          <path d="M32 18C33 11 37 7 41 6" fill="none" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
          {/* 3D Glossy Leaf */}
          <path d="M34 14C37 10 46 10 48 13C48 18 40 21 34 14Z" fill="url(#leaf-grad)" />
          {/* Main Apple Body with indent */}
          <path
            d="M32 21C27 16 12 18 12 32C12 47 22 55 32 55C42 55 52 47 52 32C52 18 37 16 32 21Z"
            fill="url(#apple-grad)"
          />
          {/* Rim Light */}
          <path
            d="M32 23C28 19 14.5 20.5 14.5 32C14.5 45 23.5 52.5 32 52.5C40.5 52.5 49.5 45 49.5 32C49.5 20.5 36 19 32 23Z"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1.2"
          />
          {/* Specular Glow */}
          <ellipse cx="23" cy="28" rx="6" ry="10" transform="rotate(-30 23 28)" fill="#ffffff" fillOpacity="0.45" />
          <circle cx="21" cy="24" r="2.5" fill="#ffffff" fillOpacity="0.8" />
        </g>
      )}

      {(name === "activity" || name === "physio") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#0284c7" fillOpacity="0.2" />
          {/* Dynamic 3D Hexagon / Shield Container */}
          <circle cx="32" cy="32" r="24" fill="url(#act-wave)" fillOpacity="0.15" />
          {/* Kinetic Vertebra Rings */}
          <circle cx="32" cy="18" r="5" fill="url(#act-wave)" />
          <circle cx="32" cy="30" r="6" fill="url(#act-wave)" />
          <circle cx="32" cy="44" r="5.5" fill="url(#act-wave)" />
          {/* Kinetic Energy Pulse Line */}
          <path
            d="M8 32H20L26 14L38 50L44 32H56"
            fill="none"
            stroke="url(#act-wave)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="drop-shadow(0 2px 5px rgba(2, 132, 199, 0.4))"
          />
          {/* Energy Nodes */}
          <circle cx="26" cy="14" r="3.5" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
          <circle cx="38" cy="50" r="3.5" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
        </g>
      )}

      {(name === "video") && (
        <g>
          <ellipse cx="32" cy="57" rx="20" ry="4" fill="#0284c7" fillOpacity="0.22" />
          {/* Camera Base Body */}
          <rect x="8" y="16" width="36" height="30" rx="8" fill="url(#cam-body)" />
          <rect x="10" y="18" width="32" height="26" rx="6" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.5" />
          {/* Optical Lens */}
          <circle cx="26" cy="31" r="9" fill="#0369a1" />
          <circle cx="26" cy="31" r="7" fill="#0f172a" />
          <circle cx="24" cy="29" r="3" fill="#38bdf8" fillOpacity="0.8" />
          {/* Projector Cone */}
          <path d="M44 26L56 18V44L44 36V26Z" fill="url(#cam-body)" />
          {/* Live Recording LED */}
          <circle cx="15" cy="22" r="2.5" fill="#ef4444" />
          <circle cx="15" cy="22" r="4.5" fill="#ef4444" fillOpacity="0.4" />
        </g>
      )}

      {(name === "hospital" || name === "cashless") && (
        <g>
          <ellipse cx="32" cy="57" rx="20" ry="4" fill="#4f46e5" fillOpacity="0.2" />
          {/* Pavilion Main Structure */}
          <rect x="14" y="18" width="36" height="34" rx="6" fill="url(#hosp-body)" />
          <rect x="16" y="20" width="32" height="30" rx="4" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.2" />
          {/* Modern Rooftop Apex */}
          <path d="M12 18L32 8L52 18H12Z" fill="#4338ca" />
          {/* Cross Crest */}
          <rect x="29" y="12" width="6" height="12" rx="2" fill="#ffffff" />
          <rect x="26" y="15" width="12" height="6" rx="2" fill="#ffffff" />
          {/* Windows Matrix */}
          <rect x="20" y="26" width="6" height="6" rx="1.5" fill="#a5b4fc" />
          <rect x="38" y="26" width="6" height="6" rx="1.5" fill="#a5b4fc" />
          <rect x="20" y="36" width="6" height="6" rx="1.5" fill="#a5b4fc" />
          <rect x="38" y="36" width="6" height="6" rx="1.5" fill="#a5b4fc" />
          {/* Grand Entrance Door */}
          <path d="M28 52V42C28 40.5 29.5 39 31 39H33C34.5 39 36 40.5 36 42V52H28Z" fill="#e0e7ff" />
        </g>
      )}

      {(name === "sparkles" || name === "ai") && (
        <g>
          <ellipse cx="32" cy="57" rx="16" ry="4" fill="#9333ea" fillOpacity="0.2" />
          {/* 3D 8-Point Crystal Star */}
          <path
            d="M32 6L37 23L54 28L39 37L42 54L32 44L22 54L25 37L10 28L27 23L32 6Z"
            fill="url(#ai-star)"
            filter="drop-shadow(0 3px 8px rgba(147, 51, 234, 0.4))"
          />
          {/* Inner Facet Lines */}
          <path d="M32 6V44M10 28H54" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="1.2" />
          <circle cx="32" cy="28" r="4.5" fill="#ffffff" />
          {/* Micro Sparkles */}
          <path d="M48 10L50 16L56 18L50 20L48 26L46 20L40 18L46 16L48 10Z" fill="#38bdf8" />
          <path d="M16 42L17.5 46L22 47.5L17.5 49L16 53L14.5 49L10 47.5L14.5 46L16 42Z" fill="#c084fc" />
        </g>
      )}

      {(name === "mic" || name === "voice") && (
        <g>
          <ellipse cx="32" cy="57" rx="16" ry="3.5" fill="#7e22ce" fillOpacity="0.2" />
          {/* Concentric Sonic Rings */}
          <circle cx="32" cy="26" r="22" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="4 4" strokeOpacity="0.4" />
          <circle cx="32" cy="26" r="17" fill="none" stroke="#a855f7" strokeWidth="2" strokeOpacity="0.6" />
          {/* Mic Capsule */}
          <rect x="24" y="10" width="16" height="26" rx="8" fill="url(#mic-grad)" />
          {/* Metallic Grille Mesh Lines */}
          <line x1="24" y1="18" x2="40" y2="18" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.2" />
          <line x1="24" y1="24" x2="40" y2="24" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.2" />
          {/* Specular Highlight */}
          <rect x="26" y="12" width="4" height="14" rx="2" fill="#ffffff" fillOpacity="0.5" />
          {/* Cradle & Stand */}
          <path d="M19 24C19 32 25 38 32 38C39 38 45 32 45 24" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 38V50" stroke="#64748b" strokeWidth="3.5" strokeLinecap="round" />
          <ellipse cx="32" cy="50" rx="10" ry="3.5" fill="#334155" />
        </g>
      )}

      {(name === "shield" || name === "drugshield") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#059669" fillOpacity="0.2" />
          {/* 3D Security Shield */}
          <path
            d="M32 6L50 14V30C50 43 42 52 32 56C22 52 14 43 14 30V14L32 6Z"
            fill="url(#shield-grad)"
          />
          {/* Beveled Rim */}
          <path
            d="M32 9L47 16V30C47 41 40 49 32 52.5C24 49 17 41 17 30V16L32 9Z"
            fill="none"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1.5"
          />
          {/* Specular Crest Flare */}
          <path d="M32 9L18 16V28C18 36 22 43 32 47V9Z" fill="#ffffff" fillOpacity="0.18" />
          {/* Embedded Medicine Capsule Symbol */}
          <g transform="translate(23, 21) scale(0.6)">
            <rect x="2" y="2" width="28" height="14" rx="7" transform="rotate(-45 16 9)" fill="#ffffff" />
            <rect x="2" y="2" width="14" height="14" rx="7" transform="rotate(-45 16 9)" fill="#059669" />
          </g>
          <circle cx="32" cy="31" r="1.5" fill="#ffffff" />
        </g>
      )}

      {(name === "calendar") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#0284c7" fillOpacity="0.2" />
          {/* Calendar Body */}
          <rect x="10" y="14" width="44" height="40" rx="8" fill="url(#cal-body)" />
          <rect x="10" y="14" width="44" height="40" rx="8" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Top Header Bar */}
          <rect x="10" y="14" width="44" height="14" rx="8" fill="url(#cal-header)" />
          <rect x="10" y="22" width="44" height="6" fill="url(#cal-header)" />
          {/* Metallic Spiral Rings */}
          <rect x="18" y="8" width="4" height="10" rx="2" fill="#64748b" />
          <rect x="30" y="8" width="4" height="10" rx="2" fill="#64748b" />
          <rect x="42" y="8" width="4" height="10" rx="2" fill="#64748b" />
          {/* Date Grids */}
          <circle cx="20" cy="35" r="2.5" fill="#94a3b8" />
          <circle cx="32" cy="35" r="2.5" fill="#94a3b8" />
          <circle cx="44" cy="35" r="2.5" fill="#94a3b8" />
          <circle cx="20" cy="44" r="2.5" fill="#94a3b8" />
          {/* Active Booked Day Badge */}
          <rect x="27" y="39" width="10" height="10" rx="3" fill="#0284c7" />
          <circle cx="32" cy="44" r="2" fill="#ffffff" />
        </g>
      )}

      {(name === "check" || name === "completed") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#16a34a" fillOpacity="0.2" />
          {/* 3D Spherical Seal */}
          <circle cx="32" cy="32" r="24" fill="url(#check-seal)" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
          {/* Specular Sphere Cap */}
          <ellipse cx="26" cy="20" rx="10" ry="5" fill="#ffffff" fillOpacity="0.4" />
          {/* Embossed Bold Checkmark */}
          <path
            d="M20 32L28 40L44 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"
          />
        </g>
      )}

      {(name === "pill" || name === "capsule") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#0284c7" fillOpacity="0.18" />
          {/* Rotated 3D Capsule */}
          <g transform="rotate(-35 32 32)">
            {/* Left Cyan Half */}
            <path
              d="M16 23C16 17 21 12 27 12H32V52H27C21 52 16 47 16 41V23Z"
              fill="url(#pill-left)"
            />
            {/* Right White Half */}
            <path
              d="M32 12H37C43 12 48 17 48 23V41C48 47 43 52 37 52H32V12Z"
              fill="url(#pill-right)"
            />
            {/* Specular Curved Reflection Line */}
            <line x1="20" y1="16" x2="44" y2="16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.85" />
            <circle cx="22" cy="20" r="1.5" fill="#ffffff" />
            {/* Middle Divider Seam */}
            <line x1="32" y1="12" x2="32" y2="52" stroke="#0369a1" strokeWidth="1.2" />
          </g>
        </g>
      )}

      {(name === "chart" || name === "records") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#3b82f6" fillOpacity="0.2" />
          {/* Base Platform */}
          <rect x="8" y="50" width="48" height="4" rx="2" fill="#cbd5e1" />
          {/* 3D Tiered Bars */}
          <rect x="14" y="34" width="10" height="16" rx="3" fill="url(#chart-bar1)" />
          <rect x="27" y="22" width="10" height="28" rx="3" fill="url(#chart-bar2)" />
          <rect x="40" y="12" width="10" height="38" rx="3" fill="url(#chart-bar3)" />
          {/* Specular Highlights on Bars */}
          <rect x="15" y="35" width="2.5" height="14" rx="1" fill="#ffffff" fillOpacity="0.45" />
          <rect x="28" y="23" width="2.5" height="26" rx="1" fill="#ffffff" fillOpacity="0.45" />
          <rect x="41" y="13" width="2.5" height="36" rx="1" fill="#ffffff" fillOpacity="0.45" />
          {/* Holographic Diagnostic Arrow */}
          <path
            d="M12 36L25 24L36 29L48 10"
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M42 10H48V16" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {(name === "user" || name === "patient") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#2563eb" fillOpacity="0.2" />
          {/* Head Sphere with 3D highlight */}
          <circle cx="32" cy="20" r="11" fill="url(#user-grad)" />
          <circle cx="32" cy="20" r="10" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.2" />
          <ellipse cx="28" cy="15" rx="4" ry="2" fill="#ffffff" fillOpacity="0.6" />
          {/* Torso / Shoulders with smooth curve */}
          <path
            d="M14 50C14 41 22 36 32 36C42 36 50 41 50 50V52H14V50Z"
            fill="url(#user-grad)"
          />
          <path
            d="M16 50C16 43 23 38 32 38C41 38 48 43 48 50"
            fill="none"
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth="1.5"
          />
          {/* Biometric Shield Emblem */}
          <circle cx="32" cy="46" r="3.5" fill="#38bdf8" />
          <path d="M31 46L32 47L34 45" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}

      {(name === "syringe" || name === "phlebo") && (
        <g>
          <ellipse cx="32" cy="57" rx="16" ry="3.5" fill="#047857" fillOpacity="0.2" />
          <g transform="rotate(-45 32 32)">
            {/* Needle */}
            <line x1="32" y1="4" x2="32" y2="16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
            {/* Volumetric Barrel */}
            <rect x="26" y="16" width="12" height="28" rx="3" fill="url(#syr-body)" />
            <rect x="27" y="17" width="10" height="26" rx="2" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1" />
            {/* Measurement Marks */}
            <line x1="26" y1="22" x2="30" y2="22" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="26" y1="28" x2="32" y2="28" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="26" y1="34" x2="30" y2="34" stroke="#ffffff" strokeWidth="1.5" />
            {/* Plunger */}
            <rect x="29" y="44" width="6" height="12" fill="#64748b" />
            <rect x="24" y="56" width="16" height="4" rx="2" fill="#334155" />
          </g>
        </g>
      )}

      {(name === "fileText" || name === "briefing") && (
        <g>
          <ellipse cx="32" cy="57" rx="16" ry="4" fill="#0f172a" fillOpacity="0.18" />
          {/* Clipboard Board */}
          <rect x="12" y="12" width="40" height="44" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
          {/* Metal Clamp */}
          <rect x="24" y="8" width="16" height="8" rx="3" fill="#64748b" />
          <circle cx="32" cy="12" r="2" fill="#ffffff" />
          {/* Text Lines */}
          <rect x="18" y="24" width="22" height="3" rx="1.5" fill="#0284c7" />
          <rect x="18" y="31" width="28" height="2.5" rx="1" fill="#94a3b8" />
          <rect x="18" y="37" width="25" height="2.5" rx="1" fill="#94a3b8" />
          <rect x="18" y="43" width="18" height="2.5" rx="1" fill="#94a3b8" />
          {/* Holographic Verification Badge */}
          <circle cx="42" cy="44" r="5" fill="#10b981" />
          <path d="M40 44L41.5 45.5L44.5 42.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {(name === "pharmacy") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#0284c7" fillOpacity="0.2" />
          {/* Dispensary Jar / Mortar */}
          <path
            d="M16 26C16 38 22 50 32 50C42 50 48 38 48 26H16Z"
            fill="url(#pill-left)"
          />
          <ellipse cx="32" cy="26" rx="16" ry="4" fill="#38bdf8" />
          <ellipse cx="32" cy="50" rx="8" ry="3" fill="#0369a1" />
          {/* Medical Cross on Mortar */}
          <rect x="30" y="32" width="4" height="12" rx="2" fill="#ffffff" />
          <rect x="26" y="36" width="12" height="4" rx="2" fill="#ffffff" />
          {/* Pestle */}
          <path d="M40 10L28 32" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}

      {(name === "staff") && (
        <g>
          <ellipse cx="32" cy="57" rx="18" ry="4" fill="#4f46e5" fillOpacity="0.2" />
          {/* Staff ID Lanyard Card */}
          <rect x="16" y="18" width="32" height="38" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
          {/* Blue Top Stripe */}
          <path d="M16 24C16 20.7 18.7 18 22 18H42C45.3 18 48 20.7 48 24V28H16V24Z" fill="#4f46e5" />
          {/* Lanyard Clip */}
          <rect x="28" y="12" width="8" height="6" rx="2" fill="#94a3b8" />
          <path d="M32 12V6" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" />
          {/* Avatar Photo */}
          <circle cx="32" cy="36" r="6" fill="#818cf8" />
          {/* Department Bars */}
          <rect x="22" y="46" width="20" height="2.5" rx="1" fill="#cbd5e1" />
          <rect x="25" y="51" width="14" height="2" rx="1" fill="#94a3b8" />
        </g>
      )}
    </svg>
  );
}
