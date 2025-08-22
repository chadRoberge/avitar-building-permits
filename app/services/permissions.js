import Service from '@ember/service';

/**
 * Permissions Service
 * 
 * Centralized service for managing user permissions and abilities
 * across the application. Provides consistent permission checking
 * logic that can be used in controllers, routes, components, and templates.
 */
export default class PermissionsService extends Service {
  
  // Permission Level Constants
  LEVELS = {
    RESIDENTIAL: 1,
    COMMERCIAL: 5,
    MUNICIPAL_BASIC: 11,
    MUNICIPAL_VIEWER: 12,
    MUNICIPAL_POWER_USER: 13,
    DEPARTMENT_REVIEWER: 14,
    MUNICIPAL_INSPECTOR: 15,
    SENIOR_INSPECTOR: 16,
    DEPARTMENT_SUPERVISOR: 17,
    MUNICIPAL_COORDINATOR: 18,
    MUNICIPAL_MANAGER: 19,
    ASSISTANT_ADMIN: 20,
    MUNICIPAL_ADMIN: 21,
    MUNICIPAL_SYSTEM_ADMIN: 22,
    MUNICIPALITY_SUPER_ADMIN: 23,
  };

  /**
   * Check if user has required permission level
   * @param {number|object} userOrLevel - User object or permission level
   * @param {number} requiredLevel - Required permission level
   * @returns {boolean}
   */
  hasPermissionLevel(userOrLevel, requiredLevel) {
    const currentLevel = typeof userOrLevel === 'object' 
      ? userOrLevel?.permissionLevel 
      : userOrLevel;
    
    if (!currentLevel || !requiredLevel) return false;
    return parseInt(currentLevel) >= parseInt(requiredLevel);
  }

  /**
   * Check if user can edit their own profile
   * @param {object} user - User object
   * @returns {boolean}
   */
  canEditProfile(user) {
    // All active users can edit their own profile
    return user?.isActive !== false;
  }

  /**
   * Check if user can edit department assignments
   * @param {object} user - User object
   * @returns {boolean}
   */
  canEditDepartment(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_ADMIN);
  }

  /**
   * Check if user can manage other users
   * @param {object} user - User object
   * @returns {boolean}
   */
  canManageUsers(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_ADMIN);
  }

  /**
   * Check if user can manage permit types
   * @param {object} user - User object
   * @returns {boolean}
   */
  canManagePermitTypes(user) {
    return this.hasPermissionLevel(user, this.LEVELS.DEPARTMENT_SUPERVISOR);
  }

  /**
   * Check if user can conduct inspections
   * @param {object} user - User object
   * @returns {boolean}
   */
  canConductInspections(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_INSPECTOR);
  }

  /**
   * Check if user can review permits
   * @param {object} user - User object
   * @returns {boolean}
   */
  canReviewPermits(user) {
    return this.hasPermissionLevel(user, this.LEVELS.DEPARTMENT_REVIEWER);
  }

  /**
   * Check if user can create permits
   * @param {object} user - User object
   * @returns {boolean}
   */
  canCreatePermits(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_VIEWER);
  }

  /**
   * Check if user can view permits
   * @param {object} user - User object
   * @returns {boolean}
   */
  canViewPermits(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_BASIC);
  }

  /**
   * Check if user can access system administration
   * @param {object} user - User object
   * @returns {boolean}
   */
  canAccessSystemAdmin(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_ADMIN);
  }

  /**
   * Check if user can manage municipality settings
   * @param {object} user - User object
   * @returns {boolean}
   */
  canManageMunicipalitySettings(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_SYSTEM_ADMIN);
  }

  /**
   * Check if user is admin level (21+)
   * @param {object} user - User object
   * @returns {boolean}
   */
  isAdminUser(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_ADMIN);
  }

  /**
   * Check if user is municipal staff
   * @param {object} user - User object
   * @returns {boolean}
   */
  isMunicipalUser(user) {
    return user?.userType === 'municipal';
  }

  /**
   * Check if user is residential user
   * @param {object} user - User object
   * @returns {boolean}
   */
  isResidentialUser(user) {
    return user?.userType === 'residential';
  }

  /**
   * Check if user is commercial user
   * @param {object} user - User object
   * @returns {boolean}
   */
  isCommercialUser(user) {
    return user?.userType === 'commercial';
  }

  /**
   * Check if user is system admin
   * @param {object} user - User object
   * @returns {boolean}
   */
  isSystemAdmin(user) {
    return user?.userType === 'system_admin';
  }

  /**
   * Check if user is power user (can manage permit types)
   * @param {object} user - User object
   * @returns {boolean}
   */
  isPowerUser(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_POWER_USER);
  }

  /**
   * Get role name for permission level
   * @param {number} permissionLevel - Permission level
   * @returns {string}
   */
  getRoleName(permissionLevel) {
    const roleMap = {
      1: 'Residential User',
      5: 'Commercial User',
      11: 'Municipal Basic User',
      12: 'Municipal Viewer',
      13: 'Municipal Power User',
      14: 'Department Reviewer',
      15: 'Municipal Inspector',
      16: 'Senior Inspector',
      17: 'Department Supervisor',
      18: 'Municipal Coordinator',
      19: 'Municipal Manager',
      20: 'Assistant Admin',
      21: 'Municipal Admin',
      22: 'Municipal System Admin',
      23: 'Municipality Super Admin'
    };
    return roleMap[permissionLevel] || `Level ${permissionLevel} User`;
  }

  /**
   * Get permissions array for a user
   * @param {object} user - User object
   * @returns {Array} Array of permission objects
   */
  getUserPermissions(user) {
    const level = user?.permissionLevel || 11;
    
    return [
      { name: 'View Permits', granted: this.canViewPermits(user) },
      { name: 'Create Permits', granted: this.canCreatePermits(user) },
      { name: 'Review Permits', granted: this.canReviewPermits(user) },
      { name: 'Conduct Inspections', granted: this.canConductInspections(user) },
      { name: 'Manage Permit Types', granted: this.canManagePermitTypes(user) },
      { name: 'Manage Users', granted: this.canManageUsers(user) },
      { name: 'System Administration', granted: this.canAccessSystemAdmin(user) }
    ];
  }

  /**
   * Check if user has any system permissions worth displaying
   * @param {object} user - User object
   * @returns {boolean}
   */
  hasSystemPermissions(user) {
    return this.hasPermissionLevel(user, this.LEVELS.MUNICIPAL_VIEWER);
  }

  /**
   * Get permission level category for UI styling
   * @param {number} permissionLevel - Permission level
   * @returns {string}
   */
  getPermissionCategory(permissionLevel) {
    if (permissionLevel >= 21) return 'admin';
    if (permissionLevel >= 17) return 'supervisor';
    if (permissionLevel >= 14) return 'reviewer';
    if (permissionLevel >= 11) return 'staff';
    if (permissionLevel >= 5) return 'commercial';
    return 'residential';
  }

  /**
   * Check if user can edit another user
   * @param {object} currentUser - Current user
   * @param {object} targetUser - User to be edited
   * @returns {boolean}
   */
  canEditUser(currentUser, targetUser) {
    // Only admins can edit users
    if (!this.canManageUsers(currentUser)) return false;
    
    // Super admins can edit anyone
    if (this.hasPermissionLevel(currentUser, this.LEVELS.MUNICIPALITY_SUPER_ADMIN)) return true;
    
    // Admins can't edit users with equal or higher permission levels
    return (currentUser?.permissionLevel || 0) > (targetUser?.permissionLevel || 0);
  }

  /**
   * Check if user can deactivate another user
   * @param {object} currentUser - Current user
   * @param {object} targetUser - User to be deactivated
   * @returns {boolean}
   */
  canDeactivateUser(currentUser, targetUser) {
    return this.canEditUser(currentUser, targetUser);
  }
}