import Route from '@ember/routing/route';

export default class RegisterMunicipalityRoute extends Route {
  model() {
    // Return any setup data needed for the form
    return {
      states: [
        { code: 'NH', name: 'New Hampshire' },
        { code: 'VT', name: 'Vermont' },
        { code: 'ME', name: 'Maine' },
        { code: 'MA', name: 'Massachusetts' }
      ]
    };
  }
}