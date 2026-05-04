
import React from 'react';
import { UserRole, SubscriptionTier, getTierValue } from '../types';
import { Icons, COLORS } from '../constants';

interface SidebarProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  planTier?: SubscriptionTier;
  trialEndsAt?: string;
  canCollectCash?: boolean;
  canPostAnnouncements?: boolean;
  canAddExpenses?: boolean;
  onSettings?: () => void;
  isBasicHost?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setOpen, activeTab, setActiveTab, role, planTier, trialEndsAt, canCollectCash, canPostAnnouncements, canAddExpenses, onSettings, isBasicHost }) => {
  const menuItems: { id: string; label: string; icon: React.FC; roles: readonly UserRole[]; permissionRequired?: boolean; tierRequired?: SubscriptionTier }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard, roles: [UserRole.OWNER, UserRole.STAFF, UserRole.RESIDENT], tierRequired: SubscriptionTier.FREE },
    { id: 'properties', label: 'Properties', icon: Icons.Property, roles: [UserRole.OWNER, UserRole.STAFF], permissionRequired: true, tierRequired: SubscriptionTier.FREE },
    { id: 'rooms', label: 'Room Management', icon: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, roles: [UserRole.OWNER], tierRequired: SubscriptionTier.FREE },
    { id: 'residents', label: 'Residents', icon: Icons.Users, roles: [UserRole.OWNER, UserRole.STAFF], permissionRequired: true, tierRequired: SubscriptionTier.FREE },
    { id: 'staff', label: 'Staff Directory', icon: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, roles: [UserRole.OWNER], tierRequired: SubscriptionTier.BASIC },
    { id: 'payments', label: 'Billing', icon: Icons.Payments, roles: [UserRole.OWNER, UserRole.STAFF, UserRole.RESIDENT], permissionRequired: true, tierRequired: SubscriptionTier.LITE },
    { id: 'complaints', label: 'Complaints', icon: Icons.Complaints, roles: [UserRole.OWNER, UserRole.STAFF, UserRole.RESIDENT], tierRequired: SubscriptionTier.BASIC },
    { id: 'updates', label: 'Hostel Updates', icon: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>, roles: [UserRole.OWNER, UserRole.STAFF, UserRole.RESIDENT], permissionRequired: true, tierRequired: SubscriptionTier.BASIC },
    { id: 'meals', label: 'Meal Plan', icon: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, roles: [UserRole.OWNER, UserRole.STAFF, UserRole.RESIDENT], tierRequired: SubscriptionTier.BUSINESS },
    { id: 'reports', label: 'Empire Reports', icon: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, roles: [UserRole.OWNER], tierRequired: SubscriptionTier.BUSINESS },
    { id: 'expenses', label: 'Expenses', icon: Icons.Expenses, roles: [UserRole.OWNER, UserRole.STAFF], permissionRequired: true, tierRequired: SubscriptionTier.BASIC },
    { id: 'settings', label: 'Settings', icon: Icons.Settings, roles: [UserRole.OWNER, UserRole.RESIDENT], tierRequired: SubscriptionTier.FREE },
    { id: 'superadmin', label: 'Superadmin', icon: Icons.SuperAdmin, roles: [UserRole.SUPERADMIN], tierRequired: SubscriptionTier.FREE },
  ];

  const getTrialDaysLeft = () => {
    if (!trialEndsAt) return null;
    const diff = new Date(trialEndsAt).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const trialDaysLeft = getTrialDaysLeft();

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setOpen(false)} />
      )}
      
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-100">H</div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Hostel Pro</h1>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">SaaS Edition</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.filter(item => {
              const hasRole = (item.roles as readonly UserRole[]).includes(role);
              if (!hasRole) return false;

              // If staff, check if permission is required and if they have it
              if (role === UserRole.STAFF && item.permissionRequired) {
                if (item.id === 'updates' && !canPostAnnouncements) return false;
                if (item.id === 'expenses' && !canAddExpenses) return false;
                if (['properties', 'residents', 'payments'].includes(item.id) && !canCollectCash) return false;
              }
              
              return true;
            }).map((item) => {
              const currentTierValue = getTierValue(planTier || SubscriptionTier.TRIAL);
              const requiredTierValue = getTierValue(item.tierRequired || SubscriptionTier.TRIAL);
              
              const isLocked = role !== UserRole.SUPERADMIN && currentTierValue < requiredTierValue;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                    activeTab === item.id 
                      ? (isLocked ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-100')
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex items-center gap-3 transition-opacity ${isLocked ? 'opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0' : ''}`}>
                    <item.icon />
                    <span className="font-semibold text-sm">{item.label}</span>
                  </div>
                  {isLocked && (
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                      <svg className="w-2.5 h-2.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Upgrade</span>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

            {role === UserRole.OWNER && (
              <div className="p-4 border-t border-slate-100">
                <div className={`bg-gradient-to-br transition-all duration-500 rounded-2xl p-4 relative overflow-hidden group ${
                  planTier === SubscriptionTier.TRIAL 
                    ? (trialDaysLeft && trialDaysLeft <= 2 ? 'from-rose-600 to-rose-700' : 'from-amber-500 to-amber-600')
                    : 'from-blue-600 to-indigo-700'
                }`}>
                    <div className="relative z-10">
                       <p className="text-white text-[10px] font-black uppercase mb-1 tracking-widest opacity-60">
                         {planTier === SubscriptionTier.TRIAL ? 'Trial Status' : 'My Active Plan'}
                       </p>
                       <p className={`font-black uppercase tracking-tight text-white`}>
                         {planTier === SubscriptionTier.TRIAL 
                           ? `Expires in ${trialDaysLeft} Days` 
                           : `${planTier || 'NO PLAN'} Tier`}
                       </p>
                       {planTier === SubscriptionTier.TRIAL && (
                         <div className="mt-2 text-[8px] font-black uppercase text-white/80 bg-white/10 px-2 py-0.5 rounded-full border border-white/20 inline-block">
                           7-Day Full Access
                         </div>
                       )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition"></div>
                </div>
              </div>
            )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
