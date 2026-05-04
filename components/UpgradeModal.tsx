
import React from 'react';
import { Icons } from '../constants';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  limitType: 'properties' | 'residents' | 'staff';
  limitValue: number;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, onUpgrade, limitType, limitValue }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 " onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-lg rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-10 text-center shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[95vh] border border-slate-100">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all transform hover:rotate-90 z-20"
        >
          <Icons.Close className="w-5 h-5" />
        </button>
        <div className="overflow-y-auto scrollbar-hide">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-6 md:mb-8 animate-bounce">
             <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 md:mb-4 uppercase tracking-tight">Capacity Reached!</h2>
          <p className="text-sm md:text-base text-slate-500 mb-6 md:mb-8 font-medium italic border-l-4 border-blue-600 pl-4 py-2 bg-blue-50/30">
            👉 "You've reached your limit of {limitValue} {limitType}"
          </p>
          <p className="text-xs text-slate-400 mb-8 px-4 font-bold uppercase tracking-tight">
            Upgrade to unlock higher limits and scale your hostel properly.
          </p>

          <div className="space-y-3">
             <button 
               onClick={onUpgrade}
               className="w-full py-4 md:py-5 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition text-[10px] md:text-xs"
             >
               Upgrade Plan Now
             </button>
             <button 
               onClick={onClose}
               className="w-full py-3 md:py-4 text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-[10px] hover:text-slate-600 transition"
             >
               Maybe Later
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
