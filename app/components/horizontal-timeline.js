import Component from '@glimmer/component';

export default class HorizontalTimelineComponent extends Component {
  get orderedSteps() {
    if (!this.args.steps) return [];
    
    // Sort steps by order if available, otherwise by array index
    return this.args.steps.sort((a, b) => {
      const orderA = a.order || 0;
      const orderB = b.order || 0;
      return orderA - orderB;
    });
  }

  getTimelineItemClass(step) {
    const baseClass = 'timeline-step';
    
    switch (step.status) {
      case 'completed':
        return `${baseClass} completed`;
      case 'in_progress':
        return `${baseClass} in-progress`;
      case 'failed':
        return `${baseClass} failed`;
      case 'pending':
        return `${baseClass} pending`;
      default:
        return `${baseClass} not-started`;
    }
  }

  getConnectorClass(currentStep, nextStep) {
    if (!nextStep) return 'timeline-connector';
    
    // Connector is active if current step is completed
    return currentStep.status === 'completed' 
      ? 'timeline-connector active' 
      : 'timeline-connector';
  }

  formatDateTime(date) {
    if (!date) return '';
    
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStepMarker(step, index) {
    switch (step.status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '●';
      case 'failed':
        return '✗';
      default:
        return (index + 1).toString();
    }
  }
}