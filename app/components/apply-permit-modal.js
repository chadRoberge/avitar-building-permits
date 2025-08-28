import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import config from 'avitar-building-permits/config/environment';

export default class ApplyPermitModalComponent extends Component {
  @tracked currentStep = 'property-search';
  @tracked isSearching = false;
  @tracked searchQuery = '';
  @tracked searchResults = [];
  @tracked selectedProperty = null;
  @tracked noResults = false;
  @tracked selectedPermitType = null;
  @tracked applicationData = {};
  @tracked openDropdowns = {};
  @tracked isSubmittingApplication = false;

  // File upload properties
  @tracked selectedFiles = [];
  @tracked selectedFileType = 'other';
  @tracked fileDescription = '';
  @tracked isDragOver = false;
  @tracked fileError = null;
  

  // File type options for dropdown
  fileTypes = [
    { value: 'plans', label: 'Plans & Drawings' },
    { value: 'specifications', label: 'Specifications' },
    { value: 'calculations', label: 'Calculations' },
    { value: 'photos', label: 'Photos' },
    { value: 'reports', label: 'Reports' },
    { value: 'correspondence', label: 'Correspondence' },
    { value: 'certificates', label: 'Certificates' },
    { value: 'surveys', label: 'Surveys' },
    { value: 'other', label: 'Other' },
  ];

  get allowedFileTypes() {
    return [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed',
    ];
  }

  get hasSelectedFiles() {
    return this.selectedFiles.length > 0;
  }

  // Mock property data
  mockProperties = [{
      pid: '000001000001000001',
      address: '296 Mount Delight Road',
      city: 'Rochester',
      state: 'NH',
      zip: '03839',
      lat: 43.149627,
      lng: -71.322090,
      owner: 'John Smith',
      propertyType: 'Residential',
      mapLotSub: '1-1-1'
    },
    {
      pid: '000002000003000001',
      address: '326 North Road',
      city: 'Deerfield',
      state: 'NH',
      zip: '03037',
      owner: 'Sarah Johnson',
      propertyType: 'Residential',
      mapLotSub: '2-3-1'
    },
    {
      pid: '000005000010000002',
      address: '789 Pine Road',
      city: 'Deerfield',
      state: 'NH',
      zip: '03037',
      owner: 'Mike Wilson',
      propertyType: 'Commercial',
      mapLotSub: '5-10-2'
    },
    {
      pid: '000001000025000000',
      address: '321 Elm Street',
      city: 'Deerfield',
      state: 'NH',
      zip: '03037',
      owner: 'Lisa Brown',
      propertyType: 'Residential',
      mapLotSub: '1-25-0'
    },
    {
      pid: '000010000005000003',
      address: '654 Maple Drive',
      city: 'Deerfield',
      state: 'NH',
      zip: '03037',
      owner: 'David Miller',
      propertyType: 'Residential',
      mapLotSub: '10-5-3'
    }
  ];

  @tracked permitTypes = [];
  @tracked isLoadingPermitTypes = false;

  get municipality() {
    return this.args.selectedMunicipality?.name || 'Selected Municipality';
  }

  @action
  closeModal() {
    this.args.onClose?.();
    this.resetModal();
  }

  @action
  stopPropagation(event) {
    event.stopPropagation();
  }

  @action
  updateSearchQuery(event) {
    this.searchQuery = event.target.value;
    this.noResults = false;
  }

  @action
  async searchProperties() {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      this.noResults = false;
      return;
    }

    this.isSearching = true;

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const query = this.searchQuery.toLowerCase().trim();

    // Search by address, owner name, or PID/Map-Lot-Sub
    const results = this.mockProperties.filter(property => {
      return (
        property.address.toLowerCase().includes(query) ||
        property.owner.toLowerCase().includes(query) ||
        property.pid.includes(query.replace(/[-]/g, '')) ||
        property.mapLotSub.includes(query)
      );
    });

    this.searchResults = results;
    this.noResults = results.length === 0 && query.length > 0;
    this.isSearching = false;
  }

  @action
  selectProperty(property) {
    this.selectedProperty = property;
  }

  @action
  async proceedWithProperty() {
    if (!this.selectedProperty) return;

    // Load permit types for the selected municipality
    await this.loadPermitTypes();

    // Move to permit type selection step
    this.currentStep = 'permit-type-selection';
  }

  async loadPermitTypes() {
    if (!this.args.selectedMunicipality) return;

    this.isLoadingPermitTypes = true;

    try {
      const authToken = localStorage.getItem('auth_token');

      // For commercial users, we need to fetch permit types for a specific municipality
      // The API endpoint expects the municipality ID as a query parameter
      const municipalityId = this.args.selectedMunicipality.id || this.args.selectedMunicipality._id;

      const response = await fetch(`${config.APP.API_HOST}/api/municipalities/${municipalityId}/permit-types`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const permitTypes = await response.json();
        // Filter only active and public permit types for commercial users
        this.permitTypes = permitTypes.filter(permitType =>
          permitType.isActive && permitType.isPublic
        ).map(permitType => ({
          id: permitType._id,
          name: permitType.name,
          code: permitType.code,
          description: permitType.description,
          category: permitType.category,
          fee: this.calculateDisplayFee(permitType.fees),
          processingTime: `${permitType.estimatedProcessingTime} business days`,
          requirements: permitType.requiredDocuments?.map(doc => doc.name) || [],
          requiredInspections: permitType.requiredInspections || [],
          requiredDepartments: permitType.requiredDepartments || []
        }));
      } else {
        console.error('Failed to load permit types:', response.status);
        this.permitTypes = [];
      }
    } catch (error) {
      console.error('Error loading permit types:', error);
      this.permitTypes = [];
    } finally {
      this.isLoadingPermitTypes = false;
    }
  }

  calculateDisplayFee(fees) {
    if (!fees || fees.length === 0) return '0.00';

    // For display purposes, sum up all fixed fees
    let totalFee = 0;
    fees.forEach(fee => {
      if (fee.type === 'fixed' && fee.amount) {
        totalFee += fee.amount;
      }
    });

    return totalFee.toFixed(2);
  }

  getMockPermitTypes() {
    const municipalityName = this.args.selectedMunicipality?.name || 'Selected Municipality';
    
    return;
  }

  @action
  selectPermitType(permitType) {
    this.selectedPermitType = permitType;
  }

  @action
  async proceedWithPermitType() {
    if (!this.selectedPermitType) return;

    // Initialize application data
    this.applicationData = {};
    
    // Load full permit type details including application fields
    await this.loadFullPermitTypeDetails();
    
    // Move to application form step
    this.currentStep = 'application-form';
  }

  @action
  backToPropertySearch() {
    this.currentStep = 'property-search';
  }

  @action
  backToPermitSelection() {
    this.currentStep = 'permit-type-selection';
  }

  async loadFullPermitTypeDetails() {
    if (!this.selectedPermitType?.id) return;
    
    try {
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`${config.APP.API_HOST}/api/permit-types/${this.selectedPermitType.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const fullPermitType = await response.json();
        
        // Merge the full details with the existing permit type
        this.selectedPermitType = {
          ...this.selectedPermitType,
          ...fullPermitType,
          applicationFields: fullPermitType.applicationFields || []
        };
        
      } else {
        console.error('Failed to load full permit type details:', response.status);
        // Keep using mock questions if API fails
      }
    } catch (error) {
      console.error('Error loading full permit type details:', error);
      // Keep using mock questions if API fails
    }
  }

  @action
  updateFormField(fieldName, event) {
    let value = event.target.value;
    
    // For select fields, convert index back to actual option value
    const field = this.formFields.find(f => f.id === fieldName);
    if (field && field.type === 'select' && field.options && field.options.length > 0) {
      const index = parseInt(value);
      if (!isNaN(index) && index >= 0 && index < field.options.length) {
        value = field.options[index];
      }
    }
    
    this.applicationData[fieldName] = value;
  }


  @action
  toggleDropdown(fieldId, event) {
    event.stopPropagation();
    
    // Find the dropdown using DOM
    const dropdown = document.querySelector(`[data-field-id="${fieldId}"] .select-options`);
    const arrow = document.querySelector(`[data-field-id="${fieldId}"] .select-arrow`);
    
    if (dropdown) {
      const isVisible = dropdown.style.display !== 'none';
      dropdown.style.display = isVisible ? 'none' : 'block';
      
      if (arrow) {
        arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
      }
      
    }
  }

  @action
  selectOption(fieldId, option, event) {
    event.stopPropagation();
    
    
    // Ensure applicationData exists
    if (!this.applicationData) {
      this.applicationData = {};
    }
    
    const updatedData = {
      ...this.applicationData,
      [fieldId]: option
    };
    this.applicationData = updatedData;
    
    
    // Close the dropdown after selection using DOM
    const dropdown = document.querySelector(`[data-field-id="${fieldId}"] .select-options`);
    const arrow = document.querySelector(`[data-field-id="${fieldId}"] .select-arrow`);
    
    if (dropdown) {
      dropdown.style.display = 'none';
    }
    if (arrow) {
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  @action
  closeAllDropdowns() {
    this.openDropdowns = {};
  }

  @action
  getSelectedValue(fieldId) {
    if (!this.applicationData) {
      return null;
    }
    return this.applicationData[fieldId];
  }

  @action
  isDropdownOpen(fieldId) {
    try {
      if (!this.openDropdowns) {
        return false;
      }
      return !!this.openDropdowns[fieldId];
    } catch (error) {
      console.error('Error in isDropdownOpen:', error);
      return false;
    }
  }

  @action
  updateCheckboxField(fieldId, option, event) {
    const isChecked = event.target.checked;
    
    // Ensure applicationData exists
    if (!this.applicationData) {
      this.applicationData = {};
    }
    
    const currentValues = this.applicationData[fieldId] || [];
    
    let newValues;
    if (isChecked) {
      // Add option if not already present
      if (!currentValues.includes(option)) {
        newValues = [...currentValues, option];
      } else {
        newValues = currentValues;
      }
    } else {
      // Remove option
      newValues = currentValues.filter(val => val !== option);
    }
    
    // Force a complete object replacement to trigger reactivity
    const updatedData = {
      ...this.applicationData,
      [fieldId]: newValues
    };
    this.applicationData = updatedData;
    
  }

  @action
  async submitApplication() {
    if (this.isSubmittingApplication) return;
    
    // Validate required fields
    const missingFields = this.validateApplication();
    if (missingFields.length > 0) {
      alert(`Please fill out the following required fields:\n${missingFields.join('\n')}`);
      return;
    }

    this.isSubmittingApplication = true;

    try {
      // Get user info from localStorage or session
      const userToken = localStorage.getItem('auth_token');
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      console.log('Debug auth check:');
      console.log('- userToken exists:', !!userToken);
      console.log('- currentUser:', currentUser);
      console.log('- currentUser.id:', currentUser.id);
      console.log('- selectedMunicipality:', this.args.selectedMunicipality);
      
      if (!userToken) {
        alert('No authentication token found. Please log in again.');
        return;
      }
      
      // If we don't have user ID in localStorage, try to get it from the token
      let userId = currentUser.id;
      if (!userId && userToken) {
        try {
          // Decode the JWT token to get user ID
          const tokenPayload = JSON.parse(atob(userToken.split('.')[1]));
          userId = tokenPayload.userId;
          console.log('Extracted userId from token:', userId);
        } catch (error) {
          console.error('Error decoding token:', error);
          alert('Invalid authentication token. Please log in again.');
          return;
        }
      }
      
      if (!userId) {
        alert('User ID not found. Please log in again.');
        return;
      }

      // Prepare the permit application data for the API
      const permitApplicationData = {
        // Required fields for API
        userId: userId,
        municipalityId: this.selectedProperty.municipalityId || this.args.selectedMunicipality?.id || this.args.selectedMunicipality?._id,
        permitTypeId: this.selectedPermitType.id || this.selectedPermitType._id,
        
        // Property reference - use a valid ObjectId or null (let server create/find property)
        property: this.selectedProperty._id || null,
        
        // Project details - extract from dynamic form data
        projectDescription: this.getProjectDescription(),
        projectValue: this.getProjectValue(),
        
        // Work details
        workDetails: {
          startDate: this.applicationData.startDate || new Date().toISOString(),
          estimatedDuration: this.applicationData.estimatedDuration || '2-4 weeks',
          workLocation: 'primary'
        },
        
        // Contractor info if provided
        contractorInfo: this.getContractorInfo(),
        
        // Dynamic permit-specific data
        permitSpecificData: this.applicationData,
        
        // Calculated fee
        calculatedFee: parseFloat(this.selectedPermitType.fee || 0),
        
        // Additional info
        additionalInfo: this.applicationData.additionalInfo || 'Application submitted via web portal',
        
        // Include the selected property data for the server to use
        selectedPropertyData: this.selectedProperty,
        
        // Override user address data for commercial users
        overrideProjectAddress: {
          street: this.selectedProperty.address || '296 Mount Delight Road',
          city: this.selectedProperty.city || 'Rochester', 
          state: this.selectedProperty.state || 'NH',
          zip: this.selectedProperty.zip || '03839'
        }
      };


      // Submit to API
      const response = await fetch(`${config.APP.API_HOST}/api/permits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(permitApplicationData)
      });

      const result = await response.json();
      
      if (response.ok) {
        // Success! Now upload files if any were selected
        let fileUploadSuccess = true;
        
        if (this.hasSelectedFiles) {
          try {
            await this.uploadFilesToPermit(result.permit.id, userToken);
          } catch (fileError) {
            console.error('File upload error:', fileError);
            fileUploadSuccess = false;
            alert(`Application submitted successfully, but there was an issue uploading files: ${fileError.message}`);
          }
        }
        
        const successMessage = fileUploadSuccess && this.hasSelectedFiles 
          ? `Application submitted successfully with ${this.selectedFiles.length} file(s)!

Permit Type: ${this.selectedPermitType.name}
Property: ${this.selectedProperty.address}
Application ID: ${result.applicationId || result.id}
Fee: $${this.selectedPermitType.fee}
Files: ${this.selectedFiles.length} uploaded

Your permit application has been submitted and is now under review. You will be notified of any updates via email.`
          : `Application submitted successfully!

Permit Type: ${this.selectedPermitType.name}
Property: ${this.selectedProperty.address}
Application ID: ${result.applicationId || result.id}
Fee: $${this.selectedPermitType.fee}

Your permit application has been submitted and is now under review. You will be notified of any updates via email.`;

        alert(successMessage);

        // Close modal and refresh if needed
        this.closeModal();
        
        // Optionally trigger a page refresh or navigation to permits dashboard
        if (this.args.onSubmitSuccess) {
          this.args.onSubmitSuccess(result);
        }
        
      } else {
        // Error from API
        console.error('API Error:', result);
        alert(`Failed to submit application: ${result.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Submit error:', error);
      alert(`Failed to submit application: ${error.message}`);
    } finally {
      this.isSubmittingApplication = false;
    }
  }

  validateApplication() {
    const missingFields = [];
    const formFields = this.formFields;
    
    formFields.forEach(field => {
      if (field.required && !this.applicationData[field.id]) {
        missingFields.push(field.label);
      }
    });
    
    return missingFields;
  }

  getProjectDescription() {
    // Try to get project description from various possible field names
    return this.applicationData.projectDescription || 
           this.applicationData.description || 
           this.applicationData.workDescription || 
           'Work to be performed as specified in application';
  }

  getProjectValue() {
    console.log('DEBUG: Getting project value from applicationData:', this.applicationData);
    
    // Try to get project value from various possible field names
    // Start with the most specific and commonly used fields first
    let value = this.applicationData.estimatedValue || 
                this.applicationData.projectValue || 
                this.applicationData.constructionValue ||
                this.applicationData['Estimated Project Value']; // Try the exact field label
    
    console.log('DEBUG: Found value from standard fields:', value);
    
    // Only check custom fields if we haven't found a value yet
    // and be more selective about what we consider a project value
    if (!value) {
      const customFields = Object.keys(this.applicationData).filter(key => key.startsWith('custom_'));
      console.log('DEBUG: Checking custom fields:', customFields);
      
      for (const fieldKey of customFields) {
        const fieldValue = this.applicationData[fieldKey];
        const numValue = parseFloat(fieldValue);
        console.log(`DEBUG: Custom field ${fieldKey} = ${fieldValue} (parsed: ${numValue})`);
        
        // Be more selective - project values are typically > 10000 for construction projects
        // Also avoid picking up calculated fees which are usually smaller amounts
        if (!isNaN(numValue) && numValue > 10000) {
          console.log(`DEBUG: Using custom field ${fieldKey} as project value: ${numValue}`);
          value = numValue;
          break;
        }
      }
    }
    
    // Ensure it's a positive number, default to 1000 if still not found
    const parsedValue = parseFloat(value);
    const finalValue = (!isNaN(parsedValue) && parsedValue > 0) ? parsedValue : 1000;
    
    console.log('DEBUG: Final project value:', finalValue);
    return finalValue;
  }

  getContractorInfo() {
    // Extract contractor information if provided
    const contractorName = this.applicationData.contractorName;
    const contractorLicense = this.applicationData.contractorLicense;
    
    if (contractorName || contractorLicense) {
      return {
        name: contractorName || 'Not provided',
        license: contractorLicense || 'Not provided',
        phone: this.applicationData.contractorPhone || '',
        email: this.applicationData.contractorEmail || ''
      };
    }
    
    return null;
  }


  get formFields() {
    if (!this.selectedPermitType) return [];

    // Start with permit-specific questions if they exist
    let fields = [];

    // Check if permit type has applicationFields (from the API)
    if (this.selectedPermitType.applicationFields && this.selectedPermitType.applicationFields.length > 0) {
      // Use actual permit type questions from the API
      fields = this.selectedPermitType.applicationFields.map(apiField => {
        
        const processedOptions = apiField.options?.map(opt => {
          let processedOpt;
          if (typeof opt === 'string') {
            processedOpt = opt;
          } else if (typeof opt === 'object' && opt !== null) {
            processedOpt = opt.label || opt.value || String(opt);
          } else {
            processedOpt = String(opt);
          }
          
          // Extra safety: ensure it's a plain string with no special characters that might confuse Ember
          const safeString = String(processedOpt).trim();
          return safeString;
        }) || [];
        
        return {
          id: apiField.name,
          label: apiField.label,
          type: apiField.type,
          required: apiField.required || false,
          placeholder: apiField.helpText || apiField.placeholder || '',
          options: processedOptions
        };
      });
    } else {
      // Fallback to comprehensive mock questions based on permit category
      fields = this.getMockPermitQuestions();
    }

    // Add standard application fields at the end
    const standardFields = [
      {
        id: 'contractorName',
        label: 'Contractor Name',
        type: 'text',
        required: false,
        placeholder: 'Name of contractor (if applicable)'
      },
      {
        id: 'contractorLicense',
        label: 'Contractor License Number',
        type: 'text',
        required: false,
        placeholder: 'License number (if applicable)'
      },
      {
        id: 'applicantPhone',
        label: 'Contact Phone Number',
        type: 'text',
        required: true,
        placeholder: 'Your phone number'
      },
      {
        id: 'applicantEmail',
        label: 'Contact Email',
        type: 'email',
        required: true,
        placeholder: 'Your email address'
      }
    ];

    return [...fields, ...standardFields];
  }

  getMockPermitQuestions() {
    const permitType = this.selectedPermitType;
    let fields = [
      {
        id: 'projectDescription',
        label: 'Project Description',
        type: 'textarea',
        required: true,
        placeholder: 'Describe the work to be performed in detail'
      },
      {
        id: 'estimatedValue',
        label: 'Estimated Project Value',
        type: 'currency',
        required: true,
        placeholder: '0.00'
      }
    ];

    // Building Permit Questions
    if (permitType?.category === 'building') {
      fields.push(
        {
          id: 'constructionType',
          label: 'Type of Construction',
          type: 'select',
          required: true,
          options: ['New Construction', 'Addition', 'Alteration', 'Renovation', 'Repair']
        },
        {
          id: 'squareFootage',
          label: 'Total Square Footage',
          type: 'number',
          required: true,
          placeholder: 'Square footage of project'
        },
        {
          id: 'numStories',
          label: 'Number of Stories',
          type: 'number',
          required: true,
          placeholder: 'Total stories in structure'
        },
        {
          id: 'occupancyType',
          label: 'Occupancy Type',
          type: 'select',
          required: true,
          options: ['Single Family Residential', 'Multi-family Residential', 'Commercial', 'Industrial', 'Other']
        },
        {
          id: 'foundationType',
          label: 'Foundation Type',
          type: 'select',
          required: true,
          options: ['Concrete Slab', 'Crawl Space', 'Full Basement', 'Pile Foundation', 'Other']
        }
      );
    }

    // Electrical Permit Questions
    if (permitType?.category === 'electrical') {
      fields.push(
        {
          id: 'workType',
          label: 'Type of Electrical Work',
          type: 'select',
          required: true,
          options: ['New Service', 'Service Upgrade', 'Circuit Addition', 'Outlet/Switch Installation', 'Fixture Installation', 'Other']
        },
        {
          id: 'serviceSize',
          label: 'Electrical Service Size (Amps)',
          type: 'number',
          required: true,
          placeholder: 'e.g., 200'
        },
        {
          id: 'panelLocation',
          label: 'Main Panel Location',
          type: 'text',
          required: true,
          placeholder: 'Location of electrical panel'
        },
        {
          id: 'circuitCount',
          label: 'Number of New Circuits',
          type: 'number',
          required: false,
          placeholder: 'Number of new circuits being added'
        }
      );
    }

    // Plumbing Permit Questions
    if (permitType?.category === 'plumbing') {
      fields.push(
        {
          id: 'workType',
          label: 'Type of Plumbing Work',
          type: 'select',
          required: true,
          options: ['New Installation', 'Repair', 'Replacement', 'Addition', 'Water Line', 'Sewer Line']
        },
        {
          id: 'fixtureCount',
          label: 'Number of Fixtures',
          type: 'number',
          required: true,
          placeholder: 'Total fixtures being installed/modified'
        },
        {
          id: 'waterService',
          label: 'Water Service Size',
          type: 'select',
          required: true,
          options: ['3/4 inch', '1 inch', '1.5 inch', '2 inch', 'Other']
        },
        {
          id: 'sewerConnection',
          label: 'Sewer Connection Type',
          type: 'select',
          required: true,
          options: ['Public Sewer', 'Septic System', 'Other']
        }
      );
    }

    // Mechanical Permit Questions
    if (permitType?.category === 'mechanical') {
      fields.push(
        {
          id: 'systemType',
          label: 'HVAC System Type',
          type: 'select',
          required: true,
          options: ['Central Air/Heat', 'Heat Pump', 'Boiler', 'Ductless Mini-Split', 'Window Units', 'Other']
        },
        {
          id: 'systemCapacity',
          label: 'System Capacity (BTU)',
          type: 'number',
          required: true,
          placeholder: 'BTU capacity of system'
        },
        {
          id: 'ductwork',
          label: 'Ductwork Installation',
          type: 'select',
          required: true,
          options: ['New Ductwork', 'Modify Existing', 'No Ductwork Required']
        }
      );
    }

    // Demolition Permit Questions
    if (permitType?.category === 'demolition') {
      fields.push(
        {
          id: 'demolitionType',
          label: 'Type of Demolition',
          type: 'select',
          required: true,
          options: ['Full Structure', 'Partial Demolition', 'Interior Only', 'Accessory Structure']
        },
        {
          id: 'asbestosInspection',
          label: 'Asbestos Inspection Completed',
          type: 'select',
          required: true,
          options: ['Yes', 'No', 'Not Required']
        },
        {
          id: 'utilityDisconnection',
          label: 'Utility Disconnection Status',
          type: 'select',
          required: true,
          options: ['Completed', 'Scheduled', 'Not Required']
        },
        {
          id: 'debrisDisposal',
          label: 'Debris Disposal Plan',
          type: 'textarea',
          required: true,
          placeholder: 'Describe how debris will be disposed of'
        }
      );
    }

    return fields;
  }


  // Format PID for display (000001000001000001 -> Map 1 Lot 1 Sub 1)
  formatPIDLong(pid) {
    if (!pid || pid.length !== 18) return pid;

    const map = parseInt(pid.substring(0, 6)).toString();
    const lot = parseInt(pid.substring(6, 12)).toString();
    const sub = parseInt(pid.substring(12, 18)).toString();

    return `Map ${map} Lot ${lot} Sub ${sub}`;
  }

  // Format PID for compact display (000001000001000001 -> 1-1-1)  
  formatPID(pid) {
    if (!pid || pid.length !== 18) return pid;

    const map = parseInt(pid.substring(0, 6)).toString();
    const lot = parseInt(pid.substring(6, 12)).toString();
    const sub = parseInt(pid.substring(12, 18)).toString();

    return `${map}-${lot}-${sub}`;
  }

  // File Upload Actions
  @action
  updateFileType(event) {
    this.selectedFileType = event.target.value;
  }

  @action
  updateFileDescription(event) {
    this.fileDescription = event.target.value;
  }

  @action
  handleFileSelect(event) {
    const selectedFiles = Array.from(event.target.files);
    this.validateAndAddFiles(selectedFiles);
    // Reset input so same file can be selected again
    event.target.value = '';
  }

  @action
  handleDragOver(event) {
    event.preventDefault();
    this.isDragOver = true;
  }

  @action
  handleDragLeave(event) {
    event.preventDefault();
    this.isDragOver = false;
  }

  @action
  handleDrop(event) {
    event.preventDefault();
    this.isDragOver = false;

    const droppedFiles = Array.from(event.dataTransfer.files);
    this.validateAndAddFiles(droppedFiles);
  }

  @action
  validateAndAddFiles(newFiles) {
    this.fileError = null;
    const validFiles = [];
    const errors = [];

    // Check file count limit (5 files max)
    if (this.selectedFiles.length + newFiles.length > 5) {
      this.fileError = 'Maximum 5 files allowed at once.';
      return;
    }

    for (const file of newFiles) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      // Check file type
      if (!this.allowedFileTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`);
        continue;
      }

      // Check for duplicates
      if (this.selectedFiles.find((f) => f.name === file.name && f.size === file.size)) {
        errors.push(`${file.name}: File already selected`);
        continue;
      }

      validFiles.push({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        id: Math.random().toString(36).substr(2, 9),
      });
    }

    if (errors.length > 0) {
      this.fileError = errors.join(', ');
    }

    this.selectedFiles = [...this.selectedFiles, ...validFiles];
  }

  @action
  removeFile(fileId) {
    this.selectedFiles = this.selectedFiles.filter((f) => f.id !== fileId);
    this.fileError = null;
  }

  @action
  clearFiles() {
    this.selectedFiles = [];
    this.fileError = null;
    this.fileDescription = '';
  }

  async uploadFilesToPermit(permitId, authToken) {
    if (!this.selectedFiles.length) return;

    const formData = new FormData();

    // Add files to form data
    this.selectedFiles.forEach((fileObj) => {
      formData.append('files', fileObj.file);
    });

    // Add metadata
    formData.append('fileType', this.selectedFileType);
    formData.append('description', this.fileDescription);

    const response = await fetch(
      `${config.APP.API_HOST}/api/permits/${permitId}/files/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'File upload failed');
    }

    return result;
  }

  async uploadFormFilesToPermit(permitId, authToken) {
    if (Object.keys(this.formFiles).length === 0) return;

    const formData = new FormData();

    // Add each form file with its field name as metadata
    Object.entries(this.formFiles).forEach(([fieldName, file]) => {
      formData.append('files', file);
      
      // Find the field to get its label for better description
      const field = this.formFields.find(f => f.id === fieldName);
      const fieldLabel = field?.label || fieldName;
      
      // Add metadata for this file
      formData.append('fileFieldNames', fieldName);
      formData.append('fileFieldLabels', fieldLabel);
    });

    // Add general metadata
    formData.append('fileType', 'form-field');
    formData.append('description', 'Files uploaded via form fields');

    const response = await fetch(
      `${config.APP.API_HOST}/api/permits/${permitId}/files/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Form file upload failed');
    }

    return result;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  @action
  resetModal() {
    this.currentStep = 'property-search';
    this.searchQuery = '';
    this.searchResults = [];
    this.selectedProperty = null;
    this.selectedPermitType = null;
    this.permitTypes = [];
    this.noResults = false;
    this.isSearching = false;
    this.isLoadingPermitTypes = false;
    this.applicationData = {};
    this.openDropdowns = {};
    this.isSubmittingApplication = false;
    
    // Reset file upload state
    this.selectedFiles = [];
    this.selectedFileType = 'other';
    this.fileDescription = '';
    this.isDragOver = false;
    this.fileError = null;
    
    // Reset form file fields
    this.formFiles = {};
  }
}
