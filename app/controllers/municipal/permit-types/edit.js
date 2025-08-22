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

  // Department review tracking
  @tracked selectedDepartments = [];

  @tracked isSubmitting = false;
  @tracked errorMessage = '';
  @tracked originalCategory = '';

  constructor() {
    super(...arguments);
    // Ensure selectedDepartments is always initialized as an array
    this.selectedDepartments = [];
  }

  get safeSelectedDepartments() {
    try {
      // Handle case where 'this' might not be fully initialized
      if (!this || typeof this !== 'object') {
        return [];
      }
      
      // Check if selectedDepartments exists and is an array
      if (this.selectedDepartments && Array.isArray(this.selectedDepartments)) {
        return this.selectedDepartments;
      }
      
      // Return empty array as fallback
      return [];
    } catch (error) {
      console.error('Error in safeSelectedDepartments getter:', error);
      return [];
    }
  }

  // Available review departments
  availableDepartments = [
    {
      id: 'zoning',
      name: 'Zoning Department',
      description: 'Reviews compliance with zoning regulations and land use requirements',
      icon: '📋'
    },
    {
      id: 'planning',
      name: 'Planning Department', 
      description: 'Reviews site plans, development standards, and comprehensive plan compliance',
      icon: '🗺️'
    },
    {
      id: 'public-works',
      name: 'Public Works',
      description: 'Reviews infrastructure, utilities, drainage, and traffic impact',
      icon: '🚧'
    },
    {
      id: 'fire',
      name: 'Fire Department',
      description: 'Reviews fire safety, access, and code compliance',
      icon: '🚒'
    },
    {
      id: 'building',
      name: 'Building Department',
      description: 'Reviews building codes, structural plans, and construction standards',
      icon: '🏗️'
    }
  ];

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
    console.log('initializeForm called with:', permitType);
    
    if (!permitType) {
      console.error('initializeForm called with undefined permitType');
      return;
    }

    try {
      // Initialize all tracked properties first - ensure selectedDepartments is always an array
      this.selectedDepartments = Array.isArray(permitType.requiredDepartments) 
        ? permitType.requiredDepartments 
        : [];
      
      console.log('Initialized selectedDepartments:', this.selectedDepartments);
      
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
      
      // Initialize visual state for departments after a short delay to ensure DOM is ready
      setTimeout(() => this.initializeDepartmentVisualState(), 100);
      
      console.log('Form initialization completed successfully');
    } catch (error) {
      console.error('Error during form initialization:', error);
      // Ensure selectedDepartments is set even if there's an error
      if (!this.selectedDepartments) {
        this.selectedDepartments = [];
      }
    }
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

  // Initialize visual state for departments that are already selected
  initializeDepartmentVisualState() {
    try {
      const selectedDepts = this.safeSelectedDepartments || [];
      console.log('Initializing visual state for departments:', selectedDepts);
      
      // Find all department cards and update their visual state
      const departmentCards = document.querySelectorAll('.department-card');
      departmentCards.forEach(card => {
        // Extract department ID from the card's data or find it through the click handler
        const clickHandler = card.getAttribute('data-department-id');
        
        // Alternative: check each available department
        this.availableDepartments.forEach(dept => {
          const isSelected = selectedDepts.includes(dept.id);
          const deptIcon = card.querySelector('.department-icon');
          
          // Match by department icon text to identify the card
          if (deptIcon && deptIcon.textContent.trim() === dept.icon) {
            if (isSelected) {
              card.classList.add('selected');
              const indicator = card.querySelector('.selection-indicator');
              if (indicator) {
                indicator.innerHTML = '<span class="selected-icon">✓</span>';
              }
            } else {
              card.classList.remove('selected');
              const indicator = card.querySelector('.selection-indicator');
              if (indicator) {
                indicator.innerHTML = '<span class="unselected-icon">+</span>';
              }
            }
          }
        });
      });
    } catch (error) {
      console.error('Error initializing department visual state:', error);
    }
  }

  @action
  toggleDepartment(departmentId, event) {
    try {
      if (!this || !departmentId) {
        console.error('toggleDepartment called with invalid parameters');
        return;
      }

      // Ensure selectedDepartments is initialized
      if (!this.selectedDepartments) {
        this.selectedDepartments = [];
      }

      const currentDepartments = this.safeSelectedDepartments || [];
      console.log('Toggling department:', departmentId, 'Current:', currentDepartments);
      
      // Find the clicked department card element
      let departmentCard = event.target;
      while (departmentCard && !departmentCard.classList.contains('department-card')) {
        departmentCard = departmentCard.parentElement;
      }

      const isCurrentlySelected = currentDepartments.includes(departmentId);
      
      if (isCurrentlySelected) {
        console.log('Removing department:', departmentId);
        this.selectedDepartments = currentDepartments.filter(id => id !== departmentId);
        
        // Remove visual selection immediately
        if (departmentCard) {
          departmentCard.classList.remove('selected');
          // Update the selection indicator
          const indicator = departmentCard.querySelector('.selection-indicator');
          if (indicator) {
            indicator.innerHTML = '<span class="unselected-icon">+</span>';
          }
        }
      } else {
        console.log('Adding department:', departmentId);
        this.selectedDepartments = [...currentDepartments, departmentId];
        
        // Add visual selection immediately
        if (departmentCard) {
          departmentCard.classList.add('selected');
          // Update the selection indicator
          const indicator = departmentCard.querySelector('.selection-indicator');
          if (indicator) {
            indicator.innerHTML = '<span class="selected-icon">✓</span>';
          }
        }
      }
      
      console.log('New departments:', this.selectedDepartments);
    } catch (error) {
      console.error('Error in toggleDepartment:', error);
      // Fallback - initialize as empty array and add the department
      try {
        this.selectedDepartments = [departmentId];
      } catch (fallbackError) {
        console.error('Even fallback failed:', fallbackError);
      }
    }
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
        requiredDepartments: this.safeSelectedDepartments,

        // Update form fields - map to expected backend format
        formFields: this.buildFormFields().map((field) => ({
          id: field.name,
          label: field.label,
          type: field.type,
          isRequired: field.required,
          description: field.helpText,
          options: field.options ? field.options.map(opt => opt.value) : []
        })),

        // Update fee structure if baseFee is provided
        baseFee: this.baseFee ? parseFloat(this.baseFee) : 0,

        // Set inspection requirement
        requiresInspection: this.requiresInspection,
        requiredInspections: this.requiresInspection
          ? [
              {
                type: 'final-inspection',
                name: 'Final Inspection',
                description: 'Required final inspection for this permit type',
                estimatedDuration: 60,
                required: true
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

  // Helper method to check if question type needs options
  questionTypeNeedsOptions = (questionType) => {
    return ['select', 'radio', 'checkbox'].includes(questionType);
  }

  // Helper method to check if department is selected
  isDepartmentSelected = (departmentId) => {
    try {
      if (!this || !departmentId) {
        return false;
      }
      
      const departments = this.safeSelectedDepartments || [];
      const isSelected = departments.includes(departmentId);
      console.log(`isDepartmentSelected(${departmentId}):`, isSelected, 'departments:', departments);
      return isSelected;
    } catch (error) {
      console.error('Error in isDepartmentSelected:', error, 'departmentId:', departmentId);
      return false;
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
