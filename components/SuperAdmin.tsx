import React, { useState, useEffect } from 'react';
import { formatCurrency, formatCompactCurrency, Icons } from '../constants';
import { db } from '../services/mockData';
import { User, UserRole, SubscriptionTier, PLAN_LIMITS, Property } from '../types';

interface SuperAdminProps {
  onImpersonate: (ownerId: string) => void;
}

const SuperAdmin: React.FC<SuperAdminProps> = ({ onImpersonate }) => {
  const [tenants, setTenants] = useState<User[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'tenants' | 'plans'>('tenants');
  const [planConfigs, setPlanConfigs] = useState<any[]>([]);
  const [isSavingPlanConfig, setIsSavingPlanConfig] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [users, props, configs] = await Promise.all([
          db.getUsers(),
          db.getProperties(),
          db.getPlanConfigs()
        ]);
        // Filter for owners only
        setTenants(users.filter(u => u.role === UserRole.OWNER));
        setAllProperties(props);
        setPlanConfigs(configs);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpdateTier = async (userId: string, tier: SubscriptionTier) => {
    setUpdatingId(userId);
    try {
      await db.updateUserPlan(userId, tier);
      setTenants(tenants.map(t => (t.id === userId || (t as any)._id === userId) ? { ...t, plan: tier } : t));
    } catch (error) {
      console.error("Failed to update tier:", error);
      alert("Failed to update tier. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleLite = async (userId: string, isBasicHost: boolean) => {
    setUpdatingId(userId);
    try {
      await db.toggleLiteHost(userId, isBasicHost);
      setTenants(tenants.map(t => (t.id === userId || (t as any)._id === userId) ? { ...t, isBasicHost } : t));
    } catch (error) {
      console.error("Failed to toggle lite mode:", error);
      alert("Failed to update mode. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTogglePlanMethod = async (tier: SubscriptionTier, method: string) => {
    const config = planConfigs.find(c => c.tier === tier);
    if (!config) return;

    let newMethods: string[];
    if (config.allowedPaymentMethods.includes(method)) {
      newMethods = config.allowedPaymentMethods.filter((m: string) => m !== method);
    } else {
      newMethods = [...config.allowedPaymentMethods, method];
    }

    setIsSavingPlanConfig(tier);
    try {
      const updated = await db.updatePlanConfig(tier, newMethods);
      setPlanConfigs(planConfigs.map(c => c.tier === tier ? updated : c));
    } catch (error) {
      console.error("Failed to update plan config:", error);
      alert("Failed to update plan configuration.");
    } finally {
      setIsSavingPlanConfig(null);
    }
  };

  const allPaymentMethods = ['Cash', 'PhonePe', 'Razorpay', 'UPI QR', 'SME Pay Link'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.id || (t as any)._id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMRR = tenants.reduce((acc, t) => acc + (PLAN_LIMITS[t.plan || SubscriptionTier.TRIAL]?.price || 0), 0);
  const totalProperties = allProperties.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Platform Control</h1>
          <p className="text-slate-500 font-medium italic">Global oversight of all {tenants.length} owners and {totalProperties} properties.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveAdminTab('tenants')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeAdminTab === 'tenants' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-slate-500'
            }`}
          >
            Tenants
          </button>
          <button 
            onClick={() => setActiveAdminTab('plans')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeAdminTab === 'plans' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-slate-500'
            }`}
          >
            Plan Matrix
          </button>
        </div>
      </div>

      {activeAdminTab === 'tenants' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm hover:border-blue-100 transition-colors text-center">
          <p className="text-slate-400 text-[7px] md:text-[10px] font-black uppercase tracking-widest mb-1 leading-none">Total MRR</p>
          <p className="text-xl md:text-4xl font-black text-slate-900 leading-none">{formatCompactCurrency(totalMRR)}</p>
        </div>
        <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm text-center">
          <p className="text-slate-400 text-[7px] md:text-[10px] font-black uppercase tracking-widest mb-1 leading-none">Properties</p>
          <p className="text-xl md:text-4xl font-black text-blue-600 leading-none">{totalProperties}</p>
        </div>
        <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm text-center">
          <p className="text-slate-400 text-[7px] md:text-[10px] font-black uppercase tracking-widest mb-1 leading-none">Tenants</p>
          <p className="text-xl md:text-4xl font-black text-slate-900 leading-none">{tenants.length}</p>
        </div>
        <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm text-center">
          <p className="text-slate-400 text-[7px] md:text-[10px] font-black uppercase tracking-widest mb-1 leading-none">Uptime</p>
          <p className="text-xl md:text-4xl font-black text-emerald-500 leading-none">99.9%</p>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-6 md:p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
          <div className="text-center md:text-left">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Owner Directory</h3>
            <p className="text-slate-400 text-xs font-medium mt-1">Manage tenant lifecycle and tier upgrades</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
             <div className="relative group/search">
               <input 
                 type="text" 
                 placeholder="Search by name, ID or email..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full md:w-72 px-5 py-3 pl-12 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-sm" 
               />
               <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/search:text-blue-600 transition-colors" />
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px] md:min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 md:px-10 py-6">Owner Details</th>
                <th className="px-6 md:px-10 py-6">Current Subscription</th>
                <th className="px-6 md:px-10 py-6 hidden lg:table-cell">Infrastructure</th>
                <th className="px-6 md:px-10 py-6">ID & Status</th>
                <th className="px-6 md:px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTenants.map((t) => {
                const ownerId = t.id || (t as any)._id;
                const propCount = allProperties.filter(p => p.ownerId === ownerId).length;
                
                return (
                  <tr key={ownerId} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 md:px-10 py-6 md:py-8">
                      <div className="flex items-center gap-4 md:gap-5">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-sm md:text-base group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          {t.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm md:text-base leading-none mb-1">{t.name}</p>
                          <p className="text-[10px] md:text-xs font-bold text-slate-400 lowercase truncate max-w-[150px] md:max-w-none">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 md:px-10 py-6 md:py-8">
                      <div className="relative inline-block w-full max-w-[140px]">
                        <select
                          disabled={updatingId === ownerId}
                          value={t.plan || SubscriptionTier.TRIAL}
                          onChange={(e) => handleUpdateTier(ownerId, e.target.value as SubscriptionTier)}
                          className={`w-full appearance-none px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer disabled:opacity-50 ${
                            t.plan === SubscriptionTier.CUSTOM ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            t.plan === SubscriptionTier.BUSINESS ? 'bg-purple-50 text-purple-600 border-purple-100' :
                            t.plan === SubscriptionTier.PRO ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            t.plan === SubscriptionTier.BASIC ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            t.plan === SubscriptionTier.LITE ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          <option value={SubscriptionTier.TRIAL}>TRIAL</option>
                          <option value={SubscriptionTier.LITE}>LITE</option>
                          <option value={SubscriptionTier.BASIC}>BASIC</option>
                          <option value={SubscriptionTier.PRO}>PRO</option>
                          <option value={SubscriptionTier.BUSINESS}>BUSINESS</option>
                          <option value={SubscriptionTier.CUSTOM}>CUSTOM</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                          {updatingId === ownerId ? (
                            <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 md:px-10 py-6 md:py-8 hidden lg:table-cell">
                      <p className="text-sm font-black text-slate-700 leading-tight">{propCount} Properties</p>
                      <p className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">Active Infrastructure</p>
                    </td>
                    <td className="px-6 md:px-10 py-6 md:py-8">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">ID: {ownerId.substring(0, 8)}...</p>
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200`}></span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Active Tenant</span>
                        </div>
                        <button 
                          onClick={() => handleToggleLite(ownerId, !t.isBasicHost)}
                          disabled={updatingId === ownerId}
                          className={`mt-2 flex items-center gap-2 px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${
                            t.isBasicHost 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {t.isBasicHost ? 'Lite Edition: ON' : 'Lite Edition: OFF'}
                          {updatingId === ownerId && (
                            <div className="w-2 h-2 border border-white/30 border-t-white rounded-full animate-spin"></div>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 md:px-10 py-6 md:py-8 text-right">
                      <button 
                        onClick={() => onImpersonate(ownerId)}
                        className="inline-flex items-center gap-2 px-4 md:px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 group/btn"
                      >
                        <Icons.Exit className="w-3.5 h-3.5 rotate-180 group-hover/btn:translate-x-0.5 transition-transform" />
                        <span className="hidden sm:inline">Impersonate</span>
                        <span className="sm:hidden">Login</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredTenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No owners found matching your search</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-10 border-b border-slate-50 bg-slate-50/30">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Plan-Based Visibility Matrix</h3>
            <p className="text-slate-400 text-xs font-medium mt-1">Configure which payment methods are available for each subscription tier</p>
          </div>
          <div className="overflow-x-auto p-10">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="py-6 text-left w-1/4">Subscription Tier</th>
                  {allPaymentMethods.map(method => (
                    <th key={method} className="py-6 text-center">{method}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[SubscriptionTier.FREE, SubscriptionTier.LITE, SubscriptionTier.BASIC, SubscriptionTier.TRIAL, SubscriptionTier.PRO, SubscriptionTier.BUSINESS, SubscriptionTier.CUSTOM].map(tier => {
                  const config = planConfigs.find(c => c.tier === tier);
                  return (
                    <tr key={tier} className="hover:bg-slate-50 transition-all group">
                      <td className="py-8">
                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                          tier === SubscriptionTier.BUSINESS ? 'bg-purple-50 text-purple-600 border-purple-100' :
                          tier === SubscriptionTier.PRO ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          tier === SubscriptionTier.BASIC ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          tier === SubscriptionTier.LITE ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                          {tier}
                        </span>
                      </td>
                      {allPaymentMethods.map(method => {
                        const isAllowed = config?.allowedPaymentMethods.includes(method);
                        return (
                          <td key={method} className="py-8 text-center">
                            <button
                              onClick={() => handleTogglePlanMethod(tier, method)}
                              disabled={isSavingPlanConfig === tier}
                              className={`w-10 h-6 mx-auto flex items-center rounded-full transition-all p-1 relative border ${
                                isAllowed 
                                  ? 'bg-blue-600 border-blue-600' 
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                isAllowed ? 'translate-x-4' : 'translate-x-0'
                              }`} />
                              {isSavingPlanConfig === tier && (
                                <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                                  <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
