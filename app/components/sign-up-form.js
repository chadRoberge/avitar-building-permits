import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class SignUpFormComponent extends Component {
  @tracked email = '';
  @tracked password = '';
  @tracked confirmPassword = '';
  @tracked firstName = '';
  @tracked lastName = '';
  @tracked phone = '';

  // Municipality data
  @tracked municipalityName = '';
  @tracked municipalityAddress = '';
  @tracked municipalityCity = '';
  @tracked municipalityState = '';
  @tracked municipalityZip = '';
  @tracked municipalityCounty = '';
  @tracked municipalityPhone = '';
  @tracked municipalityEmail = '';
  @tracked municipalityWebsite = '';

  @tracked isLoading = false;
  @tracked errorMessage = '';

  @action
  updateField(field, event) {
    this[field] = event.target.value;
    this.errorMessage = '';
  }

  @action
  async handleSubmit(event) {
    event.preventDefault();

    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const userData = {
        email: this.email,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        phone: this.phone,
        municipality: {
          name: this.municipalityName,
          address: this.municipalityAddress,
          city: this.municipalityCity,
          state: this.municipalityState,
          zip: this.municipalityZip,
          county: this.municipalityCounty,
          phone: this.municipalityPhone,
          email: this.municipalityEmail,
          website: this.municipalityWebsite,
        },
      };

      // TODO: Implement actual user registration with MongoDB
      console.log('User registration data:', userData);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // For now, just show success message
      alert('Account created successfully! Backend integration pending.');
    } catch (error) {
      this.errorMessage = 'Failed to create account. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  validateForm() {
    if (
      !this.email ||
      !this.password ||
      !this.confirmPassword ||
      !this.firstName ||
      !this.lastName ||
      !this.municipalityName
    ) {
      this.errorMessage = 'Please fill in all required fields';
      return false;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return false;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long';
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Please enter a valid email address';
      return false;
    }

    return true;
  }
}
