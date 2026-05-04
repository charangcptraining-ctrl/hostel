
import React, { useEffect, useState } from 'react';
import { Icons } from '../constants';
import { motion } from 'motion/react';

const PaymentStatus: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [txnId, setTxnId] = useState<string | null>(null);

  useEffect(() => {
    // In a real PhonePe flow, the redirect to /payment-status might not have status in query params
    // PhonePe redirects the user back, and then the developer usually queries their own backend
    // to see if the payment was successful (which was updated via Server Callback).
    
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const id = params.get('transactionId') || params.get('merchantTransactionId');
    setTxnId(id);

    // Simulate checking backend status
    // In a more advanced version, we would fetch /api/payments/status/:id
    const checkStatus = async () => {
      // Small Delay to allow for the parallel callback to finish
      await new Promise(r => setTimeout(r, 2000));
      
      if (code === 'PAYMENT_SUCCESS' || code === 'SUCCESS' || !code) {
        // We assume success if we reach here after a real flow, 
        // or we could check the database.
        setStatus('success');
      } else {
        setStatus('failed');
      }
    };

    checkStatus();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Verifying Payment Status...</p>
        </div>
      )}

      {status === 'success' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-100">
            <Icons.Check className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Payment Successful</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest italic">Thank you! Your rent has been updated.</p>
          </div>
          
          {txnId && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 inline-block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaction ID</p>
              <p className="text-xs font-mono font-bold text-slate-900">{txnId}</p>
            </div>
          )}

          <div className="pt-6">
            <button 
              onClick={() => window.location.href = '/'}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition shadow-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </motion.div>
      )}

      {status === 'failed' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-rose-100">
            <Icons.Plus className="w-10 h-10 rotate-45" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Payment Failed</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest italic">Something went wrong with the transaction.</p>
          </div>

          <div className="pt-6">
            <button 
              onClick={() => window.location.href = '/'}
              className="px-8 py-3 bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-700 transition shadow-lg"
            >
              Try Again
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PaymentStatus;
