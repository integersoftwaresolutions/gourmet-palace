const test = require('node:test');
const assert = require('node:assert/strict');
const {
  registerSchema,
  onboardingSchema,
} = require('../src/modules/auth/auth.validation');
const {
  slugifyOrganizationName,
  isEmailVerified,
  isOnboardingComplete,
} = require('../src/modules/auth/auth.service');

test('registration requires a valid email and password with a letter and number', () => {
  const good = registerSchema.body.validate({
    name: 'Owner User',
    email: 'owner@example.com',
    password: 'securepass123',
  });
  assert.equal(good.error, undefined);

  const weak = registerSchema.body.validate({
    name: 'Owner User',
    email: 'owner@example.com',
    password: 'passwordonly',
  });
  assert.ok(weak.error);
});

test('onboarding requires organization and mandatory first-location fields', () => {
  const valid = onboardingSchema.body.validate({
    organizationName: 'Example Hospitality',
    locationName: 'Main Street',
    locationAddress: '123 Main Street',
    timezone: 'America/Los_Angeles',
  });
  assert.equal(valid.error, undefined);

  const missingAddress = onboardingSchema.body.validate({
    organizationName: 'Example Hospitality',
    locationName: 'Main Street',
    timezone: 'America/Los_Angeles',
  });
  assert.ok(missingAddress.error);
});

test('organization slug is generated from the organization name', () => {
  assert.equal(slugifyOrganizationName('  Café & Grill — Downtown  '), 'cafe-grill-downtown');
  assert.equal(slugifyOrganizationName('***'), 'organization');
});

test('legacy accounts remain verified/onboarded while self-registration is gated', () => {
  assert.equal(isEmailVerified({ accountOrigin: 'legacy', emailVerifiedAt: null }), true);
  assert.equal(isOnboardingComplete({ accountOrigin: 'legacy', organizationId: 'abc' }), true);

  assert.equal(isEmailVerified({ accountOrigin: 'self', emailVerifiedAt: null }), false);
  assert.equal(
    isOnboardingComplete({ accountOrigin: 'self', organizationId: 'abc', onboardingCompletedAt: null }),
    false,
  );
  assert.equal(
    isOnboardingComplete({ accountOrigin: 'self', organizationId: 'abc', onboardingCompletedAt: new Date() }),
    true,
  );
});
