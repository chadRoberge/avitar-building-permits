import { helper } from '@ember/component/helper';

/**
 * Helper to check if user is municipal user level (11-20)
 * Usage: {{is-power-user user.permissionLevel}}
 * Usage: {{if (is-power-user user.permissionLevel) "Municipal Features"}}
 */
export default helper(function isPowerUser([permissionLevel]) {
  if (!permissionLevel) return false;
  const level = parseInt(permissionLevel);
  return level >= 11 && level <= 20; // Municipal users
});