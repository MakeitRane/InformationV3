import React from 'react';
import { FaPlus, FaHome, FaGlobe, FaTh, FaArrowUp, FaDownload } from 'react-icons/fa';

const Sidebar = () => {
  return (
    <div className="fixed left-0 top-0 h-full w-[3.8vw] min-w-[80px] bg-[#181b1a] border-r border-gray-700 flex flex-col">
      {/* Logo Section */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-center">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <div className="w-5 h-5 bg-[#181b1a] rounded-sm flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <button className="w-full flex items-center justify-center bg-transparent hover:bg-gray-800 text-white p-3 rounded-lg transition-colors">
          <FaPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-4">
        <nav className="space-y-2">
          <button className="w-full flex items-center justify-center text-[#5f5f5f] hover:text-[#e8e9e2] p-3 rounded-lg hover:bg-gray-800 transition-colors">
            <FaHome className="w-5 h-5" />
          </button>
          <button className="w-full flex items-center justify-center text-[#5f5f5f] hover:text-[#e8e9e2] p-3 rounded-lg hover:bg-gray-800 transition-colors">
            <FaGlobe className="w-5 h-5" />
          </button>
          <button className="w-full flex items-center justify-center text-[#5f5f5f] hover:text-[#e8e9e2] p-3 rounded-lg hover:bg-gray-800 transition-colors">
            <FaTh className="w-5 h-5" />
          </button>
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        <button className="w-full flex items-center justify-center text-[#5f5f5f] hover:text-[#e8e9e2] p-3 rounded-lg hover:bg-gray-800 transition-colors">
          <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-xs">A</span>
          </div>
        </button>
        <button className="w-full flex items-center justify-center text-[#5f5f5f] hover:text-[#e8e9e2] p-3 rounded-lg hover:bg-gray-800 transition-colors">
          <FaArrowUp className="w-5 h-5" />
        </button>
        <button className="w-full flex items-center justify-center text-[#5f5f5f] hover:text-[#e8e9e2] p-3 rounded-lg hover:bg-gray-800 transition-colors">
          <FaDownload className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
