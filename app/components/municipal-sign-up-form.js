import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class MunicipalSignUpFormComponent extends Component {
  @tracked email = '';
  @tracked password = '';
  @tracked confirmPassword = '';
  @tracked firstName = '';
  @tracked lastName = '';
  @tracked phone = '';
  @tracked department = '';
  @tracked jobTitle = '';
  @tracked employeeId = '';
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
        userType: 'municipal',
        municipality: this.args.municipality,
        municipalInfo: {
          department: this.department,
          jobTitle: this.jobTitle,
          employeeId: this.employeeId
        }
      };

      // TODO: Implement actual API call
      console.log('Municipal user registration data:', userData);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      alert('Municipal account created successfully!');
    } catch (error) {
      this.errorMessage = 'Failed to create account. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  validateForm() {
    if (!this.email || !this.password || !this.confirmPassword || 
        !this.firstName || !this.lastName || !this.department || !this.jobTitle) {
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