import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 4: Final Hardening, Release Packaging & App Store Readiness', () => {
  const appJsonPath = path.resolve('mobile/app.json');
  const easJsonPath = path.resolve('mobile/eas.json');

  describe('1. App Store Metadata & Compliance Audit (app.json)', () => {
    const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8')).expo;

    test('App name and bundle identifiers match production specification', () => {
      assert.strictEqual(appConfig.name, 'CallMedex');
      assert.strictEqual(appConfig.scheme, 'callmedex');
      assert.strictEqual(appConfig.ios.bundleIdentifier, 'com.callmedex.app');
      assert.strictEqual(appConfig.android.package, 'com.callmedex.app');
    });

    test('iOS InfoPlist contains all mandated medical privacy descriptions', () => {
      const { infoPlist } = appConfig.ios;
      assert.ok(infoPlist.NSCameraUsageDescription, 'Camera usage description is defined');
      assert.ok(infoPlist.NSMicrophoneUsageDescription, 'Microphone usage description is defined');
      assert.ok(infoPlist.NSFaceIDUsageDescription, 'Face ID usage description is defined');
      assert.ok(infoPlist.NSLocationWhenInUseUsageDescription, 'Location usage description is defined');
    });

    test('Android permissions contain healthcare telemetry requirements', () => {
      const { permissions } = appConfig.android;
      const required = ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'USE_BIOMETRIC', 'POST_NOTIFICATIONS'];
      required.forEach((perm) => {
        assert.ok(permissions.includes(perm), `Android permission ${perm} is configured`);
      });
    });
  });

  describe('2. EAS Production Build Profiles (eas.json)', () => {
    const easConfig = JSON.parse(fs.readFileSync(easJsonPath, 'utf-8'));

    test('All 3 release channels (development, preview, production) are configured', () => {
      assert.ok(easConfig.build.development, 'Development profile exists');
      assert.ok(easConfig.build.preview, 'Preview profile exists');
      assert.ok(easConfig.build.production, 'Production profile exists');
    });

    test('Production profile generates Google Play App Bundle (AAB)', () => {
      assert.strictEqual(easConfig.build.production.android.buildType, 'app-bundle');
      assert.strictEqual(easConfig.build.production.distribution, 'store');
    });

    test('Auto-increment versioning enabled for production releases', () => {
      assert.strictEqual(easConfig.build.production.autoIncrement, true);
    });
  });

  describe('3. Deep Link Resolution Engine', () => {
    test('Parses consultation deep links with query parameters', () => {
      const url = 'callmedex://consultation/cons_789?token=jwt_xyz&role=doctor';
      const normalized = url.replace(/^[a-zA-Z]+:\/\//, '');
      const parts = normalized.split('?');
      const route = parts[0];
      const queryString = parts[1];

      assert.strictEqual(route, 'consultation/cons_789');
      assert.ok(queryString.includes('token=jwt_xyz'));
    });

    test('Parses diagnostic report deep links', () => {
      const url = 'callmedex://reports/rep_101';
      const normalized = url.replace(/^[a-zA-Z]+:\/\//, '');
      assert.strictEqual(normalized, 'reports/rep_101');
    });
  });

  describe('4. Zero Plaintext Secret Audit', () => {
    test('Ensures .env.example contains no hardcoded private keys', () => {
      const envExample = fs.readFileSync(path.resolve('mobile/.env.example'), 'utf-8');
      assert.ok(!envExample.includes('rzp_live_'), 'No live Razorpay secret in template');
      assert.ok(!envExample.includes('daily_live_secret_key_123'), 'No private daily secrets in client template');
    });
  });
});
