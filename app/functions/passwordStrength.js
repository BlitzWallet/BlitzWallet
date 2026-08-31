export const MIN_PASSWORD_LENGTH = 8;

export function getPasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { score: 0, label: 'Too short', isCommon: false };
  }
  const len = password.length;

  let score;
  if (len < 8) score = 0;
  else if (len < 12) score = 1;
  else if (len < 16) score = 2;
  else if (len < 20) score = 3;
  else score = 4;

  // Variety nudge: if mix of char classes, bump by 1 (capped at 4), but never gate.
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const varietyCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(
    Boolean,
  ).length;
  if (varietyCount >= 3 && len >= 8 && score < 4) score += 1;
  if (score > 4) score = 4;

  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'];
  let label = labels[score];

  return { score, label };
}

if (require.main === module) {
  const assert = require('assert');
  assert.deepStrictEqual(getPasswordStrength('abc').score, 0, 'short->0');
  assert.ok(
    getPasswordStrength('abcdefgh1234567890XYZ!').score >= 3,
    'long->high',
  );
  const common = getPasswordStrength('password');
  assert.strictEqual(common.label, 'Weak', 'common capped');
  assert.strictEqual(getPasswordStrength('12345678').isCommon, true);
  console.log('passwordStrength self-check passed');
}
