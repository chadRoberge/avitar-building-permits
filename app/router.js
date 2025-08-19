import EmberRouter from '@ember/routing/router';
import config from 'avitar-building-permits/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('home', { path: '/' });
  this.route('municipal-portal', { path: '/municipality/:municipality_id' });
  this.route('register-municipality');
  this.route('auth');

  // Municipal staff routes (admin portal)
  this.route('admin');
  
  // System admin routes (system administration)
  this.route('system-admin', function () {
    this.route('login');
    this.route('dashboard');
    this.route('municipalities');
    this.route('users');
    this.route('settings');
  });

  // Municipal admin routes
  this.route('municipal', function () {
    this.route('dashboard');
    this.route('permits', function () {
      this.route('index', { path: '/' });
      this.route('view', { path: '/:permit_id' });
    });
    this.route('permit-types', function () {
      this.route('index', { path: '/' });
      this.route('new');
      this.route('edit', { path: '/:permit_type_id/edit' });
    });
    this.route('billing');
    this.route('settings');
  });

  // Residential user routes
  this.route('residential', function () {
    this.route('dashboard');
    this.route('permits', function () {
      this.route('index', { path: '/' });
      this.route('new');
      this.route('view', { path: '/:permit_id' });
    });
    this.route('billing');
    this.route('profile');
  });

  // Commercial user routes
  this.route('commercial', function () {
    this.route('dashboard');
    this.route('permits', function () {
      this.route('index', { path: '/' });
      this.route('new');
      this.route('view', { path: '/:permit_id' });
    });
    this.route('billing');
    this.route('profile');
  });
});
