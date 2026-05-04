
import React, { useMemo, useState, useEffect } from 'react';
import { formatCurrency, formatCompactCurrency, Icons } from '../constants';
import { db } from '../services/mockData';
import { Resident, Complaint, ComplaintStatus, Payment, HostelUpdate, SubscriptionTier, getTierValue, User } from '../types';
import PendingPaymentItem from './PendingPaymentItem';
import { Coffee, Utensils, Pizza, Cookie } from 'lucide-react';
import PaymentReceipt from './PaymentReceipt';

interface ResidentAppProps {
  residentId: string;
  onNavigate?: (tab: string) => void;
  plan?: SubscriptionTier;
}

const formatTo12Hr = (timeStr?: string) => {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const ResidentApp: React.FC<ResidentAppProps> = ({ residentId, onNavigate, plan }) => {
  const currentTierValue = getTierValue(plan || SubscriptionTier.FREE);
  const isOnlineLocked = currentTierValue < 2; // Needs PRO
  const isMealsLocked = currentTierValue < 3; // Needs BUSINESS
  const isLitePlan = currentTierValue <= 1;

  const [currentResident, setCurrentResident] = useState<Resident | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeComplaints, setActiveComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintData, setComplaintData] = useState({ title: '', description: '', category: 'Maintenance' });
  const [submitting, setSubmitting] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [showPayCashModal, setShowPayCashModal] = useState(false);
  const [payCashStep, setPayCashStep] = useState<'select' | 'verify'>('select');
  const [activePendingId, setActivePendingId] = useState<string | null>(null);
  const [selectedCollector, setSelectedCollector] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [allCollectors, setAllCollectors] = useState<any[]>([]);
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [residentOtp, setResidentOtp] = useState('');
  const [showInitiateSuccess, setShowInitiateSuccess] = useState(false);
  const [showShareOtpModal, setShowShareOtpModal] = useState(false);
  const [sharingPayment, setSharingPayment] = useState<any>(null);
  const [complaintsDismissed, setComplaintsDismissed] = useState(false);
  const [updates, setUpdates] = useState<HostelUpdate[]>([]);
  const [todayMeal, setTodayMeal] = useState<any>(null);
  const [ownerInfo, setOwnerInfo] = useState<User | null>(null);
  const [showOnlinePaymentModal, setShowOnlinePaymentModal] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);

  const fetchResidentAndPayments = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const residents = await db.getResidents();
      const resident = residents.find(r => r.id === residentId || r.email === residentId);
      
      if (resident) {
        setCurrentResident(resident);
        const [residentPayments, residentComplaints, pending, staffList, ownerData, hostelUpdates, mealPlans] = await Promise.all([
          db.getPayments({ residentId: resident.id }),
          db.getComplaints(resident.ownerId),
          db.getPendingPaymentsForResident(resident.id),
          db.getStaff(resident.ownerId),
          db.getUsers().then(users => users.find(u => u.id === resident.ownerId || u._id === resident.ownerId)),
          db.getUpdates({ ownerId: resident.ownerId, propertyId: resident.propertyId }),
          db.getMealPlans(resident.ownerId, resident.propertyId)
        ]);
        setPayments(residentPayments);
        setActiveComplaints(residentComplaints.filter((c: Complaint) => c.residentId === resident.id && c.status !== ComplaintStatus.RESOLVED));
        setPendingPayments(pending);
        setUpdates(hostelUpdates);
        setOwnerInfo(ownerData || null);
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = days[new Date().getDay()];
        const todayPlan = mealPlans.find((p: any) => p.day === todayName);
        if (todayPlan) setTodayMeal(todayPlan);
        
        // If there's an active pending payment, track it
        if (pending && pending.length > 0) {
          setActivePendingId(pending[0].id || pending[0]._id);
        } else {
          setActivePendingId(null);
        }
        
        // Prepare collector list: Owner + Staff who can collect cash
        const collectors = [];
        if (ownerData) {
          collectors.push({
            id: ownerData.id || ownerData._id,
            name: ownerData.name + ' (Owner)',
            role: 'OWNER'
          });
        }
        staffList.filter((s: any) => s.canCollectCash && s.status === 'active').forEach((s: any) => {
          collectors.push({
            id: s.id || s._id,
            name: s.name + ' (Staff)',
            role: 'STAFF'
          });
        });
        setAllCollectors(collectors);
        setPayAmount(resident.rent.toString());
      }
    } catch (error: any) {
      console.error("Error fetching resident data:", error);
      setError(error.message || "Failed to fetch dashboard data. Please check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidentAndPayments();
    
    // Poll for updates every 10 seconds (Payments, Pending OTPs, balance)
    const pollInterval = setInterval(() => {
      fetchResidentAndPayments(true);
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [residentId, currentResident?.id]);

  const handlePhonePePayment = async () => {
    if (!currentResident || !ownerInfo || !payAmount) return;
    setLoading(true);
    try {
      const response = await db.createPhonePeOrder({
        amount: parseFloat(payAmount),
        residentId: currentResident.id,
        propertyId: currentResident.propertyId,
        ownerId: ownerInfo.id || (ownerInfo as any)._id
      });
      
      if (response.success && response.redirectUrl) {
        // In a real app, this would redirect to the real gateway
        // For the demo, we show the mock URL
        window.open(response.redirectUrl, '_blank');
        setSuccess('Payment gateway opened in new tab.');
        setShowOnlinePaymentModal(false);
      }
    } catch (err: any) {
      setError(err.message || 'PhonePe payment failed to initialize');
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!currentResident || !ownerInfo || !payAmount) return;
    setLoading(true);
    try {
      // Mock Razorpay initialization
      alert(`Razorpay Integration: Initializing payment for ₹${payAmount} with Key ID: ${ownerInfo.razorpayKeyId}`);
      // In a real app, you'd load Rzp script and call .open()
      setShowOnlinePaymentModal(false);
      setSuccess('Razorpay payment initiated.');
    } catch (err: any) {
      setError(err.message || 'Razorpay payment failed to initialize');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateCashPayment = async () => {
    if (!currentResident || !selectedCollector || !payAmount) return;
    const collectorId = selectedCollector.id || selectedCollector._id;
    if (!collectorId) {
      console.error("Collector ID is missing:", selectedCollector);
      setError("Error: Collector information is incomplete. Please try again.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setInitiatingPayment(true);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const result = await db.createPendingPayment({
        otp,
        ownerId: currentResident.ownerId,
        residentId: currentResident.id,
        propertyId: currentResident.propertyId,
        amount: parseInt(payAmount),
        collectorId,
        collectorName: selectedCollector.name,
        initiatorId: currentResident.id,
        initiatorRole: 'RESIDENT'
      });
      setResidentOtp(otp);
      setActivePendingId(result.id || result._id);
      setPayCashStep('verify');
      await fetchResidentAndPayments();
    } catch (error) {
      console.error("Error initiating payment:", error);
      setError("Failed to initiate payment.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setInitiatingPayment(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    if (!currentResident || otp.length !== 6) return;

    setVerifyingOtp(true);
    try {
      await db.verifyOtpAndPay({
        residentId: currentResident.id,
        otp: otp
      });

      setSuccess('Cash payment confirmed successfully!');
      setTimeout(() => setSuccess(null), 3000);
      setShowPayCashModal(false);
      setShowShareOtpModal(false);
      setPayCashStep('select');
      setActivePendingId(null);
      await fetchResidentAndPayments();
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      setError(error.message || 'Invalid OTP. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleRaiseComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentResident) return;
    
    setSubmitting(true);
    try {
      const newComplaint: Complaint = {
        id: Math.random().toString(36).substr(2, 9),
        ownerId: currentResident.ownerId,
        title: complaintData.title,
        description: complaintData.description,
        residentId: currentResident.id,
        residentName: currentResident.name,
        targetType: 'PROPERTY',
        propertyId: currentResident.propertyId,
        category: complaintData.category,
        priority: 'Medium',
        status: ComplaintStatus.OPEN,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        createdBy: 'RESIDENT',
        creatorId: currentResident.id
      };
      await db.saveComplaint(newComplaint);
      setShowComplaintModal(false);
      setComplaintData({ title: '', description: '', category: 'Maintenance' });
      setSuccess('Complaint raised successfully!');
      setTimeout(() => setSuccess(null), 3000);
      fetchResidentAndPayments();
    } catch (error) {
      console.error("Error raising complaint:", error);
      setError("Failed to raise complaint.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadInvoice = (ledgerId: string) => {
    setSuccess(`Downloading invoice... (Mock PDF)`);
    setTimeout(() => setSuccess(null), 3000);
    console.log(`Downloading invoice for ${ledgerId}... (Mock PDF generation)`);
  };

  // Calculate if due date is within 3 days
  const billingStatus = useMemo(() => {
    if (!currentResident) return null;
    
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    let diff = currentResident.dueDate - currentDay;
    
    // Handle month wrap-around
    if (diff < 0) {
      diff = (daysInMonth - currentDay) + currentResident.dueDate;
    }

    return {
      daysRemaining: diff,
      isUpcoming: diff >= 0 && diff <= 3
    };
  }, [currentResident]);

  const paymentStatusInfo = useMemo(() => {
    if (!currentResident || !payments || payments.length === 0) {
      return { status: 'PENDING' as const };
    }
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Check if paid for current month
    const hasPaidCurrent = payments.some(p => {
      const pDate = new Date(p.date);
      return pDate.getMonth() === currentMonth && 
             pDate.getFullYear() === currentYear && 
             p.status === 'SUCCESS';
    });

    // Find the latest successful payment
    const sortedPayments = [...payments]
      .filter(p => p.status === 'SUCCESS')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const latestPayment = sortedPayments[0];
    let clearedUntil = '';
    if (latestPayment) {
      const pDate = new Date(latestPayment.date);
      clearedUntil = pDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
    }
    
    return {
      status: hasPaidCurrent ? 'CLEARED' as const : 'PENDING' as const,
      clearedUntil
    };
  }, [currentResident, payments]);

  useEffect(() => {
    // If we have an active pending payment and it's gone from the list, 
    // it likely means it was verified by the collector.
    if (activePendingId && !pendingPayments.find(p => p.id === activePendingId || p._id === activePendingId)) {
      setShowPayCashModal(false);
      setShowShareOtpModal(false);
      setPayCashStep('select');
      setActivePendingId(null);
      fetchResidentAndPayments();
    }
  }, [activePendingId, pendingPayments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentResident) {
    return (
      <div className="p-12 text-center">
         <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
         <p className="text-slate-500">Your resident profile could not be found. Please contact your property owner.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-4 max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 animate-in fade-in duration-500">
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
      {/* Notification Banners */}
      <div className="space-y-4">
        {/* Flow 1/2: Owner/Staff initiated, Resident needs to share OTP */}
        {pendingPayments.filter(p => p.initiatorRole !== 'RESIDENT').map((pending, idx) => (
          <div 
            key={`pending-share-${pending.id || pending._id || idx}`} 
            onClick={() => {
              setSharingPayment(pending);
              setShowShareOtpModal(true);
            }}
            className="bg-blue-600 text-white rounded-2xl md:rounded-[1.5rem] p-4 md:p-6 shadow-xl shadow-blue-100 animate-in slide-in-from-top-4 duration-500 cursor-pointer hover:bg-blue-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center  border border-white/30 shrink-0">
                  <Icons.Payments />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black uppercase tracking-tight">Handover OTP for {pending.collectorName}</h3>
                  <p className="text-blue-50 text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">
                    Click to view OTP for {formatCurrency(pending.amount)}
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
            </div>
          </div>
        ))}

        {/* Flow 3: Resident initiated, Resident needs to enter OTP from collector */}
        {pendingPayments.filter(p => p.initiatorRole === 'RESIDENT').map((pending, idx) => (
          <div 
            key={`pending-verify-${pending.id || pending._id || idx}`} 
            onClick={() => {
              setActivePendingId(pending.id || pending._id);
              setPayCashStep('verify');
              setShowPayCashModal(true);
            }}
            className="bg-emerald-600 text-white rounded-2xl md:rounded-[1.5rem] p-4 md:p-6 shadow-xl shadow-emerald-100 animate-in slide-in-from-top-4 duration-500 cursor-pointer hover:bg-emerald-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center  border border-white/30 shrink-0">
                  <Icons.Payments />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black uppercase tracking-tight">Confirm Cash Payment</h3>
                  <p className="text-emerald-50 text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">
                    Click to enter OTP for {formatCurrency(pending.amount)}
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </div>
        ))}

        {billingStatus?.isUpcoming && (
          <div className="bg-orange-500 text-white rounded-2xl md:rounded-[1.5rem] p-4 md:p-6 shadow-xl shadow-orange-100 flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 md:border-b-4 border-orange-700 animate-in slide-in-from-top-4 duration-500">
             <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl flex items-center justify-center  border border-white/30 shrink-0">
                   <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black uppercase tracking-tight">Payment Approaching</h3>
                  <p className="text-orange-50 text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">
                    {billingStatus.daysRemaining === 0 ? "Due Today" : `Due in ${billingStatus.daysRemaining} days`} • {formatCurrency(currentResident.rent)}
                  </p>
                </div>
             </div>
             <div className="flex gap-3 w-full sm:w-auto">
               <button 
                 onClick={() => setShowPayCashModal(true)}
                 className="flex-1 sm:flex-none bg-white text-orange-600 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-orange-50 transition active:scale-95"
               >
                 Pay Cash
               </button>
               <button 
                 onClick={() => setShowOnlinePaymentModal(true)}
                 className={`flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg transition active:scale-95`}
               >
                 Pay Online
               </button>
             </div>
          </div>
        )}

        {activeComplaints.length > 0 && !complaintsDismissed && !isLitePlan && (
          <div className="bg-rose-500 text-white rounded-2xl md:rounded-[1.5rem] p-3 md:p-5 shadow-xl shadow-rose-100 flex flex-row items-center justify-between gap-3 border-b-2 md:border-b-4 border-rose-700 animate-in slide-in-from-top-4 duration-500 relative group/banner">
             <button 
               onClick={() => setComplaintsDismissed(true)}
               className="absolute -top-1 -right-1 md:top-2 md:right-2 p-1 bg-rose-700 md:bg-transparent text-white md:text-white/50 hover:text-white transition-colors rounded-full md:rounded-lg"
               title="Dismiss"
             >
               <svg className="w-2.5 h-2.5 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
             <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center  border border-white/30 shrink-0">
                   <Icons.Complaints />
                </div>
                <div>
                  <h3 className="text-[10px] md:text-sm font-black uppercase tracking-tight">Active Complaints</h3>
                  <p className="text-rose-50 text-[7px] md:text-[8px] font-black uppercase tracking-widest opacity-80">
                    {activeComplaints.length} ticket pending
                  </p>
                </div>
             </div>
             <button 
               onClick={() => onNavigate ? onNavigate('complaints') : alert('Please navigate to the Complaints tab to view details.')}
               className="bg-white text-rose-600 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-black uppercase tracking-widest text-[8px] md:text-[10px] shadow-lg hover:bg-rose-50 transition active:scale-95 whitespace-nowrap"
             >
                View
             </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 p-4 md:p-6">
        <div className="flex flex-row items-center gap-4 md:gap-6 mb-4 md:mb-6">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-xl shadow-blue-100 shrink-0">
             {currentResident.name?.[0] || '?'}
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-black text-slate-900 leading-tight">Hello, {currentResident.name?.split(' ')[0] || 'Resident'}</h1>
            <p className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Resident Portal • RM {currentResident.roomNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
          <div className="bg-blue-50/50 p-3 md:p-5 rounded-xl md:rounded-2xl border border-blue-100">
            <p className="text-[7px] md:text-[9px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Monthly Rent</p>
            <p className="text-lg md:text-3xl font-black text-blue-900 truncate">{formatCurrency(currentResident.rent)}</p>
          </div>
          <div className="bg-orange-50/50 p-3 md:p-5 rounded-xl md:rounded-2xl border border-orange-100">
            <p className="text-[7px] md:text-[9px] font-black text-orange-600 uppercase tracking-widest mb-0.5">Due Date</p>
            <p className="text-lg md:text-3xl font-black text-orange-900">{currentResident.dueDate}th</p>
          </div>
          <div className={`${
            paymentStatusInfo.status === 'CLEARED' 
              ? 'bg-emerald-50/50 border-emerald-100' 
              : 'bg-rose-50/50 border-rose-100'
          } p-3 md:p-5 rounded-xl md:rounded-2xl border col-span-2 md:col-span-1 transition-all duration-500`}>
            <p className={`text-[7px] md:text-[9px] font-black ${
              paymentStatusInfo.status === 'CLEARED' ? 'text-emerald-600' : 'text-rose-600'
            } uppercase tracking-widest mb-0.5`}>
              {paymentStatusInfo.status === 'CLEARED' ? `Cleared Till ${paymentStatusInfo.clearedUntil || 'Now'}` : 'Current Status'}
            </p>
            <p className={`text-lg md:text-3xl font-black ${
              paymentStatusInfo.status === 'CLEARED' ? 'text-emerald-900' : 'text-rose-900'
            }`}>{paymentStatusInfo.status}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 p-5 md:p-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs md:text-sm">Hostel Updates</h3>
              <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">
                {updates.length} New
              </span>
            </div>
            <p className="text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">Stay informed about your residence</p>
          </div>
          <button 
            onClick={() => onNavigate?.('updates')}
            className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all group"
          >
            <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {updates.length > 0 ? (
            updates.slice(0, 4).map((update, idx) => (
              <div 
                key={update.id || (update as any)._id} 
                className="group relative p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500 flex flex-col"
              >
                {/* Priority Indicator Dot */}
                <div className={`absolute top-6 left-6 w-1.5 h-1.5 rounded-full ${
                  update.priority === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                  update.priority === 'medium' ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' :
                  'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                }`} />

                <div className="pl-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-xs md:text-sm font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight line-clamp-1">{update.title}</h4>
                  </div>
                  
                  <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-relaxed line-clamp-2 min-h-[2.5rem]">
                    {update.content}
                  </p>

                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                        {update.authorName[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-900 uppercase tracking-tighter leading-none">{update.authorName}</span>
                        <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{update.date}</span>
                      </div>
                    </div>
                    
                    <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest ${
                      update.priority === 'high' ? 'bg-rose-50 text-rose-600' :
                      update.priority === 'medium' ? 'bg-orange-50 text-orange-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {update.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-16 px-4 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
              <div className="w-16 h-16 bg-white text-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Icons.Complaints className="w-8 h-8" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No recent updates or broadcasts</p>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">Check back later for news</p>
            </div>
          )}
        </div>
      </div>

      {/* Meal of the Day */}
      <div className={`bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden relative ${isMealsLocked ? 'opacity-75' : ''}`}>
        {isMealsLocked && (
          <div className="absolute inset-0 bg-white/40 z-10 flex items-center justify-center p-6 text-center">
            <div className="max-w-xs">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-100">
                <Icons.Dashboard className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Meal Management Restricted</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Property owner needs to upgrade to Business Tier to enable digital meal plans.</p>
            </div>
          </div>
        )}
        <div className="p-4 md:p-6 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-[9px] md:text-xs">Today's Menu</h3>
            <p className="text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mt-0.5">Check today's serving schedule</p>
          </div>
          <button 
            onClick={() => onNavigate?.('meals')} 
            className="text-blue-600 font-black text-[9px] uppercase tracking-widest border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
          >
            Full Week
          </button>
        </div>
        <div className="p-4 md:p-6 divide-y md:divide-y-0 grid grid-cols-2 gap-4 md:gap-x-0 md:gap-y-6">
          <div className="px-0 md:px-6 space-y-2 border-r border-slate-100 md:border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-50 rounded-lg text-orange-500">
                  <Coffee className="w-3.5 h-3.5" />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Breakfast</p>
              </div>
              {(todayMeal?.breakfastStart || todayMeal?.breakfastEnd) && (
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest leading-none">
                  {formatTo12Hr(todayMeal.breakfastStart)}<br className="md:hidden" /> {formatTo12Hr(todayMeal.breakfastEnd)}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 leading-tight">{todayMeal?.breakfast || 'Not yet set'}</p>
          </div>
          <div className="px-0 md:px-6 space-y-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-500">
                  <Utensils className="w-3.5 h-3.5" />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lunch</p>
              </div>
              {(todayMeal?.lunchStart || todayMeal?.lunchEnd) && (
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest leading-none">
                  {formatTo12Hr(todayMeal.lunchStart)}<br className="md:hidden" /> {formatTo12Hr(todayMeal.lunchEnd)}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 leading-tight">{todayMeal?.lunch || 'Not yet set'}</p>
          </div>
          <div className="px-0 md:px-6 space-y-2 border-t md:border-t border-slate-100 pt-6 md:pt-10 border-r md:border-r">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 rounded-lg text-amber-500">
                  <Cookie className="w-3.5 h-3.5" />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Snacks</p>
              </div>
              {(todayMeal?.snacksStart || todayMeal?.snacksEnd) && (
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest leading-none">
                  {formatTo12Hr(todayMeal.snacksStart)}<br className="md:hidden" /> {formatTo12Hr(todayMeal.snacksEnd)}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 leading-tight">{todayMeal?.snacks || 'Not yet set'}</p>
          </div>
          <div className="px-0 md:px-6 space-y-2 border-t md:border-t border-slate-100 pt-6 md:pt-10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 rounded-lg text-rose-500">
                  <Pizza className="w-3.5 h-3.5" />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dinner</p>
              </div>
              {(todayMeal?.dinnerStart || todayMeal?.dinnerEnd) && (
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest leading-none">
                  {formatTo12Hr(todayMeal.dinnerStart)}<br className="md:hidden" /> {formatTo12Hr(todayMeal.dinnerEnd)}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 leading-tight">{todayMeal?.dinner || 'Not yet set'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 p-4 md:p-6">
        <h3 className="font-black text-slate-900 uppercase tracking-widest text-[9px] md:text-xs mb-4 md:mb-6">Action Center</h3>
        <div className="grid grid-cols-2 gap-2 md:gap-4">
           <button 
             onClick={() => setShowOnlinePaymentModal(true)}
             className="flex flex-col items-center justify-center gap-2 md:gap-3 p-4 md:p-8 bg-blue-600 text-white rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-widest text-[9px] md:text-xs hover:bg-blue-700 transition shadow-xl shadow-blue-100 hover:-translate-y-1"
           >
              <div className="bg-white/20 p-2 md:p-3 rounded-xl mb-1">
                <Icons.Payments />
              </div>
              Pay Rent Now
           </button>
            <button 
              onClick={() => isLitePlan ? alert('The digital ticketing system requires a Pro plan upgrade by your property owner.') : setShowComplaintModal(true)}
              className={`flex flex-col items-center justify-center gap-2 md:gap-3 p-4 md:p-8 ${isLitePlan ? 'bg-slate-50 text-slate-400 grayscale cursor-not-allowed' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-50 hover:-translate-y-1'} rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-widest text-[9px] md:text-xs transition`}
            >
               <div className={`${isLitePlan ? 'bg-slate-100' : 'bg-slate-100'} p-2 md:p-3 rounded-xl mb-1`}>
                 <Icons.Complaints />
               </div>
               {isLitePlan ? 'Tickets Locked' : 'Raise Ticket'}
            </button>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 md:p-10 border-b border-slate-50">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] md:text-xs">Last Transaction</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Your most recent payment activity</p>
        </div>
        <div className="p-6 md:p-10">
          {payments.length === 0 ? (
            <p className="text-center text-slate-400 italic text-sm py-4">No payment history found.</p>
          ) : (
            (() => {
              const entry = payments[0];
              return (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
                      <Icons.Payments />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">{entry.description}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entry.date}</p>
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                          entry.status === 'SUCCESS' ? 'text-emerald-500' : 
                          entry.status === 'PENDING' ? 'text-orange-500' : 'text-rose-500'
                        }`}>{entry.status}</span>
                      </div>
                    </div>
                  </div>
                  {entry.status === 'SUCCESS' && (
                    <button 
                      onClick={() => setSelectedPaymentForReceipt(entry)}
                      className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                    >
                      <Icons.Inventory className="w-3.5 h-3.5" />
                      View Receipt
                    </button>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </div>

      {showOnlinePaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowOnlinePaymentModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[2rem] p-6 md:p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Select Payment Method</h2>
              <button 
                onClick={() => setShowOnlinePaymentModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white transition-all transform hover:rotate-90"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Payment Amount (₹)</label>
              <input 
                type="number" 
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full bg-transparent text-xl font-black text-slate-900 outline-none placeholder:text-slate-300"
                placeholder="0.00"
              />
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-2 italic px-1">Your monthly rent is {formatCurrency(currentResident?.rent || 0)}</p>
            </div>

            <div className="space-y-4">
              {/* UPI Option */}
              {ownerInfo?.upiId && (!ownerInfo.acceptedPaymentMethods || ownerInfo.acceptedPaymentMethods.includes('UPI QR')) && (
                <div className="p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                      <Icons.Payments className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Pay via UPI ID</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Instant Direct Transfer</p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-black text-slate-700 tracking-tight">{ownerInfo.upiId}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(ownerInfo.upiId!);
                        setSuccess('UPI ID copied to clipboard!');
                        setTimeout(() => setSuccess(null), 2000);
                      }}
                      className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  
                  <a 
                    href={`upi://pay?pa=${ownerInfo.upiId}&pn=${encodeURIComponent(ownerInfo.name)}&am=${currentResident?.rent}&cu=INR`}
                    className="block w-full py-4 bg-blue-600 text-white text-center rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 hover:bg-blue-700 transition"
                  >
                    Open UPI App
                  </a>
                </div>
              )}

              {/* QR Code Option */}
              {ownerInfo?.qrImageUrl && (!ownerInfo.acceptedPaymentMethods || ownerInfo.acceptedPaymentMethods.includes('UPI QR')) && (
                <div className="p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                      <Icons.Dashboard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Scan QR Code</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Pay using any UPI App</p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-4">
                    <img 
                      src={ownerInfo.qrImageUrl} 
                      alt="Payment QR Code" 
                      className="w-48 h-48 object-contain rounded-lg shadow-inner bg-slate-50"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Scan with GPay, PhonePe, or Paytm</p>
                  </div>
                </div>
              )}

              {/* SMEPay Option */}
              {ownerInfo?.smePayLink && (!ownerInfo.acceptedPaymentMethods || ownerInfo.acceptedPaymentMethods.includes('SME Pay Link')) && (
                <div className="p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                      <Icons.Payments className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Link SMEPay Account</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Official Settle Integration</p>
                    </div>
                  </div>
                  
                  <a 
                    href={ownerInfo.smePayLink.startsWith('http') ? ownerInfo.smePayLink : `https://${ownerInfo.smePayLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-4 bg-slate-900 text-white text-center rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-100 hover:bg-slate-800 transition"
                  >
                    Proceed to SMEPay
                  </a>
                </div>
              )}

              {/* PhonePe Business Option */}
              {ownerInfo?.phonepeMerchantId && (!ownerInfo.acceptedPaymentMethods || ownerInfo.acceptedPaymentMethods.includes('PhonePe')) && (
                <div className="p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                      <Icons.Payments className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">PhonePe Business</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Secure Merchant Gateway</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handlePhonePePayment}
                    className="block w-full py-4 bg-indigo-600 text-white text-center rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition"
                  >
                    Pay via PhonePe
                  </button>
                </div>
              )}

              {/* Razorpay Option */}
              {ownerInfo?.razorpayKeyId && (!ownerInfo.acceptedPaymentMethods || ownerInfo.acceptedPaymentMethods.includes('Razorpay')) && (
                <div className="p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                      <Icons.Razorpay className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Razorpay Online</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Cards, Netbanking, Wallets</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleRazorpayPayment}
                    className="block w-full py-4 bg-blue-500 text-white text-center rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 hover:bg-blue-600 transition"
                  >
                    Pay via Razorpay
                  </button>
                </div>
              )}

              {/* Pay Cash Backup */}
              {(!ownerInfo?.acceptedPaymentMethods || ownerInfo.acceptedPaymentMethods.includes('Cash')) && (
                <div 
                  onClick={() => {
                    setShowOnlinePaymentModal(false);
                    setShowPayCashModal(true);
                  }}
                  className="p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 hover:bg-slate-100 cursor-pointer transition-all space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-100">
                      <Icons.Payments className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Pay via Cash</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Handover to host/staff</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Default/Razorpay Option (Always available if PRO or if nothing else set) */}
              {(!ownerInfo?.upiId && !ownerInfo?.qrImageUrl && !ownerInfo?.smePayLink) && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icons.Payments className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">No Online Methods Configured</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">
                    Property owner hasn't set up direct UPI or SMEPay yet. Please use the cash payment option or notify your host.
                  </p>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">All payments go directly to the property owner</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPayCashModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-400/20 " onClick={() => {
            setShowPayCashModal(false);
            setPayCashStep('select');
            setActivePendingId(null);
          }}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] p-8 md:p-10 shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <button 
              onClick={() => {
                setShowPayCashModal(false);
                setPayCashStep('select');
                setActivePendingId(null);
              }}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors z-10"
            >
              <Icons.Close className="w-4 h-4" />
            </button>
            <div className="overflow-y-auto scrollbar-hide px-1">
            {payCashStep === 'select' ? (
              <>
                <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight">Pay Rent (Cash)</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Collector</label>
                    <div className="grid grid-cols-1 gap-3">
                      {allCollectors.map((collector) => (
                        <button
                          key={collector.id || collector._id}
                          onClick={() => setSelectedCollector(collector)}
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            selectedCollector?.id === collector.id 
                              ? 'border-blue-600 bg-blue-50/50' 
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                              collector.role === 'OWNER' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {collector.name[0]}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-black text-slate-900">{collector.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{collector.role}</p>
                            </div>
                          </div>
                          {selectedCollector?.id === collector.id && (
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount to Pay</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">₹</span>
                      <input 
                        type="number" 
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full pl-10 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 transition-all text-xl font-black" 
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setShowPayCashModal(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition">Cancel</button>
                    <button 
                      disabled={!selectedCollector || !payAmount || initiatingPayment}
                      onClick={handleInitiateCashPayment}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {initiatingPayment ? 'Initiating...' : 'Initiate Payment'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Icons.Payments />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Confirm Payment</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
                    Hand over cash to {pendingPayments.find(p => p.id === activePendingId || p._id === activePendingId)?.collectorName || 'Collector'}
                  </p>
                </div>

                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Amount to Pay</p>
                  <p className="text-3xl font-black text-emerald-900">
                    {formatCurrency(pendingPayments.find(p => p.id === activePendingId || p._id === activePendingId)?.amount || 0)}
                  </p>
                </div>

                {pendingPayments.find(p => p.id === activePendingId || p._id === activePendingId) ? (
                  <PendingPaymentItem 
                    pending={pendingPayments.find(p => p.id === activePendingId || p._id === activePendingId)} 
                    onVerify={handleVerifyOtp} 
                    verifying={verifyingOtp} 
                    currentUserId={currentResident.id}
                    onRefresh={fetchResidentAndPayments}
                  />
                ) : (
                  <div className="bg-rose-600 text-white rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 shadow-xl shadow-rose-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center  border border-white/30 shrink-0">
                        <Icons.Complaints />
                      </div>
                      <div>
                        <h3 className="text-base md:text-lg font-black uppercase tracking-tight">Payment Expired</h3>
                        <p className="text-rose-50 text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">
                          This transaction is no longer active. Please close this and start again.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    setShowPayCashModal(false);
                    setPayCashStep('select');
                    setActivePendingId(null);
                  }} 
                  className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition"
                >
                  Close & Complete Later
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {showShareOtpModal && sharingPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-400/20 " onClick={() => setShowShareOtpModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] p-8 md:p-10 shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <button 
              onClick={() => setShowShareOtpModal(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors z-10"
            >
              <Icons.Close className="w-4 h-4" />
            </button>
            <div className="overflow-y-auto scrollbar-hide px-1">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
                <Icons.Payments />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Handover OTP</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
                  Share this with {sharingPayment.collectorName}
                </p>
              </div>

              <PendingPaymentItem 
                pending={sharingPayment}
                onVerify={handleVerifyOtp}
                verifying={verifyingOtp}
                currentUserId={currentResident.id}
                onRefresh={fetchResidentAndPayments}
              />

              <div className="bg-slate-50 p-4 rounded-xl text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment Details</p>
                <p className="text-sm font-black text-slate-900">{formatCurrency(sharingPayment.amount)} Cash Payment</p>
              </div>

              <button 
                onClick={() => setShowShareOtpModal(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-100 hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {showComplaintModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-400/20 " onClick={() => setShowComplaintModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] p-8 md:p-10 shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <button 
              onClick={() => setShowComplaintModal(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors z-10"
            >
              <Icons.Close className="w-4 h-4" />
            </button>
            <div className="overflow-y-auto scrollbar-hide px-1">
            <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight">Raise Complaint</h2>
            <form onSubmit={handleRaiseComplaint} className="space-y-4 md:space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                <select 
                  value={complaintData.category}
                  onChange={(e) => setComplaintData({...complaintData, category: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold"
                >
                  <option>Maintenance</option>
                  <option>Housekeeping</option>
                  <option>Water Issue</option>
                  <option>Electricity/Electrical</option>
                  <option>Internet/Wi-Fi</option>
                  <option>Security</option>
                  <option>Billing</option>
                  <option>Mess/Food</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                <input 
                  type="text" 
                  value={complaintData.title}
                  onChange={(e) => setComplaintData({...complaintData, title: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                  placeholder="Brief summary"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <textarea 
                  value={complaintData.description}
                  onChange={(e) => setComplaintData({...complaintData, description: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold min-h-[100px]" 
                  placeholder="Details of your issue..."
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowComplaintModal(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
      {selectedPaymentForReceipt && currentResident && (
        <PaymentReceipt 
          payment={selectedPaymentForReceipt}
          resident={currentResident}
          onClose={() => setSelectedPaymentForReceipt(null)}
        />
      )}
    </div>
  );
};

export default ResidentApp;
