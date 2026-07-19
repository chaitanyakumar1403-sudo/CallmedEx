"use client";

import ProviderDispatchTracker from "../components/ProviderDispatchTracker";

export default function NurseDashboard() {
  return (
    <ProviderDispatchTracker
      title="Nurse Dashboard"
      icon="👩‍⚕️"
      providerType="nurse"
      earningsRate={350} // Estimate rate for nursing care
    />
  );
}
