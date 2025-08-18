import { helper } from '@ember/component/helper';

export default helper(function float([value]) {
  return parseFloat(value) || 0;
});
