
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { Icons } from '../constants';

interface HeaderProps {
  toggleSidebar: () => void;
  role: UserRole;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, role, onLogout }) => {
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setDbStatus(data.db === 'connected' ? 'connected' : 'disconnected');
        setDbError(data.error || null);
      } catch (err) {
        setDbStatus('disconnected');
        setDbError('Server unreachable');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-[45]">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-slate-100 lg:hidden text-slate-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="flex items-center gap-3">
           <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
             role === UserRole.SUPERADMIN ? 'bg-purple-100 text-purple-600' :
             role === UserRole.OWNER ? 'bg-blue-100 text-blue-600' :
             role === UserRole.STAFF ? 'bg-orange-100 text-orange-600' :
             'bg-emerald-100 text-emerald-600'
           }`}>
             {role}
           </span>
           
           <div className="group relative flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
             <div className={`w-1.5 h-1.5 rounded-full ${
               dbStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
               dbStatus === 'disconnected' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
               'bg-slate-300 animate-pulse'
             }`}></div>
             <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400 hidden min-[400px]:inline">
               DB: {dbStatus}
             </span>
             {dbStatus === 'disconnected' && dbError && (
               <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-white border border-slate-200 rounded-lg shadow-xl text-[8px] text-rose-600 font-bold z-50 invisible group-hover:visible">
                 {dbError}
               </div>
             )}
           </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400 relative">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
        
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 rounded-lg transition text-xs font-bold uppercase"
        >
          <Icons.Exit />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
