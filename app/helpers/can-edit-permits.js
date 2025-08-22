import { helper } from '@ember/component/helper';

/**
 * Helper to check if user can edit permits (level 13+)
 * Usage: {{can-edit-permits user.permissionLevel}}
 * Usage: {{if (can-edit-permits user.permissionLevel) "Edit Button"}}
 */
export default helper(function canEditPermits([permissionLevel]) {
  if (!permissionLevel) return false;
  return parseInt(permissionLevel) >= 13; // Municipal power users and above
});