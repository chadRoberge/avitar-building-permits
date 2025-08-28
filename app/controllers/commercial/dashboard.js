import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialDashboardController extends Controller {
  @service router;
  
  @tracked municipalitySearchTerm = '';
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
  @tracked isLoadingPermits = false;
  @tracked municipalityPermits = [];
  @tracked municipalityStats = {
    totalPermits: 0,
    totalPermitCosts: 0,
    totalProjectValue: 0,
    pendingProjectValue: 0,
    pendingPermitCosts: 0,
    activeProjects: 0,
    pendingPermits: 0,
    approvedPermits: 0,
    completedPermits: 0,
    avgProcessingTime: 0
  };
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
        municipality.state.toLowerCase().includes(searchTerm) ||
        municipality.county?.toLowerCase().includes(searchTerm)
      );
    });
  }

  @action
  updateMunicipalitySearch(event) {
    this.municipalitySearchTerm = event.target.value;
  }

  @action
  async selectMunicipality(municipality) {
    // Delegate to parent controller
    this.target.selectMunicipality(municipality);
    
    // Load permits for this municipality
    await this.loadPermitsForMunicipality(municipality);
  }

  @action
  clearMunicipalitySelection() {
    // Delegate to parent controller
    this.target.clearMunicipality();
    this.resetMunicipalityStats();
  }

  @action
  refresh() {
    window.location.reload();
  }

  async loadPermitsForMunicipality(municipality) {
    this.isLoadingPermits = true;
    
    try {
      const authToken = localStorage.getItem('auth_token');
      
      if (!authToken) {
        this.router.transitionTo('home');
        return;
      }

      const municipalityId = municipality.id || municipality._id;
      console.log('Loading permits for municipality ID:', municipalityId);
      
      const response = await fetch(`${config.APP.API_HOST}/api/permits?municipality=${municipalityId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const permits = await response.json();
        
        // Update permits
        this.municipalityPermits = permits.slice(0, 5); // Show latest 5 permits
        
        // Calculate comprehensive stats
        const totalPermitCosts = permits.reduce((sum, p) => sum + (p.fee || 0), 0);
        const totalProjectValue = permits.reduce((sum, p) => sum + (p.projectValue || 0), 0);
        const pendingPermits = permits.filter(p => ['submitted', 'under-review'].includes(p.status));
        const approvedPermits = permits.filter(p => p.status === 'approved');
        const completedPermits = permits.filter(p => p.status === 'completed');
        const activeProjects = permits.filter(p => ['active', 'inspections'].includes(p.status));
        
        // Calculate pending stats
        const pendingProjectValue = pendingPermits.reduce((sum, p) => sum + (p.projectValue || 0), 0);
        const pendingPermitCosts = pendingPermits.reduce((sum, p) => sum + (p.fee || 0), 0);
        
        // Calculate average processing time (mock for now)
        const avgProcessingTime = permits.length > 0 ? Math.round(Math.random() * 10 + 15) : 0;
        
        this.municipalityStats = {
          totalPermits: permits.length,
          totalPermitCosts: totalPermitCosts,
          totalProjectValue: totalProjectValue,
          pendingProjectValue: pendingProjectValue,
          pendingPermitCosts: pendingPermitCosts,
          activeProjects: activeProjects.length,
          pendingPermits: pendingPermits.length,
          approvedPermits: approvedPermits.length,
          completedPermits: completedPermits.length,
          avgProcessingTime: avgProcessingTime
        };
      } else {
        console.error('Failed to load permits:', response.status);
        this.resetMunicipalityStats();
      }
    } catch (error) {
      console.error('Error loading permits:', error);
      this.resetMunicipalityStats();
    } finally {
      this.isLoadingPermits = false;
    }
  }

  resetMunicipalityStats() {
    this.municipalityPermits = [];
    this.municipalityStats = {
      totalPermits: 0,
      totalPermitCosts: 0,
      totalProjectValue: 0,
      pendingProjectValue: 0,
      pendingPermitCosts: 0,
      activeProjects: 0,
      pendingPermits: 0,
      approvedPermits: 0,
      completedPermits: 0,
      avgProcessingTime: 0
    };
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

  @action
  async onPermitSubmitSuccess(result) {
    console.log('Permit submitted successfully:', result);
    
    // Close the modal
    this.showApplyPermitModal = false;
    
    // Refresh the permits for the current municipality
    if (this.selectedMunicipality) {
      await this.loadPermitsForMunicipality(this.selectedMunicipality);
    }
  }

  @action
  onModelLoaded() {
    // Initialize tracked municipality from available sources
    this.initializeMunicipality();
    
    const municipality = this.selectedMunicipality;
    if (municipality) {
      this.loadPermitsForMunicipality(municipality);
      return;
    }
    
    // If no municipality and municipalities are available, 
    // the parent controller should handle auto-selection
    if (!municipality && this.model?.municipalities?.length > 0) {
      // Give parent controller time to auto-select municipality
      setTimeout(() => {
        this.initializeMunicipality();
        const updatedMunicipality = this.selectedMunicipality;
        if (updatedMunicipality) {
          this.loadPermitsForMunicipality(updatedMunicipality);
        }
      }, 300);
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
    municipalityChanged(municipality) {
      // Handle municipality change from parent controller
      this._selectedMunicipality = municipality;
      if (municipality) {
        this.loadPermitsForMunicipality(municipality);
      } else {
        this.resetMunicipalityStats();
      }
    }
  }
}