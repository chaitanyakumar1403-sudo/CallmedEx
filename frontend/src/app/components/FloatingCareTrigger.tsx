"use client";

import React, { useState } from "react";
import { Bell, MessageSquare } from "lucide-react";
import { PatientNotificationCenter } from "./PatientNotificationCenter";

interface FloatingCareTriggerProps {
  iconType?: "bell" | "message";
}

export function FloatingCareTrigger({ iconType = "bell" }: FloatingCareTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  return (
    <>
      <div className="chat-widget" style={{ zIndex: 9999 }}>
        <button
          type="button"
          className="chat-widget__btn"
          aria-label={`Open clinical care notifications and alerts (${unreadCount} unread)`}
          onClick={() => setIsOpen(true)}
          style={{
            display: "grid",
            placeItems: "center",
            position: "relative",
            cursor: "pointer",
            background: "linear-gradient(135deg, var(--cm-navy) 0%, var(--cm-active) 100%)",
            boxShadow: "0 8px 24px rgba(3, 105, 161, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.2) inset",
          }}
        >
          {iconType === "message" ? (
            <MessageSquare size={22} color="#ffffff" />
          ) : (
            <Bell size={22} color="#ffffff" />
          )}

          {unreadCount > 0 && (
            <span
              className="chat-widget__pulse"
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--cm-urgent)",
                border: "2.5px solid #ffffff",
                animation: "cm-pulse-ring 2s infinite",
              }}
            />
          )}
        </button>
      </div>

      <PatientNotificationCenter
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onUnreadCountChange={(count) => setUnreadCount(count)}
      />
    </>
  );
}

export default FloatingCareTrigger;
