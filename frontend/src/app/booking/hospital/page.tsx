"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function HospitalBookingRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const params = searchParams.toString();
    const target = params ? `/booking?${params}` : "/booking";
    router.replace(target);
  }, [searchParams, router]);

  return (
    <div style={{ textAlign: "center", padding: "100px 20px", color: "#64748b" }}>
      <div style={{ fontSize: "2rem", marginBottom: "16px" }}>🏥</div>
      <h3>Redirecting to Booking Console...</h3>
    </div>
  );
}

export default function HospitalBookingRedirectPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "100px 20px" }}>Loading...</div>}>
      <HospitalBookingRedirectContent />
    </Suspense>
  );
}
