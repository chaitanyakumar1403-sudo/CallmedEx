/**
 * Human label for a dispatch task's service type.
 *
 * `DispatchTask.service_type` is declared as a required string, but the live
 * dispatch API does not always send it — a task can arrive carrying little more
 * than an id and a status. Three call sites called `.replace()` on it directly,
 * which threw and took the whole phlebotomist dashboard down with an error
 * boundary rather than degrading. TypeScript could not catch this: the type
 * described what we expected, not what the server sends.
 *
 * Centralised so the fallback and the `home_collection` special case stay
 * consistent — previously the tracker said "Blood collection" while the task
 * panels said "home collection" for the same value.
 */
export function serviceLabel(serviceType?: string | null): string {
  if (!serviceType) return "Collection";
  if (serviceType === "home_collection") return "Blood collection";
  return serviceType.replace(/_/g, " ");
}
