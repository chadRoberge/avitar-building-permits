import Route from '@ember/routing/route';

export default class MunicipalPermitTypesIndexRoute extends Route {
  model() {
    // Return empty model, data loading will happen in setupController
    return {};
  }

  setupController(controller, model) {
    super.setupController(controller, model);

    // Load permit types data after controller is set up
    controller.loadPermitTypes();
  }
}
