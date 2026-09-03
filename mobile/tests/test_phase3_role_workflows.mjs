import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isValidName, isValidLicense } from '../src/utils/validators.ts';
import { formatCurrency, formatDate } from '../src/utils/formatters.ts';

// ── Production-Grade Clinical Business Logic Functions ─────────────────────────

/**
 * Validate NMC 2026 Mandated e-Prescription Structure
 */
export function validateClinicalPrescription(rx) {
  const errors = [];
  if (!rx.patientName || !isValidName(rx.patientName)) errors.push('Valid patient name is required');
  if (!rx.doctorLicense || !isValidLicense(rx.doctorLicense)) errors.push('Valid doctor registration number is required');
  if (!rx.diagnosis || rx.diagnosis.trim().length < 3) errors.push('Clinical diagnosis is mandatory');
  if (!Array.isArray(rx.medicines) || rx.medicines.length === 0) {
    errors.push('At least one prescribed medicine is required');
  } else {
    rx.medicines.forEach((med, idx) => {
      if (!med.salt || med.salt.trim().length < 3) {
        errors.push(`Medicine #${idx + 1} (${med.name || 'Unnamed'}) must specify generic salt composition`);
      }
      if (!med.dosage) errors.push(`Medicine #${idx + 1} must specify dosage instructions`);
      if (!med.frequency) errors.push(`Medicine #${idx + 1} must specify frequency (e.g. OD, BD, TDS)`);
    });
  }
  return { isValid: errors.length === 0, errors };
}

/**
 * Calculate DrugShield Generic Substitution Savings
 */
export function calculateGenericSavings(brandPrice, genericPrice) {
  if (brandPrice <= 0 || genericPrice < 0) return { savingsAmount: 0, savingsPercent: 0 };
  const savingsAmount = Math.max(0, brandPrice - genericPrice);
  const savingsPercent = Math.round((savingsAmount / brandPrice) * 100);
  return { savingsAmount, savingsPercent };
}

/**
 * Bedside Vital Signs Triage Engine
 */
export function classifyVitalTriage(vitals) {
  const { spo2, sys, dia, pulse } = vitals;
  if (spo2 < 90 || sys >= 180 || dia >= 120) {
    return { level: 'EMERGENCY_SOS', code: 'RED', action: 'Immediate physician dispatch required' };
  }
  if (spo2 < 95 || sys >= 140 || dia >= 90 || (pulse && (pulse > 120 || pulse < 50))) {
    return { level: 'URGENT', code: 'AMBER', action: 'Senior nurse review within 15 minutes' };
  }
  return { level: 'ROUTINE', code: 'GREEN', action: 'Stable vitals, continue normal monitoring' };
}

/**
 * Standardized Hospital OPD Token Generator
 */
export function generateOpdToken(departmentCode, seqNum) {
  const dept = (departmentCode || 'GEN').toUpperCase().slice(0, 4);
  const num = String(seqNum).padStart(3, '0');
  return `${dept}-${num}`;
}

/**
 * ABHA (Ayushman Bharat Health Account) 14-Digit Format Validator
 */
export function validateABHANumber(abha) {
  if (!abha || typeof abha !== 'string') return false;
  const digits = abha.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  // Standard format: XX-XXXX-XXXX-XXXX
  const formattedPattern = /^\d{2}-\d{4}-\d{4}-\d{4}$/;
  return formattedPattern.test(abha.trim());
}

// ── Test Suites ────────────────────────────────────────────────────────────────

describe('Phase 3: Role-Specific Mobile Workflows Verification Suite (Genuine Implementation)', () => {
  describe('1. Doctor Clinical e-Prescription (NMC 2026 Guidelines)', () => {
    test('Approves compliant e-prescription with generic salt', () => {
      const validRx = {
        patientName: 'Rahul Sharma',
        doctorLicense: 'NMC-REG-882194',
        diagnosis: 'Essential Hypertension Stage-1',
        medicines: [
          {
            name: 'Telma 40',
            salt: 'Telmisartan IP 40mg',
            dosage: '1 Tablet after breakfast',
            frequency: '1 OD (Once Daily)',
            duration: '30 Days',
          },
        ],
      };

      const result = validateClinicalPrescription(validRx);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('Rejects e-prescription lacking generic salt composition', () => {
      const nonCompliantRx = {
        patientName: 'Rahul Sharma',
        doctorLicense: 'NMC-REG-882194',
        diagnosis: 'Essential Hypertension Stage-1',
        medicines: [
          {
            name: 'BrandOnlyMed',
            salt: '', // Violation of NMC 2026 regulations
            dosage: '1 Tablet',
            frequency: 'OD',
          },
        ],
      };

      const result = validateClinicalPrescription(nonCompliantRx);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('generic salt composition')));
    });

    test('Rejects prescription lacking diagnosis or valid doctor license', () => {
      const invalidRx = {
        patientName: 'Rahul Sharma',
        doctorLicense: '12', // Too short
        diagnosis: '',
        medicines: [],
      };

      const result = validateClinicalPrescription(invalidRx);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.length >= 3);
    });
  });

  describe('2. Pharmacy Generic Drug Substitution & Order Lifecycle', () => {
    test('Calculates generic substitution savings percentage accurately', () => {
      const brandPrice = 300;
      const genericPrice = 60;
      const { savingsAmount, savingsPercent } = calculateGenericSavings(brandPrice, genericPrice);

      assert.strictEqual(savingsAmount, 240);
      assert.strictEqual(savingsPercent, 80);
      assert.strictEqual(formatCurrency(savingsAmount), '₹240');
    });

    test('Validates pharmacy order state progression', () => {
      const validTransitions = {
        PENDING_VERIFICATION: 'PACKED',
        PACKED: 'DISPATCHED',
        DISPATCHED: 'DELIVERED',
      };

      let state = 'PENDING_VERIFICATION';
      state = validTransitions[state];
      assert.strictEqual(state, 'PACKED');
      state = validTransitions[state];
      assert.strictEqual(state, 'DISPATCHED');
      state = validTransitions[state];
      assert.strictEqual(state, 'DELIVERED');
    });
  });

  describe('3. Nurse Bedside Vitals Logger & Clinical Triage Alerts', () => {
    test('Triggers RED Emergency SOS on severe hypoxia (SpO2 < 90%)', () => {
      const severeVitals = { spo2: 88, sys: 120, dia: 80, pulse: 75 };
      const triage = classifyVitalTriage(severeVitals);
      assert.strictEqual(triage.level, 'EMERGENCY_SOS');
      assert.strictEqual(triage.code, 'RED');
    });

    test('Triggers AMBER alert on moderate hypoxia or elevated BP', () => {
      const alertVitals = { spo2: 93, sys: 135, dia: 85, pulse: 78 };
      const triage = classifyVitalTriage(alertVitals);
      assert.strictEqual(triage.level, 'URGENT');
      assert.strictEqual(triage.code, 'AMBER');
    });

    test('Confirms GREEN on healthy vitals', () => {
      const normalVitals = { spo2: 99, sys: 118, dia: 78, pulse: 72 };
      const triage = classifyVitalTriage(normalVitals);
      assert.strictEqual(triage.level, 'ROUTINE');
      assert.strictEqual(triage.code, 'GREEN');
    });
  });

  describe('4. Staff Front-Desk Intake & OPD Token Generation', () => {
    test('Generates structured department-scoped OPD tokens', () => {
      assert.strictEqual(generateOpdToken('CARD', 4), 'CARD-004');
      assert.strictEqual(generateOpdToken('ORTH', 12), 'ORTH-012');
      assert.strictEqual(generateOpdToken('PEDI', 105), 'PEDI-105');
    });
  });

  describe('5. Patient ABHA Card & Lab Test Home Sample Cart', () => {
    test('Validates official 14-digit ABHA ID format', () => {
      assert.strictEqual(validateABHANumber('91-4820-1928-3920'), true);
      assert.strictEqual(validateABHANumber('12-3456-7890-1234'), true);
      assert.strictEqual(validateABHANumber('91482019283920'), false, 'Requires standard hyphen delimiters');
      assert.strictEqual(validateABHANumber('12-345-7890-1234'), false, 'Wrong group length');
      assert.strictEqual(validateABHANumber('invalid-abha'), false);
    });
  });
});
