/**
 * CallMedex Mobile — Input Validation Utilities
 * Indian-standard validators for phone, email, pincode, GSTIN, medical licenses.
 */

/**
 * Validate Indian mobile number (10 digits starting with 6-9).
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // Accept 10-digit, 12-digit (91 prefix), or 13-digit (+91 prefix)
  if (digits.length === 10) return /^[6-9]\d{9}$/.test(digits);
  if (digits.length === 12 && digits.startsWith('91'))
    return /^91[6-9]\d{9}$/.test(digits);
  return false;
}

/**
 * Validate email address.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate Indian pincode (6 digits, first digit 1-9).
 */
export function isValidPincode(pincode: string): boolean {
  return /^[1-9]\d{5}$/.test(pincode.trim());
}

/**
 * Validate Indian GSTIN format.
 * Format: 2-digit state code + 10-char PAN + 1 entity + 1 Z + 1 check
 */
export function isValidGSTIN(gstin: string): boolean {
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(
    gstin.trim().toUpperCase()
  );
}

/**
 * Validate password strength.
 * Minimum 8 characters, at least one uppercase, one lowercase, one digit.
 */
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

/**
 * Validate password match.
 */
export function doPasswordsMatch(password: string, confirm: string): boolean {
  return password === confirm && password.length > 0;
}

/**
 * Validate full name (at least 2 characters, letters and spaces only).
 */
export function isValidName(name: string): boolean {
  return /^[A-Za-z\s.'-]{2,100}$/.test(name.trim());
}

/**
 * Validate medical license/registration number (alphanumeric, 5-20 chars).
 */
export function isValidLicense(license: string): boolean {
  return /^[A-Za-z0-9/-]{5,30}$/.test(license.trim());
}

/**
 * Validate date of birth (must be in the past, age >= 0).
 */
export function isValidDateOfBirth(dob: string): boolean {
  try {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return false;
    return d < new Date();
  } catch {
    return false;
  }
}

/**
 * Validate OTP code (4-8 digit numeric).
 */
export function isValidOTP(otp: string): boolean {
  return /^\d{4,8}$/.test(otp.trim());
}

/**
 * Get human-readable validation error message.
 */
export function getValidationError(
  field: string,
  value: string
): string | null {
  switch (field) {
    case 'phone':
      return isValidPhone(value) ? null : 'Enter a valid 10-digit mobile number';
    case 'email':
      return isValidEmail(value) ? null : 'Enter a valid email address';
    case 'pincode':
      return isValidPincode(value) ? null : 'Enter a valid 6-digit pincode';
    case 'gstin':
      return isValidGSTIN(value) ? null : 'Enter a valid GSTIN';
    case 'password':
      return isValidPassword(value)
        ? null
        : 'Password must be 8+ chars with uppercase, lowercase, and digit';
    case 'name':
      return isValidName(value) ? null : 'Enter a valid name';
    case 'license':
      return isValidLicense(value) ? null : 'Enter a valid license number';
    case 'otp':
      return isValidOTP(value) ? null : 'Enter a valid OTP code';
    default:
      return value.trim().length > 0 ? null : `${field} is required`;
  }
}
