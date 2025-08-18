import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPermitTypesEditController extends Controller {
  @service router;

  @tracked permitName = '';
  @tracked permitCode = '';
  @tracked baseFee = '';
  @tracked processingTime = 14;
  @tracked permitDescription = '';
  @tracked requiresInspection = true;
  @tracked isActive = true;

  @tracked activeQuestionTab = 'default';
  @tracked defaultQuestions = [];
  @tracked customQuestions = [];

  @tracked isSubmitting = false;
  @tracked errorMessage = '';
  @tracked originalCategory = '';

  // Load predefined categories (same as new controller)
  predefinedCategories = [
    {
      id: 'building',
      name: 'Building Permit',
      icon: '🏗️',
      description: 'New construction, additions, and structural modifications',
    },
    {
      id: 'zoning',
      name: 'Zoning Permit',
      icon: '📋',
      description: 'Land use compliance and zoning variances',
    },
    {
      id: 'electrical',
      name: 'Electrical Permit',
      icon: '⚡',
      description: 'Electrical installations and modifications',
    },
    {
      id: 'plumbing',
      name: 'Plumbing Permit',
      icon: '🔧',
      description: 'Plumbing installations and repairs',
    },
    {
      id: 'mechanical',
      name: 'Mechanical Permit',
      icon: '🌡️',
      description: 'HVAC and mechanical systems',
    },
    {
      id: 'specialized',
      name: 'Specialized Permits',
      icon: '🛠️',
      description: 'Special purpose permits and unique requirements',
    },
  ];

  // Initialize form with existing permit type data
  initializeForm(permitType) {
    if (!permitType) {
      console.error('initializeForm called with undefined permitType');
      return;
    }

    this.permitName = permitType.name || '';
    this.permitCode = permitType.code || '';
    this.permitDescription = permitType.description || '';
    this.baseFee =
      permitType.fees && permitType.fees[0]
        ? permitType.fees[0].amount.toString()
        : '';
    this.processingTime = permitType.estimatedProcessingTime || 14;
    this.requiresInspection =
      permitType.requiredInspections &&
      permitType.requiredInspections.length > 0;
    this.isActive = permitType.isActive !== false;
    this.originalCategory = permitType.category;

    // Load form fields into appropriate tabs
    this.loadFormFields(permitType.applicationFields || []);
  }

  loadFormFields(applicationFields) {
    // Separate default and custom questions
    this.defaultQuestions = [];
    this.customQuestions = [];

    applicationFields.forEach((field) => {
      if (field.isDefault) {
        this.defaultQuestions.push({
          id: field.id,
          type: field.type,
          label: field.label,
          description: field.description,
          isRequired: field.required,
          isIncluded: true,
          options: field.options
            ? field.options.map((opt) => opt.label || opt.value)
            : [],
        });
      } else {
        this.customQuestions.push({
          type: field.type,
          label: field.label,
          description: field.description,
          isRequired: field.required,
          options: field.options
            ? field.options.map((opt) => opt.label || opt.value)
            : [],
        });
      }
    });
  }

  get selectedCategoryInfo() {
    return (
      this.predefinedCategories.find(
        (cat) => cat.id === this.originalCategory,
      ) || {
        id: 'other',
        name: 'Custom',
        icon: '🔧',
        description: 'Custom permit type',
      }
    );
  }

  @action
  setQuestionTab(tab) {
    this.activeQuestionTab = tab;
  }

  @action
  toggleDefaultQuestion(question) {
    question.isIncluded = !question.isIncluded;
  }

  @action
  addCustomQuestion() {
    const newQuestion = {
      type: 'text',
      label: '',
      description: '',
      isRequired: false,
      options: [],
    };
    this.customQuestions = [...this.customQuestions, newQuestion];
  }

  @action
  removeCustomQuestion(index) {
    this.customQuestions = this.customQuestions.filter((_, i) => i !== index);
  }

  @action
  updateQuestionType(index, event) {
    const questions = [...this.customQuestions];
    questions[index].type = event.target.value;

    // Initialize options for select/radio/checkbox types
    if (
      ['select', 'radio', 'checkbox'].includes(event.target.value) &&
      !questions[index].options.length
    ) {
      questions[index].options = ['Option 1', 'Option 2'];
    }

    this.customQuestions = questions;
  }

  @action
  updateQuestionLabel(index, event) {
    const questions = [...this.customQuestions];
    questions[index].label = event.target.value;
    this.customQuestions = questions;
  }

  @action
  updateQuestionDescription(index, event) {
    const questions = [...this.customQuestions];
    questions[index].description = event.target.value;
    this.customQuestions = questions;
  }

  @action
  toggleQuestionRequired(index, event) {
    const questions = [...this.customQuestions];
    questions[index].isRequired = event.target.checked;
    this.customQuestions = questions;
  }

  @action
  addQuestionOption(index) {
    const questions = [...this.customQuestions];
    questions[index].options = [
      ...questions[index].options,
      `Option ${questions[index].options.length + 1}`,
    ];
    this.customQuestions = questions;
  }

  @action
  removeQuestionOption(questionIndex, optionIndex) {
    const questions = [...this.customQuestions];
    questions[questionIndex].options = questions[questionIndex].options.filter(
      (_, i) => i !== optionIndex,
    );
    this.customQuestions = questions;
  }

  @action
  updateQuestionOption(questionIndex, optionIndex, event) {
    const questions = [...this.customQuestions];
    questions[questionIndex].options[optionIndex] = event.target.value;
    this.customQuestions = questions;
  }

  @action
  cancelForm() {
    this.router.transitionTo('municipal.permit-types.index');
  }

  @action
  async updatePermitType(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      // Prepare permit type data
      const permitTypeData = {
        name: this.permitName,
        code: this.permitCode,
        description: this.permitDescription,
        estimatedProcessingTime: parseInt(this.processingTime) || 14,
        isActive: this.isActive,

        // Update form fields
        applicationFields: this.buildFormFields(),

        // Update fee structure if baseFee is provided
        fees: this.baseFee
          ? [
              {
                name: 'Application Fee',
                type: 'fixed',
                amount: parseFloat(this.baseFee),
                description: 'Standard application fee',
              },
            ]
          : [],

        // Set inspection requirement
        requiredInspections: this.requiresInspection
          ? [
              {
                name: 'Standard Inspection',
                description: 'Required inspection for this permit type',
                triggerCondition: 'approval',
              },
            ]
          : [],
      };

      // Get auth token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Submit to API
      const response = await fetch(
        `${config.APP.API_HOST}/api/permit-types/${this.model.permitType._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(permitTypeData),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update permit type');
      }

      // Success - redirect to permit types list
      this.router.transitionTo('municipal.permit-types.index');
    } catch (error) {
      console.error('Error updating permit type:', error);
      this.errorMessage =
        error.message || 'An error occurred while updating the permit type';
    } finally {
      this.isSubmitting = false;
    }
  }

  buildFormFields() {
    const fields = [];

    // Add included default questions
    const includedDefaults = this.defaultQuestions.filter((q) => q.isIncluded);
    fields.push(
      ...includedDefaults.map((q, index) => ({
        name: q.id || `default_field_${index}`,
        label: q.label,
        type: q.type,
        required: q.isRequired || false,
        helpText: q.description,
        options: q.options
          ? q.options.map((opt) => ({
              value: opt,
              label: opt,
            }))
          : [],
        order: index,
      })),
    );

    // Add custom questions
    this.customQuestions.forEach((q, index) => {
      if (q.label && q.label.trim()) {
        fields.push({
          name: `custom_field_${index}`,
          label: q.label,
          type: q.type,
          required: q.isRequired || false,
          helpText: q.description,
          options: q.options
            ? q.options.map((opt) => ({
                value: opt,
                label: opt,
              }))
            : [],
          order: includedDefaults.length + index,
        });
      }
    });

    return fields;
  }
}
