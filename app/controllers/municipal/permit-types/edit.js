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

  // Enhanced fee structure
  @tracked feeStructureType = 'none';
  @tracked feePercentage = '';
  @tracked feePerSquareFoot = '';
  @tracked minimumFee = '';
  @tracked feeTiers = [];

  // Department checklists
  @tracked departmentChecklists = {};

  // Document management
  @tracked activeDocumentTab = 'predefined';
  @tracked selectedDocuments = [];
  @tracked documentRequirements = {};
  @tracked customDocuments = [];
  @tracked showCustomDocumentForm = false;
  @tracked customDocumentName = '';
  @tracked customDocumentDescription = '';
  @tracked customDocumentRequirement = 'required';
  @tracked customDocumentFormats = 'pdf, doc, docx';
  @tracked customDocumentMaxSize = 10;

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

  // Common document types available for selection
  commonDocuments = [
    {
      id: 'architectural-plans',
      name: 'Architectural Plans',
      description: 'Detailed architectural drawings and floor plans',
      icon: '📐',
      allowedFormats: ['pdf', 'dwg', 'dxf'],
      maxSize: 25
    },
    {
      id: 'site-plan',
      name: 'Site Plan',
      description: 'Property site plan showing building location',
      icon: '🗺️',
      allowedFormats: ['pdf', 'dwg'],
      maxSize: 10
    },
    {
      id: 'structural-drawings',
      name: 'Structural Drawings',
      description: 'Structural engineering plans and calculations',
      icon: '🏗️',
      allowedFormats: ['pdf', 'dwg'],
      maxSize: 20
    },
    {
      id: 'electrical-plans',
      name: 'Electrical Plans',
      description: 'Electrical system layouts and specifications',
      icon: '⚡',
      allowedFormats: ['pdf', 'dwg'],
      maxSize: 15
    },
    {
      id: 'plumbing-plans',
      name: 'Plumbing Plans',
      description: 'Plumbing system designs and specifications',
      icon: '🔧',
      allowedFormats: ['pdf', 'dwg'],
      maxSize: 15
    },
    {
      id: 'mechanical-plans',
      name: 'Mechanical Plans',
      description: 'HVAC and mechanical system designs',
      icon: '🌡️',
      allowedFormats: ['pdf', 'dwg'],
      maxSize: 15
    },
    {
      id: 'fire-safety-plan',
      name: 'Fire Safety Plan',
      description: 'Fire protection and life safety systems',
      icon: '🚒',
      allowedFormats: ['pdf'],
      maxSize: 10
    },
    {
      id: 'soil-report',
      name: 'Soil/Geotechnical Report',
      description: 'Soil analysis and foundation recommendations',
      icon: '🌍',
      allowedFormats: ['pdf'],
      maxSize: 20
    },
    {
      id: 'survey-certificate',
      name: 'Survey Certificate',
      description: 'Land survey showing property boundaries',
      icon: '📏',
      allowedFormats: ['pdf'],
      maxSize: 5
    },
    {
      id: 'title-deed',
      name: 'Title/Deed',
      description: 'Property ownership documentation',
      icon: '📜',
      allowedFormats: ['pdf'],
      maxSize: 5
    },
    {
      id: 'contractor-license',
      name: 'Contractor License',
      description: 'Licensed contractor certification',
      icon: '🏅',
      allowedFormats: ['pdf', 'jpg', 'png'],
      maxSize: 5
    },
    {
      id: 'insurance-certificate',
      name: 'Insurance Certificate',
      description: 'Liability insurance documentation',
      icon: '🛡️',
      allowedFormats: ['pdf'],
      maxSize: 5
    },
    {
      id: 'environmental-report',
      name: 'Environmental Assessment',
      description: 'Environmental impact or compliance report',
      icon: '🌿',
      allowedFormats: ['pdf'],
      maxSize: 15
    },
    {
      id: 'zoning-compliance',
      name: 'Zoning Compliance Letter',
      description: 'Municipal zoning compliance verification',
      icon: '📋',
      allowedFormats: ['pdf'],
      maxSize: 5
    },
    {
      id: 'photos',
      name: 'Site Photos',
      description: 'Current site conditions and context photos',
      icon: '📸',
      allowedFormats: ['jpg', 'png', 'pdf'],
      maxSize: 25
    }
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
      
      // Initialize fee structure after a brief delay to ensure proper state management
      setTimeout(() => {
        this.initializeFeeStructure(permitType.feeStructure || permitType.fees);
      }, 50);
      
      this.processingTime = permitType.estimatedProcessingTime || 14;
      this.requiresInspection =
        permitType.requiredInspections &&
        permitType.requiredInspections.length > 0;
      this.isActive = permitType.isActive !== false;
      this.originalCategory = permitType.category;

      // Initialize department checklists
      this.departmentChecklists = permitType.departmentChecklists || {};

      // Load form fields into appropriate tabs
      this.loadFormFields(permitType.applicationFields || []);

      // Initialize document requirements
      this.initializeDocumentRequirements(permitType.requiredDocuments || []);
      
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
    // Visual state is now handled by Ember's reactive data binding
    // No need for manual DOM manipulation
    console.log('Department visual state initialized through reactive data');
  }

  @action
  toggleDepartment(departmentId) {
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
      
      const isCurrentlySelected = currentDepartments.includes(departmentId);
      
      if (isCurrentlySelected) {
        console.log('Removing department:', departmentId);
        this.selectedDepartments = currentDepartments.filter(id => id !== departmentId);
      } else {
        console.log('Adding department:', departmentId);
        this.selectedDepartments = [...currentDepartments, departmentId];
      }
      
      console.log('New departments:', this.selectedDepartments);
    } catch (error) {
      console.error('Error in toggleDepartment:', error);
      // Fallback - initialize as empty array and add the department
      try {
        if (!this.selectedDepartments.includes(departmentId)) {
          this.selectedDepartments = [...(this.selectedDepartments || []), departmentId];
        }
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

        // Department-specific checklists
        departmentChecklists: this.departmentChecklists,

        // Update form fields - map to expected backend format
        formFields: this.buildFormFields().map((field) => ({
          id: field.name,
          label: field.label,
          type: field.type,
          isRequired: field.required,
          description: field.helpText,
          options: field.options ? field.options.map(opt => opt.value) : []
        })),

        // Enhanced fee structure
        feeStructure: this.buildFeeStructure(),

        // Document requirements
        requiredDocuments: this.buildDocumentRequirements(),

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

  // Build fee structure for API
  buildFeeStructure() {
    const feeStructure = {
      baseFee: parseFloat(this.baseFee) || 0,
      additionalType: this.feeStructureType
    };

    switch (this.feeStructureType) {
      case 'percentage':
        feeStructure.percentage = parseFloat(this.feePercentage) || 0;
        feeStructure.minimumFee = parseFloat(this.minimumFee) || 0;
        break;
      case 'square_footage':
        feeStructure.feePerSquareFoot = parseFloat(this.feePerSquareFoot) || 0;
        feeStructure.minimumFee = parseFloat(this.minimumFee) || 0;
        break;
      case 'tiered':
        feeStructure.tiers = this.feeTiers.map(tier => ({
          minValue: parseFloat(tier.minValue) || 0,
          maxValue: parseFloat(tier.maxValue) || 0,
          fee: parseFloat(tier.fee) || 0
        }));
        break;
    }

    return feeStructure;
  }

  // Build document requirements for API
  buildDocumentRequirements() {
    const documentRequirements = [];

    // Add selected common documents
    this.selectedDocuments.forEach(docId => {
      const commonDoc = this.commonDocuments.find(doc => doc.id === docId);
      const requirement = this.documentRequirements[docId];
      
      if (commonDoc && requirement) {
        documentRequirements.push({
          id: docId,
          type: docId,
          name: commonDoc.name,
          description: commonDoc.description,
          required: requirement.requirement === 'required',
          allowedFormats: commonDoc.allowedFormats,
          maxSize: commonDoc.maxSize,
          isCustom: false
        });
      }
    });

    // Add custom documents
    this.customDocuments.forEach(doc => {
      documentRequirements.push({
        id: doc.id,
        type: doc.id,
        name: doc.name,
        description: doc.description,
        required: doc.requirement === 'required',
        allowedFormats: doc.allowedFormats,
        maxSize: doc.maxSize,
        isCustom: true
      });
    });

    return documentRequirements;
  }

  // Fee structure initialization
  initializeFeeStructure(feeStructure) {
    console.log('Initializing fee structure with:', feeStructure);
    
    // Handle fees array (current database format)
    if (Array.isArray(feeStructure)) {
      let baseFee = '';
      let additionalType = 'none';
      
      // Reset fee structure fields first
      this.feePercentage = '';
      this.feePerSquareFoot = '';
      this.minimumFee = '';
      this.feeTiers = [];
      
      // Process each fee in the array
      feeStructure.forEach(fee => {
        console.log('Processing fee:', fee);
        switch (fee.type) {
          case 'fixed':
            baseFee = fee.amount?.toString() || '';
            break;
          case 'percentage':
            additionalType = 'percentage';
            this.feePercentage = fee.percentage?.toString() || '';
            this.minimumFee = fee.minimumAmount?.toString() || '';
            break;
          case 'per-unit':
            additionalType = 'square_footage';
            this.feePerSquareFoot = fee.unitAmount?.toString() || '';
            this.minimumFee = fee.minimumAmount?.toString() || '';
            break;
          case 'tiered':
            additionalType = 'tiered';
            this.feeTiers = fee.tiers || [];
            break;
        }
      });
      
      console.log('Setting baseFee to:', baseFee);
      console.log('Setting feeStructureType to:', additionalType);
      
      this.baseFee = baseFee;
      this.feeStructureType = additionalType;
      
      console.log('Final feeStructureType:', this.feeStructureType);
      console.log('Final feePercentage:', this.feePercentage);
      console.log('Final minimumFee:', this.minimumFee);
      
      // Force DOM update for select element
      setTimeout(() => {
        const selectElement = document.getElementById('additional-fee-structure');
        if (selectElement) {
          selectElement.value = this.feeStructureType;
          console.log('Forced select element value to:', this.feeStructureType);
        }
      }, 100);
      
      return;
    }

    if (!feeStructure) {
      this.feeStructureType = 'none';
      this.baseFee = '';
      return;
    }

    // Handle new fee structure format (if it exists)
    this.baseFee = feeStructure.baseFee?.toString() || '';
    this.feeStructureType = feeStructure.additionalType || 'none';
    
    switch (this.feeStructureType) {
      case 'percentage':
        this.feePercentage = feeStructure.percentage?.toString() || '';
        this.minimumFee = feeStructure.minimumFee?.toString() || '';
        break;
      case 'square_footage':
        this.feePerSquareFoot = feeStructure.feePerSquareFoot?.toString() || '';
        this.minimumFee = feeStructure.minimumFee?.toString() || '';
        break;
      case 'tiered':
        this.feeTiers = feeStructure.tiers || [];
        break;
    }
  }

  // Fee structure actions
  @action
  handleFeeStructureChange(event) {
    this.feeStructureType = event.target.value;
    
    // Initialize default tier structure for tiered fees
    if (event.target.value === 'tiered' && !this.feeTiers.length) {
      this.feeTiers = [
        { minValue: 0, maxValue: 10000, fee: 100 },
        { minValue: 10000, maxValue: 50000, fee: 300 }
      ];
    }
  }

  @action
  addTier() {
    const lastTier = this.feeTiers[this.feeTiers.length - 1];
    const newTier = {
      minValue: lastTier ? lastTier.maxValue : 0,
      maxValue: (lastTier ? lastTier.maxValue : 0) + 10000,
      fee: 100
    };
    this.feeTiers = [...this.feeTiers, newTier];
  }

  @action
  removeTier(index) {
    this.feeTiers = this.feeTiers.filter((_, i) => i !== index);
  }

  @action
  updateTierMinValue(index, event) {
    const tiers = [...this.feeTiers];
    tiers[index].minValue = parseFloat(event.target.value) || 0;
    this.feeTiers = tiers;
  }

  @action
  updateTierMaxValue(index, event) {
    const tiers = [...this.feeTiers];
    tiers[index].maxValue = parseFloat(event.target.value) || 0;
    this.feeTiers = tiers;
  }

  @action
  updateTierFee(index, event) {
    const tiers = [...this.feeTiers];
    tiers[index].fee = parseFloat(event.target.value) || 0;
    this.feeTiers = tiers;
  }

  // Department checklist methods
  getDepartmentInfo = (departmentId) => {
    return this.availableDepartments.find(dept => dept.id === departmentId) || {
      id: departmentId,
      name: departmentId,
      icon: '📋'
    };
  }

  getDepartmentChecklist = (departmentId) => {
    return this.departmentChecklists[departmentId] || [];
  }

  @action
  addChecklistItem(departmentId) {
    const checklists = { ...this.departmentChecklists };
    if (!checklists[departmentId]) {
      checklists[departmentId] = [];
    }
    const newItem = {
      id: `${departmentId}-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: '',
      required: false,
      order: checklists[departmentId].length
    };
    checklists[departmentId] = [...checklists[departmentId], newItem];
    this.departmentChecklists = checklists;
  }

  @action
  removeChecklistItem(departmentId, index) {
    const checklists = { ...this.departmentChecklists };
    if (checklists[departmentId]) {
      checklists[departmentId] = checklists[departmentId].filter((_, i) => i !== index);
      this.departmentChecklists = checklists;
    }
  }

  @action
  updateChecklistItem(departmentId, index, field, event) {
    const checklists = { ...this.departmentChecklists };
    if (checklists[departmentId] && checklists[departmentId][index]) {
      if (field === 'required') {
        checklists[departmentId][index][field] = event.target.checked;
      } else {
        checklists[departmentId][index][field] = event.target.value;
      }
      this.departmentChecklists = checklists;
    }
  }

  // Document management methods
  initializeDocumentRequirements(requiredDocuments) {
    this.selectedDocuments = [];
    this.documentRequirements = {};
    this.customDocuments = [];

    requiredDocuments.forEach(doc => {
      if (doc.isCustom) {
        // Add to custom documents
        this.customDocuments.push({
          id: doc.id || doc.type,
          name: doc.name || doc.type,
          description: doc.description || '',
          requirement: doc.required ? 'required' : 'optional',
          allowedFormats: doc.allowedFormats || ['pdf'],
          maxSize: doc.maxSize || 10
        });
      } else {
        // Add to selected predefined documents
        this.selectedDocuments.push(doc.type || doc.id);
        this.documentRequirements[doc.type || doc.id] = {
          requirement: doc.required ? 'required' : 'optional'
        };
      }
    });

    this.selectedDocuments = [...this.selectedDocuments];
    this.customDocuments = [...this.customDocuments];
  }

  @action
  setActiveDocumentTab(tab) {
    this.activeDocumentTab = tab;
  }

  @action
  toggleDocument(documentId) {
    const isSelected = this.selectedDocuments.includes(documentId);
    
    if (isSelected) {
      this.selectedDocuments = this.selectedDocuments.filter(id => id !== documentId);
      const requirements = { ...this.documentRequirements };
      delete requirements[documentId];
      this.documentRequirements = requirements;
    } else {
      this.selectedDocuments = [...this.selectedDocuments, documentId];
      this.documentRequirements = {
        ...this.documentRequirements,
        [documentId]: { requirement: 'required' }
      };
    }
  }

  @action
  setDocumentRequirement(documentId, requirement) {
    this.documentRequirements = {
      ...this.documentRequirements,
      [documentId]: { requirement }
    };
  }

  isDocumentSelected = (documentId) => {
    return this.selectedDocuments.includes(documentId);
  }

  @action
  showCustomDocumentForm() {
    this.showCustomDocumentForm = true;
    this.customDocumentName = '';
    this.customDocumentDescription = '';
    this.customDocumentRequirement = 'required';
    this.customDocumentFormats = 'pdf, doc, docx';
    this.customDocumentMaxSize = 10;
  }

  @action
  cancelCustomDocument() {
    this.showCustomDocumentForm = false;
  }

  @action
  addCustomDocument() {
    if (!this.customDocumentName.trim()) return;

    const formatsArray = this.customDocumentFormats
      .split(',')
      .map(format => format.trim().toLowerCase())
      .filter(format => format);

    const newDocument = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: this.customDocumentName,
      description: this.customDocumentDescription,
      requirement: this.customDocumentRequirement,
      allowedFormats: formatsArray,
      maxSize: parseInt(this.customDocumentMaxSize) || 10
    };

    this.customDocuments = [...this.customDocuments, newDocument];
    this.showCustomDocumentForm = false;
  }

  @action
  removeCustomDocument(documentId) {
    this.customDocuments = this.customDocuments.filter(doc => doc.id !== documentId);
  }

  @action
  setCustomDocumentRequirement(requirement) {
    this.customDocumentRequirement = requirement;
  }
}
