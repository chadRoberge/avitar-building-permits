import { helper } from '@ember/component/helper';

/**
 * Helper to check if user is residential user level (1-4)
 * Usage: {{is-residential-user user.permissionLevel}}
 * Usage: {{if (is-residential-user user.permissionLevel) "Residential Features"}}
 */
export default helper(function isResidentialUser([permissionLevel]) {
  if (!permissionLevel) return false;
  const level = parseInt(permissionLevel);
  return level >= 1 && level <= 4;
});