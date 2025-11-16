from node import Node
from node import ResponseSegment

# Create a root node with a multi-line response
root = Node()
root.message = "Tell me about Python programming."
root.response = """Python is a high-level programming language.


It's known for its simple syntax and readability.

Python supports multiple programming paradigms."""
root._segment_response()


# The response is automatically segmented into three parts
print(len(root.response_segments))  # Output: 3

# Add a question about a specific segment
child1 = root.add_segment_specific_child(
    segment_index=1,  # Question about the second segment
    message="You are an assistant. What makes Python's syntax simple?",
    response="Python's syntax is simple because it uses indentation..."
)

# Add a general follow-up question
#root.add_child(
#    message="What version of Python should I use?",
#    response="Python 3.x is recommended..."
#)

# Get all children for a specific segment
#segment_children = root.get_segment_children(1)

# Get the full context including segments
#context = root.get_context()

print (child1.get_context())