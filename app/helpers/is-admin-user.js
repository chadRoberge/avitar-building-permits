import { helper } from '@ember/component/helper';
import { getOwner } from '@ember/application';

/**
 * Helper to check if user is admin level
 * Usage: {{is-admin-user user.permissionLevel}}
 * Usage: {{if (is-admin-user user.permissionLevel) "Admin Features"}}
 */
export default helper(function isAdminUser([permissionLevel], hash, { owner }) {
  if (!permissionLevel) return false;
  
  try {
    const permissions = getOwner(owner).lookup('service:permissions');
    return permissions.isAdminUser({ permissionLevel });
  } catch (error) {
    // Fallback to direct check if service not available
    const level = parseInt(permissionLevel);
    return level >= 21 && level <= 30;
  }
});