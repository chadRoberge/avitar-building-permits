import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalityRegistrationFormComponent extends Component {
  @service router;

  @tracked currentStep = 1;
  @tracked isLoading = false;
  @tracked errorMessage = '';
  @tracked successMessage = '';

  // Municipality Information (Step 1)
  @tracked municipalityName = '';
  @tracked municipalityType = '';
  @tracked streetAddress = '';
  @tracked city = '';
  @tracked state = 'NH';
  @tracked zipCode = '';
  @tracked county = '';
  @tracked website = '';
  @tracked population = '';
  @tracked nameAvailable = null;
  @tracked checkingName = false;

  // Department Information (Step 2)
  @tracked departmentName = 'Building Department';
  @tracked departmentPhone = '';
  @tracked departmentEmail = '';
  @tracked departmentFax = '';
  @tracked departmentAddress = '';
  @tracked hoursOfOperation = '';
  @tracked permitFeeSchedule = '';

  // Administrator Account (Step 3)
  @tracked adminFirstName = '';
  @tracked adminLastName = '';
  @tracked adminTitle = '';
  @tracked adminEmail = '';
  @tracked adminPhone = '';
  @tracked adminPassword = '';
  @tracked adminConfirmPassword = '';
  @tracked adminEmployeeId = '';

  @action
  updateField(field, event) {
    this[field] = event.target.value;
    this.errorMessage = '';

    // Check name availability when municipality name changes
    if (field === 'municipalityName') {
      this.checkNameAvailability();
    }
  }

  @action
  async checkNameAvailability() {
    if (!this.municipalityName || this.municipalityName.length < 3) {
      this.nameAvailable = null;
      return;
    }

    this.checkingName = true;

    try {
      const response = await fetch(
        `${config.APP.API_HOST}/api/municipalities/check-availability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: this.municipalityName }),
        },
      );

      const result = await response.json();
      this.nameAvailable = result.available;
    } catch (error) {
      console.error('Error checking name availability:', error);
      this.nameAvailable = null;
    } finally {
      this.checkingName = false;
    }
  }

  @action
  nextStep() {
    if (this.validateCurrentStep()) {
      this.currentStep++;
      window.scrollTo(0, 0);
    }
  }

  @action
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      window.scrollTo(0, 0);
    }
  }

  @action
  async submitRegistration(event) {
    event.preventDefault();

    if (!this.validateCurrentStep()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const registrationData = {
        municipality: {
          name: this.municipalityName,
          type: this.municipalityType,
          address: {
            street: this.streetAddress,
            city: this.city,
            state: this.state,
            zip: this.zipCode,
            county: this.county,
          },
          website: this.website,
          population: this.population ? parseInt(this.population) : null,

          buildingDepartment: {
            name: this.departmentName,
            phone: this.departmentPhone,
            email: this.departmentEmail,
            fax: this.departmentFax,
            address:
              this.departmentAddress.trim() ||
              `${this.streetAddress}, ${this.city}, ${this.state} ${this.zipCode}`,
            hoursOfOperation: this.hoursOfOperation,
            permitFeeSchedule: this.permitFeeSchedule,
          },
        },

        administrator: {
          firstName: this.adminFirstName,
          lastName: this.adminLastName,
          email: this.adminEmail,
          password: this.adminPassword,
          phone: this.adminPhone,
          title: this.adminTitle,
          employeeId: this.adminEmployeeId,
          userType: 'municipal',
          role: 'admin',
        },
      };

      // Debug: Log the data being sent
      console.log(
        'Registration data being sent:',
        JSON.stringify(registrationData, null, 2),
      );

      // Make API call to register municipality
      const response = await fetch(
        `${config.APP.API_HOST}/api/municipalities/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(registrationData),
        },
      );

      // Check if response is empty or invalid
      if (!response || response.status === 0) {
        throw new Error(
          'Unable to connect to server. Please check your connection.',
        );
      }

      // First get the response text, then try to parse as JSON
      const responseText = await response.text();
      console.log('Raw server response:', responseText);
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed JSON result:', result);
      } catch (jsonError) {
        console.error('Server response (not JSON):', responseText);
        console.error('JSON parse error:', jsonError);
        console.error('Response status:', response.status);
        console.error('Response headers:', [...response.headers.entries()]);
        throw new Error(
          `Server returned non-JSON response (${response.status}): ${responseText.substring(0, 200)}...`,
        );
      }

      if (!response.ok) {
        // Log the full error details to console for debugging
        console.error('API Error Response:', result);
        throw new Error(
          result.error ||
            result.message ||
            `Server error (${response.status}): ${responseText}`,
        );
      }

      this.successMessage = `Successfully registered ${this.municipalityName}! You will receive confirmation via email. Redirecting to your municipal dashboard...`;

      // Store auth token for immediate login
      if (result.token) {
        localStorage.setItem('auth_token', result.token);
      }

      // Reset form and redirect after success
      setTimeout(() => {
        // Check if the municipality portal route exists
        if (result.municipality?._id) {
          this.router.transitionTo('municipal.dashboard');
        } else {
          // Fallback to admin sign-in if no municipality ID
          this.router.transitionTo('admin');
        }
      }, 4000);
    } catch (error) {
      console.error('Registration error:', error);

      // Handle different types of errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        this.errorMessage =
          'Unable to connect to server. Please check your internet connection and try again.';
      } else if (
        error.message.includes('Municipality') &&
        error.message.includes('already exists')
      ) {
        this.errorMessage =
          'A municipality with this name already exists. Please choose a different name.';
      } else if (
        error.message.includes('email') &&
        error.message.includes('already exists')
      ) {
        this.errorMessage =
          'An account with this email already exists. Please use a different email address.';
      } else if (error.message.includes('validation')) {
        this.errorMessage = `Registration failed: ${error.message}`;
      } else {
        this.errorMessage =
          error.message ||
          'Failed to register municipality. Please check all fields and try again.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  validateCurrentStep() {
    this.errorMessage = '';

    switch (this.currentStep) {
      case 1:
        return this.validateStep1();
      case 2:
        return this.validateStep2();
      case 3:
        return this.validateStep3();
      default:
        return false;
    }
  }

  validateStep1() {
    if (
      !this.municipalityName ||
      !this.municipalityType ||
      !this.streetAddress ||
      !this.city ||
      !this.state ||
      !this.zipCode ||
      !this.county
    ) {
      this.errorMessage =
        'Please fill in all required municipality information fields';
      return false;
    }
    return true;
  }

  validateStep2() {
    if (
      !this.departmentName ||
      !this.departmentPhone ||
      !this.departmentEmail
    ) {
      this.errorMessage =
        'Please fill in all required department information fields';
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.departmentEmail)) {
      this.errorMessage = 'Please enter a valid department email address';
      return false;
    }

    return true;
  }

  validateStep3() {
    if (
      !this.adminFirstName ||
      !this.adminLastName ||
      !this.adminEmail ||
      !this.adminPassword ||
      !this.adminConfirmPassword ||
      !this.adminTitle
    ) {
      this.errorMessage =
        'Please fill in all required administrator account fields';
      return false;
    }

    if (this.adminPassword !== this.adminConfirmPassword) {
      this.errorMessage = 'Administrator passwords do not match';
      return false;
    }

    if (this.adminPassword.length < 8) {
      this.errorMessage =
        'Administrator password must be at least 8 characters long';
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.adminEmail)) {
      this.errorMessage = 'Please enter a valid administrator email address';
      return false;
    }

    return true;
  }

  get progressPercentage() {
    return (this.currentStep / 3) * 100;
  }
}
