
import React, { useState, useEffect } from 'react';
import { Icons } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

const PhonePeMockGateway: React.FC = () => {
  const [step, setStep] = useState<'details' | 'processing' | 'success'>('details');
  const [amount, setAmount] = useState('0');
  const [merchantId, setMerchantId] = useState('');
  const [context, setContext] = useState<{ resId: string; propId: string; ownerId: string } | null>(null);

  useEffect(() => {
    // Collect simulated data from URL or session
    const params = new URLSearchParams(window.location.search);
    const amt = params.get('amount') || '12000';
    const mid = params.get('mid') || 'HOSTEL_MGMT_001';
    setAmount(amt);
    setMerchantId(mid);
    setContext({
      resId: params.get('resId') || '',
      propId: params.get('propId') || '',
      ownerId: params.get('ownerId') || ''
    });
  }, []);

  const handlePay = async () => {
    setStep('processing');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const transactionId = `PP${Date.now()}`;
      // Call our simulation callback to update the database
      const response = await fetch('/api/phonepe/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          status: 'SUCCESS',
          amount,
          merchantId,
          residentId: context?.resId,
          propertyId: context?.propId,
          ownerId: context?.ownerId
        })
      });

      if (response.ok) {
        setStep('success');
      } else {
        alert('Simulation error: Failed to update payment status.');
        setStep('details');
      }
    } catch (e) {
      console.error(e);
      setStep('success'); // Fallback if server is down during simulation demo
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="bg-amber-500 p-2 text-center text-[10px] font-black text-white uppercase tracking-[0.3em]">
        ⚠️ Simulation Mode - No Real Money is Deducted ⚠️
      </div>
      <div className="bg-indigo-600 p-4 shadow-lg flex items-center gap-3 text-white">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-inner">
          <Icons.Payments className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-widest opacity-80 leading-none mb-1">PhonePe</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-black uppercase tracking-tight leading-none">Checkout</p>
            {merchantId === 'PGTESTPAYUAT' && (
              <span className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">Sandbox</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Amount</p>
          <p className="text-lg font-black leading-none">₹{amount}</p>
        </div>
      </div>

      <main className="flex-1 max-w-md mx-auto w-full p-6 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {step === 'details' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Payment Details</h2>
                  </div>
                  <p className="text-sm font-bold text-slate-500">You are paying to Merchant ID: <span className="text-slate-900 underline underline-offset-4">{merchantId}</span></p>
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                      <img src="https://phonepe.com/favicon.ico" className="w-6 h-6 grayscale opacity-50" referrerPolicy="no-referrer" alt="UPI" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">UPI Direct</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instant Settlement</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <Icons.Settings className="w-5 h-5 text-indigo-600 animate-spin-slow" />
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Secure 256-bit SSL Encrypted</p>
                  </div>

                  <button 
                    onClick={handlePay}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Pay ₹{amount} Now
                  </button>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">By paying, you agree to our Terms & Conditions</p>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative">
                <div className="w-24 h-24 border-8 border-indigo-100 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-24 h-24 border-8 border-t-indigo-600 rounded-full animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Processing Payment</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Talking to your bank...</p>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-emerald-500/20 text-center space-y-8"
            >
              <div className="w-24 h-24 bg-emerald-500 rounded-full mx-auto flex items-center justify-center text-white shadow-2xl shadow-emerald-200">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Payment Successful!</h2>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Direct Merchant settlement initiated</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
                  <span>Merchant ID</span>
                  <span className="text-slate-900">{merchantId}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-60">
                  <span>Amount Paid</span>
                  <span className="text-emerald-600">₹{amount}</span>
                </div>
              </div>

              <button 
                onClick={() => window.close()}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-100"
              >
                Return to Application
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center">
        <div className="flex items-center justify-center gap-4 opacity-30 grayscale mb-4">
          <img src="https://phonepe.com/favicon.ico" className="h-4" referrerPolicy="no-referrer" alt="PhonePe" />
          <div className="w-px h-4 bg-slate-400" />
          <span className="text-[8px] font-black uppercase tracking-[0.4em]">PCI DSS Compliant</span>
        </div>
      </footer>
    </div>
  );
};

export default PhonePeMockGateway;
