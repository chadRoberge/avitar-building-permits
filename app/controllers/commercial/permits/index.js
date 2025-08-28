import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialPermitsIndexController extends Controller {
  @service router;
  
  @tracked municipalitySearchTerm = '';
  @tracked permitSearchTerm = '';
  @tracked _selectedMunicipality = null;

  get selectedMunicipality() {
    // First check if we have our own tracked municipality
    if (this._selectedMunicipality) {
      return this._selectedMunicipality;
    }
    
    // Otherwise try to get from parent commercial controller
    const parentController = this.target;
    if (parentController?.selectedMunicipality) {
      return parentController.selectedMunicipality;
    }
    
    // Fallback to checking session storage
    const savedMunicipality = sessionStorage.getItem('selected_municipality');
    if (savedMunicipality) {
      try {
        const parsed = JSON.parse(savedMunicipality);
        return parsed;
      } catch (error) {
        console.error('Error parsing saved municipality:', error);
        sessionStorage.removeItem('selected_municipality');
      }
    }
    
    return null;
  }
  @tracked activeFilter = 'all';
  @tracked permits = [];
  @tracked isLoading = false;
  @tracked municipalityPermitCounts = {};
  @tracked showApplyPermitModal = false;

  get filteredMunicipalities() {
    const municipalities = this.model.municipalities || [];
    const searchTerm = this.municipalitySearchTerm.toLowerCase().trim();
    
    if (!searchTerm) {
      return municipalities;
    }
    
    return municipalities.filter(municipality => {
      return (
        municipality.name.toLowerCase().includes(searchTerm) ||
        municipality.city.toLowerCase().includes(searchTerm) ||
        municipality.state.toLowerCase().includes(searchTerm)
      );
    });
  }

  get totalPermits() {
    return this.permits.length;
  }

  get pendingPermits() {
    return this.permits.filter(permit => 
      ['submitted', 'under-review'].includes(permit.status)
    );
  }

  get activePermits() {
    return this.permits.filter(permit => 
      ['approved', 'active', 'inspections'].includes(permit.status)
    );
  }

  get completedPermits() {
    return this.permits.filter(permit => 
      permit.status === 'completed'
    );
  }

  get filteredByStatus() {
    switch (this.activeFilter) {
      case 'pending':
        return this.pendingPermits;
      case 'active':
        return this.activePermits;
      case 'completed':
        return this.completedPermits;
      case 'all':
      default:
        return this.permits;
    }
  }

  get filteredPermits() {
    let permits = this.filteredByStatus;
    
    if (this.permitSearchTerm.trim()) {
      const searchTerm = this.permitSearchTerm.toLowerCase().trim();
      permits = permits.filter(permit => {
        return (
          permit.type?.toLowerCase().includes(searchTerm) ||
          permit.permitNumber?.toLowerCase().includes(searchTerm) ||
          permit.projectDescription?.toLowerCase().includes(searchTerm) ||
          permit.projectAddress?.street?.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    return permits;
  }

  @action
  updateMunicipalitySearch(event) {
    this.municipalitySearchTerm = event.target.value;
  }

  @action
  updatePermitSearch(event) {
    this.permitSearchTerm = event.target.value;
  }

  @action
  setFilter(filter) {
    this.activeFilter = filter;
  }

  @action
  async selectMunicipality(municipality) {
    // Delegate to parent controller for municipality management
    const parentController = this.target;
    if (parentController?.selectMunicipality) {
      parentController.selectMunicipality(municipality);
    } else {
      // Fallback if no parent controller
      this._selectedMunicipality = municipality;
      sessionStorage.setItem('selected_municipality', JSON.stringify(municipality));
    }
    
    // Load permits for this municipality
    await this.loadPermitsForMunicipality(municipality);
  }

  @action
  clearMunicipalitySelection() {
    // Delegate to parent controller for municipality management
    const parentController = this.target;
    if (parentController?.clearMunicipality) {
      parentController.clearMunicipality();
    } else {
      // Fallback if no parent controller
      this._selectedMunicipality = null;
      sessionStorage.removeItem('selected_municipality');
    }
    
    this.permits = [];
    this.activeFilter = 'all';
    this.permitSearchTerm = '';
  }

  @action
  refresh() {
    if (this.selectedMunicipality) {
      this.loadPermitsForMunicipality(this.selectedMunicipality);
    } else {
      window.location.reload();
    }
  }

  @action
  newPermitApplication() {
    if (this.selectedMunicipality) {
      this.showApplyPermitModal = true;
    } else {
      // If no municipality selected, show alert
      alert('Please select a municipality first to apply for a permit.');
    }
  }

  @action
  closeApplyPermitModal() {
    this.showApplyPermitModal = false;
  }

  @action
  viewPermit(permitId) {
    this.router.transitionTo('commercial.permits.view', permitId);
  }

  async loadPermitsForMunicipality(municipality) {
    this.isLoading = true;
    
    try {
      const authToken = localStorage.getItem('auth_token');
      
      if (!authToken) {
        this.router.transitionTo('home');
        return;
      }

      const response = await fetch(`${config.APP.API_HOST}/api/permits?municipality=${municipality.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const permits = await response.json();
        this.permits = permits;
        console.log(`Loaded ${permits.length} permits for ${municipality.name}`);
      } else {
        console.error('Failed to load permits:', response.status);
        this.permits = [];
      }
    } catch (error) {
      console.error('Error loading permits:', error);
      this.permits = [];
    } finally {
      this.isLoading = false;
    }
  }

  async loadMunicipalityPermitCounts() {
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) return;

    // Load permit counts for each municipality to show in the selection
    const municipalities = this.model.municipalities || [];
    
    for (const municipality of municipalities) {
      try {
        // Use the existing permits endpoint to get count
        const response = await fetch(`${config.APP.API_HOST}/api/permits?municipality=${municipality.id}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const permits = await response.json();
          this.municipalityPermitCounts = {
            ...this.municipalityPermitCounts,
            [municipality.id]: permits.length
          };
        }
      } catch (error) {
        console.error(`Error loading permit count for ${municipality.name}:`, error);
      }
    }
  }

  initializeMunicipality() {
    // Don't initialize if already set
    if (this._selectedMunicipality) {
      return;
    }

    // Try to get from parent controller first
    const parentController = this.target;
    if (parentController?.selectedMunicipality) {
      this._selectedMunicipality = parentController.selectedMunicipality;
      return;
    }

    // Fallback to session storage
    const savedMunicipality = sessionStorage.getItem('selected_municipality');
    if (savedMunicipality) {
      try {
        const parsed = JSON.parse(savedMunicipality);
        this._selectedMunicipality = parsed;
      } catch (error) {
        console.error('Error parsing saved municipality:', error);
        sessionStorage.removeItem('selected_municipality');
      }
    }
  }

  actions = {
    // Called after model is loaded
    onModelLoaded() {
      // Initialize tracked municipality from available sources
      this.initializeMunicipality();
      
      const municipality = this.selectedMunicipality;
      if (municipality) {
        this.loadPermitsForMunicipality(municipality);
      }
      
      // Load permit counts for municipality cards
      this.loadMunicipalityPermitCounts();
    },

    // Handle municipality change from parent controller
    municipalityChanged(municipality) {
      this._selectedMunicipality = municipality;
      if (municipality) {
        this.loadPermitsForMunicipality(municipality);
      } else {
        this.clearMunicipalitySelection();
      }
    }
  }
}