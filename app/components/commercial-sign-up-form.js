import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CommercialSignUpFormComponent extends Component {
  @tracked email = '';
  @tracked password = '';
  @tracked confirmPassword = '';
  @tracked firstName = '';
  @tracked lastName = '';
  @tracked phone = '';

  // Business information
  @tracked businessName = '';
  @tracked businessType = '';
  @tracked licenseNumber = '';
  @tracked licenseType = '';
  @tracked federalTaxId = '';

  // Business address
  @tracked businessStreet = '';
  @tracked businessCity = '';
  @tracked businessState = 'NH';
  @tracked businessZip = '';

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
        userType: 'commercial',
        municipality: this.args.municipality,
        businessInfo: {
          businessName: this.businessName,
          businessType: this.businessType,
          licenseNumber: this.licenseNumber,
          licenseType: this.licenseType,
          federalTaxId: this.federalTaxId,
          businessAddress: {
            street: this.businessStreet,
            city: this.businessCity,
            state: this.businessState,
            zip: this.businessZip,
          },
        },
      };

      // TODO: Implement actual API call
      console.log('Commercial user registration data:', userData);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      alert('Commercial account created successfully!');
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
      !this.businessName ||
      !this.businessType ||
      !this.businessStreet ||
      !this.businessCity ||
      !this.businessZip
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
