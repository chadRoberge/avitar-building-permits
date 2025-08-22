import { helper } from '@ember/component/helper';

/**
 * Helper to check if a Set or Array contains a value
 * Usage: {{has item collection}}
 * Usage: {{if (has item collection) "Found" "Not found"}}
 */
export default helper(function has([item, collection]) {
  if (!collection) return false;
  
  if (collection instanceof Set) {
    return collection.has(item);
  }
  
  if (Array.isArray(collection)) {
    return collection.includes(item);
  }
  
  return false;
});