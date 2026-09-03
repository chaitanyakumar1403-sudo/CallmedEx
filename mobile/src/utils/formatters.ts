/**
 * CallMedex Mobile — Formatting Utilities
 * Currency (INR), date/time, phone, and display formatters.
 */

/**
 * Format amount as Indian Rupees (₹).
 * Uses the Indian numbering system (lakhs/crores).
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format ISO date string to readable date (e.g., "16 Aug 2026").
 */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Format ISO date string to readable date + time (e.g., "16 Aug 2026, 2:30 PM").
 */
export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

/**
 * Format time string (HH:MM or HH:MM:SS) to 12-hour format.
 */
export function formatTime(timeStr: string | undefined | null): string {
  if (!timeStr) return '—';
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
  } catch {
    return timeStr || '—';
  }
}

/**
 * Relative time formatting (e.g., "2 hours ago", "Just now").
 */
export function formatRelativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';

    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return formatDate(dateStr);
  } catch {
    return '—';
  }
}

/**
 * Normalize phone number to E.164 format for India.
 * Handles: "9876543210", "09876543210", "+919876543210", "91 9876543210"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Format phone for display: "+919876543210" → "+91 98765 43210"
 */
export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '—';
  const normalized = normalizePhone(phone);
  if (normalized.startsWith('+91') && normalized.length === 13) {
    const num = normalized.slice(3);
    return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
  }
  return phone;
}

/**
 * Extract initials from a full name (e.g., "Priya Sharma" → "PS").
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Truncate text with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Capitalize first letter of each word.
 */
export function titleCase(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format age from date of birth.
 */
export function formatAge(dob: string | undefined | null): string {
  if (!dob) return '—';
  try {
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return '—';
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} yrs`;
  } catch {
    return '—';
  }
}
