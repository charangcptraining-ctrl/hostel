
import React, { useState, useEffect } from 'react';
import RentCollectionModal from './RentCollectionModal';
import PendingPaymentItem from './PendingPaymentItem';
import { UserRole, Resident, Property, SubscriptionTier, AlertChannel, PLAN_ALERTS, PLAN_LIMITS, Unit, Staff, User, RoomStatus, getTierValue } from '../types';
import { formatCurrency, formatCompactCurrency, Icons } from '../constants';
import { db } from '../services/mockData';
import { alertService } from '../services/alertService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const chartData = [
  { name: 'Jan', revenue: 4000 },
  { name: 'Feb', revenue: 3000 },
  { name: 'Mar', revenue: 2000 },
  { name: 'Apr', revenue: 2780 },
  { name: 'May', revenue: 1890 },
  { name: 'Jun', revenue: 2390 },
];

const StatCard = ({ title, current, total, isCurrency, unit, icon: Icon }: any) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  return (
    <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-2xl shadow-sm border border-slate-100 hover:border-blue-100 transition-all group overflow-hidden">
      <div className="flex items-start justify-between gap-2 mb-3 md:mb-4">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
          {Icon && <div className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0">
            <Icon className="w-3.5 h-3.5 md:w-5 md:h-5" />
          </div>}
          <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-tight md:tracking-widest flex-1 truncate">{title}</h3>
        </div>
        <span className="text-[9px] md:text-xs font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shadow-sm border text-blue-600 bg-blue-50 border-blue-100 shrink-0">
          {percentage}%
        </span>
      </div>
      
      <div className="mb-2 md:mb-4">
        <p className="text-xl md:text-3xl font-black text-slate-900 group-hover:scale-[1.02] transition-transform origin-left break-words">
          {isCurrency ? formatCompactCurrency(current) : current}
        </p>
      </div>

      <div className="space-y-2">
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div 
            className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(37,99,235,0.3)]"
            style={{ width: `${Math.min(100, percentage)}%` }}
          ></div>
        </div>
        <div className="flex justify-between items-center text-[9px] md:text-[11px] font-bold uppercase tracking-tight text-slate-400">
          <span className="truncate mr-1">{isCurrency ? formatCurrency(current) : `${current} ${unit}`}</span>
          <span className="truncate">{isCurrency ? formatCurrency(total) : `${total} ${unit}`}</span>
        </div>
      </div>
    </div>
  );
};

interface DashboardProps {
  role: UserRole;
  ownerId: string;
  onAddProperty: () => void;
  onViewComplaints: () => void;
  onViewPayments: (view?: string) => void;
  onViewProperty: (propertyId: string) => void;
  onUpgrade: () => void;
  propertyId?: string;
  assignedPropertyIds?: string[];
  plan: SubscriptionTier;
  canCollectCash?: boolean;
  user?: User | null;
  isBasicHost?: boolean;
  hideRevenue?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  role, ownerId, onAddProperty, onViewComplaints, onViewPayments, 
  onViewProperty, onUpgrade, propertyId, assignedPropertyIds, plan, 
  canCollectCash, user, isBasicHost, hideRevenue 
}) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [upcomingDues, setUpcomingDues] = useState<Resident[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [activeComplaints, setActiveComplaints] = useState<any[]>([]);
  const [totalCollectedRevenue, setTotalCollectedRevenue] = useState(0);
  const [overdueResidents, setOverdueResidents] = useState<Resident[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResidentForAlert, setSelectedResidentForAlert] = useState<Resident | null>(null);
  const [showBulkAlertModal, setShowBulkAlertModal] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [autoAlertsSent, setAutoAlertsSent] = useState<string[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [pendingHandovers, setPendingHandovers] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Rent Collection States
  const [collectingRentFor, setCollectingRentFor] = useState<Resident | null>(null);
  const [showDuesOptions, setShowDuesOptions] = useState(false);
  const [showComplaintsOptions, setShowComplaintsOptions] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      let [propsData, resData, staffData, complaintsData, upcomingDuesData, unitsData, paymentsData, pendingData] = await Promise.all([
        db.getProperties(ownerId),
        db.getResidents(ownerId),
        db.getStaff(ownerId),
        db.getComplaints(ownerId),
        db.getUpcomingDues(ownerId),
        db.getUnits(ownerId),
        db.getPayments({ ownerId }),
        db.getPendingPaymentsForCollector(user?.id || ownerId)
      ]);

      setAllStaff(staffData);
      setPendingHandovers(pendingData);

      // Filter based on role and assignments
      if (role === UserRole.RESIDENT && propertyId) {
        propsData = propsData.filter((p: any) => p.id === propertyId || p._id === propertyId);
        resData = resData.filter((r: any) => r.propertyId === propertyId);
        unitsData = unitsData.filter((u: any) => u.propertyId === propertyId);
        complaintsData = complaintsData.filter((c: any) => c.residentId === propertyId);
        upcomingDuesData = upcomingDuesData.filter((r: any) => r.propertyId === propertyId);
        paymentsData = paymentsData.filter((p: any) => p.propertyId === propertyId);
      } else if (role === UserRole.STAFF && assignedPropertyIds && assignedPropertyIds.length > 0) {
        propsData = propsData.filter((p: any) => assignedPropertyIds.includes(p.id) || assignedPropertyIds.includes(p._id));
        resData = resData.filter((r: any) => assignedPropertyIds.includes(r.propertyId));
        unitsData = unitsData.filter((u: any) => assignedPropertyIds.includes(u.propertyId));
        complaintsData = complaintsData.filter((c: any) => assignedPropertyIds.includes(c.propertyId));
        upcomingDuesData = upcomingDuesData.filter((r: any) => assignedPropertyIds.includes(r.propertyId));
        paymentsData = paymentsData.filter((p: any) => assignedPropertyIds.includes(p.propertyId));
      }

      // Calculate collected revenue for current month
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const currentDay = now.getDate();
      const monthlyCollected = paymentsData
        .filter((p: any) => {
          const pDate = new Date(p.date);
          return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear && (p.status === 'SUCCESS' || p.status === 'PAID');
        })
        .reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);

      setProperties(propsData);
      
      const residentLimit = PLAN_LIMITS[plan || SubscriptionTier.FREE]?.residents || 9999;
      const limitedResidents = resData.slice(0, residentLimit);
      setResidents(limitedResidents);
      
      setUnits(unitsData);
      setUpcomingDues(upcomingDuesData.filter(r => limitedResidents.find((lr: any) => lr.id === r.id || lr._id === r._id)));
      setStaffCount(getTierValue(plan) <= 1 ? 0 : staffData.length);
      setActiveComplaints(complaintsData.filter((c: any) => c.status !== 'Resolved'));
      setTotalCollectedRevenue(monthlyCollected);

      // Calculate overdue residents
      const overdue = resData.filter((res: any) => {
        if (res.dueDate >= currentDay) return false;
        const hasPaidThisMonth = paymentsData.some((p: any) => {
          const pDate = new Date(p.date);
          return (p.residentId === res.id || p.residentId === res._id) && 
                 pDate.getMonth() === currentMonth && 
                 pDate.getFullYear() === currentYear && 
                 (p.status === 'SUCCESS' || p.status === 'PAID');
        });
        return !hasPaidThisMonth;
      });
      setOverdueResidents(overdue);

      setRecentPayments(paymentsData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5));

      // Automatic Alert Check (only for owners/staff)
      if (role !== UserRole.RESIDENT) {
        const sent = await alertService.checkAndSendAutomaticAlerts(resData, propsData, plan);
        if (sent.length > 0) {
          setAutoAlertsSent(sent);
          // Refetch upcoming dues to update lastAlertMonth status
          const updatedDues = await db.getUpcomingDues(ownerId);
          setUpcomingDues(updatedDues);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ownerId, role, propertyId, assignedPropertyIds, plan]);

  const handleManualAlert = async (resident: Resident, channel: AlertChannel) => {
    setSendingAlert(true);
    try {
      const property = properties.find(p => p.id === resident.propertyId || p._id === resident.propertyId);
      await alertService.sendAlert(resident, channel, property?.name || 'Your Hostel');
      setSuccess(`${channel} alert sent successfully to ${resident.name}!`);
      setTimeout(() => setSuccess(null), 3000);
      setSelectedResidentForAlert(null);
      
      // Update local state
      const updatedResidents = await db.getResidents(ownerId);
      setResidents(updatedResidents);
      const updatedDues = await db.getUpcomingDues(ownerId);
      setUpcomingDues(updatedDues);
    } catch (error) {
      console.error("Failed to send alert:", error);
      setError("Failed to send alert. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSendingAlert(false);
    }
  };

  const handleBulkAlert = async (channel?: AlertChannel) => {
    const pendingAlerts = upcomingDues.filter(res => res.lastAlertMonth !== new Date().toISOString().substring(0, 7));
    if (pendingAlerts.length === 0) {
      setSuccess("All upcoming dues have already been alerted this month.");
      setTimeout(() => setSuccess(null), 3000);
      setShowBulkAlertModal(false);
      return;
    }

    setSendingAlert(true);
    try {
      const sent = await alertService.sendBulkAlerts(pendingAlerts, properties, plan, channel);
      setAutoAlertsSent(sent);
      setShowBulkAlertModal(false);
      
      // Update local state
      const updatedResidents = await db.getResidents(ownerId);
      setResidents(updatedResidents);
      const updatedDues = await db.getUpcomingDues(ownerId);
      setUpcomingDues(updatedDues);
    } catch (error) {
      console.error("Failed to send bulk alerts:", error);
      setError("Failed to send some alerts. Please check the logs.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSendingAlert(false);
    }
  };

  const handleBroadcast = async () => {
    if (!notifyTitle || !notifyBody) {
      setError("Please fill in both title and body.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setBroadcasting(true);
    try {
      await alertService.broadcastNotification(notifyTitle, notifyBody);
      setSuccess("Notification sent to all residents and staff!");
      setTimeout(() => setSuccess(null), 3000);
      setShowNotifyModal(false);
      setNotifyTitle('');
      setNotifyBody('');
    } catch (error) {
      console.error("Failed to broadcast:", error);
      setError("Failed to send broadcast.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleStartCollection = (resident: Resident) => {
    setCollectingRentFor(resident);
  };

  const availableChannels = alertService.getAvailableChannels(plan);

  const totalCapacity = units.reduce((acc, u) => acc + (u.capacity || 0), 0);
  const monthlyTargetRevenue = residents.reduce((acc, r) => acc + (r.rent || 0), 0);
  const totalPropertiesRevenue = properties.reduce((acc, p) => acc + (p.revenue || 0), 0);
  const currentPlanLimits = PLAN_LIMITS[plan || SubscriptionTier.FREE];
  
  const currentTierValue = getTierValue(plan || SubscriptionTier.FREE);
  const hasReports = currentTierValue >= 2; // PRO and above
  const hasPayments = currentTierValue >= 1; // LITE and above
  const hasAutomation = plan !== SubscriptionTier.TRIAL && currentTierValue >= 2;
  const hasComplaints = currentTierValue >= 2;
  const hasExpenses = currentTierValue >= 2;
  const hasStaff = currentTierValue >= 2;
  const hasMeals = currentTierValue >= 2;
  const hasInventory = currentTierValue >= 3;
  const hasMultiProperty = currentTierValue >= 3;

  const handleVerifyHandover = async (handover: any, otp: string) => {
    setApprovingId(handover.id || handover._id);
    try {
      await db.verifyOtpAndPay({
        residentId: handover.residentId,
        otp: otp
      });
      await fetchData();
    } catch (error: any) {
      console.error("Error verifying handover:", error);
      setError(error.message || "Invalid OTP. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
           <Icons.Property />
        </div>
        <h2 className="text-2xl font-black text-slate-900">
          {role === UserRole.OWNER ? 'No Properties Found' : 'No Properties Assigned'}
        </h2>
        <p className="text-slate-500 max-w-sm">
          {role === UserRole.OWNER 
            ? 'Start by adding your first hostel property to see analytics here.' 
            : "You haven't been assigned to any properties yet. Please contact the owner."}
        </p>
        {role === UserRole.OWNER && (
          <button 
            onClick={onAddProperty}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100"
          >
            + Add My First Property
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {plan === SubscriptionTier.TRIAL && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl rounded-[2rem] border-b-4 border-blue-800/30 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center animate-bounce shadow-inner border border-white/20">
              <Icons.Plus className="w-8 h-8 rotate-45 text-white" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-tighter mb-0.5">Active Pro Trial: 7 Days Remaining</p>
              <p className="text-[10px] font-bold text-blue-50 opacity-90 uppercase tracking-widest max-w-sm leading-relaxed">
                You have Pro Pack limits (150 residents, Reports). <span className="text-yellow-300">Billing automation</span> requires a paid upgrade.
              </p>
            </div>
          </div>
          <button 
            onClick={onUpgrade}
            className="px-8 py-3 bg-white text-blue-700 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-50 transition-all shadow-2xl shadow-blue-900/40 hover:-translate-y-0.5 active:scale-95 relative z-10 shrink-0"
          >
            Upgrade to Pro Pack
          </button>
        </div>
      )}
      {/* Notifications */}
      {(success || error) && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300 w-[90%] md:w-auto">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            success ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            <div className={`w-2 h-2 rounded-full ${success ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <p className="text-sm font-black uppercase tracking-tight">{success || error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Hostel Insights</h1>
          <p className="text-slate-500 font-medium italic">Live metrics and proactive billing alerts.</p>
        </div>
      </div>

      {/* Pending Handover Notifications (Flow 3) */}
      {pendingHandovers.length > 0 && (
        <div className="space-y-4">
          {pendingHandovers.map((handover, idx) => (
            <PendingPaymentItem 
              key={idx}
              pending={handover}
              onVerify={(otp) => handleVerifyHandover(handover, otp)}
              verifying={approvingId === (handover.id || handover._id)}
              currentUserId={user?.id || ownerId}
              onRefresh={fetchData}
            />
          ))}
        </div>
      )}

      {/* Critical Alerts Center: Upcoming Dues & Active Complaints */}
      {(role === UserRole.OWNER || canCollectCash) && (upcomingDues.length > 0 || (hasComplaints && activeComplaints.length > 0)) && (
        <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className={`grid ${hasComplaints && activeComplaints.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} divide-x divide-slate-100`}>
            {/* Upcoming Dues Section */}
            <button 
              onClick={() => setShowDuesOptions(true)}
              className="p-4 md:p-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0 border border-orange-100 group-hover:scale-110 transition-transform shadow-sm">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-tight md:tracking-widest truncate leading-tight">Upcoming Dues</h2>
                  <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tight opacity-70">Next 3 days</p>
                </div>
              </div>
              <div className="flex items-center shrink-0 ml-auto">
                <span className="bg-orange-50 text-orange-600 w-6 h-6 md:w-8 md:h-8 rounded-full text-[10px] md:text-xs font-black flex items-center justify-center border border-orange-100 shadow-sm">
                  {upcomingDues.length}
                </span>
              </div>
            </button>
 
            {/* Active Complaints Section */}
            {hasComplaints && activeComplaints.length > 0 && (
              <button 
                onClick={() => setShowComplaintsOptions(true)}
                className="p-4 md:p-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0 border border-rose-100 group-hover:scale-110 transition-transform shadow-sm">
                    <Icons.Complaints className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-tight md:tracking-widest truncate leading-tight">Active Complaints</h2>
                    <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tight opacity-70">Requires attention</p>
                  </div>
                </div>
                <div className="flex items-center shrink-0 ml-auto">
                  <span className="bg-rose-50 text-rose-600 w-6 h-6 md:w-8 md:h-8 rounded-full text-[10px] md:text-xs font-black flex items-center justify-center border border-rose-100 shadow-sm">
                    {activeComplaints.length}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Staff Personal Info - Only for Staff without Cash Collection Permission */}
      {role === UserRole.STAFF && !canCollectCash && (
        <div className="grid grid-cols-1 gap-6 mb-6">
          <div className="md:col-span-2 bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-blue-100">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">My Profile & Benefits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <Icons.Staff />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{user?.category || 'Monthly Salary'}</p>
                    <p className="text-xl font-black text-slate-900">{formatCurrency(allStaff.find(s => s.email === user?.email)?.salary || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Holidays Taken</p>
                    <p className="text-xl font-black text-slate-900">0 Days</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 h-full">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assigned Properties</p>
                  <div className="flex flex-wrap gap-2">
                    {properties.map(p => (
                      <span key={p.id || (p as any)._id} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                        {p.name}
                      </span>
                    ))}
                    {properties.length === 0 && <p className="text-[10px] text-slate-400 italic">No properties assigned yet.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Quick Actions</h2>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  if (!hasComplaints) { onUpgrade(); return; }
                  onViewComplaints();
                }}
                className={`w-full p-4 border rounded-2xl flex items-center gap-4 transition-all group ${
                  hasComplaints 
                    ? 'bg-slate-50 hover:bg-blue-50 border-slate-100 hover:border-blue-200' 
                    : 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  hasComplaints ? 'bg-white text-slate-400 group-hover:text-blue-600' : 'bg-slate-100 text-slate-300'
                }`}>
                  <Icons.Complaints />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black uppercase tracking-tight ${hasComplaints ? 'text-slate-900' : 'text-slate-400'}`}>View Complaints</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {hasComplaints ? 'Check resident issues' : 'Lite Plan Feature'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {role === UserRole.OWNER ? (
          <>
            <div className="relative col-span-2 lg:col-span-4">
              {(!hasPayments || hideRevenue) && (
                <div className="absolute inset-0 z-10 bg-white/60 rounded-2xl flex flex-col items-center justify-center p-2 text-center group cursor-pointer" onClick={onUpgrade}>
                  <Icons.Lock className="w-4 h-4 text-amber-600 mb-1" />
                  <span className="text-[8px] font-black text-blue-600 uppercase underline decoration-2 underline-offset-2">
                    {hideRevenue ? 'Revenue Hidden' : 'Unlock Payments'}
                  </span>
                </div>
              )}
              <StatCard 
                key="stat-revenue"
                title="Total Revenue" 
                current={hideRevenue ? 0 : totalCollectedRevenue} 
                total={hideRevenue ? 1 : (monthlyTargetRevenue || 1)} 
                isCurrency 
                icon={Icons.Payments}
              />
            </div>
            <div className="col-span-1 md:col-span-1">
              <StatCard 
                key="stat-total-rooms"
                title="Total Rooms" 
                current={units.length} 
                total={units.length} 
                unit="Rooms"
                icon={Icons.Property}
              />
            </div>
            <div className="col-span-1 md:col-span-1">
              <StatCard 
                key="stat-available"
                title="Available Now" 
                current={units.filter(u => u.status === RoomStatus.VACANT).length} 
                total={units.length} 
                unit="Rooms"
                icon={Icons.Dashboard}
              />
            </div>
            <div className="col-span-1 md:col-span-1">
              <StatCard 
                key="stat-partial"
                title="Partially Occupied" 
                current={units.filter(u => u.status === RoomStatus.PARTIAL).length} 
                total={units.length} 
                unit="Rooms"
                icon={Icons.Staff}
              />
            </div>
            <div className="col-span-1 md:col-span-1">
              <StatCard 
                key="stat-full"
                title="Full Rooms" 
                current={units.filter(u => u.status === RoomStatus.FULL).length} 
                total={units.length} 
                unit="Rooms"
                icon={Icons.Home}
              />
            </div>
          </>
        ) : (
          <>
            {(role === UserRole.OWNER || canCollectCash) && hasPayments && !hideRevenue && (
              <div className="col-span-2 lg:col-span-4">
                <StatCard 
                  key="stat-revenue"
                  title="Revenue Collected" 
                  current={totalCollectedRevenue} 
                  total={monthlyTargetRevenue || 1} 
                  isCurrency 
                  icon={Icons.Payments}
                />
              </div>
            )}
            <div className="col-span-1">
              <StatCard 
                key="stat-properties"
                title="Properties" 
                current={properties.length} 
                total={currentPlanLimits.properties || properties.length} 
                unit="Hostels"
                icon={Icons.Property}
              />
            </div>
            {(role === UserRole.OWNER || canCollectCash) && (
              <div className="col-span-1">
                <StatCard 
                  key="stat-beds"
                  title="Beds Occupied" 
                  current={residents.length} 
                  total={totalCapacity} 
                  unit="Beds"
                  icon={Icons.Home}
                />
              </div>
            )}
            <div className="col-span-1">
              <StatCard 
                key="stat-alerts"
                title="Billing Alerts" 
                current={upcomingDues.length} 
                total={residents.length} 
                unit="Alerts"
                icon={Icons.Payments}
              />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {(role === UserRole.OWNER || canCollectCash) && (
          <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
            {!hasPayments && (
               <div className="absolute inset-0 z-20 bg-white/80 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4 border border-blue-100 shadow-xl shadow-blue-50/50">
                    <Icons.Payments className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Payment Tracking Locked</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest max-w-[240px] mb-6 leading-relaxed">
                    Monitor who paid, track dues, and manage receipts in Lite plan.
                  </p>
                  <button 
                    onClick={onUpgrade}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-blue-200 hover:scale-105 active:scale-95 transition-all"
                  >
                    🚀 Upgrade to Lite
                  </button>
               </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 uppercase text-[10px] md:text-xs tracking-widest">Overdue Payments</h3>
                {overdueResidents.length > 0 && (
                  <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                    {overdueResidents.length}
                  </span>
                )}
              </div>
              <button 
                onClick={onViewPayments}
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
              >
                View All
              </button>
            </div>
            <div className="space-y-4 flex-1">
               {overdueResidents.slice(0, 3).map((res, index) => (
                 <div key={res.id || (res as any)._id || `res-${index}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group/item hover:border-rose-200 transition-all">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center font-black text-rose-400 group-hover/item:text-rose-600 transition-colors">
                       {res.name?.[0] || '?'}
                     </div>
                     <div>
                       <p className="text-xs font-black text-slate-900">{res.name}</p>
                       <p className="text-[9px] font-bold text-rose-400 uppercase tracking-tight">Due on {res.dueDate}th • Overdue</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <p className="text-xs font-black text-rose-600">{formatCurrency(res.rent)}</p>
                     <button 
                       onClick={() => handleStartCollection(res)}
                       className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-sm"
                     >
                       Collect Rent
                     </button>
                   </div>
                 </div>
               ))}
               {overdueResidents.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                   <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                   </div>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-tight">All caught up!</p>
                   <p className="text-[10px] text-slate-300 font-medium">No overdue payments found.</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {(role === UserRole.OWNER || canCollectCash) && (
          <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 uppercase text-[10px] md:text-xs tracking-widest">Recent Transactions</h3>
              <button 
                onClick={onViewPayments}
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
              >
                View All
              </button>
            </div>
            <div className="space-y-4 flex-1">
               {recentPayments.slice(0, 3).map((payment, index) => {
                 const resident = residents.find(r => r.id === payment.residentId || (r as any)._id === payment.residentId);
                 return (
                   <div key={payment.id || payment._id || `payment-${index}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group/item hover:border-blue-200 transition-all">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-emerald-600">
                         <Icons.Payments />
                       </div>
                       <div>
                         <p className="text-sm font-black text-slate-900">{resident?.name || 'Resident'}</p>
                         <div className="flex items-center gap-2">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{new Date(payment.date).toLocaleDateString()}</p>
                           <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-black uppercase">
                             {payment.paymentMethod || 'Offline'}
                           </span>
                         </div>
                         {payment.paymentMethod === 'CASH' && payment.collectorName && (
                           <p className="text-[9px] font-bold text-blue-500 uppercase tracking-tight mt-0.5">
                             To: {payment.collectorName}
                           </p>
                         )}
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="text-sm font-black text-emerald-600">+{formatCurrency(payment.amount)}</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{payment.status}</p>
                     </div>
                   </div>
                 );
               })}
               {recentPayments.length === 0 && (
                 <p className="text-slate-400 text-xs italic text-center py-10">No recent transactions.</p>
               )}
            </div>
          </div>
        )}

        {role === UserRole.OWNER ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className={`bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[400px] relative`}>
              {(!hasReports || hideRevenue) && (
                <div className="absolute inset-0 z-10 bg-white/60 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                   <div className="w-16 h-16 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-center text-blue-600 mb-6 border border-slate-50">
                     <Icons.Dashboard className="w-8 h-8" />
                   </div>
                   <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">
                     {hideRevenue ? 'Revenue Hidden' : 'Reports & Analytics'}
                   </h4>
                   <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest max-w-[240px] mb-8 leading-relaxed opacity-60">
                     {hideRevenue ? 'Revenue data is not included in your current plan.' : 'Reports available in Pro plan and above.'}
                   </p>
                   <button 
                     onClick={onUpgrade}
                     className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                   >
                     🚀 {user?.plan === SubscriptionTier.FREE ? 'Upgrade to Lite' : 'Unlock Pro'}
                   </button>
                   {!hideRevenue && <p className="mt-8 text-[10px] font-black text-blue-600 uppercase tracking-widest italic opacity-80">"Automate rent collection and save hours"</p>}
                </div>
              )}
              <div className="p-6 md:p-8 pb-4">
                <h3 className="font-black text-slate-900 uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2">
                  <div className="w-1 h-3 bg-blue-600 rounded-full"></div>
                  Revenue Forecast (6 Months)
                </h3>
              </div>
              <div className="flex-1 w-full relative min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}}
                      tickFormatter={(value) => `₹${value/1000}k`}
                    />
                    <Tooltip 
                      cursor={{stroke: '#2563EB', strokeWidth: 1, strokeDasharray: '4 4'}} 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}} 
                      labelStyle={{fontWeight: 'black', color: '#1e293b', marginBottom: '4px', textTransform: 'uppercase', fontSize: '12px'}}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#2563EB" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
              <h3 className="font-black text-slate-900 mb-6 md:mb-8 uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2">
                <div className="w-1 h-3 bg-blue-600 rounded-full"></div>
                Property Distribution
              </h3>
              <div className="flex-1 flex flex-col justify-center gap-4 md:gap-6">
                 {properties.slice(0, 4).map((p, index) => (
                   <button 
                     key={p.id || (p as any)._id || `prop-dist-${index}`} 
                     onClick={() => onViewProperty(p.id || (p as any)._id)}
                     className="w-full text-left space-y-2 group/prop transition-all hover:translate-x-1"
                   >
                     <div className="flex justify-between items-center text-[10px] md:text-xs font-black uppercase tracking-tight mb-1">
                        <span className="text-slate-500 truncate max-w-[120px] md:max-w-none group-hover/prop:text-blue-600 transition-colors flex items-center gap-2">
                          <Icons.Property className="w-4 h-4" />
                          {p.name}
                        </span>
                        <span className="text-blue-600 shrink-0">{formatCurrency(p.revenue)}</span>
                     </div>
                     <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 group-hover/prop:border-blue-100 transition-colors">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(37,99,235,0.2)]" 
                          style={{ width: `${Math.min(100, (p.revenue / (totalPropertiesRevenue || 1)) * 100)}%` }}
                        ></div>
                     </div>
                   </button>
                 ))}
                 {properties.length === 0 && (
                   <p className="text-slate-400 text-xs italic text-center">No property data available.</p>
                 )}
              </div>
            </div>
          </div>
        ) : (
          <div className={`bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100`}>
            <h3 className="font-black text-slate-900 mb-6 md:mb-8 uppercase text-[10px] md:text-xs tracking-widest">Assigned Properties Overview</h3>
            <div className="grid grid-cols-1 gap-6">
               {properties.map((p, index) => (
                 <div key={p.id || (p as any)._id || `prop-overview-${index}`} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="font-black text-slate-900 mb-1">{p.name}</h4>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-4">{p.city}</p>
                    <div className="flex justify-between items-center">
                       <span className="text-[11px] font-black text-slate-500 uppercase">Capacity</span>
                       <span className="text-base font-black text-blue-600">{p.totalRooms} Rooms</span>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* Dues Options Modal */}
      {showDuesOptions && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowDuesOptions(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto scrollbar-hide">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 text-center">Upcoming Dues Actions</h3>
            <div className="space-y-3">
              {!hasAutomation && (
                <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-[1.5rem] mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                      <Icons.Lock className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-900 uppercase tracking-tight">Automation Locked</p>
                      <p className="text-[8px] text-amber-600 font-bold uppercase tracking-widest">Upgrade to Unlock</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-amber-700 font-bold leading-relaxed mb-4">
                    Billing automation (auto-reminders 3 days before due date) is only available in the Pro Pack.
                  </p>
                  <button 
                    onClick={() => {
                      setShowDuesOptions(false);
                      onUpgrade();
                    }}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-amber-100 flex items-center justify-center gap-2"
                  >
                    🚀 Upgrade Now
                  </button>
                </div>
              )}
              <button 
                onClick={() => {
                  if (!hasAutomation) {
                    onUpgrade();
                    return;
                  }
                  setShowDuesOptions(false);
                  setShowNotifyModal(true);
                }}
                className={`w-full p-4 border rounded-2xl flex items-center gap-4 transition-all group ${
                  hasAutomation 
                    ? 'bg-orange-50 hover:bg-orange-100 border-orange-100' 
                    : 'bg-slate-50 border-slate-100 grayscale cursor-not-allowed opacity-70'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                  hasAutomation ? 'bg-white text-orange-600' : 'bg-slate-100 text-slate-300'
                }`}>
                  <Icons.Complaints className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className={`text-xs font-black uppercase tracking-tight ${hasAutomation ? 'text-slate-900' : 'text-slate-400'}`}>Notify All</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {hasAutomation ? 'App Notification to all users' : 'Pro Pack Feature'}
                  </p>
                </div>
              </button>
              <button 
                onClick={() => {
                  setShowDuesOptions(false);
                  onViewPayments('upcoming-dues');
                }}
                className="w-full p-4 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl flex items-center gap-4 transition-all group"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                  <Icons.Payments />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Show All</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">View detailed billing</p>
                </div>
              </button>
            </div>
            <button 
              onClick={() => setShowDuesOptions(false)}
              className="w-full mt-6 py-2 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Notify All Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setShowNotifyModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-[1.25rem] flex items-center justify-center border border-orange-100 shadow-sm shrink-0">
                <Icons.Complaints className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">App Notification</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Broadcast to all residents & staff</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notification Title</label>
                <input 
                  type="text"
                  placeholder="e.g. Hostel Maintenance Update"
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message Body</label>
                <textarea 
                  placeholder="Type your message here..."
                  value={notifyBody}
                  onChange={(e) => setNotifyBody(e.target.value)}
                  rows={4}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowNotifyModal(false)}
                  className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition"
                  disabled={broadcasting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBroadcast}
                  disabled={broadcasting || !notifyTitle || !notifyBody}
                  className="flex-[2] py-4 bg-slate-900 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-2"
                >
                  {broadcasting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  )}
                  {broadcasting ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complaints Options Modal */}
      {showComplaintsOptions && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowComplaintsOptions(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto scrollbar-hide">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 text-center">Complaints Actions</h3>
            <div className="space-y-3">
              <button 
                onClick={async () => {
                  setShowComplaintsOptions(false);
                  const propertyName = properties[0]?.name || 'Your Hostel';
                  await alertService.notifyStaffAboutComplaints(propertyName, activeComplaints.length);
                  setSuccess("Staff notified via App about active complaints.");
                  setTimeout(() => setSuccess(null), 3000);
                }}
                className="w-full p-4 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-2xl flex items-center gap-4 transition-all group"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-600 shadow-sm">
                  <Icons.Complaints />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Remind Staff</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Escalate pending issues</p>
                </div>
              </button>
              <button 
                onClick={() => {
                  setShowComplaintsOptions(false);
                  onViewComplaints();
                }}
                className="w-full p-4 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl flex items-center gap-4 transition-all group"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                  <Icons.Complaints />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Show All</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">View all complaints</p>
                </div>
              </button>
            </div>
            <button 
              onClick={() => setShowComplaintsOptions(false)}
              className="w-full mt-6 py-2 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Rent Collection Modal */}
      <RentCollectionModal 
        resident={collectingRentFor}
        onClose={() => setCollectingRentFor(null)}
        onSuccess={fetchData}
        ownerId={ownerId}
        allStaff={allStaff}
        currentUser={user}
        plan={plan}
        onUpgrade={onUpgrade}
      />

      {/* Bulk Alert Modal */}
      {showBulkAlertModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowBulkAlertModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] p-8 md:p-10 shadow-2xl animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-black shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Bulk Rent Alert</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">To {upcomingDues.filter(res => res.lastAlertMonth !== new Date().toISOString().substring(0, 7)).length} Residents</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Channel (Based on your {plan} plan)</p>
              <div className="grid grid-cols-2 gap-3">
                {(['APP', 'EMAIL', 'SMS', 'WHATSAPP'] as AlertChannel[]).map(channel => {
                  const isAvailable = availableChannels.includes(channel);
                  return (
                    <button
                      key={channel}
                      disabled={sendingAlert}
                      onClick={() => {
                        if (isAvailable) {
                          handleBulkAlert(channel);
                        } else {
                          onUpgrade();
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all relative overflow-hidden group ${
                        isAvailable 
                          ? 'bg-white border-slate-100 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-blue-600' 
                          : 'bg-slate-50 border-slate-100 text-slate-300 grayscale grayscale-[0.8]'
                      }`}
                    >
                      {!isAvailable && (
                        <div className="absolute top-2 right-2">
                          <Icons.Lock className="w-3 h-3 text-slate-300" />
                        </div>
                      )}
                      <div className={`p-2 rounded-xl transition-colors ${isAvailable ? 'bg-slate-100 group-hover:bg-blue-100' : 'bg-slate-50'}`}>
                        {channel === 'APP' && <Icons.Dashboard />}
                        {channel === 'EMAIL' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" /></svg>}
                        {channel === 'SMS' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
                        {channel === 'WHATSAPP' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest">{channel}</span>
                      {!isAvailable && (
                        <div className="flex flex-col items-center text-center mt-1">
                          <span className="text-[7px] font-black text-amber-600 uppercase tracking-tight">Lock</span>
                          <span className="text-[6px] text-slate-400 font-bold uppercase tracking-tight">Upgrade Only</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-8">
              <button 
                onClick={() => setShowBulkAlertModal(false)} 
                className="flex-1 py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Alert Modal */}
      {selectedResidentForAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setSelectedResidentForAlert(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] p-8 md:p-10 shadow-2xl animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-black shrink-0">
                {selectedResidentForAlert.name?.[0] || '?'}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Send Rent Alert</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">To {selectedResidentForAlert.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Channel (Based on your {plan} plan)</p>
              <div className="grid grid-cols-2 gap-3">
                {(['APP', 'EMAIL', 'SMS', 'WHATSAPP'] as AlertChannel[]).map(channel => {
                  const isAvailable = availableChannels.includes(channel);
                  return (
                    <button
                      key={channel}
                      disabled={sendingAlert}
                      onClick={() => {
                        if (isAvailable) {
                          handleManualAlert(selectedResidentForAlert, channel);
                        } else {
                          onUpgrade();
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${
                        isAvailable 
                          ? 'bg-white border-slate-100 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-blue-600' 
                          : 'bg-slate-50 border-slate-100 hover:border-amber-200 text-slate-400 opacity-80'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${isAvailable ? 'bg-slate-100 group-hover:bg-blue-100' : 'bg-slate-50'}`}>
                        {channel === 'APP' && <Icons.Dashboard />}
                        {channel === 'EMAIL' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                        {channel === 'SMS' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
                        {channel === 'WHATSAPP' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest">{channel}</span>
                      {!isAvailable && (
                        <div className="flex flex-col items-center text-center">
                          <span className="text-[7px] font-bold text-amber-600 uppercase tracking-tight">Upgrade Available</span>
                          <span className="text-[6px] text-slate-400 font-medium whitespace-nowrap">👉 Only in Pro+</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-8">
              <button 
                onClick={() => setSelectedResidentForAlert(null)} 
                className="flex-1 py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Alert Notification */}
      {autoAlertsSent.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[110] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 flex items-center gap-4 border-b-4 border-emerald-800">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-tight">Auto Alerts Sent</p>
            <p className="text-[10px] font-bold text-emerald-50 opacity-80 uppercase tracking-widest">Sent to {autoAlertsSent.length} residents due in 3 days</p>
          </div>
          <button onClick={() => setAutoAlertsSent([])} className="ml-4 text-white/60 hover:text-white transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
