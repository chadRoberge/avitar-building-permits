import { helper } from '@ember/component/helper';

export default helper(function gt([a, b]) {
  return a > b;
});