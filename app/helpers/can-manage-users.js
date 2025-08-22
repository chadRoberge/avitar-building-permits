import { helper } from '@ember/component/helper';
import { getOwner } from '@ember/application';

/**
 * Helper to check if user can manage other users (level 21+)
 * Usage: {{can-manage-users user.permissionLevel}}
 * Usage: {{if (can-manage-users user.permissionLevel) "User Management"}}
 */
export default helper(function canManageUsers([permissionLevel], hash, { owner }) {
  if (!permissionLevel) return false;
  
  try {
    const permissions = getOwner(owner).lookup('service:permissions');
    return permissions.canManageUsers({ permissionLevel });
  } catch (error) {
    // Fallback to direct check if service not available
    return parseInt(permissionLevel) >= 21;
  }
});