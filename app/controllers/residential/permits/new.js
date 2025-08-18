import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialPermitsNewController extends Controller {
  @service router;
  @service currentProperty;

  @tracked selectedPermitType = null;
  @tracked projectDescription = '';
  @tracked projectValue = '';
  @tracked contractorInfo = {
    hasContractor: false,
    name: '',
    licenseNumber: '',
    phone: '',
    email: ''
  };
  @tracked workDetails = {
    startDate: '',
    estimatedDuration: '',
    workLocation: 'primary'
  };
  @tracked additionalInfo = '';
  @tracked isSubmitting = false;
  @tracked errorMessage = '';
  @tracked currentStep = 1;

  get totalSteps() {
    return 4;
  }

  get selectedPermitTypeObject() {
    if (!this.selectedPermitType) return null;
    return this.model.permitTypes.find(type => type._id === this.selectedPermitType);
  }

  get baseFee() {
    const permitType = this.selectedPermitTypeObject;
    if (!permitType || !permitType.fees || permitType.fees.length === 0) return 0;
    return permitType.fees[0].amount || 0;
  }

  get totalFee() {
    let total = this.baseFee;
    
    // Add any additional fees based on project value
    const projectVal = parseFloat(this.projectValue) || 0;
    if (projectVal > 50000) {
      total += projectVal * 0.01; // 1% for projects over $50k
    }
    
    return Math.max(total, 0);
  }

  get formattedBaseFee() {
    if (!this.baseFee && this.baseFee !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.baseFee);
  }

  get formattedTotalFee() {
    if (!this.totalFee && this.totalFee !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.totalFee);
  }

  get formattedProjectValueFee() {
    const projectVal = parseFloat(this.projectValue) || 0;
    const fee = projectVal * 0.010;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(fee);
  }

  get canProceedToNextStep() {
    switch (this.currentStep) {
      case 1:
        return this.selectedPermitType;
      case 2:
        return this.projectDescription.trim().length > 10 && this.projectValue.trim().length > 0;
      case 3:
        console.log('Step 3 validation - contractorInfo:', this.contractorInfo);
        console.log('Step 3 validation - hasContractor:', this.contractorInfo.hasContractor);
        
        if (this.contractorInfo.hasContractor) {
          // If using a contractor, they cannot proceed with residential application
          console.log('Step 3 validation (with contractor): contractor must apply');
          return false;
        }
        console.log('Step 3 validation (no contractor): returning true');
        return true;
      case 4:
        console.log('Step 4 validation - workDetails:', this.workDetails);
        console.log('Step 4 validation - startDate:', this.workDetails.startDate);
        console.log('Step 4 validation - startDate type:', typeof this.workDetails.startDate);
        const hasDate = !!this.workDetails.startDate;
        const hasLength = this.workDetails.startDate && this.workDetails.startDate.trim().length > 0;
        console.log('Step 4 validation - hasDate:', hasDate, 'hasLength:', hasLength);
        const isValid = hasDate && hasLength;
        console.log('Step 4 validation result:', isValid);
        return isValid;
      default:
        return false;
    }
  }

  get progressPercentage() {
    return (this.currentStep / this.totalSteps) * 100;
  }

  @action
  selectPermitType(permitTypeId) {
    this.selectedPermitType = permitTypeId;
    this.errorMessage = '';
  }

  @action
  updateProjectDescription(event) {
    this.projectDescription = event.target.value;
    this.errorMessage = '';
  }

  @action
  updateProjectValue(event) {
    this.projectValue = event.target.value;
    this.errorMessage = '';
  }

  @action
  updateContractorField(field, event) {
    this.contractorInfo[field] = event.target.value;
    this.errorMessage = '';
  }

  @action
  toggleContractor(event) {
    this.contractorInfo.hasContractor = event.target.checked;
    this.errorMessage = '';
    
    if (event.target.checked) {
      // Show alert when contractor is selected
      alert('Important: If you are using a licensed contractor, the contractor must apply for the permit on your behalf. Please contact your contractor to submit the permit application through the Commercial Portal.');
    }
  }

  @action
  updateWorkField(field, event) {
    console.log('updateWorkField called:', field, 'value:', event.target.value);
    // Create a new object to trigger reactivity
    this.workDetails = {
      ...this.workDetails,
      [field]: event.target.value
    };
    this.errorMessage = '';
    console.log('workDetails after update:', this.workDetails);
  }

  @action
  updateAdditionalInfo(event) {
    this.additionalInfo = event.target.value;
    this.errorMessage = '';
  }

  @action
  nextStep() {
    console.log('Next step clicked - current step:', this.currentStep, 'can proceed:', this.canProceedToNextStep);
    if (this.canProceedToNextStep && this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.errorMessage = '';
      console.log('Advanced to step:', this.currentStep);
    } else {
      console.log('Cannot proceed:', {
        canProceed: this.canProceedToNextStep,
        currentStep: this.currentStep,
        totalSteps: this.totalSteps
      });
    }
  }

  @action
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.errorMessage = '';
    }
  }

  @action
  goToStep(step) {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
      this.errorMessage = '';
    }
  }


  @action
  async submitApplication() {
    if (!this.canProceedToNextStep) {
      this.errorMessage = 'Please complete all required fields before submitting.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');
      const municipalityId = localStorage.getItem('municipality_id');

      // Get municipality ID from model instead of localStorage to avoid [object Object] issue
      const municipalityObjectId = this.model.municipality._id || municipalityId;
      
      // Get current property ID - required for permits
      const currentPropertyId = this.currentProperty.currentPropertyId;
      if (!currentPropertyId) {
        throw new Error('No property selected. Please add a property first.');
      }
      
      const applicationData = {
        userId: userId,
        municipalityId: municipalityObjectId,
        permitTypeId: this.selectedPermitType,
        property: currentPropertyId, // Add the required property field
        projectDescription: this.projectDescription,
        projectValue: parseFloat(this.projectValue) || 0,
        contractorInfo: this.contractorInfo.hasContractor ? {
          name: this.contractorInfo.name,
          licenseNumber: this.contractorInfo.licenseNumber,
          phone: this.contractorInfo.phone,
          email: this.contractorInfo.email
        } : null,
        workDetails: this.workDetails,
        additionalInfo: this.additionalInfo,
        calculatedFee: this.totalFee,
        status: 'submitted',
        submittedDate: new Date().toISOString()
      };

      console.log('Submitting permit application:', applicationData);

      const response = await fetch(`${config.APP.API_HOST}/api/permits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(applicationData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit permit application');
      }

      console.log('Permit application submitted successfully:', result);
      
      // Show success message and redirect
      alert(`Permit application submitted successfully! Application ID: ${result.id || 'N/A'}`);
      this.router.transitionTo('residential.permits.index');
      
    } catch (error) {
      console.error('Error submitting permit application:', error);
      this.errorMessage = error.message || 'Failed to submit permit application. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  @action
  contactContractor() {
    alert('Please contact your contractor and ask them to:\n\n1. Visit the Commercial Portal at [Municipality Website]\n2. Sign up or log in as a commercial contractor\n3. Submit the permit application on your behalf\n\nYour contractor will need:\n• Project details\n• Property address\n• Their business license information');
  }

  @action
  cancel() {
    this.router.transitionTo('residential.dashboard');
  }
}