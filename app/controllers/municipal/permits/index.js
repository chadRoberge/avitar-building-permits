import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MunicipalPermitsIndexController extends Controller {
  @service router;

  @tracked searchTerm = '';
  @tracked selectedStatus = '';
  @tracked selectedType = '';
  @tracked selectedDateRange = '';
  @tracked startDate = '';
  @tracked endDate = '';
  @tracked sortField = 'applicationDate';
  @tracked sortAsc = false;
  @tracked currentPage = 1;
  @tracked isLoading = false;

  pageSize = 25;

  get filteredPermits() {
    // We'll let the template handle the filtering through the model data
    return [];
  }

  get displayedPermits() {
    // Template will use @model data directly
    return [];
  }

  get paginatedPermits() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredPermits.slice(startIndex, startIndex + this.pageSize);
  }

  get totalPages() {
    return Math.ceil(this.filteredPermits.length / this.pageSize);
  }

  get showPagination() {
    return this.totalPages > 1;
  }

  get isFirstPage() {
    return this.currentPage === 1;
  }

  get isLastPage() {
    return this.currentPage === this.totalPages;
  }

  get startIndex() {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endIndex() {
    return Math.min(this.currentPage * this.pageSize, this.filteredPermits.length);
  }

  get pageNumbers() {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  get hasActiveFilters() {
    return !!(this.searchTerm || this.selectedStatus || this.selectedType || this.selectedDateRange);
  }

  @action
  updateSearchTerm(event) {
    this.searchTerm = event.target.value;
    this.currentPage = 1;
  }

  @action
  handleSearchKeyup(event) {
    if (event.key === 'Enter') {
      this.performSearch();
    }
  }

  @action
  filterByStatus(event) {
    const status = typeof event === 'string' ? event : event.target.value;
    this.router.transitionTo('municipal.permits.index', { queryParams: { status } });
  }

  @action
  updateStatusFilter(event) {
    this.selectedStatus = event.target.value;
    this.currentPage = 1;
  }

  @action
  updateTypeFilter(event) {
    this.selectedType = event.target.value;
    this.currentPage = 1;
  }

  @action
  updateDateFilter(event) {
    this.selectedDateRange = event.target.value;
    this.currentPage = 1;
  }

  @action
  updateStartDate(event) {
    this.startDate = event.target.value;
    this.currentPage = 1;
  }

  @action
  updateEndDate(event) {
    this.endDate = event.target.value;
    this.currentPage = 1;
  }

  @action
  sortBy(field) {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    this.currentPage = 1;
  }

  @action
  clearFilters() {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedType = '';
    this.selectedDateRange = '';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.router.transitionTo({ queryParams: { status: null, search: null } });
  }

  @action
  clearSearch() {
    this.searchTerm = '';
    this.router.transitionTo({ queryParams: { search: null } });
  }

  @action
  previousPage() {
    if (!this.isFirstPage) {
      this.currentPage--;
    }
  }

  @action
  nextPage() {
    if (!this.isLastPage) {
      this.currentPage++;
    }
  }

  @action
  goToPage(pageNum) {
    this.currentPage = pageNum;
  }

  @action
  viewPermit(permitId) {
    this.router.transitionTo('municipal.permits.view', permitId);
  }

  @action
  reviewPermit(permitId) {
    this.router.transitionTo('municipal.permits.view', permitId, { queryParams: { mode: 'review' } });
  }

  @action
  exportPermits() {
    // TODO: Implement permit export functionality
    console.log('Export permits functionality to be implemented');
  }

  @action
  viewDashboard() {
    this.router.transitionTo('municipal.dashboard');
  }

  @action
  stopPropagation(event) {
    event.stopPropagation();
  }

  @action
  retryLoad() {
    // Refresh the route
    this.router.refresh();
  }

  @action
  performSearch() {
    this.router.transitionTo({ queryParams: { search: this.searchTerm } });
  }

  // Helper methods for template
  formatStatus(status) {
    try {
      if (!status) return '';
      const statusMap = {
        'submitted': 'Submitted',
        'under-review': 'Under Review',
        'approved': 'Approved',
        'active': 'Active',
        'inspections': 'Inspections',
        'completed': 'Completed',
        'denied': 'Denied',
        'expired': 'Expired'
      };
      return statusMap[status] || status;
    } catch (error) {
      console.warn('Error formatting status:', status, error);
      return '';
    }
  }

  formatDate(date) {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  formatCurrency(amount) {
    if (!amount) return '0';
    return new Intl.NumberFormat('en-US').format(amount);
  }

  getDaysAgo(date) {
    if (!date) return 0;
    const now = new Date();
    const past = new Date(date);
    const diffTime = Math.abs(now - past);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getPermitCountForStatus(status) {
    try {
      if (!this.model || !this.model.permits || !this.model.permits[status]) {
        return 0;
      }
      return this.model.permits[status].length || 0;
    } catch (error) {
      return 0;
    }
  }

  getDisplayedPermits() {
    try {
      if (!this.model || !this.model.permits) return [];
      
      if (!this.model.selectedStatus || this.model.selectedStatus === 'all') {
        return this.model.permits.all || [];
      }
      
      return this.model.permits[this.model.selectedStatus] || [];
    } catch (error) {
      console.warn('Error getting displayed permits:', error);
      return [];
    }
  }
}