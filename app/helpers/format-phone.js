import { helper } from '@ember/component/helper';

export default helper(function formatPhone([phone]) {
  if (!phone || typeof phone !== 'string') return phone;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's a valid US phone number (10 digits)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // Check if it's 11 digits starting with 1 (US country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // Return original if doesn't match expected formats
  return phone;
});