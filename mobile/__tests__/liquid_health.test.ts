// mobile/__tests__/liquid_health.test.ts
// Unit tests for CallMedex Liquid Health design tokens and glassmorphism contracts (§3.7)

import { GlassTokens, RoleAccents, ColorTokens } from '../src/theme/tokens';

describe('Liquid Health Tokens & Design System (§3.7)', () => {
  it('should have all 4 glass tiers defined with proper optical parameters', () => {
    expect(GlassTokens.G1).toBeDefined();
    expect(GlassTokens.G2).toBeDefined();
    expect(GlassTokens.G3).toBeDefined();
    expect(GlassTokens.G4).toBeDefined();

    expect(GlassTokens.G1.blur).toBe(0);
    expect(GlassTokens.G2.blur).toBe(16);
    expect(GlassTokens.G3.blur).toBe(24);
  });

  it('mandates that G4 (Clinical Opaque) has zero blur and solid opaque fill (§3.2)', () => {
    // Clinical liability firewall: lab readings, barcodes, doses must NEVER be blurred/translucent
    expect(GlassTokens.G4.blur).toBe(0);
    expect(GlassTokens.G4.fill).toBe('#132032');
  });

  it('defines distinct role accents for all 10 unified role groups (§3.7 & §5)', () => {
    const roles = [
      'patient',
      'phlebotomist',
      'processingCenter',
      'deliveryRider',
      'doctor',
      'nurse',
      'physiotherapist',
      'pharmacy',
      'hospital',
      'supervisor',
    ];

    roles.forEach((role) => {
      expect((RoleAccents as any)[role]).toBeDefined();
      expect((RoleAccents as any)[role].primary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect((RoleAccents as any)[role].glow).toContain('rgba');
    });
  });

  it('preserves core CallMedex color tokens from foundation.css', () => {
    expect(ColorTokens.navy).toBeDefined();
    expect(ColorTokens.urgent).toBe('#d92020');
    expect(ColorTokens.done).toBe('#15803d');
  });
});
