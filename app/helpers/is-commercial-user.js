import { helper } from '@ember/component/helper';

/**
 * Helper to check if user is commercial user level (5-10)
 * Usage: {{is-commercial-user user.permissionLevel}}
 * Usage: {{if (is-commercial-user user.permissionLevel) "Commercial Features"}}
 */
export default helper(function isCommercialUser([permissionLevel]) {
  if (!permissionLevel) return false;
  const level = parseInt(permissionLevel);
  return level >= 5 && level <= 10;
});