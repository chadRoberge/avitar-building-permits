import { helper } from '@ember/component/helper';

export default helper(function formatDate([date]) {
  try {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error in format-date helper:', error, 'date:', date);
    return 'N/A';
  }
});
