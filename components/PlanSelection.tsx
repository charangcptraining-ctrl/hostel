
import React, { useState, useEffect } from 'react';
import { SubscriptionTier, PLAN_LIMITS, User } from '../types';
import { formatCurrency } from '../constants';

type PaymentStep = 'none' | 'checkout' | 'processing' | 'success';

interface PlanSelectionProps {
  onSelect: (tier: SubscriptionTier) => Promise<void> | void;
  onClose?: () => void;
  currentTier?: SubscriptionTier;
  user?: User;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PlanSelection: React.FC<PlanSelectionProps> = ({ onSelect, onClose, currentTier, user }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('none');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load Razorpay Script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const plans: {
    tier: SubscriptionTier;
    name: string;
    description: string;
    features: string[];
    highlight: boolean;
    tagline: string;
  }[] = [
    {
      tier: SubscriptionTier.FREE,
      name: 'Free',
      description: 'The Explorer - Best for testing the platform.',
      features: [
        '✅ Cash Payment Tracking',
        '🔒 (1) Property Management',
        '🔒 (10) Resident Management',
        '✅ Basic Dashboard',
        '❌ Automation'
      ],
      highlight: false,
      tagline: 'FREE'
    },
    {
      tier: SubscriptionTier.LITE,
      name: 'Lite',
      description: 'The Beginner - Core hostel management.',
      features: [
        '✅ QR / UPI Payments (Manual)',
        '✅ Manual App Updates',
        '✅ Auto-Due Notifications (App)',
        '✅ All 7 Days: (D-3 to D+3)',
        '🔒 (1) Property Management'
      ],
      highlight: false,
      tagline: 'BEGINNER'
    },
    {
      tier: SubscriptionTier.BASIC,
      name: 'Basic',
      description: 'The Automator - Save time and collect rent faster.',
      features: [
        '✅ Auto-Due App (7 Days)',
        '✅ Email Alerts (D-3 to D-1)',
        '✅ Email Post-Payment Invoices',
        '🔒 (2) Property Management',
        '🔒 (99) Resident Management'
      ],
      highlight: true,
      tagline: 'AUTOMATOR'
    },
    {
      tier: SubscriptionTier.PRO,
      name: 'Pro',
      description: 'The Automation Pro - Perfect for multi-hostel chains.',
      features: [
        '✅ Auto-Due App (7 Days)',
        '✅ Email & SMS (D-3 to D-1)',
        '✅ Email Invoices After Payment',
        '✅ SMS / Text Confirmation',
        '✅ (4) Property Management'
      ],
      highlight: false,
      tagline: 'AUTOMATION'
    },
    {
      tier: SubscriptionTier.BUSINESS,
      name: 'Business',
      description: 'The Complete Package - Professional hostel enterprise suite.',
      features: [
        '✅ Auto-Due App (7 Days)',
        '✅ Email, SMS, WA (D-3 to D-1)',
        '✅ WA Post-Payment Invoices 🔥',
        '✅ Owner Overdue Alerts (+1 to +3)',
        '🔒 (Unlimited) Properties'
      ],
      highlight: false,
      tagline: 'EMPIRE'
    },
    {
      tier: SubscriptionTier.CUSTOM,
      name: 'Custom',
      description: 'The Custom Builder - Large scale chains.',
      features: [
        '✅ Unlimited Everything',
        '✅ Full API & White-Labeling',
        '✅ 24/7 Dedicated Manager',
        '✅ Custom Integrations',
        '✅ Biometric & Smart Locks'
      ],
      highlight: false,
      tagline: 'CUSTOM'
    }
  ];

  const ComparisonTable = () => (
    <div className="mt-24 max-w-7xl mx-auto overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-1000">
      <div className="text-left mb-12 flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner">💰</div>
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Features By Plan (Final)</h2>
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-100 border border-slate-100 overflow-hidden">
        <div className="p-8 md:p-12">
          <div className="flex items-center gap-3 mb-10">
             <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shadow-sm">🏠</div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Core Management</h3>
          </div>
          
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Feature</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Free</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lite ₹149</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic ₹699 ⭐</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pro ₹999</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business ₹2499 💎</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Property Management</td>
                  <td className="py-6 px-6 text-center">✅ (1)</td>
                  <td className="py-6 px-6 text-center">✅ (1)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (2)</td>
                  <td className="py-6 px-6 text-center">✅ (4)</td>
                  <td className="py-6 px-6 text-center">✅ (Unlimited)</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Resident Management</td>
                  <td className="py-6 px-6 text-center">✅ (10)</td>
                  <td className="py-6 px-6 text-center">✅ (20)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (99)</td>
                  <td className="py-6 px-6 text-center">✅ (150)</td>
                  <td className="py-6 px-6 text-center">✅ (300)</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Room / Bed Management</td>
                  <td className="py-6 px-6 text-center">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Staff Management</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (8)</td>
                  <td className="py-6 px-6 text-center">✅ (20)</td>
                  <td className="py-6 px-6 text-center">✅ (50)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mb-10 mt-20">
             <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shadow-sm">💰</div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Payments & Billing</h3>
          </div>
          
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Feature</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Free</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lite</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pro</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Payment Mode</td>
                  <td className="py-6 px-6 text-center">Cash Only</td>
                  <td className="py-6 px-6 text-center">QR / UPI</td>
                  <td className="py-6 px-6 text-center">QR / PhonePe / RZP</td>
                  <td className="py-6 px-6 text-center">QR / PhonePe / RZP</td>
                  <td className="py-6 px-6 text-center">QR / PhonePe / RZP</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Auto-Due Notifications</td>
                  <td className="py-6 px-6 text-center text-slate-300">❌ None</td>
                  <td className="py-6 px-6 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-blue-600">📱 App Alerts</span>
                      <span className="text-[9px] text-slate-400 font-medium">(D-3 to D+3)</span>
                    </div>
                  </td>
                  <td className="py-6 px-6 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-blue-600">📱 App + 📧 Email</span>
                      <span className="text-[9px] text-slate-400 font-medium">(Email: D-3 to D-1)</span>
                    </div>
                  </td>
                  <td className="py-6 px-6 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-blue-600">📱 App + 📧 Email + 💬 SMS</span>
                      <span className="text-[9px] text-slate-400 font-medium">(Channels: D-3 to D-1)</span>
                    </div>
                  </td>
                  <td className="py-6 px-6 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-emerald-600">📱 App + 📧 Email + 💬 SMS + 🟢 WA</span>
                      <span className="text-[10px] text-emerald-500 font-black mt-1">Overdue Owner WA Alerts 🔥</span>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Post-Payment Invoices</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (Email)</td>
                  <td className="py-6 px-6 text-center">✅ (Email + PDF)</td>
                  <td className="py-6 px-6 text-center">✅ (Email + PDF + WA)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mb-10 mt-20">
             <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shadow-sm">📊</div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Notification Channels</h3>
          </div>
          
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Feature</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Free</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lite</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pro</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">App Notifications</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (D-3 to D+3)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (D-3 to D+3)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Email Alerts</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (Pre-Due)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">SMS / Text</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (Pre-Due)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">WhatsApp Invoices</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">➕ Add-on</td>
                  <td className="py-6 px-6 text-center text-emerald-600">✅ + Overdue Alerts</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mb-10 mt-20">
             <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center shadow-sm">🔔</div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Notifications</h3>
          </div>
          
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Feature</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Free</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lite</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pro</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">App Notifications</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Email Notifications</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">✅ 🔒(2/resident)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (Unlimited)</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">WhatsApp Notifications</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">➕ Add-on</td>
                  <td className="py-6 px-6 text-center">➕ Add-on</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">SMS Notifications</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">➕ Add-on</td>
                  <td className="py-6 px-6 text-center">➕ Add-on</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mb-10 mt-20">
             <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shadow-sm">📱</div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Messaging (Add-ons)</h3>
          </div>
          
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Feature</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Free</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lite</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pro</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">WhatsApp Packs</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">➕</td>
                  <td className="py-6 px-6 text-center">➕</td>
                  <td className="py-6 px-6 text-center">➕</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">SMS Packs</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">➕</td>
                  <td className="py-6 px-6 text-center">➕</td>
                  <td className="py-6 px-6 text-center">➕</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <span className="text-xl">👉</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Controlled via packs (no unlimited)</span>
          </div>

          <div className="flex items-center gap-3 mb-10 mt-20">
             <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shadow-sm">🛡️</div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Resident Verification</h3>
          </div>
          
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Feature</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Free</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lite</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pro</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Email Verification</td>
                  <td className="py-6 px-6 text-center">✅ 🔒</td>
                  <td className="py-6 px-6 text-center">✅ 🔒 (20/mo)</td>
                  <td className="py-6 px-6 text-center">✅ 🔒 (100/mo)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ 🔒 (1000/mo)</td>
                  <td className="py-6 px-6 text-center">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">SMS Verification</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (SMS+Email)</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ 🔒 (2000/mo)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mb-10 mt-20">
             <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shadow-sm">⚙️</div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Automation</h3>
          </div>
          
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Feature</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Free</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lite</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pro</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Rent Reminder Automation</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Payment Confirmation</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Welcome Automation</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅ (Email + 1 SMS)</td>
                  <td className="py-6 px-6 text-center">✅</td>
                  <td className="py-6 px-6 text-center">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Custom Rules</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-blue-600">✅</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mb-10 mt-20">
             <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shadow-sm">🧩</div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Advanced Features</h3>
          </div>
          
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Feature</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Free</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lite</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pro</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Multi-property Dashboard</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-emerald-600">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">Priority Processing</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-emerald-600">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">API Access</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center font-bold">✅ (Enterprise+)</td>
                  <td className="py-6 px-6 text-center">✅ (Business+)</td>
                  <td className="py-6 px-6 text-center text-emerald-600">✅</td>
                </tr>
                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                  <td className="py-6 px-6 font-black text-slate-900 group-hover:pl-8 transition-all">White-label</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center">❌</td>
                  <td className="py-6 px-6 text-center text-emerald-600">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="mt-16 bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-wrap gap-12 items-center justify-center">
            <div className="flex items-center gap-3">
              <span className="text-xl">🧠</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How to read</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">✅</span>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">= included</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">❌</span>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">= not included</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">➕ Add-on</span>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">= optional paid pack</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">= limited (with cap)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const WhatThisAchieves = () => (
    <div className="mt-24 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
      <div className="text-left mb-12 flex items-center gap-4">
        <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner">🎯</div>
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">What This Achieves</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {[
          { color: 'bg-green-500', tier: 'Free', action: 'Try', desc: 'Can explore, but not operate fully' },
          { color: 'bg-indigo-400', tier: 'Lite', action: 'Begin', desc: 'Basic manual tracking for small setups' },
          { color: 'bg-orange-500', tier: 'Basic', action: 'Automate', desc: 'Real value unlocked → most conversions', star: true },
          { color: 'bg-red-600', tier: 'Pro', action: 'Expand', desc: 'Communication + multi-property' },
          { color: 'bg-purple-600', tier: 'Business', action: 'Optimize', desc: 'Heavy usage + advanced insights' },
          { color: 'bg-emerald-600', tier: 'Custom', action: 'Transform', desc: 'Full-scale custom transformation' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-50 flex flex-col items-start text-left group hover:-translate-y-2 transition-all duration-500">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-4 h-4 rounded-full ${item.color} shadow-lg shadow-${item.color}/20`}></div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{item.tier}</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">"{item.action}"</h4>
              {item.star && <span className="text-2xl animate-pulse">⭐</span>}
            </div>
            <p className="text-slate-500 font-bold text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const handleInitialSelect = async (tier: SubscriptionTier) => {
    if (tier === SubscriptionTier.TRIAL || tier === SubscriptionTier.FREE) {
      setIsSubmitting(true);
      try {
        await onSelect(tier);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setSelectedTier(tier);
      setPaymentStep('checkout');
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedTier || !user) return;
    
    setErrorMessage(null);
    setPaymentStep('processing');
    
    try {
      const displayPrice = billingCycle === 'annual' ? Math.floor(PLAN_LIMITS[selectedTier].price * 0.8) : PLAN_LIMITS[selectedTier].price;
      
      // Step 1: Create Order on Backend
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: displayPrice,
          currency: 'INR',
          receipt: `plan_${selectedTier}_${user.id}`
        })
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to initialize payment gateway');
      }

      // Step 2: Open Razorpay Checkout
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Hostel Management Pro',
        description: `Upgrade to ${selectedTier} Plan`,
        order_id: orderData.id,
        handler: async (response: any) => {
          // Step 3: Verify Payment on Backend
          try {
            setPaymentStep('processing');
            const verifyResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              setPaymentStep('success');
              setTimeout(async () => {
                await onSelect(selectedTier);
              }, 2000);
            } else {
              throw new Error(verifyData.message || 'Payment verification failed');
            }
          } catch (error: any) {
            setErrorMessage(error.message);
            setPaymentStep('checkout');
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: '' // Add phone if available in user object
        },
        theme: {
          color: '#2563EB'
        },
        modal: {
          ondismiss: () => {
            setPaymentStep('checkout');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      console.error('Payment Flow Error:', error);
      setErrorMessage(error.message);
      setPaymentStep('checkout');
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6 md:p-16 animate-in fade-in duration-700 relative overflow-x-hidden">
      {onClose && (
        <button 
          onClick={onClose}
          className="fixed top-6 right-6 md:top-10 md:right-10 z-[100] w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:scale-95 border border-slate-100"
          title="Close and return to dashboard"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {/* Enhanced Payment Simulation Overlay */}
      {paymentStep !== 'none' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-400/20  transition-all duration-500"></div>
          
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-12 text-center shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] animate-in zoom-in duration-300">
            {paymentStep === 'checkout' && (
              <div className="animate-in fade-in duration-300">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 text-blue-600 rounded-[1.5rem] md:rounded-[2rem] mx-auto flex items-center justify-center mb-6 md:mb-8 border border-blue-100 shadow-inner">
                  <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Billing Summary</h2>
                <p className="text-slate-500 mb-8 md:mb-10 font-bold uppercase tracking-widest text-[9px] md:text-[10px] opacity-60">Complete your subscription</p>
                
                <div className="bg-slate-50 rounded-2xl md:rounded-3xl p-6 md:p-8 mb-8 md:mb-10 border border-slate-100 space-y-3 md:space-y-4">
                  {errorMessage && (
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-tight border border-rose-100 mb-4 animate-in slide-in-from-top-2">
                       {errorMessage === 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variable is missing' 
                         ? 'Payment gateway not configured. Please add Razorpay keys in Settings.' 
                         : errorMessage}
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan</span>
                    <span className="text-xs md:text-sm font-black text-slate-900 uppercase">{selectedTier}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Cycle</span>
                    <span className="text-xs md:text-sm font-black text-slate-900 capitalize">{billingCycle}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[9px] md:text-[10px] font-black text-slate-900 uppercase tracking-widest">Total Pay</span>
                    <span className="text-xl md:text-2xl font-black text-blue-600">
                      {selectedTier && formatCurrency(billingCycle === 'annual' ? PLAN_LIMITS[selectedTier].price * 0.8 : PLAN_LIMITS[selectedTier].price)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={handleConfirmPayment}
                    className="w-full py-4 md:py-5 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-blue-700 shadow-2xl shadow-blue-100 transition-all hover:-translate-y-1 active:scale-95"
                  >
                    Confirm & Pay Securely
                  </button>
                  <button 
                    onClick={() => setPaymentStep('none')}
                    className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition"
                  >
                    Cancel and Return
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'processing' && (
              <div className="py-12 animate-in fade-in duration-300">
                <div className="relative w-24 h-24 mx-auto mb-10">
                   <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                   <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-8 h-8 text-blue-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
                   </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Verifying Payment</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] italic">Awaiting response from Razorpay...</p>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="py-12 animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full mx-auto flex items-center justify-center mb-10 border-4 border-emerald-100 shadow-xl shadow-emerald-100/50">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Payment Confirmed!</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Your account is being upgraded...</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto text-center mb-12 md:mb-20">
        <h1 className="text-3xl md:text-6xl font-black text-slate-900 mb-4 md:mb-6 uppercase tracking-tighter">Choose Your Power</h1>
        <p className="text-slate-500 text-base md:text-lg max-w-2xl mx-auto font-medium px-4">Select a plan to unlock advanced hostel automation tools.</p>
        
        <div className="mt-8 md:mt-12 flex items-center justify-center gap-4 md:gap-6">
           <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
           <button 
             onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
             className="w-14 md:w-16 h-7 md:h-8 bg-slate-200 rounded-full relative p-1 md:p-1.5 transition-all hover:bg-slate-300"
           >
             <div className={`w-5 h-5 bg-blue-600 rounded-full shadow-lg transform transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-7 md:translate-x-8' : 'translate-x-0'}`}></div>
           </button>
           <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${billingCycle === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}>
             Annual <span className="text-emerald-500 ml-1 md:ml-1.5 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">-20%</span>
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 md:gap-8 max-w-7xl mx-auto">
        {plans.map((p) => {
          const limit = PLAN_LIMITS[p.tier];
          const isCurrent = currentTier === p.tier;
          const displayPrice = billingCycle === 'annual' ? Math.floor(limit.price * 0.8) : limit.price;

          return (
            <div 
              key={p.tier} 
              className={`relative flex flex-col p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 transition-all duration-500 hover:-translate-y-2 ${
                p.highlight 
                  ? 'border-blue-600 shadow-2xl shadow-blue-100 z-10 bg-white' 
                  : 'border-transparent bg-white/70 shadow-xl shadow-slate-100 hover:bg-white hover:border-blue-100'
              }`}
            >
              {p.highlight && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">{p.tagline}</span>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">{p.name}</h3>
                <p className="text-slate-400 text-[10px] md:text-xs font-bold leading-relaxed h-8">{p.description}</p>
              </div>

              <div className="mb-8 md:mb-10 flex items-baseline gap-1.5 h-12">
                <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
                  {p.tier === SubscriptionTier.TRIAL || p.tier === SubscriptionTier.FREE 
                    ? 'FREE' 
                    : p.tier === SubscriptionTier.CUSTOM 
                      ? 'CUSTOM' 
                      : formatCurrency(displayPrice)}
                </span>
                {p.tier !== SubscriptionTier.CUSTOM && (
                  <span className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                    {p.tier === SubscriptionTier.TRIAL ? '7 DAYS' : '/ mo'}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-4 md:space-y-5 mb-8 md:mb-10">
                {p.features.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-3 md:gap-4">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                       <svg className="w-2.5 h-2.5 md:w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-[9px] md:text-[10px] font-black text-slate-600 uppercase tracking-tight">{f}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => !isCurrent && !isSubmitting && handleInitialSelect(p.tier)}
                disabled={isCurrent || isSubmitting}
                className={`w-full py-4 md:py-5 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all duration-300 ${
                  isCurrent 
                    ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-200 cursor-default'
                    : isSubmitting
                      ? 'bg-slate-200 text-slate-400 cursor-wait'
                      : p.highlight 
                        ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95' 
                        : 'bg-blue-50 text-blue-600 border-2 border-blue-50 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm active:scale-95'
                }`}
              >
                {isCurrent ? 'Current Plan' : isSubmitting ? 'Processing...' : p.tier === SubscriptionTier.TRIAL ? 'Start 7-Day Trial' : 'Upgrade Now'}
              </button>
            </div>
          );
        })}
      </div>
      <ComparisonTable />
      <WhatThisAchieves />
    </div>
  );
};

export default PlanSelection;
