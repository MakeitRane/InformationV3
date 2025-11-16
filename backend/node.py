from typing import List, Optional, Any, Dict
from dataclasses import dataclass, field
from datetime import datetime
from collections import deque
import re
import uuid


class ResponseSegment:
    """
    A class representing a segment of an AI response.
    Each segment corresponds to a paragraph or line in the response.
    """
    content: str
    index: int  # Position in the original response
    children: List['Node']  # Questions specific to this segment

    def __str__(self) -> list:
        return [self.index, self.content, self.children]


class Node:
    """
    A class representing a node in a chat history tree.
    Each node contains a message, its response (broken into segments), and can have multiple child nodes.
    """
    # The user's message/query
    message: str
    
    # The complete AI response
    response: str
    
    # Response broken down into segments by newlines
    response_segments: List['ResponseSegment']
    
    # Optional parent node reference
    parent: Optional['Node'] = None
    
    # List of child nodes (general follow-up questions)
    children: List['Node']
    
    # Context of the node
    context: Optional[str] = None

    # 1) Extended list of “imperative‐mood” triggers (lowercased)
    _IMPERATIVE_VERBS = {
        "ensure", "sanitize", "never", "always", "make", "avoid", "validate",
        "check", "reject", "allow", "deny", "use", "require", "respond"
    }

    # Heuristic keywords/regex that often indicate a “system” instruction
    _SYSTEM_PATTERNS = [
    r"^you are\b",
    r"^you should\b",
    r"^always\b",
    r"^never\b",
    r"\bmake sure\b",
]

    def __post_init__(self):
        """
        After initialization, break the response into segments.
        """
        self._id = str(uuid.uuid4())
        self._segment_response()


    def _segment_response(self):
        """
        Breaks the response into segments based on newlines and creates ResponseSegment objects.
        Filters out empty lines and normalizes whitespace.
        """
        # Reset the response_segments list
        self.response_segments = []
        
        # Split by newlines and filter out empty lines
        segments = [seg.strip() for seg in self.response.split('\n') if seg.strip()]
        
        # Create ResponseSegment objects for each non-empty segment
        for idx, content in enumerate(segments):
            segment = ResponseSegment()
            segment.content=content
            segment.index = idx
            segment.children = []
            self.response_segments.append(segment)
        


    def add_child(self, message: str, response: str, metadata: dict = None) -> 'Node':
        """
        Creates and adds a child node to the current node.
        
        Args:
            message: The user's message
            response: The AI's response
            metadata: Optional metadata for the node
            
        Returns:
            The newly created child node
        """
        child = Node()
        child.message=message
        child.response=response
        child.parent=self

        print(child.response)
        self.children.append(child)
        return child

    def add_segment_specific_child(self, segment_index: int, message: str, response: str, metadata: dict = None) -> 'Node':
        """
        Creates and adds a child node specific to a response segment.
        
        Args:
            segment_index: Index of the response segment this question relates to
            message: The user's message
            response: The AI's response
            metadata: Optional metadata for the node
            
        Returns:
            The newly created child node
        """
        if 0 <= segment_index < len(self.response_segments):
            child = Node()
            child.message=message
            child.response=response
            child.parent=self

            self.response_segments[segment_index].children.append(child)
            return child
        raise IndexError(f"Segment index {segment_index} is out of range")

    # def get_segment(self, index: int) -> Optional[ResponseSegment]:
        # """
        # Retrieves a specific response segment by index.
        
        # Args:
        #     index: The index of the segment to retrieve
            
        # Returns:
        #     The ResponseSegment if found, None otherwise
        # """
        # if 0 <= index < len(self.response_segments):
        #     return self.response_segments[index]
        # return None

    # def get_segment_children(self, segment_index: int) -> List['Node']:
    #     """
    #     Gets all children nodes specific to a particular response segment.
        
    #     Args:
    #         segment_index: Index of the response segment
            
    #     Returns:
    #         List of child nodes specific to the segment
    #     """
    #     if 0 <= segment_index < len(self.response_segments):
    #         return self.response_segments[segment_index].children
    #     return []


    

    def is_probable_system_heuristic(self, text: str, is_before_first_user: bool) -> bool:
        """
        Returns True if `text` looks like a system instruction, based on:
        1) Explicit meta‐tags (“[SYSTEM]:”, “##SYSTEM##”, “(system)”).  
        2) Imperative‐mood heuristics (first token is a common verb).  
        3) Multi‐sentence or multi‐line structure (e.g. semicolons or multiple '\n').  
        4) If we are still before any detected user greeting, treat as system.
        """
        stripped = text.strip()
        # Patterns for explicit meta‐tags
        _META_TAGS = re.compile(r"^\s*(?:\[SYSTEM\]|##SYSTEM##|\(system\))", re.IGNORECASE)
        _IMPERATIVE_VERBS = self._IMPERATIVE_VERBS
        _SYSTEM_PATTERNS = self._SYSTEM_PATTERNS

        _system_regex = re.compile("|".join(self._SYSTEM_PATTERNS), re.IGNORECASE)
        if (_system_regex.search(text.strip())):
            return True
        else:
            # 1) Meta‐tag check
            if _META_TAGS.match(stripped):
                return True

            # 2) Imperative‐mood check: first word in our list
            first_word = stripped.split()[0].lower() if stripped else ""
            if first_word in _IMPERATIVE_VERBS:
                return True

            # 3) Multi‐sentence / multi‐line
            if ("\n" in text and text.count("\n") >= 1) or ";" in text:
                # Often a block of instructions uses line breaks or semicolons
                return True

            # 4) Positional heuristic: if we haven’t yet seen a user greeting
            if is_before_first_user:
                # If text does not end with “?” or a typical user signature,
                # we lean toward system.
                if not stripped.endswith("?") and not stripped.lower().startswith(("hi", "hello", "hey")):
                    return True
            return False




    def get_context(self) -> List[dict]:
        """
        Returns the conversation context by traversing up the tree to the root.
        This includes all parent messages and responses up to the root.
        
        
        Returns:
            List of dictionaries containing message-response pairs in chronological order
        """
        context = []
        current = self
    
        # Traverse up the tree to the root
        while current != None:
            context.append({"role": "assistant", "content": current.response})
            # Denote any system responses
            line = re.split(r'(?<=[.!?]) +', current.message)
            for idx in (reversed(line)):
                print (idx)
                for element in context:
                    if (element.get("role") == "user"):
                        if (current.is_probable_system_heuristic(str(idx), False) == True):
                            context.append({"role": "system", "content": idx})
                            break
                        else:
                            context.append({"role": "user", "content": idx})
                            break

                    else:
                        
                        if (current.is_probable_system_heuristic(str(idx), True) == True):
                            context.append({"role": "system", "content": idx})
                            break
                        else:
                            context.append({"role": "user", "content": idx})
                            break
            current = current.parent
        #print(list(reversed(context)))
        return list(reversed(context)) 

    # def find_child_by_message(self, message: str) -> Optional['Node']:
    #     """
    #     Finds a child node by its message content.
        
    #     Args:
    #         message: The message to search for
            
    #     Returns:
    #         The matching Node if found, None otherwise
    #     """
    #     # Search in general children
    #     for child in self.children:
    #         if child.message == message:
    #             return child
        
    #     # Search in segment-specific children
    #     for segment in self.response_segments:
    #         for child in segment.children:
    #             if child.message == message:
    #                 return child
    #     return None

    # def get_all_children(self) -> List['Node']:
    #     """
    #     Returns all children nodes, including both general and segment-specific children.
        
    #     Returns:
    #         List of all child nodes
    #     """
    #     all_children = self.children.copy()
    #     for segment in self.response_segments:
    #         all_children.extend(segment.children)
    #     return all_children

    # def is_root(self) -> bool:
    #     """
    #     Checks if the current node is the root node.
        
    #     Returns:
    #         True if this is the root node (no parent), False otherwise
    #     """
    #     return self.parent is None

    # def is_leaf(self) -> bool:
    #     """
    #     Checks if the current node is a leaf node.
        
    #     Returns:
    #         True if this is a leaf node (no children), False otherwise
    #     """
    #     return len(self.get_all_children()) == 0

    def __str__(self) -> str:
        """
        String representation of the node.
        
        Returns:
            A string containing the node's message and number of children
        """
        return f"Node(message='{self.message[:50]}...', segments={len(self.response_segments)}, children={len(self.get_all_children())})"
    def node_response (self) -> str:
        """
        Print the response of the node in question
        """
        return f"Node(message = '{self.response}')"