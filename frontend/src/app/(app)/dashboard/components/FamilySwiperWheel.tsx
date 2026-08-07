'use client';

import React from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { Users, User, ShieldCheck, AlertCircle, Plus } from 'lucide-react';

export const FamilySwiperWheel: React.FC = () => {
  const { members, activeMemberId, setActiveMemberId } = useFamilyHubStore();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/95 to-slate-950/90 p-5 text-white shadow-xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-cyan-400">
            <Users className="h-3.5 w-3.5" />
            Family Caregiver Hub
          </span>
        </div>
        <span className="text-xs font-semibold text-slate-400">{members.length} Dependents Active</span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        {members.map((member) => {
          const isActive = member.id === activeMemberId;
          const statusColor =
            member.healthStatus === 'optimal'
              ? 'border-emerald-400 ring-emerald-400/40'
              : member.healthStatus === 'attention'
              ? 'border-amber-400 ring-amber-400/40 animate-pulse'
              : 'border-rose-400 ring-rose-400/40';

          return (
            <button
              key={member.id}
              onClick={() => setActiveMemberId(member.id)}
              className={`relative flex min-w-[120px] flex-col items-center rounded-2xl border p-3.5 transition-all duration-200 ${
                isActive
                  ? 'border-cyan-500/80 bg-gradient-to-b from-cyan-950/60 to-slate-950/90 shadow-lg shadow-cyan-500/15 scale-[1.02]'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              {/* Alert Badge */}
              {member.hasActiveAlert && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-slate-950 shadow-md ring-2 ring-slate-900 animate-bounce">
                  !
                </span>
              )}

              {/* Glowing Avatar Ring */}
              <div
                className={`relative mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 bg-slate-800 transition-all ${statusColor} ${
                  isActive ? 'ring-4 ring-offset-2 ring-offset-slate-900' : ''
                }`}
              >
                <User className={`h-7 w-7 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
              </div>

              <span className={`max-w-[100px] truncate text-xs font-extrabold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                {member.fullName.split(' ')[0]}
              </span>
              <span className="mt-0.5 text-[10px] font-medium text-slate-400">{member.relationship}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
