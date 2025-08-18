import { helper } from '@ember/component/helper';

export default helper(function jsonStringify([obj]) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return `Error stringifying: ${error.message}`;
  }
});