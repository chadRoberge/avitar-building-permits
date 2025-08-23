import { helper } from '@ember/component/helper';

export default helper(function getBaseFee([permitType]) {
  if (!permitType || !permitType.fees || permitType.fees.length === 0) {
    return 0;
  }
  
  // Find the first fixed fee (base fee)
  const baseFee = permitType.fees.find(fee => fee.type === 'fixed');
  return baseFee ? (baseFee.amount || 0) : 0;
});