import Route from '@ember/routing/route';

export default class MunicipalBillingRoute extends Route {
  model() {
    // Return the model from the parent municipal route
    // The parent route already handles authentication
    return this.modelFor('municipal');
  }
}
