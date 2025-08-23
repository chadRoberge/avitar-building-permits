import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class HomeController extends Controller {
  @service router;

  @tracked searchTerm = '';
  @tracked isSearching = false;
  @tracked showAddForm = false;
  @tracked filteredMunicipalities = null;
  @tracked popularMunicipalities = [];
  @tracked allMunicipalities = [];
  @tracked isLoading = true;
  @tracked errorMessage = '';

  constructor() {
    super(...arguments);
    this.loadMunicipalities();
  }

  async loadMunicipalities() {
    try {
      this.isLoading = true;
      this.errorMessage = '';

      const response = await fetch(
        `${config.APP.API_HOST}/api/municipalities?state=NH&limit=50`,
      );

      if (!response.ok) {
        throw new Error(`Failed to load municipalities: ${response.status}`);
      }

      const municipalities = await response.json();
      console.log('Loaded municipalities:', municipalities);

      this.allMunicipalities = municipalities.map((municipality) => ({
        id: municipality._id,
        name: municipality.name,
        city: municipality.address.city,
        state: municipality.address.state,
        zip: municipality.address.zip,
        type: municipality.type,
        population: municipality.population,
        portalUrl: municipality.portalUrl,
        fullMunicipality: municipality, // Store full object for navigation
      }));

      // Set popular municipalities as the first 4 with highest population or most recent
      this.popularMunicipalities = this.allMunicipalities
        .sort((a, b) => (b.population || 0) - (a.population || 0))
        .slice(0, 4);

      console.log('Popular municipalities:', this.popularMunicipalities);
    } catch (error) {
      console.error('Error loading municipalities:', error);
      this.errorMessage =
        'Failed to load municipalities. Please try again later.';

      // Fallback to show registration option
      this.popularMunicipalities = [];
      this.allMunicipalities = [];
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async updateSearchTerm(event) {
    this.searchTerm = event.target.value;
    this.showAddForm = false;

    if (this.searchTerm.length > 2) {
      this.isSearching = true;

      try {
        // Search via API for real-time results
        const response = await fetch(
          `${config.APP.API_HOST}/api/municipalities?search=${encodeURIComponent(this.searchTerm)}&state=NH&limit=20`,
        );

        if (response.ok) {
          const searchResults = await response.json();
          this.filteredMunicipalities = searchResults.map((municipality) => ({
            id: municipality._id,
            name: municipality.name,
            city: municipality.address.city,
            state: municipality.address.state,
            zip: municipality.address.zip,
            type: municipality.type,
            population: municipality.population,
            portalUrl: municipality.portalUrl,
            fullMunicipality: municipality,
          }));
        } else {
          // Fallback to local search if API fails
          this.filteredMunicipalities = this.allMunicipalities.filter(
            (municipality) =>
              municipality.name
                .toLowerCase()
                .includes(this.searchTerm.toLowerCase()) ||
              municipality.city
                .toLowerCase()
                .includes(this.searchTerm.toLowerCase()) ||
              municipality.zip.includes(this.searchTerm),
          );
        }
      } catch (error) {
        console.error('Search error:', error);
        // Fallback to local search
        this.filteredMunicipalities = this.allMunicipalities.filter(
          (municipality) =>
            municipality.name
              .toLowerCase()
              .includes(this.searchTerm.toLowerCase()) ||
            municipality.city
              .toLowerCase()
              .includes(this.searchTerm.toLowerCase()) ||
            municipality.zip.includes(this.searchTerm),
        );
      } finally {
        this.isSearching = false;
      }
    } else {
      this.filteredMunicipalities = null;
    }
  }

  @action
  selectMunicipality(municipality) {
    // Always use the municipality ID for the route parameter, not the portalUrl
    const identifier = municipality.id;
    console.log(
      'Navigating to municipality:',
      municipality.name,
      'with ID:',
      identifier,
      'portalUrl:',
      municipality.portalUrl,
    );
    this.router.transitionTo('municipal-portal', identifier);
  }

  @action
  showAddMunicipality() {
    this.showAddForm = true;
  }

  @action
  showMunicipalityRegistration() {
    // This would navigate to a municipality registration form
    this.router.transitionTo('register-municipality');
  }

  @action
  showAdminLogin() {
    // Navigate to system admin login page
    this.router.transitionTo('system-admin.login');
  }
}
