const API_URL = 'http://localhost:3001/api';

export const api = {
  // Create a new conversation
  createConversation: async (title) => {
    const response = await fetch(`${API_URL}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    return response.json();
  },

  // Get all conversations
  getConversations: async () => {
    const response = await fetch(`${API_URL}/conversations`);
    return response.json();
  },

  // Get all messages for a conversation
  getConversationMessages: async (conversationId) => {
    const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`);
    return response.json();
  },

  // Add a new message
  addMessage: async (message) => {
    const response = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    return response.json();
  }
}; 