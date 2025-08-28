import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPermitTypesNewController extends Controller {
  @service router;

  // Constructor removed - using @tracked class field initialization instead

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
  
  // Building codes and energy requirements
  @tracked selectedBuildingCodes = [];
  @tracked requiresResidentialEnergyCode = false;
  
  // Document uploads
  @tracked uploadedDocuments = [];
  
  // Document requirements
  @tracked activeDocumentTab = 'predefined';
  @tracked selectedDocuments = [];
  @tracked documentRequirements = {}; // Track whether each document is required
  @tracked customDocuments = [];

  // Department review tracking
  @tracked selectedDepartments = [];

  // Inspection tracking
  @tracked selectedInspections = [];

  @tracked activeQuestionTab = 'default';
  @tracked defaultQuestions = [];
  @tracked customQuestions = [];

  @tracked isSubmitting = false;
  @tracked errorMessage = '';

  // Available review departments
  availableDepartments = [
    {
      id: 'building',
      name: 'Building Department',
      description: 'Reviews building codes, structural plans, and construction standards',
      icon: '🏗️'
    },
    {
      id: 'planning',
      name: 'Planning Department', 
      description: 'Reviews site plans, development standards, and comprehensive plan compliance',
      icon: '🗺️'
    },
    {
      id: 'fire',
      name: 'Fire Department',
      description: 'Reviews fire safety, access, and code compliance',
      icon: '🚒'
    },
    {
      id: 'health',
      name: 'Health Department',
      description: 'Reviews health and safety compliance',
      icon: '🏥'
    },
    {
      id: 'engineering',
      name: 'Engineering Department',
      description: 'Reviews structural and civil engineering aspects',
      icon: '⚙️'
    },
    {
      id: 'zoning',
      name: 'Zoning Department',
      description: 'Reviews compliance with zoning regulations and land use requirements',
      icon: '📋'
    },
    {
      id: 'environmental',
      name: 'Environmental Department',
      description: 'Reviews environmental impact and compliance',
      icon: '🌿'
    },
    {
      id: 'finance',
      name: 'Finance Department',
      description: 'Reviews fees, bonds, and financial requirements',
      icon: '💰'
    }
  ];

  // Available building codes
  availableBuildingCodes = [
    {
      id: 'ibc-2021',
      name: 'International Building Code (IBC) 2021',
      description: 'Comprehensive model building code addressing safety, health and welfare of building occupants',
      category: 'building',
      icon: '🏗️'
    },
    {
      id: 'ibc-2018',
      name: 'International Building Code (IBC) 2018',
      description: 'Previous edition of the International Building Code',
      category: 'building',
      icon: '🏗️'
    },
    {
      id: 'irc-2021',
      name: 'International Residential Code (IRC) 2021',
      description: 'Comprehensive code addressing construction of one- and two-family dwellings',
      category: 'residential',
      icon: '🏠'
    },
    {
      id: 'irc-2018',
      name: 'International Residential Code (IRC) 2018',
      description: 'Previous edition of the International Residential Code',
      category: 'residential',
      icon: '🏠'
    },
    {
      id: 'nec-2020',
      name: 'National Electrical Code (NEC) 2020',
      description: 'Standard for the safe installation of electrical wiring and equipment',
      category: 'electrical',
      icon: '⚡'
    },
    {
      id: 'nec-2017',
      name: 'National Electrical Code (NEC) 2017',
      description: 'Previous edition of the National Electrical Code',
      category: 'electrical',
      icon: '⚡'
    },
    {
      id: 'ipc-2021',
      name: 'International Plumbing Code (IPC) 2021',
      description: 'Model code for plumbing systems installation and inspection',
      category: 'plumbing',
      icon: '🚰'
    },
    {
      id: 'imc-2021',
      name: 'International Mechanical Code (IMC) 2021',
      description: 'Model code for mechanical systems, HVAC, and ventilation',
      category: 'mechanical',
      icon: '🌡️'
    },
    {
      id: 'iecc-2021',
      name: 'International Energy Conservation Code (IECC) 2021',
      description: 'Model code for energy efficiency in buildings',
      category: 'energy',
      icon: '🔋'
    },
    {
      id: 'ife-2021',
      name: 'International Fire Code (IFC) 2021',
      description: 'Model code addressing fire prevention and protection',
      category: 'fire',
      icon: '🚒'
    },
    {
      id: 'local-building',
      name: 'Local Building Code Amendments',
      description: 'Municipality-specific amendments to model codes',
      category: 'local',
      icon: '📋'
    },
    {
      id: 'ada-2010',
      name: 'ADA Standards 2010',
      description: 'Americans with Disabilities Act accessibility standards',
      category: 'accessibility',
      icon: '♿'
    }
  ];

  // Available inspections
  availableInspections = [
    {
      type: 'foundation-certification',
      name: 'Foundation Certification',
      description: 'Certifies foundation meets engineering specifications',
      icon: '🏗️',
      estimatedDuration: 60
    },
    {
      type: 'footing-inspection',
      name: 'Footing Inspection',
      description: 'Inspects foundation footings before concrete pour',
      icon: '🧱',
      estimatedDuration: 45
    },
    {
      type: 'rebar-inspection',
      name: 'Rebar Inspection',
      description: 'Inspects reinforcement bar placement and specifications',
      icon: '🔗',
      estimatedDuration: 30
    },
    {
      type: 'electrical-inspection',
      name: 'Electrical Inspection',
      description: 'Inspects electrical systems and compliance with electrical code',
      icon: '⚡',
      estimatedDuration: 75
    },
    {
      type: 'framing-inspection',
      name: 'Framing Inspection',
      description: 'Inspects structural framing and load-bearing elements',
      icon: '🏠',
      estimatedDuration: 90
    },
    {
      type: 'plumbing-inspection',
      name: 'Plumbing Inspection',
      description: 'Inspects plumbing systems and compliance with plumbing code',
      icon: '🚰',
      estimatedDuration: 60
    },
    {
      type: 'mechanical-inspection',
      name: 'Mechanical Inspection',
      description: 'Inspects HVAC systems and mechanical equipment',
      icon: '🌡️',
      estimatedDuration: 60
    },
    {
      type: 'insulation-inspection',
      name: 'Insulation Inspection',
      description: 'Inspects insulation installation and energy efficiency',
      icon: '🧊',
      estimatedDuration: 45
    },
    {
      type: 'drywall-inspection',
      name: 'Drywall Inspection',
      description: 'Inspects drywall installation before finishing',
      icon: '🏠',
      estimatedDuration: 30
    },
    {
      type: 'final-inspection',
      name: 'Final Inspection',
      description: 'Comprehensive final inspection before certificate of occupancy',
      icon: '✅',
      estimatedDuration: 120
    },
    {
      type: 'fire-safety-inspection',
      name: 'Fire Safety Inspection',
      description: 'Inspects fire safety systems and egress requirements',
      icon: '🔥',
      estimatedDuration: 90
    },
    {
      type: 'accessibility-inspection',
      name: 'Accessibility Inspection',
      description: 'Inspects ADA compliance and accessibility features',
      icon: '♿',
      estimatedDuration: 60
    },
    {
      type: 'energy-efficiency-inspection',
      name: 'Energy Efficiency Inspection',
      description: 'Inspects energy efficiency and green building compliance',
      icon: '🌱',
      estimatedDuration: 75
    },
    {
      type: 'environmental-inspection',
      name: 'Environmental Inspection',
      description: 'Inspects environmental compliance and mitigation measures',
      icon: '🌿',
      estimatedDuration: 90
    }
  ];

  // Available file formats for custom documents
  availableFormats = [
    { id: 'pdf', name: 'PDF' },
    { id: 'doc', name: 'Word Document' },
    { id: 'docx', name: 'Word Document (New)' },
    { id: 'jpg', name: 'JPEG Image' },
    { id: 'jpeg', name: 'JPEG Image' },
    { id: 'png', name: 'PNG Image' },
    { id: 'gif', name: 'GIF Image' },
    { id: 'xls', name: 'Excel Spreadsheet' },
    { id: 'xlsx', name: 'Excel Spreadsheet (New)' },
    { id: 'dwg', name: 'AutoCAD Drawing' },
    { id: 'dxf', name: 'AutoCAD Exchange' }
  ];

  // Common document types
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
      id: 'structural-plans',
      name: 'Structural Plans',
      description: 'Structural engineering drawings and calculations',
      icon: '🏗️',
      allowedFormats: ['pdf', 'dwg', 'dxf'],
      maxSize: 25
    },
    {
      id: 'site-plan',
      name: 'Site Plan',
      description: 'Property survey and site layout plan',
      icon: '🗺️',
      allowedFormats: ['pdf', 'dwg', 'dxf'],
      maxSize: 15
    },
    {
      id: 'electrical-plans',
      name: 'Electrical Plans',
      description: 'Electrical system drawings and load calculations',
      icon: '⚡',
      allowedFormats: ['pdf', 'dwg', 'dxf'],
      maxSize: 20
    },
    {
      id: 'plumbing-plans',
      name: 'Plumbing Plans',
      description: 'Plumbing system layouts and specifications',
      icon: '🚰',
      allowedFormats: ['pdf', 'dwg', 'dxf'],
      maxSize: 20
    },
    {
      id: 'hvac-plans',
      name: 'HVAC Plans',
      description: 'Heating, ventilation, and air conditioning plans',
      icon: '🌡️',
      allowedFormats: ['pdf', 'dwg', 'dxf'],
      maxSize: 20
    },
    {
      id: 'energy-calculations',
      name: 'Energy Calculations',
      description: 'Energy efficiency calculations and compliance forms',
      icon: '🔋',
      allowedFormats: ['pdf', 'xls', 'xlsx'],
      maxSize: 10
    },
    {
      id: 'contractor-license',
      name: 'Contractor License',
      description: 'Valid contractor license and insurance certificate',
      icon: '📜',
      allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxSize: 5
    },
    {
      id: 'property-deed',
      name: 'Property Deed',
      description: 'Property ownership documentation',
      icon: '🏠',
      allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxSize: 5
    },
    {
      id: 'zoning-compliance',
      name: 'Zoning Compliance Letter',
      description: 'Letter confirming project meets zoning requirements',
      icon: '📋',
      allowedFormats: ['pdf'],
      maxSize: 5
    },
    {
      id: 'environmental-assessment',
      name: 'Environmental Assessment',
      description: 'Environmental impact study or assessment',
      icon: '🌿',
      allowedFormats: ['pdf', 'doc', 'docx'],
      maxSize: 15
    },
    {
      id: 'fire-safety-plan',
      name: 'Fire Safety Plan',
      description: 'Fire safety and egress plan',
      icon: '🔥',
      allowedFormats: ['pdf', 'dwg', 'dxf'],
      maxSize: 15
    },
    {
      id: 'accessibility-compliance',
      name: 'ADA Compliance Documentation',
      description: 'Americans with Disabilities Act compliance documentation',
      icon: '♿',
      allowedFormats: ['pdf', 'doc', 'docx'],
      maxSize: 10
    },
    {
      id: 'soil-report',
      name: 'Soil/Geotechnical Report',
      description: 'Soil conditions and geotechnical analysis report',
      icon: '🪨',
      allowedFormats: ['pdf', 'doc', 'docx'],
      maxSize: 20
    },
    {
      id: 'traffic-impact-study',
      name: 'Traffic Impact Study',
      description: 'Analysis of traffic impact from proposed development',
      icon: '🚦',
      allowedFormats: ['pdf', 'doc', 'docx'],
      maxSize: 15
    }
  ];

  // Predefined permit categories with default questions
  predefinedCategories = [
    {
      id: 'building',
      name: 'Building Permit',
      icon: '🏗️',
      description: 'New construction, additions, and structural modifications',
      examples: [
        'New Construction',
        'Additions',
        'Renovations',
        'Structural Changes',
      ],
      code: 'BP',
      defaultQuestions: [
        {
          id: 'project-type',
          type: 'select',
          label: 'Type of Construction',
          description: 'Select the primary type of construction work',
          isRequired: true,
          isIncluded: true,
          options: [
            'New Construction',
            'Addition',
            'Renovation',
            'Alteration',
            'Repair',
          ],
        },
        {
          id: 'square-footage',
          type: 'number',
          label: 'Total Square Footage',
          description: 'Enter the total square footage of the project',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'construction-value',
          type: 'number',
          label: 'Estimated Construction Value ($)',
          description:
            'Total estimated cost of construction including materials and labor',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'occupancy-type',
          type: 'select',
          label: 'Occupancy Classification',
          description: 'Select the intended use of the building',
          isRequired: true,
          isIncluded: true,
          options: [
            'Residential - Single Family',
            'Residential - Multi-Family',
            'Commercial',
            'Industrial',
            'Mixed Use',
          ],
        },
        {
          id: 'contractor-info',
          type: 'text',
          label: 'General Contractor',
          description: 'Name and license number of the general contractor',
          isRequired: false,
          isIncluded: true,
        },
        {
          id: 'architect-info',
          type: 'text',
          label: 'Architect/Engineer',
          description: 'Name and license number of the architect or engineer',
          isRequired: false,
          isIncluded: false,
        },
        {
          id: 'construction-drawings',
          type: 'file',
          label: 'Construction Plans',
          description: 'Upload architectural and engineering drawings',
          isRequired: true,
          isIncluded: true,
        },
      ],
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
          options: [
            'Residential R-1',
            'Residential R-2',
            'Commercial C-1',
            'Commercial C-2',
            'Industrial I-1',
            'Mixed Use',
          ],
        },
        {
          id: 'proposed-use',
          type: 'textarea',
          label: 'Proposed Use',
          description: 'Describe the intended use of the property',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'variance-required',
          type: 'radio',
          label: 'Is a variance required?',
          description: 'Indicate if you are requesting any zoning variances',
          isRequired: true,
          isIncluded: true,
          options: ['Yes', 'No'],
        },
        {
          id: 'setback-requirements',
          type: 'text',
          label: 'Setback Distances',
          description: 'Front, side, and rear setback measurements',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'parking-spaces',
          type: 'number',
          label: 'Number of Parking Spaces',
          description: 'Total parking spaces provided',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'site-plan',
          type: 'file',
          label: 'Site Plan',
          description:
            'Upload detailed site plan showing proposed improvements',
          isRequired: true,
          isIncluded: true,
        },
      ],
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
          options: [
            'New Service Installation',
            'Service Upgrade',
            'Panel Replacement',
            'Wiring Installation',
            'Outlet Installation',
            'Lighting Installation',
            'HVAC Electrical',
          ],
        },
        {
          id: 'service-amperage',
          type: 'select',
          label: 'Service Amperage',
          description: 'Select the electrical service amperage',
          isRequired: true,
          isIncluded: true,
          options: ['100 Amp', '150 Amp', '200 Amp', '400 Amp', 'Other'],
        },
        {
          id: 'electrician-license',
          type: 'text',
          label: 'Licensed Electrician',
          description: 'Name and license number of the electrician',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'electrical-load',
          type: 'number',
          label: 'Estimated Electrical Load (Watts)',
          description: 'Total estimated electrical load for the project',
          isRequired: false,
          isIncluded: false,
        },
        {
          id: 'electrical-drawings',
          type: 'file',
          label: 'Electrical Plans',
          description: 'Upload electrical drawings and load calculations',
          isRequired: true,
          isIncluded: true,
        },
      ],
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
          options: [
            'New Installation',
            'Repair',
            'Replacement',
            'Water Service',
            'Sewer Connection',
            'Gas Line',
            'Fixture Installation',
          ],
        },
        {
          id: 'fixture-count',
          type: 'number',
          label: 'Number of Fixtures',
          description: 'Total number of plumbing fixtures',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'plumber-license',
          type: 'text',
          label: 'Licensed Plumber',
          description: 'Name and license number of the plumber',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'water-pressure',
          type: 'text',
          label: 'Water Pressure (PSI)',
          description: 'Available water pressure at the property',
          isRequired: false,
          isIncluded: false,
        },
        {
          id: 'septic-connection',
          type: 'radio',
          label: 'Septic or Sewer Connection?',
          description: 'Select the type of waste water connection',
          isRequired: true,
          isIncluded: true,
          options: ['Municipal Sewer', 'Septic System', 'Other'],
        },
        {
          id: 'plumbing-drawings',
          type: 'file',
          label: 'Plumbing Plans',
          description: 'Upload plumbing drawings and specifications',
          isRequired: false,
          isIncluded: false,
        },
      ],
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
          options: [
            'Central Air Conditioning',
            'Heating System',
            'Ventilation',
            'Boiler',
            'Heat Pump',
            'Ductwork',
            'Exhaust Fans',
          ],
        },
        {
          id: 'btu-capacity',
          type: 'number',
          label: 'System Capacity (BTU)',
          description: 'Total BTU capacity of the mechanical system',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'hvac-contractor',
          type: 'text',
          label: 'HVAC Contractor',
          description: 'Name and license number of the HVAC contractor',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'energy-efficiency',
          type: 'text',
          label: 'Energy Efficiency Rating',
          description: 'SEER rating or efficiency specifications',
          isRequired: false,
          isIncluded: true,
        },
        {
          id: 'ductwork-modification',
          type: 'radio',
          label: 'Ductwork Modifications Required?',
          description: 'Will existing ductwork be modified or replaced?',
          isRequired: true,
          isIncluded: true,
          options: ['Yes', 'No', 'New Installation'],
        },
        {
          id: 'mechanical-drawings',
          type: 'file',
          label: 'Mechanical Plans',
          description: 'Upload HVAC drawings and specifications',
          isRequired: false,
          isIncluded: false,
        },
      ],
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
          options: [
            'Sign Permit',
            'Pool/Spa Permit',
            'Demolition Permit',
            'Temporary Structure',
            'Fence Permit',
            'Deck Permit',
            'Other',
          ],
        },
        {
          id: 'project-description',
          type: 'textarea',
          label: 'Project Description',
          description: 'Provide detailed description of the proposed work',
          isRequired: true,
          isIncluded: true,
        },
        {
          id: 'contractor-info',
          type: 'text',
          label: 'Contractor Information',
          description: 'Name and license number of the contractor',
          isRequired: false,
          isIncluded: true,
        },
        {
          id: 'compliance-standards',
          type: 'textarea',
          label: 'Applicable Standards',
          description: 'List any specific codes or standards that apply',
          isRequired: false,
          isIncluded: false,
        },
        {
          id: 'supporting-docs',
          type: 'file',
          label: 'Supporting Documentation',
          description:
            'Upload plans, specifications, or other required documents',
          isRequired: true,
          isIncluded: true,
        },
      ],
    },
  ];

  get suggestedCode() {
    if (this.isCustomCategory) {
      return this.customCategoryName
        ? this.customCategoryName.substring(0, 2).toUpperCase()
        : '';
    }
    return this.selectedCategory?.code || '';
  }

  @action
  selectCategory(category) {
    console.log('selectCategory called - selectedDepartments:', this.selectedDepartments);
    
    this.selectedCategory = category;
    this.isCustomCategory = false;
    this.permitName = category.name;
    this.permitCode = category.code;
    this.permitDescription = category.description;
    this.loadDefaultQuestions();
    
    console.log('selectCategory completed successfully');
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
      this.defaultQuestions = this.selectedCategory.defaultQuestions.map(
        (q) => ({ ...q }),
      );
    } else {
      this.defaultQuestions = [];
    }
  }

  @action
  toggleDepartment(departmentId) {
    try {
      if (!this || !departmentId) {
        console.error('toggleDepartment called with invalid parameters');
        return;
      }

      if (!this.selectedDepartments) {
        this.selectedDepartments = [];
      }

      const isCurrentlySelected = this.selectedDepartments.includes(departmentId);
      
      if (isCurrentlySelected) {
        console.log('Removing department:', departmentId);
        this.selectedDepartments = this.selectedDepartments.filter(id => id !== departmentId);
      } else {
        console.log('Adding department:', departmentId);
        this.selectedDepartments = [...this.selectedDepartments, departmentId];
      }
      
      console.log('New departments:', this.selectedDepartments);
    } catch (error) {
      console.error('Error in toggleDepartment:', error);
    }
  }

  @action
  setQuestionTab(tab) {
    this.activeQuestionTab = tab;
  }

  @action
  setDocumentTab(tab) {
    this.activeDocumentTab = tab;
  }

  @action
  toggleDocument(documentId) {
    if (this.selectedDocuments.includes(documentId)) {
      this.selectedDocuments = this.selectedDocuments.filter(id => id !== documentId);
      // Remove from requirements when deselected
      const requirements = { ...this.documentRequirements };
      delete requirements[documentId];
      this.documentRequirements = requirements;
    } else {
      this.selectedDocuments = [...this.selectedDocuments, documentId];
      // Default to required when first selected
      this.documentRequirements = {
        ...this.documentRequirements,
        [documentId]: true
      };
    }
  }

  @action
  toggleDocumentRequired(documentId) {
    this.documentRequirements = {
      ...this.documentRequirements,
      [documentId]: !this.documentRequirements[documentId]
    };
  }

  @action
  addCustomDocument() {
    const newDocument = {
      name: '',
      description: '',
      allowedFormats: ['pdf'],
      maxSize: 10,
      required: false
    };
    this.customDocuments = [...this.customDocuments, newDocument];
  }

  @action
  removeCustomDocument(index) {
    this.customDocuments = this.customDocuments.filter((_, i) => i !== index);
  }

  @action
  updateCustomDocumentName(index, event) {
    const documents = [...this.customDocuments];
    documents[index].name = event.target.value;
    this.customDocuments = documents;
  }

  @action
  updateCustomDocumentDescription(index, event) {
    const documents = [...this.customDocuments];
    documents[index].description = event.target.value;
    this.customDocuments = documents;
  }

  @action
  updateCustomDocumentMaxSize(index, event) {
    const documents = [...this.customDocuments];
    documents[index].maxSize = parseInt(event.target.value) || 10;
    this.customDocuments = documents;
  }

  @action
  toggleCustomDocumentRequired(index) {
    const documents = [...this.customDocuments];
    documents[index].required = !documents[index].required;
    this.customDocuments = documents;
  }

  @action
  toggleCustomDocumentFormat(index, formatId) {
    const documents = [...this.customDocuments];
    const document = documents[index];
    
    if (document.allowedFormats.includes(formatId)) {
      // Don't allow removing the last format
      if (document.allowedFormats.length > 1) {
        document.allowedFormats = document.allowedFormats.filter(f => f !== formatId);
      }
    } else {
      document.allowedFormats = [...document.allowedFormats, formatId];
    }
    
    this.customDocuments = documents;
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
  toggleInspection(inspectionType) {
    if (this.selectedInspections.includes(inspectionType)) {
      this.selectedInspections = this.selectedInspections.filter(type => type !== inspectionType);
    } else {
      this.selectedInspections = [...this.selectedInspections, inspectionType];
    }
  }

  // Helper method to check if inspection is selected
  @action
  isInspectionSelected(inspectionType) {
    return this.selectedInspections && this.selectedInspections.includes(inspectionType);
  }

  // Helper method to get inspection name by type
  @action
  getInspectionName(inspectionType) {
    const inspection = this.availableInspections.find(insp => insp.type === inspectionType);
    return inspection ? inspection.name : inspectionType;
  }

  // Helper method to check if building code is selected
  @action
  isBuildingCodeSelected(codeId) {
    return this.selectedBuildingCodes.includes(codeId);
  }

  // Helper method to format file size
  @action
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  @action
  resetForm() {
    // Reset all form state
    this.selectedCategory = null;
    this.isCustomCategory = false;
    this.customCategoryName = '';
    this.customCategoryDescription = '';
    
    this.permitName = '';
    this.permitCode = '';
    this.baseFee = '';
    this.processingTime = 14;
    this.permitDescription = '';
    this.requiresInspection = true;
    
    // Reset building codes and energy requirements
    this.selectedBuildingCodes = [];
    this.requiresResidentialEnergyCode = false;
    this.uploadedDocuments = [];

    // Reset document requirements
    this.activeDocumentTab = 'predefined';
    this.selectedDocuments = [];
    this.documentRequirements = {};
    this.customDocuments = [];

    // Explicitly reset arrays
    this.selectedDepartments = [];
    this.selectedInspections = [];
    
    this.activeQuestionTab = 'default';
    this.defaultQuestions = [];
    this.customQuestions = [];

    this.isSubmitting = false;
    this.errorMessage = '';
    
    console.log('Form reset completed');
  }

  @action
  toggleBuildingCode(codeId) {
    if (this.selectedBuildingCodes.includes(codeId)) {
      this.selectedBuildingCodes = this.selectedBuildingCodes.filter(id => id !== codeId);
    } else {
      this.selectedBuildingCodes = [...this.selectedBuildingCodes, codeId];
    }
  }

  @action
  toggleResidentialEnergyCode() {
    this.requiresResidentialEnergyCode = !this.requiresResidentialEnergyCode;
  }

  @action
  async handleDocumentUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Basic file validation
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (!allowedTypes.includes(file.type)) {
        alert(`File ${file.name} is not a supported format. Please upload PDF, Word, or Excel files only.`);
        continue;
      }

      // Create document object
      const document = {
        id: Date.now() + Math.random(), // Simple ID generation
        name: file.name,
        size: file.size,
        type: file.type,
        file: file, // Store the actual file object
        uploadedAt: new Date().toISOString()
      };

      this.uploadedDocuments = [...this.uploadedDocuments, document];
    }

    // Clear the input
    event.target.value = '';
  }

  @action
  removeDocument(documentId) {
    this.uploadedDocuments = this.uploadedDocuments.filter(doc => doc.id !== documentId);
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

    // Debug: Check state before processing
    console.log('CreatePermitType called with state:', {
      selectedDepartments: this.selectedDepartments,
      selectedInspections: this.selectedInspections,
      selectedDepartmentsType: typeof this.selectedDepartments,
      selectedInspectionsType: typeof this.selectedInspections
    });

    try {
      // Prepare permit type data
      const permitTypeData = {
        name: this.permitName,
        code: this.permitCode,
        description: this.permitDescription,
        category: this.isCustomCategory ? 'custom' : this.selectedCategory.id,
        customCategory: this.isCustomCategory
          ? {
              name: this.customCategoryName,
              description: this.customCategoryDescription,
            }
          : null,
        baseFee: parseFloat(this.baseFee) || 0,
        processingTime: parseInt(this.processingTime) || 14,
        requiresInspection: this.requiresInspection,
        
        // Building codes and energy requirements
        selectedBuildingCodes: this.selectedBuildingCodes || [],
        requiresResidentialEnergyCode: this.requiresResidentialEnergyCode,
        documentTemplates: (this.uploadedDocuments || []).map(doc => ({
          name: doc.name,
          size: doc.size,
          type: doc.type,
          uploadedAt: doc.uploadedAt
        })),
        
        requiredDepartments: this.selectedDepartments || [],
        requiredInspections: (this.selectedInspections || []).map(inspectionType => {
          const inspection = this.availableInspections.find(insp => insp.type === inspectionType);
          return {
            type: inspectionType,
            name: inspection?.name || inspectionType,
            description: inspection?.description || '',
            estimatedDuration: inspection?.estimatedDuration || 60,
            required: true
          };
        }),
        formFields: this.buildFormFields(),
        requiredDocuments: this.buildRequiredDocuments(),
        isActive: true,
      };

      console.log('Sending permit type data:', {
        name: permitTypeData.name,
        requiredDepartments: permitTypeData.requiredDepartments,
        requiredInspections: permitTypeData.requiredInspections,
        selectedDepartments: this.selectedDepartments,
        selectedInspections: this.selectedInspections
      });

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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(permitTypeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create permit type');
      }

      // Success - redirect to permit types list
      this.router.transitionTo('municipal.permit-types.index');
    } catch (error) {
      console.error('Error creating permit type:', error);
      this.errorMessage =
        error.message || 'An error occurred while creating the permit type';
    } finally {
      this.isSubmitting = false;
    }
  }

  // Helper method to check if question type needs options
  @action
  questionTypeNeedsOptions(questionType) {
    return ['select', 'radio', 'checkbox'].includes(questionType);
  }

  // Helper method to check if department is selected  
  @action
  isDepartmentSelected(departmentId) {
    return this.selectedDepartments && this.selectedDepartments.includes(departmentId);
  }

  // Helper method to check if document is selected
  @action
  isDocumentSelected(documentId) {
    return this.selectedDocuments.includes(documentId);
  }

  // Helper method to check if document is required
  @action
  isDocumentRequired(documentId) {
    return this.documentRequirements[documentId] === true;
  }

  // Helper method to get document by ID
  @action
  getDocumentById(documentId) {
    return this.commonDocuments.find(doc => doc.id === documentId);
  }

  buildFormFields() {
    const fields = [];

    // Add included default questions
    const includedDefaults = this.defaultQuestions.filter((q) => q.isIncluded);
    fields.push(
      ...includedDefaults.map((q) => ({
        id: q.id,
        type: q.type,
        label: q.label,
        description: q.description,
        isRequired: q.isRequired,
        options: q.options || [],
        isDefault: true,
      })),
    );

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
          isDefault: false,
        });
      }
    });

    return fields;
  }

  buildRequiredDocuments() {
    const documents = [];

    // Add selected common documents
    this.selectedDocuments.forEach(docId => {
      const commonDoc = this.commonDocuments.find(doc => doc.id === docId);
      if (commonDoc) {
        documents.push({
          name: commonDoc.name,
          description: commonDoc.description,
          required: this.documentRequirements[docId] === true,
          allowedFormats: commonDoc.allowedFormats,
          maxSize: commonDoc.maxSize
        });
      }
    });

    // Add custom documents
    this.customDocuments.forEach(doc => {
      if (doc.name.trim()) {
        documents.push({
          name: doc.name,
          description: doc.description,
          required: doc.required,
          allowedFormats: doc.allowedFormats,
          maxSize: doc.maxSize
        });
      }
    });

    return documents;
  }
}
