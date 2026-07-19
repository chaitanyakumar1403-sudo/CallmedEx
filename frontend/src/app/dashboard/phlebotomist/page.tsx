"use client";

import ProviderDispatchTracker from "../components/ProviderDispatchTracker";

export default function PhlebotomistDashboard() {
  return (
    <ProviderDispatchTracker
      title="Phlebotomist Hub"
      icon="🩸"
      providerType="phlebotomist"
      earningsRate={200}
    />
  );
}
