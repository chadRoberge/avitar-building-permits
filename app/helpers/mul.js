import { helper } from '@ember/component/helper';

export default helper(function mul([a, b]) {
  return (parseFloat(a) || 0) * (parseFloat(b) || 0);
});
