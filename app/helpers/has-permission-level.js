import { helper } from '@ember/component/helper';

/**
 * Helper to check if user has required permission level
 * Usage: {{has-permission-level user.permissionLevel 12}}
 * Usage: {{if (has-permission-level user.permissionLevel 21) "Show admin content"}}
 */
export default helper(function hasPermissionLevel([currentLevel, requiredLevel]) {
  if (!currentLevel || !requiredLevel) return false;
  return parseInt(currentLevel) >= parseInt(requiredLevel);
});