import { helper } from '@ember/component/helper';

export default helper(function now() {
  return new Date();
});