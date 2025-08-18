import { helper } from '@ember/component/helper';

export default helper(function debugHelper([value, label]) {
  console.log('Debug helper called:', label || 'unnamed', 'value:', value);
  return value || '';
});
