import { helper } from '@ember/component/helper';

export default helper(function sub([a, b]) {
  const numA = Number(a) || 0;
  const numB = Number(b) || 0;
  return numA - numB;
});
