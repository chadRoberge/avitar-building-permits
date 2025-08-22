import { helper } from '@ember/component/helper';

/**
 * Helper to check if user is municipal user level (11-20)
 * Usage: {{is-municipal-user user.permissionLevel}}
 * Usage: {{if (is-municipal-user user.permissionLevel) "Municipal Features"}}
 */
export default helper(function isMunicipalUser([permissionLevel]) {
  if (!permissionLevel) return false;
  const level = parseInt(permissionLevel);
  return level >= 11 && level <= 20;
});