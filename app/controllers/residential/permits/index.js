import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

export default class ResidentialPermitsIndexController extends Controller {
  @service router;

  // Search and filter state
  @tracked searchTerm = '';
  @tracked selectedStatus = 'all';
  @tracked selectedType = 'all';
  @tracked sortBy = 'submittedDate';
  @tracked sortOrder = 'desc';
  @tracked dateFrom = '';
  @tracked dateTo = '';

  get permitTypes() {
    const types = new Set();
    if (this.model?.permits?.all) {
      this.model.permits.all.forEach(permit => {
        if (permit.type) types.add(permit.type);
      });
    }
    return Array.from(types).sort();
  }

  get statusOptions() {
    return [
      { value: 'all', label: 'All Status' },
      { value: 'pending', label: 'Pending Review' },
      { value: 'approved', label: 'Approved' },
      { value: 'active', label: 'Active/Inspections' },
      { value: 'completed', label: 'Completed' },
      { value: 'denied', label: 'Denied' },
      { value: 'expired', label: 'Expired' }
    ];
  }

  get sortOptions() {
    return [
      { value: 'submittedDate', label: 'Date Submitted' },
      { value: 'approvedDate', label: 'Date Approved' },
      { value: 'permitNumber', label: 'Permit Number' },
      { value: 'type', label: 'Permit Type' },
      { value: 'status', label: 'Status' }
    ];
  }

  get filteredPermits() {
    if (!this.model?.permits?.all) {
      return [];
    }
    let permits = [...this.model.permits.all];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      permits = permits.filter(permit => 
        permit.permitNumber?.toLowerCase().includes(searchLower) ||
        permit.type?.toLowerCase().includes(searchLower) ||
        permit.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (this.selectedStatus !== 'all') {
      if (this.selectedStatus === 'active') {
        permits = permits.filter(p => ['active', 'inspections'].includes(p.status));
      } else if (this.selectedStatus === 'pending') {
        permits = permits.filter(p => ['pending', 'submitted', 'under-review'].includes(p.status));
      } else {
        permits = permits.filter(p => p.status === this.selectedStatus);
      }
    }

    // Apply type filter
    if (this.selectedType !== 'all') {
      permits = permits.filter(p => p.type === this.selectedType);
    }

    // Apply date range filter
    if (this.dateFrom) {
      const fromDate = new Date(this.dateFrom);
      permits = permits.filter(p => {
        const permitDate = new Date(p.submittedDate);
        return permitDate >= fromDate;
      });
    }

    if (this.dateTo) {
      const toDate = new Date(this.dateTo + 'T23:59:59'); // End of day
      permits = permits.filter(p => {
        const permitDate = new Date(p.submittedDate);
        return permitDate <= toDate;
      });
    }

    // Apply sorting
    permits.sort((a, b) => {
      let aValue = a[this.sortBy];
      let bValue = b[this.sortBy];

      // Handle date fields
      if (this.sortBy.includes('Date')) {
        aValue = aValue ? new Date(aValue) : new Date(0);
        bValue = bValue ? new Date(bValue) : new Date(0);
      }

      // Handle string comparisons
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Handle null/undefined values
      if (!aValue && !bValue) return 0;
      if (!aValue) return this.sortOrder === 'desc' ? 1 : -1;
      if (!bValue) return this.sortOrder === 'desc' ? -1 : 1;

      let result;
      if (aValue < bValue) result = -1;
      else if (aValue > bValue) result = 1;
      else result = 0;

      return this.sortOrder === 'desc' ? -result : result;
    });

    return permits;
  }

  get permitCount() {
    return this.filteredPermits?.length || 0;
  }

  @action
  updateSearch(event) {
    this.searchTerm = event.target.value;
  }

  @action
  updateStatusFilter(event) {
    this.selectedStatus = event.target.value;
  }

  @action
  updateTypeFilter(event) {
    this.selectedType = event.target.value;
  }

  @action
  updateSort(event) {
    this.sortBy = event.target.value;
  }

  @action
  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
  }

  @action
  updateDateFrom(event) {
    this.dateFrom = event.target.value;
  }

  @action
  updateDateTo(event) {
    this.dateTo = event.target.value;
  }

  @action
  clearFilters() {
    this.searchTerm = '';
    this.selectedStatus = 'all';
    this.selectedType = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    this.sortBy = 'submittedDate';
    this.sortOrder = 'desc';
  }

  @action
  applyForPermit() {
    this.router.transitionTo('residential.permits.new');
  }

  @action
  viewPermit(permitId) {
    // Navigate to the permit detail view
    this.router.transitionTo('residential.permits.view', permitId);
  }
}
