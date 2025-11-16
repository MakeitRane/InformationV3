import { Tree } from './tree.js';

export class TreeManager {
  /**
   * Manages multiple conversation trees and provides an interface for the backend server.
   */
  constructor() {
    this.trees = new Map();
    this.treeCounter = 0;
  }

  /**
   * Create a new conversation tree with the first message.
   * 
   * @param {string} userMessage - The user's initial message
   * @param {string} aiResponse - The AI's response to the user message
   * @returns {string} The tree ID of the newly created tree
   */
  createNewTree(userMessage, aiResponse) {
    const tree = new Tree();
    tree.createRootNode(userMessage, aiResponse);
    
    this.trees.set(tree.treeId, tree);
    this.treeCounter += 1;
    
    return tree.treeId;
  }

  /**
   * Add a new message to an existing tree.
   * 
   * @param {string} treeId - The ID of the tree to add the message to
   * @param {string} parentNodeId - The ID of the parent node
   * @param {string} userMessage - The user's message
   * @param {string} aiResponse - The AI's response
   * @param {string} highlightedText - Optional highlighted text from the parent response
   * @returns {string|null} The ID of the newly created node, or null if failed
   */
  addMessageToTree(treeId, parentNodeId, userMessage, aiResponse, highlightedText = null) {
    if (!this.trees.has(treeId)) {
      return null;
    }
    
    const tree = this.trees.get(treeId);
    const childNode = tree.addChildNode(parentNodeId, userMessage, aiResponse, highlightedText);
    
    if (childNode) {
      return childNode._id;
    }
    return null;
  }

  /**
   * Get a tree by its ID.
   * 
   * @param {string} treeId - The ID of the tree to retrieve
   * @returns {Tree|null} The tree if found, null otherwise
   */
  getTree(treeId) {
    return this.trees.get(treeId);
  }

  /**
   * Get information about all trees.
   * 
   * @returns {Array} List of dictionaries containing tree information
   */
  getAllTrees() {
    const result = [];
    for (const [treeId, tree] of this.trees) {
      result.push({
        tree_id: treeId,
        stats: tree.getTreeStats(),
        root_message: tree.rootNode ? tree.rootNode.message : null
      });
    }
    return result;
  }

  /**
   * Get the conversation from a tree in a format suitable for the frontend.
   * 
   * @param {string} treeId - The ID of the tree to get the conversation from
   * @returns {Array|null} List of message dictionaries, or null if tree not found
   */
  getTreeConversation(treeId) {
    if (!this.trees.has(treeId)) {
      return null;
    }
    
    const tree = this.trees.get(treeId);
    const nodes = tree.getAllNodes();
    
    const conversation = [];
    for (const node of nodes) {
      // Add user message
      conversation.push({
        _id: node._id,
        content: node.message,
        party: 'user',
        parent: {
          reference: node.parent ? node.parent._id : null,
          highlightedText: node.highlightedText || null
        },
        createdAt: tree.createdAt.toISOString(),
        tree_id: treeId,
        nodeData: {
          message: node.message,
          response: node.response,
          children: node.children.map(child => child._id)
        }
      });
      
      // Add AI response
      conversation.push({
        _id: `${node._id}_response`,
        content: node.response,
        party: 'system',
        parent: {
          reference: node._id,
          highlightedText: null
        },
        createdAt: tree.createdAt.toISOString(),
        tree_id: treeId,
        nodeData: {
          message: node.message,
          response: node.response,
          children: node.children.map(child => child._id)
        }
      });
    }
    
    return conversation;
  }

  /**
   * Get the conversation path from root to a specific node.
   * 
   * @param {string} treeId - The ID of the tree
   * @param {string} nodeId - The ID of the target node
   * @returns {Array|null} List of message dictionaries from root to target node, or null if not found
   */
  getConversationPath(treeId, nodeId) {
    if (!this.trees.has(treeId)) {
      return null;
    }
    
    const tree = this.trees.get(treeId);
    const path = tree.getConversationPath(nodeId);
    
    if (path.length === 0) {
      return null;
    }
    
    const conversation = [];
    for (const node of path) {
      // Add user message
      conversation.push({
        _id: node._id,
        content: node.message,
        party: 'user',
        parent: {
          reference: node.parent ? node.parent._id : null,
          highlightedText: node.highlightedText || null
        },
        createdAt: tree.createdAt.toISOString(),
        tree_id: treeId,
        nodeData: {
          message: node.message,
          response: node.response,
          children: node.children.map(child => child._id)
        }
      });
      
      // Add AI response
      conversation.push({
        _id: `${node._id}_response`,
        content: node.response,
        party: 'system',
        parent: {
          reference: node._id,
          highlightedText: null
        },
        createdAt: tree.createdAt.toISOString(),
        tree_id: treeId,
        nodeData: {
          message: node.message,
          response: node.response,
          children: node.children.map(child => child._id)
        }
      });
    }
    
    return conversation;
  }

  /**
   * Delete a tree.
   * 
   * @param {string} treeId - The ID of the tree to delete
   * @returns {boolean} True if deleted successfully, false otherwise
   */
  deleteTree(treeId) {
    if (this.trees.has(treeId)) {
      this.trees.delete(treeId);
      return true;
    }
    return false;
  }

  /**
   * Get overall statistics about all trees.
   * 
   * @returns {Object} Dictionary containing overall statistics
   */
  getTreeStats() {
    let totalNodes = 0;
    let totalDepth = 0;
    
    for (const tree of this.trees.values()) {
      totalNodes += tree.nodeCount;
      totalDepth += tree.calculateMaxDepth();
    }
    
    return {
      total_trees: this.trees.size,
      total_nodes: totalNodes,
      average_depth: this.trees.size > 0 ? totalDepth / this.trees.size : 0,
      tree_counter: this.treeCounter
    };
  }
}
