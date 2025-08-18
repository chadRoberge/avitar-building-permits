import { helper } from '@ember/component/helper';

export default helper(function getStatusBadgeClass([status]) {
  const statusMap = {
    pending: 'warning',
    submitted: 'info',
    approved: 'success',
    active: 'success',
    completed: 'secondary',
    closed: 'secondary',
    rejected: 'danger',
    expired: 'danger',
  };
  return statusMap[status] || 'secondary';
});
