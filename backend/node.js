export class ResponseSegment {
  /**
   * A class representing a segment of an AI response.
   * Each segment corresponds to a paragraph or line in the response.
   */
  constructor() {
    this.content = '';
    this.index = 0; // Position in the original response
    this.children = []; // Questions specific to this segment
  }

  toString() {
    return [this.index, this.content, this.children];
  }
}

export class Node {
  /**
   * A class representing a node in a chat history tree.
   * Each node contains a message, its response (broken into segments), and can have multiple child nodes.
   */
  constructor() {
    // The user's message/query
    this.message = '';
    
    // The complete AI response
    this.response = '';
    
    // Response broken down into segments by newlines
    this.responseSegments = [];
    
    // Optional parent node reference
    this.parent = null;
    
    // List of child nodes (general follow-up questions)
    this.children = [];
    
    // Context of the node
    this.context = null;
    
    // Highlighted text from parent response (for branch creation)
    this.highlightedText = null;
    
    // Generate unique ID for the node
    this._id = this.generateId();
    
    // Initialize response segments
    this.segmentResponse();
  }

  /**
   * Generate a unique ID for the node.
   */
  generateId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Breaks the response into segments based on newlines and creates ResponseSegment objects.
   * Filters out empty lines and normalizes whitespace.
   */
  segmentResponse() {
    // Reset the responseSegments list
    this.responseSegments = [];
    
    if (!this.response) return;
    
    // Split by newlines and filter out empty lines
    const segments = this.response.split('\n')
      .map(seg => seg.trim())
      .filter(seg => seg.length > 0);
    
    // Create ResponseSegment objects for each non-empty segment
    for (let idx = 0; idx < segments.length; idx++) {
      const segment = new ResponseSegment();
      segment.content = segments[idx];
      segment.index = idx;
      segment.children = [];
      this.responseSegments.push(segment);
    }
  }

  /**
   * Creates and adds a child node to the current node.
   * 
   * @param {string} message - The user's message
   * @param {string} response - The AI's response
   * @param {Object} metadata - Optional metadata for the node
   * @returns {Node} The newly created child node
   */
  addChild(message, response, metadata = null) {
    const child = new Node();
    child.message = message;
    child.response = response;
    child.parent = this;

    this.children.push(child);
    return child;
  }

  /**
   * Creates and adds a child node specific to a response segment.
   * 
   * @param {number} segmentIndex - Index of the response segment this question relates to
   * @param {string} message - The user's message
   * @param {string} response - The AI's response
   * @param {Object} metadata - Optional metadata for the node
   * @returns {Node} The newly created child node
   */
  addSegmentSpecificChild(segmentIndex, message, response, metadata = null) {
    if (segmentIndex >= 0 && segmentIndex < this.responseSegments.length) {
      const child = new Node();
      child.message = message;
      child.response = response;
      child.parent = this;

      this.responseSegments[segmentIndex].children.push(child);
      return child;
    }
    throw new Error(`Segment index ${segmentIndex} is out of range`);
  }

  /**
   * Returns the conversation context by traversing up the tree to the root.
   * This includes all parent messages and responses up to the root.
   * 
   * @returns {Array} List of dictionaries containing message-response pairs in chronological order
   */
  getContext() {
    const context = [];
    let current = this;
    
    // Traverse up the tree to the root
    while (current !== null) {
      context.unshift({
        role: "assistant", 
        content: current.response
      });
      
      // Add user message
      context.unshift({
        role: "user", 
        content: current.message
      });
      
      current = current.parent;
    }
    
    return context;
  }

  /**
   * Get all children nodes, including both general and segment-specific children.
   * 
   * @returns {Array} List of all child nodes
   */
  getAllChildren() {
    const allChildren = [...this.children];
    
    for (const segment of this.responseSegments) {
      allChildren.push(...segment.children);
    }
    
    return allChildren;
  }

  /**
   * Checks if the current node is the root node.
   * 
   * @returns {boolean} True if this is the root node (no parent), false otherwise
   */
  isRoot() {
    return this.parent === null;
  }

  /**
   * Checks if the current node is a leaf node.
   * 
   * @returns {boolean} True if this is a leaf node (no children), false otherwise
   */
  isLeaf() {
    return this.getAllChildren().length === 0;
  }

  /**
   * String representation of the node.
   * 
   * @returns {string} A string containing the node's message and number of children
   */
  toString() {
    return `Node(message='${this.message.substring(0, 50)}...', segments=${this.responseSegments.length}, children=${this.getAllChildren().length})`;
  }

  /**
   * Print the response of the node in question
   * 
   * @returns {string} The node's response
   */
  nodeResponse() {
    return `Node(message = '${this.response}')`;
  }
}
