import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../config/environment';

export default class PermitPaymentComponent extends Component {
  @service router;
  
  @tracked isProcessingPayment = false;
  @tracked paymentError = null;
  @tracked paymentSuccess = false;
  @tracked selectedPaymentMethod = 'credit_card';

  get permit() {
    return this.args.permit;
  }

  get totalAmount() {
    // Use totalFees if available, otherwise fall back to fee
    return this.permit.totalFees || this.permit.fee || 0;
  }

  get isPaymentRequired() {
    // Check if permit has fees and is in a status that allows payment
    return this.totalAmount > 0 && 
           !this.permit.paymentStatus === 'paid' &&
           ['pending', 'under_review', 'approved'].includes(this.permit.status);
  }

  get isPaid() {
    return this.permit.paymentStatus === 'paid' || 
           (this.permit.paymentMethod && this.permit.transactionId);
  }

  @action
  async initiatePayment() {
    if (this.isProcessingPayment) return;
    
    this.isProcessingPayment = true;
    this.paymentError = null;

    try {
      // Create payment session with InvoiceCloud
      const response = await fetch(`${config.APP.API_HOST}/api/permits/${this.permit.id}/payment/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          paymentMethod: this.selectedPaymentMethod,
          amount: this.totalAmount,
          permitId: this.permit.id
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Payment initiation failed');
      }

      // Redirect to InvoiceCloud payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('No payment URL received');
      }

    } catch (error) {
      console.error('Payment error:', error);
      this.paymentError = error.message;
    } finally {
      this.isProcessingPayment = false;
    }
  }

  @action
  selectPaymentMethod(method) {
    this.selectedPaymentMethod = method;
  }

  @action
  retryPayment() {
    this.paymentError = null;
    this.paymentSuccess = false;
  }
}