import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Import the TreeManager
import { TreeManager } from './tree_manager.js';

// Import the Gemini AI service
import { generateGeminiResponse, testGeminiConnection } from './services/gemini.js';

// Initialize the tree manager
const treeManager = new TreeManager();

app.use(cors());
app.use(express.json());

// Create a new conversation tree
app.post('/api/conversations', async (req, res) => {
  try {
    const { userMessage } = req.body;
    
    if (!userMessage) {
      return res.status(400).json({ error: 'User message is required' });
    }
    
    // Generate AI response using Gemini
    const aiResponse = await generateGeminiResponse(userMessage);
    
    // Create a new tree with the first message
    const treeId = treeManager.createNewTree(userMessage, aiResponse);
    
    res.json({
      tree_id: treeId,
      message: 'New conversation tree created successfully',
      ai_response: aiResponse
    });
  } catch (err) {
    console.error('Error creating conversation tree:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all conversation trees
app.get('/api/conversations', async (req, res) => {
  try {
    const trees = treeManager.getAllTrees();
    res.json(trees);
  } catch (err) {
    console.error('Error getting conversations:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a specific conversation tree
app.get('/api/conversations/:treeId', async (req, res) => {
  try {
    const { treeId } = req.params;
    const conversation = treeManager.getTreeConversation(treeId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation tree not found' });
    }
    
    res.json(conversation);
  } catch (err) {
    console.error('Error getting conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get conversation path to a specific node
app.get('/api/conversations/:treeId/path/:nodeId', async (req, res) => {
  try {
    const { treeId, nodeId } = req.params;
    const conversation = treeManager.getConversationPath(treeId, nodeId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Node or conversation tree not found' });
    }
    
    res.json(conversation);
  } catch (err) {
    console.error('Error getting conversation path:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a message to an existing tree
app.post('/api/conversations/:treeId/messages', async (req, res) => {
  try {
    const { treeId } = req.params;
    const { userMessage, parentNodeId, highlightedText } = req.body;
    
    console.log('Adding message to tree:', { treeId, userMessage, parentNodeId, highlightedText });
    
    if (!userMessage || !parentNodeId) {
      return res.status(400).json({ error: 'User message and parent node ID are required' });
    }
    
    // Get conversation context for better AI responses
    const tree = treeManager.getTree(treeId);
    if (!tree) {
      console.error('Tree not found:', treeId);
      return res.status(404).json({ error: 'Tree not found' });
    }
    
    // Verify parent node exists
    const parentNode = tree.findNodeById(parentNodeId);
    if (!parentNode) {
      console.error('Parent node not found:', { treeId, parentNodeId });
      return res.status(404).json({ error: 'Parent node not found' });
    }
    
    console.log('Parent node found:', { parentNodeId, message: parentNode.message });
    
    // Get conversation context from the tree manager
    const conversationContext = treeManager.getTreeConversation(treeId) || [];
    console.log('Conversation context length:', conversationContext.length);
    
    // Generate AI response using Gemini with context and highlighted text
    const aiResponse = await generateGeminiResponse(userMessage, conversationContext, highlightedText);
    console.log('AI response generated, length:', aiResponse.length);
    
    const nodeId = treeManager.addMessageToTree(
      treeId, 
      parentNodeId, 
      userMessage, 
      aiResponse, 
      highlightedText
    );
    
    if (!nodeId) {
      console.error('Failed to add message to tree');
      return res.status(500).json({ error: 'Failed to add message to tree' });
    }
    
    console.log('Message added successfully, new node ID:', nodeId);
    
    res.json({
      message: 'Message added successfully',
      node_id: nodeId,
      ai_response: aiResponse
    });
  } catch (err) {
    console.error('Error adding message to tree:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get tree statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = treeManager.getTreeStats();
    res.json(stats);
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Test Gemini API connection
app.get('/api/test-gemini', async (req, res) => {
  try {
    const isConnected = await testGeminiConnection();
    res.json({
      connected: isConnected,
      message: isConnected ? 'Gemini API connection successful' : 'Gemini API connection failed'
    });
  } catch (err) {
    console.error('Error testing Gemini connection:', err);
    res.status(500).json({ error: err.message });
  }
});

// Legacy endpoints for backward compatibility
app.post('/api/messages', async (req, res) => {
  try {
    const { content, party, parentId, highlightedText } = req.body;
    
    // This endpoint now creates a new tree if no parentId is provided
    if (!parentId) {
      // Create new tree with user message and AI response
      const aiResponse = `This is a sample AI response to: "${content}"`;
              const treeId = treeManager.createNewTree(content, aiResponse);
      
      res.json({
        message: {
          _id: treeId,
          content: content,
          party: party,
          parent: { reference: null, highlightedText: null },
          createdAt: new Date().toISOString()
        }
      });
    } else {
      // Add to existing tree (simplified for now)
      res.json({
        message: {
          _id: `msg_${Date.now()}`,
          content: content,
          party: party,
          parent: { reference: parentId, highlightedText: highlightedText },
          createdAt: new Date().toISOString()
        }
      });
    }
  } catch (err) {
    console.error('Error creating message:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages/:messageId', async (req, res) => {
  try {
    // Simplified response for backward compatibility
    res.json({
      message: {
        _id: req.params.messageId,
        content: "Sample message content",
        party: 'user',
        parent: { reference: null, highlightedText: null },
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error getting message:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messageId } = req.body;
    
    // Simplified AI response for backward compatibility
    const aiResponse = {
      _id: `ai_${Date.now()}`,
      content: `This is a sample AI response to message: ${messageId}`,
      party: 'system',
      parent: { reference: messageId, highlightedText: null },
      createdAt: new Date().toISOString()
    };

    res.json({
      message: aiResponse
    });
  } catch (err) {
    console.error('Error generating chat response:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 