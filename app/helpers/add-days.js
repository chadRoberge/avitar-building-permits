import { helper } from '@ember/component/helper';

export default helper(function addDays([date, days]) {
  if (!date) return new Date();
  
  const result = new Date(date);
  result.setDate(result.getDate() + (days || 0));
  return result;
});