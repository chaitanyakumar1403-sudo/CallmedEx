"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface DateOfBirthPickerProps {
  value?: string; // ISO date string YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  error?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);

function getDaysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

export default function DateOfBirthPicker({ value, onChange, label = "Date of Birth", error }: DateOfBirthPickerProps) {
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [yearSearch, setYearSearch] = useState("");
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        setYear(parseInt(parts[0]));
        setMonth(parseInt(parts[1]));
        setDay(parseInt(parts[2]));
      }
    }
  }, [value]);

  // Emit change when all three are set
  useEffect(() => {
    if (year && month && day) {
      const maxDay = getDaysInMonth(month, year);
      const safeDay = Math.min(day, maxDay);
      if (safeDay !== day) setDay(safeDay);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
      onChange(dateStr);
    }
  }, [year, month, day, onChange]);

  // Close year dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
        setShowYearDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredYears = yearSearch
    ? YEARS.filter(y => String(y).includes(yearSearch))
    : YEARS;

  const daysInMonth = getDaysInMonth(month || 1, year || 2000);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const selectStyle: React.CSSProperties = {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1.5px solid var(--color-gray-200)",
    fontSize: "0.92rem",
    fontFamily: "var(--font-body)",
    color: "var(--color-gray-800)",
    backgroundColor: "var(--color-white)",
    cursor: "pointer",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    backgroundSize: "12px",
    paddingRight: "32px",
    minWidth: 0,
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {label && (
        <label style={{
          display: "block", fontWeight: 600, fontSize: "0.88rem",
          color: "var(--color-gray-700)", marginBottom: 8,
        }}>
          {label} <span style={{ color: "var(--color-red)" }}>*</span>
        </label>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        {/* Year Selector — with search */}
        <div ref={yearDropdownRef} style={{ flex: 1.2, position: "relative" }}>
          <div
            style={{
              ...selectStyle,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              color: year ? "var(--color-gray-800)" : "var(--color-gray-400)",
              borderColor: showYearDropdown ? "var(--color-navy)" : "var(--color-gray-200)",
              boxShadow: showYearDropdown ? "0 0 0 3px rgba(26,43,74,0.1)" : "none",
            }}
            onClick={() => {
              setShowYearDropdown(!showYearDropdown);
              setTimeout(() => yearInputRef.current?.focus(), 50);
            }}
          >
            {year || "Year"}
          </div>
          {showYearDropdown && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
              backgroundColor: "white", border: "1.5px solid var(--color-gray-200)",
              borderRadius: 10, marginTop: 4, boxShadow: "var(--shadow-lg)",
              maxHeight: 280, overflow: "hidden", display: "flex", flexDirection: "column",
            }}>
              {/* Search input */}
              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-gray-100)" }}>
                <input
                  ref={yearInputRef}
                  type="text"
                  placeholder="Search year..."
                  value={yearSearch}
                  onChange={e => setYearSearch(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8,
                    border: "1px solid var(--color-gray-200)", fontSize: "0.88rem",
                    outline: "none", fontFamily: "var(--font-body)",
                  }}
                  autoFocus
                />
              </div>
              {/* Scrollable year list */}
              <div style={{ overflowY: "auto", maxHeight: 220 }}>
                {filteredYears.map(y => (
                  <div
                    key={y}
                    style={{
                      padding: "9px 14px", cursor: "pointer", fontSize: "0.88rem",
                      fontWeight: y === year ? 700 : 400,
                      backgroundColor: y === year ? "var(--color-navy)" : "transparent",
                      color: y === year ? "white" : "var(--color-gray-700)",
                      transition: "background-color 0.1s",
                    }}
                    onMouseEnter={e => { if (y !== year) (e.target as HTMLElement).style.backgroundColor = "var(--color-gray-50)"; }}
                    onMouseLeave={e => { if (y !== year) (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
                    onClick={() => { setYear(y); setYearSearch(""); setShowYearDropdown(false); }}
                  >
                    {y}
                  </div>
                ))}
                {filteredYears.length === 0 && (
                  <div style={{ padding: "12px 14px", color: "var(--color-gray-400)", fontSize: "0.85rem", textAlign: "center" }}>
                    No matching year
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Month Selector */}
        <select
          value={month || ""}
          onChange={e => setMonth(parseInt(e.target.value) || null)}
          style={{ ...selectStyle, color: month ? "var(--color-gray-800)" : "var(--color-gray-400)" }}
        >
          <option value="" disabled>Month</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Day Selector */}
        <select
          value={day || ""}
          onChange={e => setDay(parseInt(e.target.value) || null)}
          style={{ ...selectStyle, flex: 0.8, color: day ? "var(--color-gray-800)" : "var(--color-gray-400)" }}
        >
          <option value="" disabled>Day</option>
          {days.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ color: "var(--color-red)", fontSize: "0.78rem", marginTop: 4, fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* Preview of selected date */}
      {year && month && day && (
        <div style={{
          fontSize: "0.78rem", color: "var(--color-gray-500)", marginTop: 6,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          📅 {MONTHS[month - 1]} {day}, {year}
        </div>
      )}
    </div>
  );
}
