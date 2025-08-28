import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CommercialLoginController extends Controller {
  @tracked showSignIn = true;
  @tracked showSignUp = false;

  @action
  showSignInForm() {
    this.showSignIn = true;
    this.showSignUp = false;
  }

  @action
  showSignUpForm() {
    this.showSignIn = false;
    this.showSignUp = true;
  }
}