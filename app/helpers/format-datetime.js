import { helper } from '@ember/component/helper';

export default helper(function formatDateTime([date]) {
  try {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error in format-datetime helper:', error, 'date:', date);
    return 'N/A';
  }
});
