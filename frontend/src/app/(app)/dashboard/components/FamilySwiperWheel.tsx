'use client';

import React from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { Users, AlertCircle, HeartPulse, User } from 'lucide-react';

export const FamilySwiperWheel: React.FC = () => {
  const { members, activeMemberId, setActiveMemberId } = useFamilyHubStore();

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 text-white shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
          <Users className="w-4 h-4" />
          <span>Family Caregiver Switcher</span>
        </div>
        <span className="text-xs text-slate-400 font-medium">{members.length} Members Active</span>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
        {members.map((member) => {
          const isActive = member.id === activeMemberId;
          return (
            <button
              key={member.id}
              onClick={() => setActiveMemberId(member.id)}
              className={`flex flex-col items-center p-3 rounded-2xl border transition-all duration-200 min-w-[110px] relative group ${
                isActive
                  ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              {/* Alert Badge */}
              {member.hasActiveAlert && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 animate-bounce">
                  !
                </span>
              )}

              {/* Avatar Circle */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 relative transition-transform group-hover:scale-105 ${
                  isActive ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 bg-cyan-600/30' : 'bg-slate-800'
                }`}
              >
                <User className={`w-6 h-6 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
              </div>

              <span className={`text-xs font-bold truncate max-w-[90px] ${isActive ? 'text-white' : 'text-slate-300'}`}>
                {member.fullName.split(' ')[0]}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">{member.relationship}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
