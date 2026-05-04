
import React, { useState, useEffect } from 'react';
import { formatCurrency, Icons } from '../constants';

interface PendingPaymentItemProps {
  pending: any;
  onVerify: (otp: string) => Promise<void>;
  verifying: boolean;
  currentUserId: string;
  onRefresh?: () => Promise<void>;
}

const PendingPaymentItem: React.FC<PendingPaymentItemProps> = ({ pending, onVerify, verifying, currentUserId, onRefresh }) => {
  const [otp, setOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  
  const isInitiator = pending?.initiatorId === currentUserId;
  
  const isResident = currentUserId === pending?.residentId;
  const otherPartyLabel = isResident 
    ? (pending?.collectorName || 'the collector') 
    : 'the resident';

  useEffect(() => {
    if (!pending?.expiresAt) return;
    
    const calculateTimeLeft = () => {
      const difference = new Date(pending.expiresAt).getTime() - new Date().getTime();
      return Math.max(0, Math.floor(difference / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    // Polling for status updates every 3 seconds
    let pollTimer: any;
    if (onRefresh && timeLeft > 0) {
      pollTimer = setInterval(() => {
        onRefresh();
      }, 3000);
    }

    return () => {
      clearInterval(timer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [pending, onRefresh, timeLeft]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 6 && timeLeft > 0) {
      onVerify(otp);
      setOtp('');
    }
  };

  if (!pending) return null;

  if (timeLeft <= 0 && pending?.expiresAt) {
    return (
      <div className="bg-rose-600 text-white rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 shadow-xl shadow-rose-100 animate-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center  border border-white/30 shrink-0">
            <Icons.Complaints />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black uppercase tracking-tight">OTP Expired</h3>
            <p className="text-rose-50 text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">
              The transaction has expired. Please close this and generate a new request.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-600 text-white rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 shadow-xl shadow-emerald-100 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 md:gap-5">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center  border border-white/30 shrink-0">
            <Icons.Payments />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black uppercase tracking-tight">
              {isInitiator ? 'Enter OTP' : 'Share OTP'}
            </h3>
            <p className="text-emerald-50 text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">
              {isInitiator 
                ? `Enter the OTP shared by ${otherPartyLabel}`
                : `Share this OTP with ${otherPartyLabel} to confirm handover`
              }
            </p>
          </div>
        </div>
        <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black tracking-widest shrink-0">
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
      </div>

      {isInitiator ? (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input 
            type="text" 
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter 6-digit OTP"
            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl outline-none focus:bg-white/20 transition-all text-sm font-black tracking-widest placeholder:text-white/40 placeholder:tracking-normal"
            required
          />
          <button 
            type="submit"
            disabled={verifying || otp.length !== 6 || timeLeft <= 0}
            className="bg-white text-emerald-600 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-emerald-50 transition active:scale-95 disabled:opacity-50"
          >
            {verifying ? '...' : 'Confirm'}
          </button>
        </form>
      ) : (
        <div className="bg-white/10 border-2 border-dashed border-white/30 rounded-2xl p-6 text-center">
          <span className="text-5xl font-black tracking-[0.3em] text-white drop-shadow-lg">{pending.otp}</span>
        </div>
      )}
    </div>
  );
};

export default PendingPaymentItem;
