import React from 'react';
import { Bug } from 'lucide-react';

export const BugReportButton = ({ onClick, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full bg-[#2B2B2B] hover:bg-[#383838] active:scale-[0.98] border border-white/10 rounded-2xl px-4 py-3.5 text-white flex items-center gap-3.5 font-medium text-base shadow-md transition-all ${className}`}
    >
      {/* Custom Bug Icon matching Screenshot 1 */}
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
        <Bug className="w-5 h-5 text-white" />
      </div>
      <span className="text-white font-medium text-base tracking-tight">Report bug</span>
    </button>
  );
};
