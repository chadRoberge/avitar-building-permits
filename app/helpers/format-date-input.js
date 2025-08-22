import { helper } from '@ember/component/helper';

export default helper(function formatDateInput([date]) {
  if (!date) return '';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    
    // Format for HTML date input (YYYY-MM-DD)
    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error in format-date-input helper:', error);
    return '';
  }
});