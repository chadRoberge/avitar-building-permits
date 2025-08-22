import Route from '@ember/routing/route';

export default class MunicipalDashboardRoute extends Route {
  model() {
    // Return the model from the parent municipal route
    return this.modelFor('municipal');
  }
}