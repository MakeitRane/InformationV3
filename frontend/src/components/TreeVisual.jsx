import React, { useState } from "react";

const TreeVisual = ({ responses, selectedNodeId, onNodeSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Convert responses array to tree structure
  const buildTreeNodes = (responses) => {
    const nodeMap = new Map();
    let rootNode = null;

    // Filter to only get user messages (not AI responses) for tree structure
    const userMessages = responses.filter(response => response.party === 'user');

    // First pass: Create all nodes
    userMessages.forEach(response => {
      const node = {
        id: response._id,
        x: 0, // Will be calculated later
        y: 0, // Will be calculated later
        type: response.parent.reference ? 'child' : 'root',
        label: response.content.substring(0, 20) + '...',
        children: [],
        data: response,
        hasHighlightedParent: !!response.parent?.highlightedText
      };
      nodeMap.set(response._id, node);
      
      if (!response.parent.reference) {
        rootNode = node;
      }
    });

    // Second pass: Build relationships
    userMessages.forEach(response => {
      if (response.parent.reference) {
        // Find the parent user message node (not the AI response)
        const parentUserMessage = userMessages.find(msg => msg._id === response.parent.reference);
        if (parentUserMessage) {
          const parentNode = nodeMap.get(parentUserMessage._id);
          const currentNode = nodeMap.get(response._id);
          if (parentNode && currentNode) {
            parentNode.children.push(currentNode);
          }
        }
      }
    });

    // Calculate positions
    if (rootNode) {
      positionNodes(rootNode, 400, 60, 800, 100);
    }

    return Array.from(nodeMap.values());
  };

  // Calculate node positions
  const positionNodes = (node, x, y, width, verticalSpacing) => {
    node.x = x;
    node.y = y;

    if (node.children.length > 0) {
      const childWidth = width / node.children.length;
      node.children.forEach((child, index) => {
        const childX = x - width/2 + childWidth * (index + 0.5);
        positionNodes(child, childX, y + verticalSpacing, childWidth, verticalSpacing);
      });
    }
  };

  const treeNodes = buildTreeNodes(responses);

  // Draw lines between connected nodes
  const renderLines = () => {
    const lines = [];
    treeNodes.forEach(node => {
      if (node.type === 'child' && node.data.parent.reference) {
        const parent = treeNodes.find(n => n.id === node.data.parent.reference);
        if (parent) {
          lines.push(
            <line
              key={`line-${node.id}`}
              x1={parent.x}
              y1={parent.y}
              x2={node.x}
              y2={node.y}
              stroke="#4B5563"
              strokeWidth="3"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          );
        }
      }
    });
    return lines;
  };

  return (
    <div 
      className={`fixed bottom-4 right-8 bg-[#181b1a] rounded-lg shadow-xl transition-all duration-300 ease-in-out border border-gray-700
        ${isExpanded ? 'w-[45vh] h-[45vh]' : 'w-60 h-60'}
        hover:ring-2 hover:ring-[#00C8C8] hover:ring-opacity-50`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      style={{ zIndex: 50 }}
    >
      {/* Header section */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-center bg-[#181b1a] rounded-t-lg">
        <div className="text-[#e8e9e2] font-medium text-base" style={{ fontFamily: 'sans-serif' }}>Conversation Tree</div>
      </div>

      {/* Legend - only show when expanded */}
      {isExpanded && (
        <div className="p-3 bg-[#181b1a] border-b border-gray-700 text-sm">
          <div className="flex items-center justify-center space-x-4 text-[#5f5f5f]">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-[#00C8C8]"></div>
              <span style={{ fontFamily: 'sans-serif' }}>Root</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-[#00C8C8]"></div>
              <span style={{ fontFamily: 'sans-serif' }}>Question</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span style={{ fontFamily: 'sans-serif' }}>Highlighted</span>
            </div>
          </div>
        </div>
      )}

      {/* Tree visualization */}
      <div className={`relative w-full p-4 overflow-auto ${isExpanded ? 'h-[calc(100%-6rem)]' : 'h-[calc(100%-4rem)]'}`}>
        <svg 
          className="w-full h-full"
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid meet"
        >
          <g className="transition-transform duration-300">
            {/* Render lines first so they appear behind nodes */}
            {renderLines()}
            
            {/* Render nodes */}
            {treeNodes.map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="transition-all duration-300"
                onClick={() => onNodeSelect(node.id)}
              >
                {/* Larger click target */}
                <circle
                  r={node.type === 'root' ? 35 : 28}
                  className="fill-transparent cursor-pointer"
                />
                {/* Visual node */}
                <circle
                  r={node.type === 'root' ? 30 : 24}
                  className={`
                    ${selectedNodeId === node.id 
                      ? 'fill-[#00C8C8] stroke-black stroke-4' 
                      : node.type === 'root'
                        ? 'fill-[#00C8C8] hover:fill-[#00B0B0]'
                        : node.hasHighlightedParent
                          ? 'fill-green-500 hover:fill-green-400'
                          : 'fill-[#00C8C8] hover:fill-[#00B0B0]'
                    }
                    cursor-pointer
                    transition-all duration-200
                    stroke-2
                  `}
                />
                {/* Node label */}
                <text
                  className="fill-white text-sm pointer-events-none select-none"
                  textAnchor="middle"
                  dy=".3em"
                  fontSize={node.type === 'root' ? "16" : "14"}
                  style={{ fontFamily: 'sans-serif' }}
                >
                  {node.type === 'root' ? 'R' : node.hasHighlightedParent ? 'H' : 'Q'}
                </text>
                
                {/* Tooltip */}
                <title>{node.data.content}</title>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default TreeVisual;
