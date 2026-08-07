'use client';

import React from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { Users, User, ShieldCheck, AlertCircle } from 'lucide-react';

export const FamilySwiperWheel: React.FC = () => {
  const { members, activeMemberId, setActiveMemberId } = useFamilyHubStore();

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        padding: '16px 20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users style={{ width: 16, height: 16, color: '#0284c7' }} />
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Family Caregiver Switcher</span>
        </div>
        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{members.length} Members</span>
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {members.map((member) => {
          const isActive = member.id === activeMemberId;
          return (
            <button
              key={member.id}
              onClick={() => setActiveMemberId(member.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                borderRadius: 12,
                border: isActive ? '2px solid #0284c7' : '1px solid #cbd5e1',
                background: isActive ? '#e0f2fe' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: isActive ? '#0284c7' : '#cbd5e1',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              >
                <User style={{ width: 16, height: 16 }} />
              </div>

              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: isActive ? 800 : 600, fontSize: '0.85rem', color: isActive ? '#0369a1' : '#1e293b' }}>
                  {member.fullName.split(' ')[0]}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{member.relationship}</div>
              </div>

              {member.hasActiveAlert && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block', marginLeft: 4 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
