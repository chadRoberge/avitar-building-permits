import { helper } from '@ember/component/helper';

export default helper(function arrayFind([array, property, value]) {
  if (!array || !Array.isArray(array)) {
    return null;
  }
  
  return array.find(item => item[property] === value);
});