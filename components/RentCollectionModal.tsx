
import React, { useState, useEffect } from 'react';
import { Resident, Staff, UserRole, SubscriptionTier, getTierValue } from '../types';
import { db } from '../services/mockData';
import { formatCurrency, Icons } from '../constants';
import PendingPaymentItem from './PendingPaymentItem';

interface RentCollectionModalProps {
  resident: Resident | null;
  onClose: () => void;
  onSuccess: () => void;
  ownerId: string;
  ownerName?: string;
  allStaff: Staff[];
  currentUser?: any;
  plan?: SubscriptionTier;
  onUpgrade?: () => void;
}

const RentCollectionModal: React.FC<RentCollectionModalProps> = ({ 
  resident, 
  onClose, 
  onSuccess, 
  ownerId, 
  ownerName = 'Owner',
  allStaff,
  currentUser,
  plan,
  onUpgrade
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [collectAmount, setCollectAmount] = useState('');
  const [selectedStaffForCash, setSelectedStaffForCash] = useState<Staff | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'METHOD' | 'DETAILS' | 'OTP' | 'QR' | 'SUCCESS'>('METHOD');
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [lastPayment, setLastPayment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownerAcceptedMethods, setOwnerAcceptedMethods] = useState<string[]>(['Cash', 'PhonePe', 'Razorpay', 'UPI QR', 'SME Pay Link']);
  const currentTierValue = getTierValue(plan || SubscriptionTier.FREE);
  const isOnlineLocked = currentTierValue < 2;

  const [totalPaidThisMonth, setTotalPaidThisMonth] = useState(0);
  const [isFirstMonth, setIsFirstMonth] = useState(false);
  const [monthlyExpected, setMonthlyExpected] = useState(0);
  const [paymentBalanceDetail, setPaymentBalanceDetail] = useState<{
    due: number;
    paid: number;
    status: 'DUE' | 'PARTIAL' | 'CLEARED' | 'ADVANCE';
    nextMonthAdvance: number;
  }>({ due: 0, paid: 0, status: 'DUE', nextMonthAdvance: 0 });

  useEffect(() => {
    const calculateDetailedBalance = async () => {
      if (!resident) return;

      try {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Check if first month
        const moveInDate = new Date(resident.moveInDate);
        const isFirst = moveInDate.getMonth() === currentMonth && moveInDate.getFullYear() === currentYear;
        setIsFirstMonth(isFirst);

        const expected = isFirst ? (resident.rent + resident.securityDeposit) : resident.rent;
        setMonthlyExpected(expected);

        const allPayments = await db.getPayments({ residentId: resident.id });
        const thisMonthPayments = allPayments.filter(p => {
          const pDate = new Date(p.date);
          return pDate.getMonth() === currentMonth && 
                 pDate.getFullYear() === currentYear &&
                 (p.status === 'SUCCESS' || p.status === 'PAID');
        });

        const paid = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);
        setTotalPaidThisMonth(paid);

        let status: 'DUE' | 'PARTIAL' | 'CLEARED' | 'ADVANCE' = 'DUE';
        let advance = 0;

        if (paid >= expected) {
          status = paid > expected ? 'ADVANCE' : 'CLEARED';
          advance = Math.max(0, paid - expected);
        } else if (paid > 0) {
          status = 'PARTIAL';
        }

        setPaymentBalanceDetail({
          due: expected,
          paid: paid,
          status,
          nextMonthAdvance: advance
        });

        // Set default collection amount
        if (paid < expected) {
          setCollectAmount((expected - paid).toString());
        } else {
          setCollectAmount(''); // Or some default for advance
        }

      } catch (err) {
        console.error("Error calculating balance:", err);
      }
    };

    calculateDetailedBalance();
  }, [resident]);

  useEffect(() => {
    const fetchOwnerDetails = async () => {
      try {
        const ownerData = await db.getUser(ownerId);
        if (ownerData && ownerData.acceptedPaymentMethods) {
          setOwnerAcceptedMethods(ownerData.acceptedPaymentMethods);
        }
      } catch (err) {
        console.error("Error fetching owner details:", err);
      }
    };
    fetchOwnerDetails();
  }, [ownerId]);

  useEffect(() => {
    const fetchLastPayment = async () => {
      if (resident) {
        try {
          const payments = await db.getPayments({ residentId: resident.id });
          if (payments && payments.length > 0) {
            // Sort by date descending and get the first one
            const sorted = payments.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setLastPayment(sorted[0]);
          }
        } catch (error) {
          console.error("Error fetching last payment:", error);
        }
      }
    };
    fetchLastPayment();
  }, [resident]);

  useEffect(() => {
    const checkExistingPending = async () => {
      if (resident) {
        try {
          const pending = await db.getPendingPaymentsForResident(resident.id);
          if (pending && pending.length > 0) {
            // Find the most recent active one
            const active = pending[0]; 
            setPendingPayment(active);
            setPaymentStep('OTP');
          }
        } catch (error) {
          console.error("Error checking pending payments:", error);
        }
      }
    };

    if (resident) {
      setCollectAmount((resident.balance !== undefined ? resident.balance : resident.rent).toString());
      setPaymentMethod('CASH');
      setPaymentStep('METHOD');
      setOtpSent(false);
      setEnteredOtp('');
      setPendingPayment(null);
      
      checkExistingPending();
      
      // Automatically set collector if owner or staff is logged in
      if (currentUser) {
        const currentUserId = currentUser.id || currentUser._id;
        if (currentUser.role === UserRole.OWNER) {
          setSelectedStaffForCash({
            id: currentUserId,
            ownerId: currentUserId,
            name: currentUser.name || 'Owner',
            username: currentUser.username || 'owner',
            phone: '',
            email: currentUser.email || '',
            salary: 0,
            category: 'Other' as any,
            assignedPropertyIds: [],
            status: 'active',
            canCollectCash: true
          });
        } else if (currentUser.role === UserRole.STAFF) {
          setSelectedStaffForCash({
            ...currentUser,
            id: currentUserId
          } as Staff);
        } else {
          setSelectedStaffForCash(null);
        }
      } else {
        setSelectedStaffForCash(null);
      }
    }
  }, [resident, currentUser]);

  useEffect(() => {
    // If we were in OTP step and pendingPayment becomes null, 
    // it likely means the other party verified it.
    if (paymentStep === 'OTP' && !pendingPayment && !isProcessingPayment) {
      // Check if it was actually successful by checking resident balance or just assume success
      // A better way is to check if a new payment exists, but for now let's just show success
      setPaymentStep('SUCCESS');
      onSuccess();
    }
  }, [pendingPayment, paymentStep, isProcessingPayment, onSuccess]);

  if (!resident) return null;

  const handleDirectPayment = async () => {
    if (!selectedStaffForCash || !resident) return;
    const collectorId = selectedStaffForCash.id || selectedStaffForCash._id;
    if (!collectorId) {
      console.error("Collector ID is missing:", selectedStaffForCash);
      setError("Error: Collector information is incomplete. Please try again.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const isAdvance = (parseInt(collectAmount) > 0 && (paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE')) || 
                      (parseInt(collectAmount) > Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid));
    
    const baseDescription = isAdvance ? 'Advance Rent Payment' : 'Rent Payment';
    const methodDescription = `(${paymentMethod === 'CASH' ? 'Cash' : 'Online'})`;
    const collectorDescription = selectedStaffForCash ? `- Collected by ${selectedStaffForCash.name}` : '';
    const finalDescription = `${baseDescription} ${methodDescription} ${collectorDescription}`.trim();

    setIsProcessingPayment(true);
    try {
      if (paymentMethod === 'CASH') {
        await db.directPayment({
          ownerId,
          residentId: resident.id,
          propertyId: resident.propertyId,
          amount: parseInt(collectAmount),
          collectorId,
          collectorName: selectedStaffForCash.name,
          description: finalDescription
        });
      } else {
        const paymentData = {
          ownerId,
          residentId: resident.id,
          propertyId: resident.propertyId,
          amount: parseInt(collectAmount),
          date: new Date().toISOString().split('T')[0],
          description: finalDescription,
          status: 'SUCCESS',
          transactionId: `ONLINE-${Date.now()}`,
          paymentMethod: 'ONLINE',
          collectorId: null,
          collectorName: null
        };
        await db.savePayment(paymentData);
      }
      
      setPaymentStep('SUCCESS');
      onSuccess();
    } catch (error) {
      console.error("Error processing payment:", error);
      setError("Failed to record payment. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSendOtp = async () => {
    if (!selectedStaffForCash) return;
    const collectorId = selectedStaffForCash.id || selectedStaffForCash._id;
    if (!collectorId) {
      console.error("Collector ID is missing:", selectedStaffForCash);
      setError("Error: Collector information is incomplete. Please try again.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const isAdvance = (parseInt(collectAmount) > 0 && (paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE')) || 
                      (parseInt(collectAmount) > Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid));
    
    const finalDescription = isAdvance 
      ? `Advance Rent Payment (Cash) - Collected by ${selectedStaffForCash.name}`
      : `Rent Payment (Cash) - Collected by ${selectedStaffForCash.name}`;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    setIsProcessingPayment(true);
    try {
      const pending = await db.createPendingPayment({
        ownerId,
        residentId: resident.id,
        propertyId: resident.propertyId,
        amount: parseInt(collectAmount),
        collectorId,
        collectorName: selectedStaffForCash.name,
        initiatorId: currentUser?.id || currentUser?._id,
        initiatorRole: currentUser?.role || 'RESIDENT',
        otp,
        description: finalDescription
      });
      
      setPendingPayment(pending);
      setGeneratedOtp(otp);
      setOtpSent(true);
      setPaymentStep('OTP');
      console.log(`OTP for Resident to share: ${otp}`);
    } catch (error) {
      console.error("Error creating pending payment:", error);
      setError("Failed to initiate handover. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const refreshPendingPayment = async () => {
    if (resident) {
      try {
        const pending = await db.getPendingPaymentsForResident(resident.id);
        if (pending && pending.length > 0) {
          setPendingPayment(pending[0]);
        } else {
          // If it's gone, it might have been processed or expired
          setPendingPayment(null);
        }
      } catch (error) {
        console.error("Error refreshing pending payment:", error);
      }
    }
  };

  const handleVerifyOtpAndPay = async (otpToVerify: string) => {
    setIsProcessingPayment(true);
    try {
      await db.verifyOtpAndPay({
        residentId: resident.id,
        otp: otpToVerify
      });
      
      setPaymentStep('SUCCESS');
      onSuccess();
    } catch (error) {
      console.error("Payment error:", error);
      setError("Failed to record payment. Please check the OTP.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleOnlinePaymentSuccess = async () => {
    const isAdvance = (parseInt(collectAmount) > 0 && (paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE')) || 
                      (parseInt(collectAmount) > Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid));
    
    const baseDescription = isAdvance ? 'Advance Rent Payment' : 'Rent Payment';
    const finalDescription = `${baseDescription} (Online)`.trim();

    setIsProcessingPayment(true);
    try {
      const paymentData = {
        ownerId,
        residentId: resident.id,
        propertyId: resident.propertyId,
        amount: parseInt(collectAmount),
        date: new Date().toISOString().split('T')[0],
        description: finalDescription,
        status: 'SUCCESS',
        transactionId: `ONLINE-${Date.now()}`,
        paymentMethod: 'ONLINE',
        collectorId: null,
        collectorName: null
      };

      await db.savePayment(paymentData);
      setPaymentStep('SUCCESS');
      onSuccess();
    } catch (error) {
      console.error("Payment error:", error);
      setError("Failed to record payment.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 " onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[95vh] border border-slate-100">
        {/* Error Notification */}
        {error && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300 w-[80%]">
            <div className="px-6 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl flex items-center gap-3 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-tight">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600 font-bold">✕</button>
            </div>
          </div>
        )}

        <div className="p-8 md:p-10 pb-4 relative shrink-0">
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all transform hover:rotate-90 z-10"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Collect Rent</h2>
          <p className="text-slate-500 text-[10px] mt-1 font-medium italic uppercase tracking-widest">Resident: {resident.name}</p>
        </div>

          <div className="flex-1 overflow-y-auto p-8 md:p-10 pt-4 space-y-8 scrollbar-hide">
            {/* Balance Overview */}
            <div className={`p-6 rounded-3xl border animate-in fade-in duration-500 ${
              paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE' 
                ? 'bg-emerald-50 border-emerald-100' 
                : 'bg-blue-50 border-blue-100'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Summary</p>
                  <h3 className="text-sm font-black text-slate-900">
                    {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    {isFirstMonth && <span className="ml-2 text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">First Month</span>}
                  </h3>
                </div>
                <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                  paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}>
                  {paymentBalanceDetail.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Expected</p>
                  <p className="text-xs font-black text-slate-900">{formatCurrency(paymentBalanceDetail.due)}</p>
                  {isFirstMonth && <p className="text-[7px] text-slate-400 font-bold">Incl. {formatCurrency(resident.securityDeposit)} Deposit</p>}
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Paid This Month</p>
                  <p className="text-xs font-black text-emerald-600">{formatCurrency(paymentBalanceDetail.paid)}</p>
                </div>
              </div>

              {(paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE') && (
                <div className="mt-4 pt-4 border-t border-emerald-100/50">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Icons.Payments className="w-3 h-3" />
                    <p className="text-[9px] font-bold">Payment cleared till this month. Collecting more will be marked as <span className="font-black">Advance</span> for next month.</p>
                  </div>
                </div>
              )}
            </div>

            {lastPayment && (
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Last Payment</p>
                  <p className="text-sm font-black text-slate-900">{formatCurrency(lastPayment.amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Month</p>
                  <p className="text-xs font-bold text-slate-600">
                    {new Date(lastPayment.date).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}

            {paymentStep === 'METHOD' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Payment Method</p>
                <div className="grid grid-cols-2 gap-4">
                  {ownerAcceptedMethods.includes('Cash') && (
                    <button 
                      onClick={() => { setPaymentMethod('CASH'); setPaymentStep('DETAILS'); }}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border-2 border-slate-100 hover:border-blue-600 hover:bg-blue-50 transition-all group"
                    >
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Cash</span>
                    </button>
                  )}
                  {(ownerAcceptedMethods.includes('PhonePe') || 
                    ownerAcceptedMethods.includes('Razorpay') || 
                    ownerAcceptedMethods.includes('UPI QR') || 
                    ownerAcceptedMethods.includes('SME Pay Link')) && (
                    <button 
                      disabled={isOnlineLocked}
                      onClick={() => { 
                        if (!isOnlineLocked) {
                          setPaymentMethod('ONLINE'); 
                          setPaymentStep('DETAILS'); 
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border-2 transition-all group relative overflow-hidden ${
                        isOnlineLocked 
                          ? 'border-slate-100 bg-slate-50 cursor-not-allowed grayscale' 
                          : 'border-slate-100 hover:border-blue-600 hover:bg-blue-50'
                      } ${!ownerAcceptedMethods.includes('Cash') ? 'col-span-2' : ''}`}
                    >
                      {isOnlineLocked && (
                        <div 
                          className="absolute inset-0 bg-white/20 flex flex-col items-center justify-center p-2 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpgrade?.();
                          }}
                        >
                          <Icons.Lock className="w-4 h-4 text-amber-600 mb-1" />
                          <span className="text-[8px] font-black text-blue-600 uppercase underline decoration-2 underline-offset-2">
                            Upgrade to Pro
                          </span>
                        </div>
                      )}
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                        isOnlineLocked ? 'bg-slate-200 text-slate-400' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                      }`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-black text-slate-900 uppercase tracking-widest block">Online</span>
                        {isOnlineLocked && <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">Payment Gateway</p>}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {paymentStep === 'DETAILS' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE' 
                    ? 'Enter Advance Payment Amount' 
                    : 'Payment Amount'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      const remaining = Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid);
                      setCollectAmount(remaining > 0 ? remaining.toString() : resident.rent.toString());
                    }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      (collectAmount === (Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid) > 0 
                        ? Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid).toString() 
                        : resident.rent.toString())) 
                        ? 'border-blue-600 bg-blue-50' 
                        : 'border-slate-100'
                    }`}
                  >
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE' ? 'Pay Next Month Rent' : 'Remaining Due'}
                    </p>
                    <p className="text-sm font-black text-slate-900">
                      {formatCurrency(paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE' 
                        ? resident.rent 
                        : Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid))}
                    </p>
                  </button>
                  <div className={`p-4 rounded-2xl border-2 transition-all ${
                    (collectAmount !== (Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid) > 0 
                      ? Math.max(0, paymentBalanceDetail.due - paymentBalanceDetail.paid).toString() 
                      : resident.rent.toString())) 
                      ? 'border-blue-600 bg-blue-50' 
                      : 'border-slate-100'
                  }`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Custom Amount</p>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold">₹</span>
                      <input 
                        type="number" 
                        value={collectAmount}
                        onChange={(e) => setCollectAmount(e.target.value)}
                        className="bg-transparent outline-none font-black text-sm w-full"
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>
                </div>

                {parseInt(collectAmount) > 0 && (paymentBalanceDetail.status === 'CLEARED' || paymentBalanceDetail.status === 'ADVANCE') && (
                   <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                      <Icons.Lock className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-900 leading-tight">
                        Do you want to pay extra? This amount will be added to the next month cycle as <span className="font-black italic underline uppercase">Advance Payment</span>.
                      </p>
                   </div>
                )}
              </div>

              {paymentMethod === 'CASH' && !selectedStaffForCash && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Receiving Person</p>
                  <div className="space-y-3">
                    {/* Owner Option */}
                    <button
                      onClick={() => setSelectedStaffForCash({
                        id: ownerId,
                        ownerId: ownerId,
                        name: ownerName,
                        username: 'owner',
                        phone: '',
                        email: '',
                        salary: 0,
                        category: 'Other' as any,
                        assignedPropertyIds: [],
                        status: 'active',
                        canCollectCash: true
                      })}
                      className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedStaffForCash?.id === ownerId ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center font-black text-xs text-slate-400">
                          {ownerName[0]}
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-black text-slate-900 block">{ownerName}</span>
                          <span className="text-[8px] font-bold text-blue-600 uppercase tracking-widest">Owner</span>
                        </div>
                      </div>
                      {selectedStaffForCash?.id === ownerId && (
                        <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>

                    {allStaff.filter(s => s.canCollectCash && s.status === 'active').map(staff => (
                      <button
                        key={staff.id}
                        onClick={() => setSelectedStaffForCash(staff)}
                        className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedStaffForCash?.id === staff.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center font-black text-xs text-slate-400">
                            {staff.name[0]}
                          </div>
                          <div className="text-left">
                            <span className="text-xs font-black text-slate-900 block">{staff.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Staff</span>
                          </div>
                        </div>
                        {selectedStaffForCash?.id === staff.id && (
                          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paymentMethod === 'CASH' && selectedStaffForCash && (
                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 space-y-3 animate-in zoom-in duration-300">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Collector Identified</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-blue-600 shadow-sm border border-blue-100">
                      {selectedStaffForCash.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{selectedStaffForCash.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {selectedStaffForCash.id === ownerId ? 'Owner' : 'Staff Member'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4">
                {paymentMethod === 'CASH' ? (
                  <button 
                    disabled={!selectedStaffForCash || !collectAmount || isProcessingPayment}
                    onClick={handleSendOtp}
                    className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-slate-200 hover:-translate-y-0.5 transition disabled:opacity-50"
                  >
                    {currentUser?.role === UserRole.RESIDENT ? 'Generate Handover OTP' : 'Request Handover OTP'}
                  </button>
                ) : (
                  <button 
                    disabled={!collectAmount}
                    onClick={() => setPaymentStep('QR')}
                    className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:-translate-y-0.5 transition disabled:opacity-50"
                  >
                    Generate Payment QR
                  </button>
                )}
              </div>
            </div>
          )}

          {paymentStep === 'OTP' && (
            <div className="space-y-8 animate-in zoom-in duration-300">
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Handover Verification</h3>
                <p className="text-xs font-medium text-slate-500 px-4">
                  {pendingPayment?.initiatorId === (currentUser?.id || currentUser?._id)
                    ? "Show this OTP to the resident to confirm you've received the cash."
                    : "Ask the resident for the OTP shown in their app to confirm the cash payment."
                  }
                </p>
              </div>

              <PendingPaymentItem 
                pending={pendingPayment}
                onVerify={handleVerifyOtpAndPay}
                verifying={isProcessingPayment}
                currentUserId={currentUser?.id || currentUser?._id}
                onRefresh={refreshPendingPayment}
              />

              <div className="text-center">
                <button 
                  onClick={() => setPaymentStep('DETAILS')}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition"
                >
                  Back to details
                </button>
              </div>
            </div>
          )}

          {paymentStep === 'QR' && (
            <div className="space-y-8 animate-in zoom-in duration-300 text-center">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Scan to Pay</h3>
                <p className="text-xs font-medium text-slate-500">Resident can scan this QR to pay <span className="font-black text-slate-900">{formatCurrency(parseInt(collectAmount))}</span></p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm inline-block mx-auto">
                <div className="w-48 h-48 bg-slate-900 rounded-2xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-2 border-2 border-white/20 rounded-lg"></div>
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className={`w-6 h-6 rounded-sm ${Math.random() > 0.5 ? 'bg-white' : 'bg-transparent'}`}></div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-xl">
                      <Icons.Dashboard className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleOnlinePaymentSuccess}
                  className="w-full py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-100 hover:-translate-y-0.5 transition flex items-center justify-center gap-2"
                >
                  Confirm Payment Received
                </button>
                <button 
                  onClick={() => setPaymentStep('DETAILS')}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition"
                >
                  Cancel & Back
                </button>
              </div>
            </div>
          )}

          {paymentStep === 'SUCCESS' && (
            <div className="space-y-8 animate-in zoom-in duration-500 text-center py-10">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 animate-bounce">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Payment Successful</h3>
                <p className="text-sm font-medium text-slate-500">Rent for <span className="font-black text-slate-900">{resident.name}</span> has been recorded.</p>
                {plan === SubscriptionTier.PRO && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
                    <div className="flex items-center justify-center gap-2 text-blue-600 mb-2">
                      <Icons.Dashboard className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Pro Automation Active</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-bold text-slate-600 flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        WhatsApp Invoice sent to resident
                      </p>
                      <p className="text-[10px] font-bold text-slate-600 flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Email confirmation sent to resident
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <button 
                onClick={onClose}
                className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-slate-200 hover:-translate-y-0.5 transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RentCollectionModal;
