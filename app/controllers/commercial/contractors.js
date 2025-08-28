import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialContractorsController extends Controller {
  @service router;
  
  @tracked selectedMunicipality = null;
  @tracked municipalityFilter = 'all';
  @tracked contractors = [];
  @tracked isLoading = false;
  @tracked searchTerm = '';
  @tracked sortBy = 'recentActivity';
  @tracked selectedContractor = null;
  @tracked showContractorModal = false;
  @tracked error = null;

  get municipalities() {
    return this.model?.municipalities || [];
  }

  get filteredMunicipalities() {
    const municipalities = this.municipalities;
    const searchTerm = this.searchTerm.toLowerCase().trim();
    
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

  get sortedContractors() {
    return this.contractors.slice().sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.businessName.localeCompare(b.businessName);
        case 'totalProjects':
          return b.totalProjects - a.totalProjects;
        case 'completionRate':
          return b.completionRate - a.completionRate;
        case 'totalValue':
          return b.totalProjectValue - a.totalProjectValue;
        case 'recentActivity':
        default:
          return new Date(b.lastPermitDate) - new Date(a.lastPermitDate);
      }
    });
  }

  @action
  async selectMunicipality(municipality) {
    this.selectedMunicipality = municipality;
    this.municipalityFilter = municipality ? municipality.id : 'all';
    await this.loadContractors();
  }

  @action
  setSortBy(event) {
    this.sortBy = event.target.value;
    this.loadContractors();
  }

  @action
  async setMunicipalityFilter(event) {
    this.municipalityFilter = event.target.value;
    this.selectedMunicipality = event.target.value === 'all' ? null : 
      this.municipalities.find(m => m.id === event.target.value);
    await this.loadContractors();
  }

  @action
  updateSearch(event) {
    this.searchTerm = event.target.value;
    // Debounce search after user stops typing
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadContractors();
    }, 500);
  }

  @action
  async showContractorDetails(contractor) {
    this.selectedContractor = contractor;
    this.showContractorModal = true;
    
    // Load detailed contractor information
    await this.loadContractorDetails(contractor.businessName);
  }

  @action
  closeContractorModal() {
    this.showContractorModal = false;
    this.selectedContractor = null;
  }

  async loadContractors() {
    this.isLoading = true;
    this.error = null;

    try {
      const authToken = localStorage.getItem('auth_token');
      const params = new URLSearchParams({
        sortBy: this.sortBy,
        search: this.searchTerm,
        municipalityFilter: this.municipalityFilter
      });
      
      const response = await fetch(`${config.APP.API_HOST}/api/contractor-lookup/all?${params}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.contractors = data.contractors || [];
        console.log(`Loaded ${this.contractors.length} contractors`);
      } else {
        console.error('Failed to load contractors:', response.status);
        this.error = 'Failed to load contractors';
      }
    } catch (error) {
      console.error('Error loading contractors:', error);
      this.error = 'Error loading contractors';
    } finally {
      this.isLoading = false;
    }
  }

  async loadContractorDetails(businessName) {
    if (!businessName) return;

    try {
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`${config.APP.API_HOST}/api/contractor-lookup/contractor/${encodeURIComponent(businessName)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.selectedContractor = {
          ...this.selectedContractor,
          detailedInfo: data
        };
      }
    } catch (error) {
      console.error('Error loading contractor details:', error);
    }
  }

  @action
  refresh() {
    this.loadContractors();
  }

  @action
  stopPropagation(event) {
    event.stopPropagation();
  }

  constructor() {
    super(...arguments);
    // Load all contractors on initialization
    setTimeout(() => this.loadContractors(), 100);
  }
}