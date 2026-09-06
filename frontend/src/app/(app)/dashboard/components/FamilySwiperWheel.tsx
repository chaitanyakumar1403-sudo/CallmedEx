'use client';

import React from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { Users, User, ShieldCheck, AlertCircle } from 'lucide-react';

import { PATIENT_TRANSLATIONS, PatientLang } from '../patient/patientTranslations';

interface FamilySwiperWheelProps {
  lang?: PatientLang;
}

export const FamilySwiperWheel: React.FC<FamilySwiperWheelProps> = ({ lang = 'en' }) => {
  const { members, activeMemberId, setActiveMemberId } = useFamilyHubStore();
  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;

  return (
    <div className="cm-family-swiper-card">
      <div className="cm-family-header">
        <div className="cm-family-title-group">
          <Users className="cm-family-title-icon" />
          <span className="cm-family-title-text">{t.familyCaregiverSwitcher}</span>
        </div>
        <span className="cm-family-count-badge">{members.length} {t.members}</span>
      </div>

      {members.length === 0 ? (
        <div className="cm-family-empty">
          {t.noFamilyMembers}
        </div>
      ) : (
        <div className="cm-family-wheel-scroll">
          {members.map((member) => {
            const isActive = member.id === activeMemberId;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setActiveMemberId(member.id)}
                className={`cm-family-member-btn ${isActive ? 'is-active' : ''}`}
              >
                <div className="cm-family-member-avatar">
                  <User style={{ width: 16, height: 16 }} />
                </div>

                <div style={{ textAlign: 'left' }}>
                  <div className="cm-family-member-name">
                    {member.fullName.split(' ')[0]}
                  </div>
                  <div className="cm-family-member-rel">
                    {member.relationship?.toLowerCase() === 'self' ? t.self : member.relationship}
                  </div>
                </div>

                {member.hasActiveAlert && (
                  <span className="cm-family-alert-dot" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
