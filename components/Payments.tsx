
import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../constants';
import { db } from '../services/mockData';
import RentCollectionModal from './RentCollectionModal';
import PaymentReceipt from './PaymentReceipt';
import { Resident, Property, UserRole, Payment, Staff, SubscriptionTier, getTierValue } from '../types';
import { Calendar, CheckCircle2, History, AlertCircle, ArrowRight, Search, Filter, Receipt } from 'lucide-react';

interface PaymentsProps {
  role: UserRole;
  ownerId: string;
  propertyId?: string;
  assignedPropertyIds?: string[];
  canCollectCash?: boolean;
  residentId?: string;
  user?: any;
  plan: SubscriptionTier;
  onUpgrade: () => void;
  initialView?: string | null;
  onClearInitialView?: () => void;
  isManualOnly?: boolean;
}

const Payments: React.FC<PaymentsProps> = ({ 
  role, ownerId, propertyId, assignedPropertyIds, canCollectCash, 
  residentId, user, plan, onUpgrade, initialView, onClearInitialView,
  isManualOnly 
}) => {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [upcomingDues, setUpcomingDues] = useState<Resident[]>([]);
  const [overduePayments, setOverduePayments] = useState<(Resident & { daysPassed: number })[]>([]);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [ownerName, setOwnerName] = useState<string>('');
  const [collectingRentFor, setCollectingRentFor] = useState<Resident | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'upcoming' | 'status' | 'history' | 'overdue'>('status');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);

  useEffect(() => {
    setSearchQuery('');
    setFilterStatus('all');
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let [resData, propsData, payData, staffData, unitsData, upcomingDuesData, overdueData] = await Promise.all([
        db.getResidents(ownerId),
        db.getProperties(ownerId),
        db.getPayments({ ownerId }),
        db.getStaff(ownerId),
        db.getUnits(ownerId),
        db.getUpcomingDues(ownerId),
        db.getOverduePayments(ownerId)
      ]);

      // Filter based on role and assignments
      if (role === UserRole.RESIDENT && residentId) {
        const actualResident = resData.find((r: any) => r.id === residentId || r.email === residentId);
        if (actualResident) {
          const actualId = actualResident.id || actualResident._id;
          resData = [actualResident];
          // Re-fetch payments specifically for this resident to ensure we get them all correctly
          payData = await db.getPayments({ residentId: actualId });
          propsData = propsData.filter((p: any) => p.id === actualResident.propertyId || p._id === actualResident.propertyId);
          unitsData = unitsData.filter((u: any) => u.id === actualResident.unitId || u._id === actualResident.unitId);
        } else {
          resData = [];
          payData = [];
          propsData = [];
          unitsData = [];
        }
      } else if (propertyId) {
        resData = resData.filter((r: any) => r.propertyId === propertyId);
        propsData = propsData.filter((p: any) => p.id === propertyId || p._id === propertyId);
        payData = payData.filter((p: any) => p.propertyId === propertyId);
        unitsData = unitsData.filter((u: any) => u.propertyId === propertyId);
      } else if (assignedPropertyIds && assignedPropertyIds.length > 0) {
        resData = resData.filter((r: any) => assignedPropertyIds.includes(r.propertyId));
        propsData = propsData.filter((p: any) => assignedPropertyIds.includes(p.id) || assignedPropertyIds.includes(p._id));
        payData = payData.filter((p: any) => assignedPropertyIds.includes(p.propertyId));
        unitsData = unitsData.filter((u: any) => assignedPropertyIds.includes(u.propertyId));
      }

      setResidents(resData);
      setProperties(propsData);
      setPayments(payData);
      setAllStaff(staffData);
      setUpcomingDues(upcomingDuesData);
      setOverduePayments(overdueData);
      setTotalCapacity(unitsData.reduce((acc: number, u: any) => acc + (u.capacity || 0), 0));

      // Fetch owner name
      if (user && user.role === UserRole.OWNER) {
        setOwnerName(user.name || 'Owner');
      } else {
        const users = await db.getUsers();
        const owner = users.find((u: any) => u.id === ownerId);
        if (owner) {
          setOwnerName(owner.name || 'Owner');
        }
      }
    } catch (error) {
      console.error("Error fetching payments data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ownerId, propertyId, assignedPropertyIds]);

  useEffect(() => {
    if (!loading && initialView === 'upcoming-dues') {
      setActiveSubTab('upcoming');
      const element = document.getElementById('upcoming-dues-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        if (onClearInitialView) onClearInitialView();
      }
    }
  }, [loading, initialView]);

  const handleMarkPaid = (resident: Resident) => {
    setCollectingRentFor(resident);
  };

  const isPaidThisMonth = (residentId: string) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return payments.some(p => {
      const pDate = new Date(p.date);
      return p.residentId === residentId && 
             pDate.getMonth() === currentMonth && 
             pDate.getFullYear() === currentYear &&
             (p.status === 'SUCCESS' || p.status === 'PAID');
    });
  };

  const totalRevenue = properties.reduce((acc, p) => acc + (p.revenue || 0), 0);
  const monthlyRevenue = payments.reduce((acc, p) => {
    const pDate = new Date(p.date);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear && p.status === 'SUCCESS') {
      return acc + (Number(p.amount) || 0);
    }
    return acc;
  }, 0);

  const monthlyTargetRevenue = residents.reduce((acc, r) => acc + (Number(r.rent) || 0), 0);
  const revenuePercentage = monthlyTargetRevenue > 0 ? Math.round((monthlyRevenue / monthlyTargetRevenue) * 100) : 0;

  const occupancyPercentage = totalCapacity > 0 ? Math.round((residents.length / totalCapacity) * 100) : 0;
  
  // For lifetime revenue, we'll show success vs total payments created
  const lifetimeTargetRevenue = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const lifetimeRevenuePercentage = lifetimeTargetRevenue > 0 ? Math.round((totalRevenue / lifetimeTargetRevenue) * 100) : 0;

  const currentTierValue = getTierValue(plan || SubscriptionTier.FREE);
  const hideRevenue = currentTierValue < 2; // PRO and above can see revenue

  if (role === UserRole.STAFF && !canCollectCash) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
           <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 max-w-sm">You do not have permission to view billing data. Please contact your administrator if you believe this is an error.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {role === UserRole.RESIDENT ? 'My Payments' : 'Billing & Revenue'}
          </h1>
          <p className="text-slate-500">
            {role === UserRole.RESIDENT 
              ? 'Track your rent payments and transaction history.' 
              : 'Global financial overview for your hostels.'}
          </p>
        </div>
      </div>

      {role !== UserRole.RESIDENT && (
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          {(role === UserRole.OWNER || canCollectCash) && (
            <div className="bg-emerald-50 border border-emerald-100 p-4 md:p-8 rounded-[1.5rem] md:rounded-2xl shadow-sm group hover:border-emerald-200 transition-all relative overflow-hidden">
              {hideRevenue && (
                <div className="absolute inset-0 z-10 bg-white/60 rounded-2xl flex flex-col items-center justify-center p-2 text-center group cursor-pointer" onClick={onUpgrade}>
                  <AlertCircle className="w-4 h-4 text-amber-600 mb-1" />
                  <span className="text-[8px] font-black text-blue-600 uppercase underline decoration-2 underline-offset-2">
                    REVENUE HIDDEN
                  </span>
                </div>
              )}
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-[8px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Monthly Revenue</h4>
                <span className="text-[8px] md:text-[10px] font-black px-1.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                  {revenuePercentage}%
                </span>
              </div>
              <p className="text-xl md:text-4xl font-black text-emerald-700 group-hover:scale-105 transition-transform origin-left truncate mb-3">
                {formatCurrency(monthlyRevenue)}
              </p>
              <div className="space-y-2">
                <div className="h-1.5 md:h-2 w-full bg-emerald-100/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-600 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, revenuePercentage)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-[7px] md:text-[10px] font-bold uppercase tracking-tight text-emerald-600/60">
                  <span className="truncate mr-1">{formatCurrency(monthlyRevenue)} Collected</span>
                  <span className="truncate">{formatCurrency(monthlyTargetRevenue)} Target</span>
                </div>
              </div>
            </div>
          )}
          <div className={`p-4 md:p-8 rounded-[1.5rem] md:rounded-2xl shadow-sm group transition-all border ${
            occupancyPercentage < 50 
              ? 'bg-rose-50 border-rose-100 hover:border-rose-200' 
              : occupancyPercentage < 85 
                ? 'bg-orange-50 border-orange-100 hover:border-orange-200'
                : 'bg-emerald-50 border-emerald-100 hover:border-emerald-200'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${
                occupancyPercentage < 50 ? 'text-rose-600' : occupancyPercentage < 85 ? 'text-orange-600' : 'text-emerald-600'
              }`}>Beds Occupied</h4>
              <span className={`text-[8px] md:text-[10px] font-black px-1.5 py-0.5 rounded-lg border ${
                occupancyPercentage < 50 
                  ? 'bg-rose-100 text-rose-700 border-rose-200' 
                  : occupancyPercentage < 85 
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}>
                {occupancyPercentage}%
              </span>
            </div>
            <p className={`text-2xl md:text-4xl font-black group-hover:scale-105 transition-transform origin-left mb-3 ${
              occupancyPercentage < 50 ? 'text-rose-900' : occupancyPercentage < 85 ? 'text-orange-900' : 'text-emerald-900'
            }`}>
              {residents.length}
            </p>
            <div className="space-y-2">
              <div className={`h-1.5 md:h-2 w-full rounded-full overflow-hidden ${
                occupancyPercentage < 50 ? 'bg-rose-100/50' : occupancyPercentage < 85 ? 'bg-orange-100/50' : 'bg-emerald-100/50'
              }`}>
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    occupancyPercentage < 50 ? 'bg-rose-600' : occupancyPercentage < 85 ? 'bg-orange-600' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, occupancyPercentage)}%` }}
                ></div>
              </div>
              <div className={`flex justify-between items-center text-[7px] md:text-[10px] font-bold uppercase tracking-tight ${
                occupancyPercentage < 50 ? 'text-rose-600/60' : occupancyPercentage < 85 ? 'text-orange-600/60' : 'text-emerald-600/60'
              }`}>
                <span className="truncate mr-1">{residents.length} Occupied</span>
                <span className="truncate">{totalCapacity} Total Beds</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {role !== UserRole.RESIDENT && (
        <div className="bg-slate-100/80 p-1.5 rounded-[2rem] flex gap-1.5 relative z-10">
          <button 
            onClick={() => setActiveSubTab('upcoming')}
            className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 md:py-4 px-2 rounded-[1.5rem] transition-all duration-300 ${
              activeSubTab === 'upcoming' 
                ? 'bg-white shadow-md shadow-slate-200/50 text-blue-600' 
                : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
            }`}
          >
            <Calendar size={18} className={activeSubTab === 'upcoming' ? 'text-blue-600' : 'text-slate-400'} strokeWidth={2.5} />
            <span className="text-[9px] md:text-xs font-black uppercase tracking-widest truncate">Upcoming</span>
            <span className={`hidden md:block px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeSubTab === 'upcoming' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'
            }`}>
              {upcomingDues.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveSubTab('status')}
            className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 md:py-4 px-2 rounded-[1.5rem] transition-all duration-300 ${
              activeSubTab === 'status' 
                ? 'bg-white shadow-md shadow-slate-200/50 text-emerald-600' 
                : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 size={18} className={activeSubTab === 'status' ? 'text-emerald-600' : 'text-slate-400'} strokeWidth={2.5} />
            <span className="text-[9px] md:text-xs font-black uppercase tracking-widest truncate">Collection</span>
            <span className={`hidden md:block px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeSubTab === 'status' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'
            }`}>
              {residents.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveSubTab('history')}
            className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 md:py-4 px-2 rounded-[1.5rem] transition-all duration-300 ${
              activeSubTab === 'history' 
                ? 'bg-white shadow-md shadow-slate-200/50 text-slate-900' 
                : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
            }`}
          >
            <History size={18} className={activeSubTab === 'history' ? 'text-slate-900' : 'text-slate-400'} strokeWidth={2.5} />
            <span className="text-[9px] md:text-xs font-black uppercase tracking-widest truncate">History</span>
            <span className={`hidden md:block px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeSubTab === 'history' ? 'bg-slate-100 text-slate-900' : 'bg-slate-200 text-slate-500'
            }`}>
              {payments.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveSubTab('overdue')}
            className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 md:py-4 px-2 rounded-[1.5rem] transition-all duration-300 ${
              activeSubTab === 'overdue' 
                ? 'bg-white shadow-md shadow-slate-200/50 text-rose-600' 
                : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
            }`}
          >
            <AlertCircle size={18} className={activeSubTab === 'overdue' ? 'text-rose-600' : 'text-slate-400'} strokeWidth={2.5} />
            <span className="text-[9px] md:text-xs font-black uppercase tracking-widest truncate">Overdue</span>
            <span className={`hidden md:block px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeSubTab === 'overdue' ? 'bg-rose-50 text-rose-600' : 'bg-slate-200 text-slate-500'
            }`}>
              {overduePayments.length}
            </span>
          </button>
        </div>
      )}

      <div className="relative z-0">
        {role !== UserRole.RESIDENT && activeSubTab === 'upcoming' && (
          <div id="upcoming-dues-section" className="bg-white rounded-[2rem] shadow-xl shadow-blue-100/40 border border-blue-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-6 md:p-8 border-b border-slate-50 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600"></div>
            <div className="flex items-center gap-4 flex-1">
              <div>
                <h3 className="font-black text-blue-600 uppercase tracking-widest text-sm mb-1">Upcoming Dues (Next 3 Days)</h3>
                <p className="text-slate-400 text-[10px] md:text-xs font-medium italic">Residents with rent due very soon</p>
              </div>
              <div className="relative flex-1 max-w-xs hidden md:flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Search resident or room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                  >
                    <option value="all">All Dues</option>
                    <option value="today">Due Today</option>
                    <option value="soon">Next 3 Days</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-2 md:hidden w-full">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <input 
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="relative w-full">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                  >
                    <option value="all">All Dues</option>
                    <option value="today">Due Today</option>
                    <option value="soon">Next 3 Days</option>
                  </select>
                </div>
              </div>
              <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 whitespace-nowrap">
                {upcomingDues.length} Pending
              </span>
            </div>
          </div>
          <div className="scrollbar-hide">
            {upcomingDues.length === 0 ? (
              <div className="py-20 text-center text-slate-400 italic">No upcoming dues in the next 3 days.</div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-10 py-6">Resident</th>
                        <th className="px-10 py-6">Room</th>
                        <th className="px-10 py-6">Amount</th>
                        <th className="px-10 py-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {upcomingDues
                        .filter(r => {
                          const query = searchQuery.toLowerCase();
                          const nameMatch = r.name.toLowerCase().includes(query);
                          const emailMatch = r.email.toLowerCase().includes(query);
                          const roomMatch = r.roomNumber?.toString().includes(searchQuery);
                          
                          const today = new Date().getDate();
                          const dueDate = r.dueDate;
                          const statusMatch = filterStatus === 'all' || 
                                            (filterStatus === 'today' && dueDate === today) ||
                                            (filterStatus === 'soon' && dueDate > today);
                          
                          return (nameMatch || emailMatch || roomMatch) && statusMatch;
                        })
                        .map((r) => (
                        <tr key={`upcoming-${r.id}`} className="hover:bg-orange-50/30 transition-all group">
                          <td className="px-10 py-6">
                            <p className="font-black text-slate-900 text-base leading-tight mb-1">{r.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate">{r.email}</p>
                          </td>
                          <td className="px-10 py-6">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                              Room {r.roomNumber}
                            </span>
                          </td>
                          <td className="px-10 py-6">
                            <p className="font-black text-orange-600 text-base">{formatCurrency(r.rent)}</p>
                          </td>
                          <td className="px-10 py-6 text-right">
                            <button 
                              onClick={() => handleMarkPaid(r)}
                              className="px-4 py-2 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-700 shadow-xl shadow-orange-100 transition-all"
                            >
                              Collect Now
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden p-4 space-y-4">
                  {upcomingDues
                    .filter(r => {
                      const query = searchQuery.toLowerCase();
                      const nameMatch = r.name.toLowerCase().includes(query);
                      const emailMatch = r.email.toLowerCase().includes(query);
                      const roomMatch = r.roomNumber?.toString().includes(searchQuery);
                      
                      const today = new Date().getDate();
                      const dueDate = r.dueDate;
                      const statusMatch = filterStatus === 'all' || 
                                        (filterStatus === 'today' && dueDate === today) ||
                                        (filterStatus === 'soon' && dueDate > today);
                      
                      return (nameMatch || emailMatch || roomMatch) && statusMatch;
                    })
                    .map((r) => (
                      <div key={`upcoming-mobile-${r.id}`} className="p-5 bg-slate-50/50 border border-slate-100 rounded-3xl space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 text-base leading-tight truncate">{r.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate mb-2">{r.email}</p>
                            <span className="px-2 py-1 bg-white border border-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                              Room {r.roomNumber}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rent Due</p>
                            <p className="font-black text-orange-600 text-lg leading-none">{formatCurrency(r.rent)}</p>
                          </div>
                        </div>
                        <div className="pt-2">
                          <button 
                            onClick={() => handleMarkPaid(r)}
                            className="w-full py-3 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-100 transition-all active:scale-[0.98]"
                          >
                            Collect Rent Now
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

        {role !== UserRole.RESIDENT && activeSubTab === 'overdue' && (
          <div className="bg-white rounded-[2rem] shadow-xl shadow-rose-100/40 border border-rose-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-6 md:p-8 border-b border-slate-50 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-600"></div>
            <div className="flex items-center gap-4 flex-1">
              <div>
                <h3 className="font-black text-rose-600 uppercase tracking-widest text-sm mb-1">Overdue Payments</h3>
                <p className="text-slate-400 text-[10px] md:text-xs font-medium italic">Residents who have missed their payment deadline</p>
              </div>
              <div className="relative flex-1 max-w-xs hidden md:flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Search resident..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all cursor-pointer"
                  >
                    <option value="all">All Overdue</option>
                    <option value="severe">Severe (7+ Days)</option>
                    <option value="critical">Critical (15+ Days)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-2 md:hidden w-full">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <input 
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                  />
                </div>
                <div className="relative w-full">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all cursor-pointer"
                  >
                    <option value="all">All Overdue</option>
                    <option value="severe">Severe (7+ Days)</option>
                    <option value="critical">Critical (15+ Days)</option>
                  </select>
                </div>
              </div>
              <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100 whitespace-nowrap">
                {overduePayments.length} Overdue
              </span>
            </div>
          </div>
          <div className="scrollbar-hide">
            {overduePayments.length === 0 ? (
              <div className="py-20 text-center text-slate-400 italic">No overdue payments found.</div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-10 py-6">Resident</th>
                        <th className="px-10 py-6">Due Date</th>
                        <th className="px-10 py-6">Days Passed</th>
                        <th className="px-10 py-6">Amount</th>
                        <th className="px-10 py-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {overduePayments
                        .filter(r => {
                          const query = searchQuery.toLowerCase();
                          const nameMatch = r.name.toLowerCase().includes(query);
                          const emailMatch = r.email.toLowerCase().includes(query);
                          
                          const daysPassed = r.daysPassed;
                          const statusMatch = filterStatus === 'all' || 
                                            (filterStatus === 'severe' && daysPassed >= 7) ||
                                            (filterStatus === 'critical' && daysPassed >= 15);
                          
                          return (nameMatch || emailMatch) && statusMatch;
                        })
                        .map((r) => (
                        <tr key={`overdue-${r.id}`} className="hover:bg-rose-50/30 transition-all group">
                          <td className="px-10 py-6">
                            <p className="font-black text-slate-900 text-base leading-tight mb-1">{r.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate">{r.email}</p>
                          </td>
                          <td className="px-10 py-6">
                            <p className="text-sm font-bold text-slate-600">{r.dueDate}th of month</p>
                          </td>
                          <td className="px-10 py-6">
                            <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest">
                              {r.daysPassed} Days
                            </span>
                          </td>
                          <td className="px-10 py-6">
                            <p className="font-black text-rose-600 text-base">{formatCurrency(r.rent)}</p>
                          </td>
                          <td className="px-10 py-6 text-right">
                            <button 
                              onClick={() => handleMarkPaid(r)}
                              className="px-4 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all"
                            >
                              Collect Now
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden p-4 space-y-4">
                  {overduePayments
                    .filter(r => {
                      const query = searchQuery.toLowerCase();
                      const nameMatch = r.name.toLowerCase().includes(query);
                      const emailMatch = r.email.toLowerCase().includes(query);
                      
                      const daysPassed = r.daysPassed;
                      const statusMatch = filterStatus === 'all' || 
                                        (filterStatus === 'severe' && daysPassed >= 7) ||
                                        (filterStatus === 'critical' && daysPassed >= 15);
                      
                      return (nameMatch || emailMatch) && statusMatch;
                    })
                    .map((r) => (
                      <div key={`overdue-mobile-${r.id}`} className="p-5 bg-rose-50/30 border border-rose-100 rounded-3xl space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 text-base leading-tight truncate">{r.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate mb-2">{r.email}</p>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest">
                                {r.daysPassed} Days Overdue
                              </span>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Due: {r.dueDate}th</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                            <p className="font-black text-rose-600 text-lg leading-none">{formatCurrency(r.rent)}</p>
                          </div>
                        </div>
                        <div className="pt-2">
                          <button 
                            onClick={() => handleMarkPaid(r)}
                            className="w-full py-3 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all active:scale-[0.98]"
                          >
                            Collect Rent Now
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

        {role !== UserRole.RESIDENT && activeSubTab === 'status' && (
          <div className="bg-white rounded-[2rem] shadow-xl shadow-emerald-100/40 border border-emerald-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-6 md:p-8 border-b border-slate-50 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600"></div>
              <div className="flex items-center gap-4 flex-1">
                <div>
                  <h3 className="font-black text-emerald-600 uppercase tracking-widest text-sm mb-1">Rent Collection Status</h3>
                  <p className="text-slate-400 text-[10px] md:text-xs font-medium italic">Track and manage payments for the current month</p>
                </div>
                {(getTierValue(plan) < 2 || isManualOnly) && (
                  <button 
                    onClick={onUpgrade}
                    className="hidden lg:flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl group hover:bg-blue-100 transition-all ml-4"
                  >
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px] group-hover:scale-110 transition-transform">🔥</div>
                    <div className="text-left">
                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-tight">Enable automatic Rent reminders</p>
                      <p className="text-[8px] font-bold text-blue-400 uppercase">Available in Pro plan</p>
                    </div>
                  </button>
                )}
                <div className="relative flex-1 max-w-xs hidden md:flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text"
                      placeholder="Search resident..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
                    >
                      <option value="all">All Status</option>
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:hidden w-full">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <input 
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div className="relative w-full">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
              </div>
            </div>
          <div className="scrollbar-hide">
            <div className="inline-block min-w-full align-middle">
              {residents.length === 0 ? (
                <div className="py-20 text-center text-slate-400 italic">No residents found.</div>
              ) : (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-10 py-6">Resident</th>
                          <th className="px-10 py-6">Amount</th>
                          <th className="px-10 py-6">Method</th>
                          <th className="px-10 py-6">Status</th>
                          <th className="px-10 py-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {residents
                          .filter(r => {
                            const query = searchQuery.toLowerCase();
                            const nameMatch = r.name.toLowerCase().includes(query);
                            const emailMatch = r.email.toLowerCase().includes(query);
                            
                            const paid = isPaidThisMonth(r.id);
                            const statusMatch = filterStatus === 'all' || 
                                              (filterStatus === 'paid' && paid) || 
                                              (filterStatus === 'unpaid' && !paid);
                            
                            return (nameMatch || emailMatch) && statusMatch;
                          })
                          .map((r) => {
                          const paid = isPaidThisMonth(r.id);
                          const lastPayment = payments.find(p => p.residentId === r.id && p.status === 'SUCCESS');
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-all group">
                              <td className="px-10 py-8">
                                <p className="font-black text-slate-900 text-base leading-tight mb-1">{r.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ID: {r.id?.slice(0, 8) || 'N/A'}</p>
                              </td>
                              <td className="px-10 py-8">
                                <p className="font-black text-slate-900 text-base">{formatCurrency(r.rent)}</p>
                              </td>
                              <td className="px-10 py-8">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                  {paid ? (lastPayment?.paymentMethod || 'Offline') : '-'}
                                </span>
                              </td>
                              <td className="px-10 py-8">
                                {paid ? (
                                  <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm">PAID</span>
                                ) : (
                                  <span className="px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm">UNPAID</span>
                                )}
                              </td>
                              <td className="px-10 py-8 text-right">
                                {!paid && (
                                  <button 
                                    onClick={() => handleMarkPaid(r)}
                                    className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all hover:-translate-y-0.5"
                                  >
                                    Collect Rent
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden p-4 space-y-4">
                    {residents
                      .filter(r => {
                        const query = searchQuery.toLowerCase();
                        const nameMatch = r.name.toLowerCase().includes(query);
                        const emailMatch = r.email.toLowerCase().includes(query);
                        
                        const paid = isPaidThisMonth(r.id);
                        const statusMatch = filterStatus === 'all' || 
                                          (filterStatus === 'paid' && paid) || 
                                          (filterStatus === 'unpaid' && !paid);
                        
                        return (nameMatch || emailMatch) && statusMatch;
                      })
                      .map((r) => {
                        const paid = isPaidThisMonth(r.id);
                        const lastPayment = payments.find(p => p.residentId === r.id && p.status === 'SUCCESS');
                        return (
                          <div key={`status-mobile-${r.id}`} className="p-5 bg-slate-50/50 border border-slate-100 rounded-3xl space-y-4">
                            <div className="flex justify-between items-start">
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 text-base leading-tight truncate">{r.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate mb-2">ID: {r.id?.slice(0, 8) || 'N/A'}</p>
                                <div className="flex items-center gap-2">
                                  {paid ? (
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                      Paid via {lastPayment?.paymentMethod || 'Offline'}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 bg-orange-50 text-orange-600 border border-orange-100 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                      Unpaid
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Rent</p>
                                <p className="font-black text-slate-900 text-lg leading-none">{formatCurrency(r.rent)}</p>
                              </div>
                            </div>
                            {!paid && (
                              <div className="pt-2">
                                <button 
                                  onClick={() => handleMarkPaid(r)}
                                  className="w-full py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-[0.98]"
                                >
                                  Collect Rent
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

        {(role === UserRole.RESIDENT || activeSubTab === 'history') && (
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-6 md:p-8 border-b border-slate-50 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-800"></div>
              <div className="flex items-center gap-4 flex-1">
                <div>
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm mb-1">
                    {role === UserRole.RESIDENT ? 'Payment History' : 'Recent Payment History'}
                  </h3>
                  <p className="text-slate-400 text-[10px] md:text-xs font-medium italic">
                    {role === UserRole.RESIDENT ? 'A complete record of your rent payments' : 'Detailed log of all transactions'}
                  </p>
                </div>
                <div className="relative flex-1 max-w-xs hidden md:flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text"
                      placeholder="Search resident or TXN..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all cursor-pointer"
                    >
                      <option value="all">All Status</option>
                      <option value="success">Success</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:hidden w-full">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <input 
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all"
                  />
                </div>
                <div className="relative w-full">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>
          <div className="scrollbar-hide">
            <div className="inline-block min-w-full align-middle">
              {payments.length === 0 ? (
                <p className="text-slate-400 text-xs italic text-center py-10">No payment history found.</p>
              ) : (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-slate-50">
                          <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Resident</th>
                          <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                          <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                          <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Collected By</th>
                          <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                          <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payments
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .filter(p => {
                            const query = searchQuery.toLowerCase();
                            const resident = residents.find(r => r.id === p.residentId || (r as any)._id === p.residentId);
                            const nameMatch = resident?.name.toLowerCase().includes(query);
                            const txnMatch = p.transactionId.toLowerCase().includes(query);
                            const methodMatch = p.paymentMethod.toLowerCase().includes(query);
                            
                            const statusMatch = filterStatus === 'all' || p.status.toLowerCase() === filterStatus;
                            
                            return (nameMatch || txnMatch || methodMatch) && statusMatch;
                          })
                          .map((p) => {
                          const resident = residents.find(r => r.id === p.residentId || (r as any)._id === p.residentId);
                          return (
                            <tr key={p.id || p.transactionId} className="hover:bg-slate-50/50 transition-all group">
                              <td className="px-10 py-4">
                                <p className="font-black text-slate-900 text-sm leading-tight">{resident?.name || 'Resident'}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">TXN: {p.transactionId}</p>
                              </td>
                              <td className="px-10 py-4">
                                <p className="font-black text-emerald-600 text-sm">{formatCurrency(p.amount)}</p>
                              </td>
                              <td className="px-10 py-4">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                  {p.paymentMethod || 'Offline'}
                                </span>
                              </td>
                              <td className="px-10 py-4">
                                <p className="text-xs font-bold text-slate-600">{p.collectorName || '-'}</p>
                              </td>
                              <td className="px-10 py-4">
                                <p className="text-xs font-bold text-slate-500">
                                  {new Date(p.date).toLocaleDateString()} <span className="text-[10px] text-slate-400 ml-1">{new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </p>
                              </td>
                              <td className="px-10 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {p.status === 'SUCCESS' && (
                                    <button 
                                      onClick={() => setSelectedPaymentForReceipt(p)}
                                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group/receipt"
                                      title="View Receipt"
                                    >
                                      <Receipt size={16} className="group-hover/receipt:scale-110 transition-transform" />
                                    </button>
                                  )}
                                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                    p.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {p.status}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden p-4 space-y-4">
                    {payments
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .filter(p => {
                        const query = searchQuery.toLowerCase();
                        const resident = residents.find(r => r.id === p.residentId || (r as any)._id === p.residentId);
                        const nameMatch = resident?.name.toLowerCase().includes(query);
                        const txnMatch = p.transactionId.toLowerCase().includes(query);
                        const methodMatch = p.paymentMethod.toLowerCase().includes(query);
                        
                        const statusMatch = filterStatus === 'all' || p.status.toLowerCase() === filterStatus;
                        
                        return (nameMatch || txnMatch || methodMatch) && statusMatch;
                      })
                      .map((p) => {
                        const resident = residents.find(r => r.id === p.residentId || (r as any)._id === p.residentId);
                        return (
                          <div key={`history-mobile-${p.id || p.transactionId}`} className="p-5 bg-slate-50/50 border border-slate-100 rounded-3xl space-y-4">
                            <div className="flex justify-between items-start">
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 text-base leading-tight truncate">{resident?.name || 'Resident'}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate mb-2">TXN: {p.transactionId}</p>
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-2 py-1 bg-white border border-slate-100 text-slate-600 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                    {p.paymentMethod || 'Offline'}
                                  </span>
                                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                                    p.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {p.status}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                                <p className="font-black text-emerald-600 text-lg leading-none">{formatCurrency(p.amount)}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                {new Date(p.date).toLocaleDateString()} • {new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className="flex items-center gap-2">
                                {p.status === 'SUCCESS' && (
                                  <button 
                                    onClick={() => setSelectedPaymentForReceipt(p)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                                  >
                                    <Receipt size={10} />
                                    Receipt
                                  </button>
                                )}
                              </div>
                            </div>
                            {p.collectorName && (
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                Collected By: <span className="text-slate-600">{p.collectorName}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      </div>

      <RentCollectionModal 
        resident={collectingRentFor}
        onClose={() => setCollectingRentFor(null)}
        onSuccess={fetchData}
        ownerId={ownerId}
        ownerName={ownerName}
        allStaff={allStaff}
        currentUser={user}
        plan={plan}
        onUpgrade={onUpgrade}
      />

      {selectedPaymentForReceipt && (
        <PaymentReceipt 
          payment={selectedPaymentForReceipt}
          resident={residents.find(r => r.id === selectedPaymentForReceipt.residentId || (r as any)._id === selectedPaymentForReceipt.residentId)}
          property={properties.find(p => p.id === selectedPaymentForReceipt.propertyId || (p as any)._id === selectedPaymentForReceipt.propertyId)}
          onClose={() => setSelectedPaymentForReceipt(null)}
        />
      )}
    </div>
  );
};

export default Payments;
