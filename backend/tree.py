
from typing import List, Optional, Dict, Any
from node import Node
import uuid
from datetime import datetime


class Tree:
    """
    A class for creating and managing conversation trees.
    Each tree represents a conversation thread with a root node and subsequent branches.
    """
    
    def __init__(self, tree_id: str = None):
        """
        Initialize a new tree.
        
        Args:
            tree_id: Optional custom ID for the tree. If None, a UUID will be generated.
        """
        self.tree_id = tree_id or str(uuid.uuid4())
        self.root_node: Optional[Node] = None
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.node_count = 0
        
    def create_root_node(self, user_message: str, ai_response: str) -> Node:
        """
        Create the root node of the tree with the first user message and AI response.
        
        Args:
            user_message: The user's initial message
            ai_response: The AI's response to the user message
            
        Returns:
            The created root node
        """
        if self.root_node is not None:
            raise ValueError("Tree already has a root node")
            
        # Create root node
        root = Node()
        root.message = user_message
        root.response = ai_response
        root.parent = None  # Root has no parent
        
        self.root_node = root
        self.node_count = 1
        self.updated_at = datetime.now()
        
        return root
    
    def add_child_node(self, parent_node_id: str, user_message: str, ai_response: str, 
                      highlighted_text: str = None) -> Optional[Node]:
        """
        Add a child node to an existing node in the tree.
        
        Args:
            parent_node_id: ID of the parent node
            user_message: The user's message
            ai_response: The AI's response
            highlighted_text: Optional highlighted text from the parent response
            
        Returns:
            The created child node, or None if parent not found
        """
        parent_node = self._find_node_by_id(parent_node_id)
        if parent_node is None:
            return None
            
        # Create child node
        child = Node()
        child.message = user_message
        child.response = ai_response
        child.parent = parent_node
        
        # Add to parent's children
        parent_node.children.append(child)
        
        self.node_count += 1
        self.updated_at = datetime.now()
        
        return child
    
    def add_segment_specific_child(self, parent_node_id: str, segment_index: int, 
                                 user_message: str, ai_response: str) -> Optional[Node]:
        """
        Add a child node specific to a response segment.
        
        Args:
            parent_node_id: ID of the parent node
            segment_index: Index of the response segment
            user_message: The user's message
            ai_response: The AI's response
            
        Returns:
            The created child node, or None if parent not found
        """
        parent_node = self._find_node_by_id(parent_node_id)
        if parent_node is None:
            return None
            
        try:
            child = parent_node.add_segment_specific_child(
                segment_index, user_message, ai_response
            )
            self.node_count += 1
            self.updated_at = datetime.now()
            return child
        except IndexError:
            return None
    
    def get_node(self, node_id: str) -> Optional[Node]:
        """
        Get a node by its ID.
        
        Args:
            node_id: The ID of the node to find
            
        Returns:
            The node if found, None otherwise
        """
        return self._find_node_by_id(node_id)
    
    def get_conversation_path(self, node_id: str) -> List[Node]:
        """
        Get the conversation path from root to a specific node.
        
        Args:
            node_id: The ID of the target node
            
        Returns:
            List of nodes from root to target node
        """
        target_node = self._find_node_by_id(node_id)
        if target_node is None:
            return []
            
        path = []
        current = target_node
        
        # Traverse up to root
        while current is not None:
            path.insert(0, current)
            current = current.parent
            
        return path
    
    def get_subtree(self, node_id: str) -> Optional[Node]:
        """
        Get a subtree starting from a specific node.
        
        Args:
            node_id: The ID of the root node for the subtree
            
        Returns:
            The subtree root node, or None if not found
        """
        return self._find_node_by_id(node_id)
    
    def get_all_nodes(self) -> List[Node]:
        """
        Get all nodes in the tree.
        
        Returns:
            List of all nodes in the tree
        """
        if self.root_node is None:
            return []
            
        nodes = []
        self._collect_nodes_recursive(self.root_node, nodes)
        return nodes
    
    def _collect_nodes_recursive(self, node: Node, nodes: List[Node]):
        """Helper method to recursively collect all nodes."""
        nodes.append(node)
        for child in node.children:
            self._collect_nodes_recursive(child, nodes)
    
    def _find_node_by_id(self, node_id: str) -> Optional[Node]:
        """
        Find a node by its ID using recursive search.
        
        Args:
            node_id: The ID of the node to find
            
        Returns:
            The node if found, None otherwise
        """
        if self.root_node is None:
            return None
            
        return self._search_node_recursive(self.root_node, node_id)
    
    def _search_node_recursive(self, node: Node, node_id: str) -> Optional[Node]:
        """Helper method to recursively search for a node by ID."""
        # Check if current node matches
        if hasattr(node, '_id') and node._id == node_id:
            return node
            
        # Search in children
        for child in node.children:
            result = self._search_node_recursive(child, node_id)
            if result is not None:
                return result
                
        return None
    
    def get_tree_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the tree.
        
        Returns:
            Dictionary containing tree statistics
        """
        return {
            'tree_id': self.tree_id,
            'node_count': self.node_count,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'has_root': self.root_node is not None,
            'max_depth': self._calculate_max_depth()
        }
    
    def _calculate_max_depth(self) -> int:
        """Calculate the maximum depth of the tree."""
        if self.root_node is None:
            return 0
            
        return self._calculate_depth_recursive(self.root_node, 1)
    
    def _calculate_depth_recursive(self, node: Node, current_depth: int) -> int:
        """Helper method to recursively calculate tree depth."""
        if not node.children:
            return current_depth
            
        max_child_depth = current_depth
        for child in node.children:
            child_depth = self._calculate_depth_recursive(child, current_depth + 1)
            max_child_depth = max(max_child_depth, child_depth)
            
        return max_child_depth
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the tree to a dictionary representation.
        
        Returns:
            Dictionary representation of the tree
        """
        return {
            'tree_id': self.tree_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'node_count': self.node_count,
            'root_node': self._node_to_dict(self.root_node) if self.root_node else None
        }
    
    def _node_to_dict(self, node: Node) -> Dict[str, Any]:
        """Helper method to convert a node to dictionary."""
        if node is None:
            return None
            
        return {
            'message': node.message,
            'response': node.response,
            'children': [self._node_to_dict(child) for child in node.children],
            'response_segments': [
                {
                    'content': seg.content,
                    'index': seg.index,
                    'children': [self._node_to_dict(child) for child in seg.children]
                }
                for seg in node.response_segments
            ] if hasattr(node, 'response_segments') else []
        }
    
    def __str__(self) -> str:
        """String representation of the tree."""
        return f"Tree(id={self.tree_id}, nodes={self.node_count}, root={'Yes' if self.root_node else 'No'})"
