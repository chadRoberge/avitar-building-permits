import { helper } from '@ember/component/helper';

export default helper(function safeString([value]) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
});