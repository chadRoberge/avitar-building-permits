import { helper } from '@ember/component/helper';

export default helper(function getInitials([firstName, lastName]) {
  const first = firstName ? firstName.charAt(0).toUpperCase() : '';
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return first + last;
});