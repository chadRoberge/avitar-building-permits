import Route from '@ember/routing/route';

export default class AdminLoginRoute extends Route {
  model() {
    return {
      title: 'System Administrator Login',
      subtitle: 'Access system administration tools'
    };
  }
}