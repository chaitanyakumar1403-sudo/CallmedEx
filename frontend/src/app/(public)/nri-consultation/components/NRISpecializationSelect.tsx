'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Globe,
  Heart,
  Brain,
  Baby,
  Bone,
  Stethoscope,
  Dna,
  Microscope,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  Check,
  Search,
  X,
} from 'lucide-react';

export interface SpecialtyMeta {
  id: string;
  label: string;
  tagline: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; color?: string; className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const SPECIALTY_CATALOG: Record<string, SpecialtyMeta> = {
  All: {
    id: 'All',
    label: 'All Specializations',
    tagline: 'Browse all overseas medical domains',
    icon: Globe,
    color: '#0284c7',
    bgColor: 'rgba(2, 132, 199, 0.1)',
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  Cardiology: {
    id: 'Cardiology',
    label: 'Cardiology',
    tagline: 'Heart, Blood Pressure & Vascular Care',
    icon: Heart,
    color: '#e11d48',
    bgColor: 'rgba(225, 29, 72, 0.1)',
    borderColor: 'rgba(225, 29, 72, 0.22)',
  },
  Neurology: {
    id: 'Neurology',
    label: 'Neurology',
    tagline: 'Brain, Nerves, Spine & Migraines',
    icon: Brain,
    color: '#9333ea',
    bgColor: 'rgba(147, 51, 234, 0.1)',
    borderColor: 'rgba(147, 51, 234, 0.22)',
  },
  Oncology: {
    id: 'Oncology',
    label: 'Oncology',
    tagline: 'Cancer Care & International Second Opinions',
    icon: ShieldAlert,
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.1)',
    borderColor: 'rgba(217, 119, 6, 0.22)',
  },
  Pediatrics: {
    id: 'Pediatrics',
    label: 'Pediatrics',
    tagline: 'Child Health, Development & Wellness',
    icon: Baby,
    color: '#0891b2',
    bgColor: 'rgba(8, 145, 178, 0.1)',
    borderColor: 'rgba(8, 145, 178, 0.22)',
  },
  Orthopedics: {
    id: 'Orthopedics',
    label: 'Orthopedics',
    tagline: 'Bones, Joints, Sports Rehab & Spine',
    icon: Bone,
    color: '#4f46e5',
    bgColor: 'rgba(79, 70, 229, 0.1)',
    borderColor: 'rgba(79, 70, 229, 0.22)',
  },
  'Internal Medicine': {
    id: 'Internal Medicine',
    label: 'Internal Medicine',
    tagline: 'Adult Healthcare, Diabetes & Chronic Care',
    icon: Stethoscope,
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: 'rgba(37, 99, 235, 0.22)',
  },
  Endocrinology: {
    id: 'Endocrinology',
    label: 'Endocrinology',
    tagline: 'Hormones, Thyroid & Metabolic Disorders',
    icon: Dna,
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.1)',
    borderColor: 'rgba(5, 150, 105, 0.22)',
  },
  Gastroenterology: {
    id: 'Gastroenterology',
    label: 'Gastroenterology',
    tagline: 'Digestive Health, Liver, Gut & IBS',
    icon: Microscope,
    color: '#ea580c',
    bgColor: 'rgba(234, 88, 12, 0.1)',
    borderColor: 'rgba(234, 88, 12, 0.22)',
  },
  Dermatology: {
    id: 'Dermatology',
    label: 'Dermatology',
    tagline: 'Skin, Hair, Nails & Aesthetic Medicine',
    icon: Sparkles,
    color: '#0d9488',
    bgColor: 'rgba(13, 148, 136, 0.1)',
    borderColor: 'rgba(13, 148, 136, 0.22)',
  },
};

interface NRISpecializationSelectProps {
  value: string;
  onChange: (spec: string) => void;
  options?: string[];
  doctorCounts?: Record<string, number>;
  totalDoctors?: number;
}

export default function NRISpecializationSelect({
  value,
  onChange,
  options = Object.keys(SPECIALTY_CATALOG),
  doctorCounts = {},
  totalDoctors = 0,
}: NRISpecializationSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus mini search input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setFilterQuery('');
    }
  }, [isOpen]);

  const activeMeta = useMemo(() => {
    return (
      SPECIALTY_CATALOG[value] || {
        id: value,
        label: value === 'All' ? 'All Specializations' : value,
        tagline: 'Overseas Medical Specialist',
        icon: Stethoscope,
        color: '#0284c7',
        bgColor: 'rgba(2, 132, 199, 0.1)',
        borderColor: 'rgba(2, 132, 199, 0.22)',
      }
    );
  }, [value]);

  const ActiveIcon = activeMeta.icon;

  const filteredOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return options.filter((spec) => {
      if (!q) return true;
      const meta = SPECIALTY_CATALOG[spec];
      const nameMatch = spec.toLowerCase().includes(q);
      const labelMatch = meta?.label.toLowerCase().includes(q);
      const taglineMatch = meta?.tagline.toLowerCase().includes(q);
      return nameMatch || labelMatch || taglineMatch;
    });
  }, [options, filterQuery]);

  const handleSelect = (spec: string) => {
    onChange(spec);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('All');
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        minWidth: 240,
        flex: '1 1 240px',
        maxWidth: 320,
      }}
    >
      {/* ─── Premium Glassmorphic Trigger Button ────────────────────── */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 10,
          border: isOpen ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
          background: isOpen ? '#ffffff' : '#f8fafc',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(2, 132, 199, 0.12), 0 4px 14px rgba(15, 23, 42, 0.06)'
            : '0 1px 2px rgba(15, 23, 42, 0.04)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.18s ease-in-out',
          textAlign: 'left',
        }}
      >
        {/* Left icon and label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: activeMeta.bgColor,
              border: `1px solid ${activeMeta.borderColor}`,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <ActiveIcon size={16} color={activeMeta.color} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: value !== 'All' ? activeMeta.color : '#64748b',
                lineHeight: 1.1,
              }}
            >
              {value !== 'All' ? 'Specialization' : 'Medical Domain'}
            </div>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: 2,
              }}
            >
              {activeMeta.label}
            </div>
          </div>
        </div>

        {/* Right side: Clear (X) if selected + Chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {value !== 'All' && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
              title="Reset to All Specializations"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: '#64748b',
                background: 'rgba(203, 213, 225, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(203, 213, 225, 0.35)';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <X size={12} strokeWidth={2.5} />
            </span>
          )}

          <div
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              alignItems: 'center',
              color: isOpen ? '#0284c7' : '#64748b',
            }}
          >
            <ChevronDown size={17} strokeWidth={2.2} />
          </div>
        </div>
      </button>

      {/* ─── Premium Glassmorphic Dropdown Flyout Menu ───────────────── */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '100%',
            minWidth: 320,
            maxWidth: 380,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            borderRadius: 14,
            border: '1.5px solid rgba(2, 132, 199, 0.22)',
            boxShadow:
              '0 20px 40px -10px rgba(15, 29, 51, 0.22), 0 10px 20px -5px rgba(2, 132, 199, 0.1)',
            padding: 8,
            zIndex: 100,
            animation: 'cmDropdownFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Internal Quick Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              marginBottom: 6,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <Search size={14} color="#64748b" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search specialization..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '0.82rem',
                color: '#1e293b',
              }}
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* List Header info */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 8px 6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>Medical Specialties</span>
            <span>{filteredOptions.length} available</span>
          </div>

          {/* Scrollable list of items */}
          <div
            style={{
              maxHeight: 290,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              paddingRight: 2,
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.84rem',
                }}
              >
                No specializations matching &ldquo;{filterQuery}&rdquo;
              </div>
            ) : (
              filteredOptions.map((spec) => {
                const meta =
                  SPECIALTY_CATALOG[spec] || {
                    id: spec,
                    label: spec,
                    tagline: 'Overseas Medical Specialist',
                    icon: Stethoscope,
                    color: '#0284c7',
                    bgColor: 'rgba(2, 132, 199, 0.1)',
                    borderColor: 'rgba(2, 132, 199, 0.22)',
                  };

                const IconComponent = meta.icon;
                const isSelected = value === spec;
                const count =
                  spec === 'All' ? totalDoctors : doctorCounts[spec] || 0;

                return (
                  <button
                    key={spec}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(spec)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: isSelected
                        ? `1px solid ${meta.borderColor}`
                        : '1px solid transparent',
                      background: isSelected
                        ? '#f0f9ff'
                        : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.14s ease',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {/* Left: icon + text */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: meta.bgColor,
                          border: `1px solid ${meta.borderColor}`,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComponent size={16} color={meta.color} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: isSelected ? 800 : 600,
                            color: isSelected ? '#0284c7' : '#0f172a',
                            lineHeight: 1.2,
                          }}
                        >
                          {meta.label}
                        </div>
                        <div
                          style={{
                            fontSize: '0.71rem',
                            color: '#64748b',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {meta.tagline}
                        </div>
                      </div>
                    </div>

                    {/* Right: Count pill or Checkmark */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {count > 0 && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 999,
                            background: isSelected ? '#e0f2fe' : '#f1f5f9',
                            color: isSelected ? '#0369a1' : '#475569',
                          }}
                        >
                          {count} {count === 1 ? 'doc' : 'docs'}
                        </span>
                      )}

                      {isSelected && (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#0284c7',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#ffffff',
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom quick actions */}
          {value !== 'All' && (
            <div
              style={{
                marginTop: 6,
                paddingTop: 6,
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => handleSelect('All')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#0284c7',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                Reset to All Specializations
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
