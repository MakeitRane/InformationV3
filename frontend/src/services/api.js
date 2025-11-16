import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for handling errors
api.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
);

// Response interceptor for handling errors
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const messageService = {
  // Get all messages
  getAllMessages: () => api.get('/messages'),

  // Get a specific message by ID
  getMessage: (id) => api.get(`/messages/${id}`),

  // Create a new message
  createMessage: (messageData) => api.post('/messages', messageData),

  // Get chat completion
  getChatCompletion: (messageId) => api.post('/chat', { messageId }),

  // Get children of a message
  getMessageChildren: (messageId) => api.get(`/messages/${messageId}/children`),

  // Get conversation path to root
  getConversationPath: (messageId) => api.get(`/messages/${messageId}/path`)
};

export default messageService; 