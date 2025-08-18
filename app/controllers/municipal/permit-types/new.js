import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPermitTypesNewController extends Controller {
  @service router;

  @tracked selectedCategory = null;
  @tracked isCustomCategory = false;
  @tracked customCategoryName = '';
  @tracked customCategoryDescription = '';
  
  @tracked permitName = '';
  @tracked permitCode = '';
  @tracked baseFee = '';
  @tracked processingTime = 14;
  @tracked permitDescription = '';
  @tracked requiresInspection = true;
  
  @tracked activeQuestionTab = 'default';
  @tracked defaultQuestions = [];
  @tracked customQuestions = [];
  
  @tracked isSubmitting = false;
  @tracked errorMessage = '';

  // Predefined permit categories with default questions
  predefinedCategories = [
    {
      id: 'building',
      name: 'Building Permit',
      icon: '🏗️',
      description: 'New construction, additions, and structural modifications',
      examples: ['New Construction', 'Additions', 'Renovations', 'Structural Changes'],
      code: 'BP',
      defaultQuestions: [
        {
          id: 'project-type',
          type: 'select',
          label: 'Type of Construction',
          description: 'Select the primary type of construction work',
          isRequired: true,
          isIncluded: true,
          options: ['New Construction', 'Addition', 'Renovation', 'Alteration', 'Repair']
        },
        {
          id: 'square-footage',
          type: 'number',
          label: 'Total Square Footage',
          description: 'Enter the total square footage of the project',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'construction-value',
          type: 'number',
          label: 'Estimated Construction Value ($)',
          description: 'Total estimated cost of construction including materials and labor',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'occupancy-type',
          type: 'select',
          label: 'Occupancy Classification',
          description: 'Select the intended use of the building',
          isRequired: true,
          isIncluded: true,
          options: ['Residential - Single Family', 'Residential - Multi-Family', 'Commercial', 'Industrial', 'Mixed Use']
        },
        {
          id: 'contractor-info',
          type: 'text',
          label: 'General Contractor',
          description: 'Name and license number of the general contractor',
          isRequired: false,
          isIncluded: true
        },
        {
          id: 'architect-info',
          type: 'text',
          label: 'Architect/Engineer',
          description: 'Name and license number of the architect or engineer',
          isRequired: false,
          isIncluded: false
        },
        {
          id: 'construction-drawings',
          type: 'file',
          label: 'Construction Plans',
          description: 'Upload architectural and engineering drawings',
          isRequired: true,
          isIncluded: true
        }
      ]
    },
    {
      id: 'zoning',
      name: 'Zoning Permit',
      icon: '📋',
      description: 'Land use compliance and zoning variances',
      examples: ['Use Permits', 'Variances', 'Site Plans', 'Sign Permits'],
      code: 'ZP',
      defaultQuestions: [
        {
          id: 'zoning-district',
          type: 'select',
          label: 'Current Zoning District',
          description: 'Select the current zoning classification',
          isRequired: true,
          isIncluded: true,
          options: ['Residential R-1', 'Residential R-2', 'Commercial C-1', 'Commercial C-2', 'Industrial I-1', 'Mixed Use']
        },
        {
          id: 'proposed-use',
          type: 'textarea',
          label: 'Proposed Use',
          description: 'Describe the intended use of the property',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'variance-required',
          type: 'radio',
          label: 'Is a variance required?',
          description: 'Indicate if you are requesting any zoning variances',
          isRequired: true,
          isIncluded: true,
          options: ['Yes', 'No']
        },
        {
          id: 'setback-requirements',
          type: 'text',
          label: 'Setback Distances',
          description: 'Front, side, and rear setback measurements',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'parking-spaces',
          type: 'number',
          label: 'Number of Parking Spaces',
          description: 'Total parking spaces provided',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'site-plan',
          type: 'file',
          label: 'Site Plan',
          description: 'Upload detailed site plan showing proposed improvements',
          isRequired: true,
          isIncluded: true
        }
      ]
    },
    {
      id: 'electrical',
      name: 'Electrical Permit',
      icon: '⚡',
      description: 'Electrical installations and modifications',
      examples: ['Wiring', 'Panel Upgrades', 'Outlets', 'Lighting'],
      code: 'EP',
      defaultQuestions: [
        {
          id: 'electrical-work-type',
          type: 'checkbox',
          label: 'Type of Electrical Work',
          description: 'Select all types of work being performed',
          isRequired: true,
          isIncluded: true,
          options: ['New Service Installation', 'Service Upgrade', 'Panel Replacement', 'Wiring Installation', 'Outlet Installation', 'Lighting Installation', 'HVAC Electrical']
        },
        {
          id: 'service-amperage',
          type: 'select',
          label: 'Service Amperage',
          description: 'Select the electrical service amperage',
          isRequired: true,
          isIncluded: true,
          options: ['100 Amp', '150 Amp', '200 Amp', '400 Amp', 'Other']
        },
        {
          id: 'electrician-license',
          type: 'text',
          label: 'Licensed Electrician',
          description: 'Name and license number of the electrician',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'electrical-load',
          type: 'number',
          label: 'Estimated Electrical Load (Watts)',
          description: 'Total estimated electrical load for the project',
          isRequired: false,
          isIncluded: false
        },
        {
          id: 'electrical-drawings',
          type: 'file',
          label: 'Electrical Plans',
          description: 'Upload electrical drawings and load calculations',
          isRequired: true,
          isIncluded: true
        }
      ]
    },
    {
      id: 'plumbing',
      name: 'Plumbing Permit',
      icon: '🔧',
      description: 'Plumbing installations and repairs',
      examples: ['Water Lines', 'Sewer Connections', 'Fixtures', 'Gas Lines'],
      code: 'PP',
      defaultQuestions: [
        {
          id: 'plumbing-work-type',
          type: 'checkbox',
          label: 'Type of Plumbing Work',
          description: 'Select all types of work being performed',
          isRequired: true,
          isIncluded: true,
          options: ['New Installation', 'Repair', 'Replacement', 'Water Service', 'Sewer Connection', 'Gas Line', 'Fixture Installation']
        },
        {
          id: 'fixture-count',
          type: 'number',
          label: 'Number of Fixtures',
          description: 'Total number of plumbing fixtures',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'plumber-license',
          type: 'text',
          label: 'Licensed Plumber',
          description: 'Name and license number of the plumber',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'water-pressure',
          type: 'text',
          label: 'Water Pressure (PSI)',
          description: 'Available water pressure at the property',
          isRequired: false,
          isIncluded: false
        },
        {
          id: 'septic-connection',
          type: 'radio',
          label: 'Septic or Sewer Connection?',
          description: 'Select the type of waste water connection',
          isRequired: true,
          isIncluded: true,
          options: ['Municipal Sewer', 'Septic System', 'Other']
        },
        {
          id: 'plumbing-drawings',
          type: 'file',
          label: 'Plumbing Plans',
          description: 'Upload plumbing drawings and specifications',
          isRequired: false,
          isIncluded: false
        }
      ]
    },
    {
      id: 'mechanical',
      name: 'Mechanical Permit',
      icon: '🌡️',
      description: 'HVAC and mechanical systems',
      examples: ['HVAC', 'Ventilation', 'Boilers', 'Air Conditioning'],
      code: 'MP',
      defaultQuestions: [
        {
          id: 'mechanical-system-type',
          type: 'checkbox',
          label: 'Type of Mechanical System',
          description: 'Select all systems being installed or modified',
          isRequired: true,
          isIncluded: true,
          options: ['Central Air Conditioning', 'Heating System', 'Ventilation', 'Boiler', 'Heat Pump', 'Ductwork', 'Exhaust Fans']
        },
        {
          id: 'btu-capacity',
          type: 'number',
          label: 'System Capacity (BTU)',
          description: 'Total BTU capacity of the mechanical system',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'hvac-contractor',
          type: 'text',
          label: 'HVAC Contractor',
          description: 'Name and license number of the HVAC contractor',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'energy-efficiency',
          type: 'text',
          label: 'Energy Efficiency Rating',
          description: 'SEER rating or efficiency specifications',
          isRequired: false,
          isIncluded: true
        },
        {
          id: 'ductwork-modification',
          type: 'radio',
          label: 'Ductwork Modifications Required?',
          description: 'Will existing ductwork be modified or replaced?',
          isRequired: true,
          isIncluded: true,
          options: ['Yes', 'No', 'New Installation']
        },
        {
          id: 'mechanical-drawings',
          type: 'file',
          label: 'Mechanical Plans',
          description: 'Upload HVAC drawings and specifications',
          isRequired: false,
          isIncluded: false
        }
      ]
    },
    {
      id: 'specialized',
      name: 'Specialized Permits',
      icon: '🛠️',
      description: 'Special purpose permits and unique requirements',
      examples: ['Signs', 'Pools', 'Demolition', 'Temporary Structures'],
      code: 'SP',
      defaultQuestions: [
        {
          id: 'specialized-type',
          type: 'select',
          label: 'Type of Specialized Permit',
          description: 'Select the specific type of permit needed',
          isRequired: true,
          isIncluded: true,
          options: ['Sign Permit', 'Pool/Spa Permit', 'Demolition Permit', 'Temporary Structure', 'Fence Permit', 'Deck Permit', 'Other']
        },
        {
          id: 'project-description',
          type: 'textarea',
          label: 'Project Description',
          description: 'Provide detailed description of the proposed work',
          isRequired: true,
          isIncluded: true
        },
        {
          id: 'contractor-info',
          type: 'text',
          label: 'Contractor Information',
          description: 'Name and license number of the contractor',
          isRequired: false,
          isIncluded: true
        },
        {
          id: 'compliance-standards',
          type: 'textarea',
          label: 'Applicable Standards',
          description: 'List any specific codes or standards that apply',
          isRequired: false,
          isIncluded: false
        },
        {
          id: 'supporting-docs',
          type: 'file',
          label: 'Supporting Documentation',
          description: 'Upload plans, specifications, or other required documents',
          isRequired: true,
          isIncluded: true
        }
      ]
    }
  ];

  get suggestedCode() {
    if (this.isCustomCategory) {
      return this.customCategoryName ? this.customCategoryName.substring(0, 2).toUpperCase() : '';
    }
    return this.selectedCategory?.code || '';
  }

  @action
  selectCategory(category) {
    this.selectedCategory = category;
    this.isCustomCategory = false;
    this.permitName = category.name;
    this.permitCode = category.code;
    this.permitDescription = category.description;
    this.loadDefaultQuestions();
  }

  @action
  selectCustomCategory() {
    this.selectedCategory = null;
    this.isCustomCategory = true;
    this.permitName = '';
    this.permitCode = '';
    this.permitDescription = '';
    this.defaultQuestions = [];
  }

  @action
  loadDefaultQuestions() {
    if (this.selectedCategory?.defaultQuestions) {
      this.defaultQuestions = this.selectedCategory.defaultQuestions.map(q => ({ ...q }));
    } else {
      this.defaultQuestions = [];
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
      options: []
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
    if (['select', 'radio', 'checkbox'].includes(event.target.value) && !questions[index].options.length) {
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
    questions[index].options = [...questions[index].options, `Option ${questions[index].options.length + 1}`];
    this.customQuestions = questions;
  }

  @action
  removeQuestionOption(questionIndex, optionIndex) {
    const questions = [...this.customQuestions];
    questions[questionIndex].options = questions[questionIndex].options.filter((_, i) => i !== optionIndex);
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
  async createPermitType(event) {
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
        category: this.isCustomCategory ? 'custom' : this.selectedCategory.id,
        customCategory: this.isCustomCategory ? {
          name: this.customCategoryName,
          description: this.customCategoryDescription
        } : null,
        baseFee: parseFloat(this.baseFee) || 0,
        processingTime: parseInt(this.processingTime) || 14,
        requiresInspection: this.requiresInspection,
        formFields: this.buildFormFields(),
        isActive: true
      };

      // Get auth token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Submit to API
      const response = await fetch(`${config.APP.API_HOST}/api/permit-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(permitTypeData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create permit type');
      }

      // Success - redirect to permit types list
      this.router.transitionTo('municipal.permit-types.index');
      
    } catch (error) {
      console.error('Error creating permit type:', error);
      this.errorMessage = error.message || 'An error occurred while creating the permit type';
    } finally {
      this.isSubmitting = false;
    }
  }

  buildFormFields() {
    const fields = [];

    // Add included default questions
    const includedDefaults = this.defaultQuestions.filter(q => q.isIncluded);
    fields.push(...includedDefaults.map(q => ({
      id: q.id,
      type: q.type,
      label: q.label,
      description: q.description,
      isRequired: q.isRequired,
      options: q.options || [],
      isDefault: true
    })));

    // Add custom questions
    this.customQuestions.forEach((q, index) => {
      if (q.label.trim()) {
        fields.push({
          id: `custom_${index}`,
          type: q.type,
          label: q.label,
          description: q.description,
          isRequired: q.isRequired,
          options: q.options || [],
          isDefault: false
        });
      }
    });

    return fields;
  }
}