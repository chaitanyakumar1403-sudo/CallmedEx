---
name: pharmacy-delivery-model
description: CallMedex's dark-store-style pharmacy delivery matching spec. Use when building or reviewing prescription/OTC order matching, pharmacy fulfillment, or delivery status tracking.
---

# Pharmacy Delivery (Dark-Store Model)

- Prescription/OTC order placed by patient (web or WhatsApp)
- System matches to nearest registered pharmacy with the item in stock and within geofenced service radius (from pharmacy's `service_radius` field set at signup)
- Pharmacy fulfills and dispatches for delivery — either pharmacy's own rider or a shared delivery pool (future)
- Order status tracked similarly to phlebotomist dispatch (simpler — no live GPS required initially, just status states: confirmed → preparing → out for delivery → delivered)
- **Future-forward additions:**
  - Direct e-prescription → pharmacy handoff from video consultation — one tap from prescription card to order
  - Real-time stock-check across nearby pharmacies before confirming order, to avoid "out of stock" cancellations
  - Auto-refill reminders for chronic-condition patients (e.g., BP/diabetes medication) with one-tap reorder via WhatsApp
  - Generic-medicine substitution suggestion (with pharmacist/doctor approval) for cost savings — relevant to India's price-sensitive market
