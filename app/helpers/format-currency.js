import { helper } from '@ember/component/helper';

export default helper(function formatCurrency([amount]) {
  try {
    if (!amount && amount !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    console.error('Error in format-currency helper:', error, 'amount:', amount);
    return '$0.00';
  }
});