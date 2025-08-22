import { helper } from '@ember/component/helper';

export default helper(function join([array, separator = ', ']) {
  if (!array || !Array.isArray(array)) {
    return '';
  }
  return array.join(separator);
});