import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import config from 'avitar-building-permits/config/environment';

export default class PermitChatComponent extends Component {
  @tracked messages = [];
  @tracked newMessage = '';
  @tracked isLoading = false;
  @tracked isSending = false;
  @tracked errorMessage = '';
  @tracked unreadCount = 0;
  @tracked isExpanded = true;

  constructor() {
    super(...arguments);
    this.loadMessages();
    this.pollForNewMessages();
  }

  willDestroy() {
    super.willDestroy(...arguments);
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  async loadMessages() {
    if (!this.args.permitId) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(
        `${config.APP.API_HOST}/api/permit-messages/permit/${this.args.permitId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      this.messages = await response.json();

      // Scroll to bottom after loading messages
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      this.errorMessage = 'Failed to load messages';
    } finally {
      this.isLoading = false;
    }
  }

  async loadUnreadCount() {
    if (!this.args.permitId) return;

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(
        `${config.APP.API_HOST}/api/permit-messages/permit/${this.args.permitId}/unread`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const result = await response.json();
        this.unreadCount = result.unreadCount;
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }

  pollForNewMessages() {
    // Poll for new messages every 30 seconds
    this.pollingInterval = setInterval(() => {
      if (!this.isExpanded) {
        this.loadUnreadCount();
      } else {
        this.loadMessages();
      }
    }, 30000);
  }

  @action
  updateMessage(event) {
    this.newMessage = event.target.value;
    this.errorMessage = '';
  }

  @action
  async sendMessage() {
    if (!this.newMessage.trim() || this.isSending) return;

    this.isSending = true;
    this.errorMessage = '';

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(
        `${config.APP.API_HOST}/api/permit-messages/permit/${this.args.permitId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: this.newMessage.trim(),
            messageType: 'general',
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Clear the input and reload messages
      this.newMessage = '';
      await this.loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      this.errorMessage = error.message || 'Failed to send message';
    } finally {
      this.isSending = false;
    }
  }

  @action
  handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  @action
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;

    if (this.isExpanded) {
      this.loadMessages();
      this.unreadCount = 0;
    } else {
      this.loadUnreadCount();
    }
  }

  @action
  scrollToBottom() {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  get currentUserId() {
    return localStorage.getItem('user_id');
  }

  get hasMessages() {
    return this.messages.length > 0;
  }

  get canSendMessage() {
    return this.newMessage.trim().length > 0 && !this.isSending;
  }

  get messageCountText() {
    const count = this.messages.length;
    return count === 1 ? '1 message' : `${count} messages`;
  }
}
