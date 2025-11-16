import { Node } from './node.js';

export class Tree {
  /**
   * A class for creating and managing conversation trees.
   * Each tree represents a conversation thread with a root node and subsequent branches.
   */
  
  constructor(treeId = null) {
    this.treeId = treeId || this.generateId();
    this.rootNode = null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.nodeCount = 0;
  }
  
  /**
   * Generate a unique ID for the tree.
   */
  generateId() {
    return `tree_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Create the root node of the tree with the first user message and AI response.
   * 
   * @param {string} userMessage - The user's initial message
   * @param {string} aiResponse - The AI's response to the user message
   * @returns {Node} The created root node
   */
  createRootNode(userMessage, aiResponse) {
    if (this.rootNode !== null) {
      throw new Error("Tree already has a root node");
    }
    
    // Create root node
    const root = new Node();
    root.message = userMessage;
    root.response = aiResponse;
    root.parent = null; // Root has no parent
    
    this.rootNode = root;
    this.nodeCount = 1;
    this.updatedAt = new Date();
    
    return root;
  }
  
  /**
   * Add a child node to an existing node in the tree.
   * 
   * @param {string} parentNodeId - ID of the parent node
   * @param {string} userMessage - The user's message
   * @param {string} aiResponse - The AI's response
   * @param {string} highlightedText - Optional highlighted text from the parent response
   * @returns {Node|null} The created child node, or null if parent not found
   */
  addChildNode(parentNodeId, userMessage, aiResponse, highlightedText = null) {
    const parentNode = this.findNodeById(parentNodeId);
    if (parentNode === null) {
      return null;
    }
    
    // Create child node
    const child = new Node();
    child.message = userMessage;
    child.response = aiResponse;
    child.parent = parentNode;
    child.highlightedText = highlightedText;
    
    // Add to parent's children
    parentNode.children.push(child);
    
    this.nodeCount += 1;
    this.updatedAt = new Date();
    
    return child;
  }
  
  /**
   * Get a node by its ID.
   * 
   * @param {string} nodeId - The ID of the node to find
   * @returns {Node|null} The node if found, null otherwise
   */
  getNode(nodeId) {
    return this.findNodeById(nodeId);
  }
  
  /**
   * Get the conversation path from root to a specific node.
   * 
   * @param {string} nodeId - The ID of the target node
   * @returns {Array} List of nodes from root to target node
   */
  getConversationPath(nodeId) {
    const targetNode = this.findNodeById(nodeId);
    if (targetNode === null) {
      return [];
    }
    
    const path = [];
    let current = targetNode;
    
    // Traverse up to root
    while (current !== null) {
      path.unshift(current);
      current = current.parent;
    }
    
    return path;
  }
  
  /**
   * Get a subtree starting from a specific node.
   * 
   * @param {string} nodeId - The ID of the root node for the subtree
   * @returns {Node|null} The subtree root node, or null if not found
   */
  getSubtree(nodeId) {
    return this.findNodeById(nodeId);
  }
  
  /**
   * Get all nodes in the tree.
   * 
   * @returns {Array} List of all nodes in the tree
   */
  getAllNodes() {
    if (this.rootNode === null) {
      return [];
    }
    
    const nodes = [];
    this.collectNodesRecursive(this.rootNode, nodes);
    return nodes;
  }
  
  /**
   * Helper method to recursively collect all nodes.
   */
  collectNodesRecursive(node, nodes) {
    nodes.push(node);
    for (const child of node.children) {
      this.collectNodesRecursive(child, nodes);
    }
  }
  
  /**
   * Find a node by its ID using recursive search.
   * 
   * @param {string} nodeId - The ID of the node to find
   * @returns {Node|null} The node if found, null otherwise
   */
  findNodeById(nodeId) {
    if (this.rootNode === null) {
      return null;
    }
    
    return this.searchNodeRecursive(this.rootNode, nodeId);
  }
  
  /**
   * Helper method to recursively search for a node by ID.
   */
  searchNodeRecursive(node, nodeId) {
    // Check if current node matches
    if (node._id === nodeId) {
      return node;
    }
    
    // Search in children
    for (const child of node.children) {
      const result = this.searchNodeRecursive(child, nodeId);
      if (result !== null) {
        return result;
      }
    }
    
    return null;
  }
  
  /**
   * Get statistics about the tree.
   * 
   * @returns {Object} Dictionary containing tree statistics
   */
  getTreeStats() {
    return {
      tree_id: this.treeId,
      node_count: this.nodeCount,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
      has_root: this.rootNode !== null,
      max_depth: this.calculateMaxDepth()
    };
  }
  
  /**
   * Calculate the maximum depth of the tree.
   */
  calculateMaxDepth() {
    if (this.rootNode === null) {
      return 0;
    }
    
    return this.calculateDepthRecursive(this.rootNode, 1);
  }
  
  /**
   * Helper method to recursively calculate tree depth.
   */
  calculateDepthRecursive(node, currentDepth) {
    if (node.children.length === 0) {
      return currentDepth;
    }
    
    let maxChildDepth = currentDepth;
    for (const child of node.children) {
      const childDepth = this.calculateDepthRecursive(child, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    
    return maxChildDepth;
  }
  
  /**
   * Convert the tree to a dictionary representation.
   * 
   * @returns {Object} Dictionary representation of the tree
   */
  toDict() {
    return {
      tree_id: this.treeId,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
      node_count: this.nodeCount,
      root_node: this.rootNode ? this.nodeToDict(this.rootNode) : null
    };
  }
  
  /**
   * Helper method to convert a node to dictionary.
   */
  nodeToDict(node) {
    if (node === null) {
      return null;
    }
    
    return {
      message: node.message,
      response: node.response,
      children: node.children.map(child => this.nodeToDict(child)),
      response_segments: node.responseSegments ? 
        node.responseSegments.map(seg => ({
          content: seg.content,
          index: seg.index,
          children: seg.children.map(child => this.nodeToDict(child))
        })) : []
    };
  }
  
  /**
   * String representation of the tree.
   */
  toString() {
    return `Tree(id=${this.treeId}, nodes=${this.nodeCount}, root=${this.rootNode ? 'Yes' : 'No'})`;
  }
}
