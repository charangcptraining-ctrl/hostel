
import React, { useState } from 'react';
import { User, SubscriptionTier, PLAN_LIMITS, UserRole } from '../types';
import { db } from '../services/mockData';
import { Icons, formatCurrency } from '../constants';

interface SettingsProps {
  user: User;
  planConfigs: any[];
  onUpdateUser: (user: User) => void;
  onUpgrade: () => void;
}

const Settings: React.FC<SettingsProps> = ({ user, planConfigs, onUpdateUser, onUpgrade }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [upiId, setUpiId] = useState(user.upiId || '');
  const [qrImageUrl, setQrImageUrl] = useState(user.qrImageUrl || '');
  const [smePayLink, setSmePayLink] = useState(user.smePayLink || '');
  const [phonepeMerchantId, setPhonepeMerchantId] = useState(user.phonepeMerchantId || '');
  const [phonepeClientId, setPhonepeClientId] = useState(user.phonepeClientId || '');
  const [phonepeClientSecret, setPhonepeClientSecret] = useState(user.phonepeClientSecret || '');
  const [razorpayKeyId, setRazorpayKeyId] = useState(user.razorpayKeyId || '');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState(user.razorpayKeySecret || '');
  const [acceptedMethods, setAcceptedMethods] = useState<string[]>(user.acceptedPaymentMethods || ['Cash']);
  const [activeTab, setActiveTab] = useState<'modes' | 'upi' | 'smepay' | 'phonepe' | 'razorpay'>('modes');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Get allowed methods for current plan
  const currentPlanConfig = planConfigs.find(c => c.tier === user.plan);
  const allowedMethods = currentPlanConfig?.allowedPaymentMethods || ['Cash'];

  const paymentModes = allowedMethods;
  
  const allTabs = [
    { id: 'modes' as const, label: 'Modes', icon: Icons.Payments, method: null },
    { id: 'upi' as const, label: 'UPI/VPA', icon: Icons.Payments, method: 'UPI QR' },
    { id: 'razorpay' as const, label: 'Razorpay', icon: Icons.Razorpay || Icons.Payments, method: 'Razorpay' },
    { id: 'smepay' as const, label: 'SMEPay', icon: Icons.Globe, method: 'SME Pay Link' },
    { id: 'phonepe' as const, label: 'PhonePe', icon: Icons.Building, method: 'PhonePe' },
  ];

  const configTabs = allTabs;

  const handleToggleMethod = (method: string) => {
    if (!allowedMethods.includes(method)) return;
    
    if (acceptedMethods.includes(method)) {
      if (acceptedMethods.length > 1) { // Prevent deselecting everything
        setAcceptedMethods(acceptedMethods.filter(m => m !== method));
      } else {
        setMessage({ type: 'error', text: 'At least one payment method must be selected.' });
      }
    } else {
      setAcceptedMethods([...acceptedMethods, method]);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const updatedUser = await db.updateUserProfile(user.id || (user as any)._id, { name, email });
      onUpdateUser(updatedUser);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPayment(true);
    setMessage(null);
    try {
      const profileData = { 
        upiId, 
        qrImageUrl, 
        smePayLink,
        phonepeMerchantId,
        phonepeClientId,
        phonepeClientSecret,
        razorpayKeyId,
        razorpayKeySecret,
        acceptedPaymentMethods: acceptedMethods
      };
      const updatedUser = await db.updateUserProfile(user.id || (user as any)._id, profileData);
      onUpdateUser(updatedUser);
      setMessage({ type: 'success', text: 'Payment configuration updated!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update payment info.' });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const currentPlan = PLAN_LIMITS[user.plan || SubscriptionTier.TRIAL];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Account Settings</h1>
        <p className="text-slate-500 font-medium">Manage your profile and subscription plan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Profile Section */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Icons.Staff /> Profile Information
            </h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  required 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  type="email" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                />
              </div>
              
              {message && (
                <div className={`p-4 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                  {message.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSaving}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Payment Configuration (Owner Only) */}
          {user.role === UserRole.OWNER && (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                  <Icons.Payments className="w-4 h-4" /> Payment Configuration
                </h2>
                <div className="flex flex-wrap bg-slate-100/50 p-1 rounded-2xl gap-1">
                  {configTabs.map(tab => {
                    const isAllowed = !tab.method || allowedMethods.includes(tab.method);
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => isAllowed && setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                          activeTab === tab.id 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : !isAllowed 
                              ? 'text-slate-300 cursor-not-allowed opacity-60'
                              : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {!isAllowed ? <Icons.Lock className="w-2.5 h-2.5" /> : <tab.icon className="w-2.5 h-2.5" />}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSavePayments} className="space-y-6">
                {activeTab === 'modes' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Accepted Payment Modes</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      {['Cash', 'PhonePe', 'Razorpay', 'UPI QR', 'SME Pay Link'].map(mode => {
                        const isAllowed = allowedMethods.includes(mode);
                        return (
                          <label key={mode} className={`flex items-center gap-3 group ${!isAllowed ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <div 
                              onClick={() => isAllowed && handleToggleMethod(mode)}
                              className={`w-10 h-6 flex items-center rounded-full transition-colors p-1 ${
                                isAllowed && acceptedMethods.includes(mode) ? 'bg-blue-600' : 'bg-slate-200'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                acceptedMethods.includes(mode) ? 'translate-x-4' : 'translate-x-0'
                              }`} />
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                              acceptedMethods.includes(mode) ? 'text-slate-900' : 'text-slate-400'
                            }`}>
                              {mode}
                              {!isAllowed && <Icons.Lock className="w-3 h-3" />}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide italic mt-1">Select the modes you wish to accept from residents.</p>
                  </div>
                )}

                {activeTab === 'upi' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UPI ID (VPA)</label>
                      <input 
                        value={upiId} 
                        onChange={(e) => setUpiId(e.target.value)} 
                        placeholder="e.g. host@okaxis"
                        type="text" 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">QR Code Image URL</label>
                      <input 
                        value={qrImageUrl} 
                        onChange={(e) => setQrImageUrl(e.target.value)} 
                        placeholder="Link to your UPI QR code image"
                        type="text" 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                      />
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide italic">Residents can scan this QR to pay directly to you.</p>
                    </div>
                  </div>
                )}

                {activeTab === 'smepay' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SMEPay Link</label>
                    <input 
                      value={smePayLink} 
                      onChange={(e) => setSmePayLink(e.target.value)} 
                      placeholder="Your unique SMEPay payment link"
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                    />
                  </div>
                )}

                {activeTab === 'phonepe' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">PhonePe Business PG Credentials</h3>
                      <div className="flex gap-4">
                        <button 
                          type="button"
                          onClick={() => {
                            setPhonepeMerchantId('M22HHI4UCQ4AX_2604240101');
                            setPhonepeClientId('MjEzOGE5Y2EtYjVIZC00ZjbMLWFjODYtZGQxYmYzZDZkZDdh');
                            setPhonepeClientSecret('1');
                          }}
                          className="text-[8px] font-black uppercase text-blue-600 hover:underline tracking-widest"
                        >
                          Use Test Mode
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setPhonepeMerchantId('');
                            setPhonepeClientId('');
                            setPhonepeClientSecret('');
                          }}
                          className="text-[8px] font-black uppercase text-rose-600 hover:underline tracking-widest"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Merchant ID (MID)</label>
                        <input 
                          value={phonepeMerchantId} 
                          onChange={(e) => setPhonepeMerchantId(e.target.value)} 
                          placeholder="e.g. M22HHI4UCQ4AX..."
                          type="text" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salt Key</label>
                          <input 
                            value={phonepeClientId} 
                            onChange={(e) => setPhonepeClientId(e.target.value)} 
                            placeholder="Enter your PhonePe Salt Key"
                            type="password" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salt Index</label>
                          <input 
                            value={phonepeClientSecret} 
                            onChange={(e) => setPhonepeClientSecret(e.target.value)} 
                            placeholder="Usually '1'"
                            type="text" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'razorpay' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Razorpay API Credentials</h3>
                      <button 
                        type="button"
                        onClick={() => {
                          setRazorpayKeyId('rzp_test_741681310733');
                          setRazorpayKeySecret('test_secret');
                        }}
                        className="text-[8px] font-black uppercase text-blue-600 hover:underline tracking-widest"
                      >
                        Use Test Mode
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Key ID</label>
                        <input 
                          value={razorpayKeyId} 
                          onChange={(e) => setRazorpayKeyId(e.target.value)} 
                          placeholder="rzp_live_..."
                          type="text" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Key Secret</label>
                        <input 
                          value={razorpayKeySecret} 
                          onChange={(e) => setRazorpayKeySecret(e.target.value)} 
                          placeholder="Enter your Razorpay Key Secret"
                          type="password" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" 
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide italic">Enable direct payment collection using your Razorpay account.</p>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={isSavingPayment}
                  className="w-full sm:w-auto bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition shadow-lg shadow-slate-100 disabled:opacity-50"
                >
                  {isSavingPayment ? 'Updating Configuration...' : 'Save Configuration'}
                </button>
              </form>
            </div>
          )}

          {/* Application Mode Section */}
          {user.role === UserRole.OWNER && (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Icons.Dashboard /> Application Mode
              </h2>
              <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Basic Host Mode (Lite)</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Simplified dashboard and navigation for small hosts.</p>
                </div>
                <button 
                  onClick={() => onUpdateUser({ ...user, isBasicHost: !user.isBasicHost })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${user.isBasicHost ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.isBasicHost ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          )}

          {/* Security Section */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Security
            </h2>
            <p className="text-xs text-slate-500 mb-4">Change your password to keep your account secure.</p>
            <button className="px-4 py-2 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition">
              Change Password
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Subscription Card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase mb-1 tracking-widest opacity-60">Current Plan</p>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-4">{user.plan} Tier</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-80">
                  <span>Properties</span>
                  <span>{currentPlan.properties || 'Unlimited'}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-80">
                  <span>Staff</span>
                  <span>{currentPlan.staff || 'Unlimited'}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-80">
                  <span>Residents</span>
                  <span>{currentPlan.residents || 'Unlimited'}</span>
                </div>
              </div>

              <button 
                onClick={onUpgrade}
                className="w-full py-3 bg-white text-blue-600 font-black rounded-xl hover:bg-blue-50 transition text-[10px] uppercase tracking-widest shadow-lg"
              >
                Change Plan
              </button>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition"></div>
          </div>

          {/* Enterprise Intelligence Hub (Business Tier Exclusive) */}
          {user.plan === SubscriptionTier.BUSINESS && user.role === UserRole.OWNER && (
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-100 space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-600/30 transition-all duration-700"></div>
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 text-blue-400">
                  <Icons.SuperAdmin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em]">Enterprise Intelligence</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Complete Business Suite Active</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 relative z-10">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Hostel ROI & Analysis</p>
                    <span className="text-[8px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-black uppercase">Live</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-300 leading-relaxed italic">Prop-by-Prop yield & occupancy heatmaps generating.</p>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Payroll IQ</p>
                    <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase">Active</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-300 leading-relaxed italic">Auto-Salary Invoices & Staff Performance logs enabled.</p>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Budget & Tax IQ</p>
                    <span className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-black uppercase">Syncing</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-300 leading-relaxed italic">Expense analysis & Tax-ready monthly exports ready.</p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-2 border-t border-white/5 relative z-10">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400 text-nowrap">Empire Management Environment</span>
              </div>
            </div>
          )}

          {/* Pro Automation Hub (New Title) */}
          {user.plan === SubscriptionTier.PRO && user.role === UserRole.OWNER && (
            <div className="bg-white p-6 rounded-[2rem] border border-blue-100 shadow-sm space-y-4 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-2 mb-2">
                <Icons.Dashboard className="w-4 h-4 text-blue-600" />
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Automation Hub (Pro)</h3>
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tight mb-1">Billing Alerts</p>
                  <p className="text-[10px] font-bold text-slate-600 leading-tight">WhatsApp & SMS active for upcoming dues.</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-tight mb-1">Monthly Reports</p>
                  <p className="text-[10px] font-bold text-slate-600 leading-tight">Revenue snapshots sent on every month-end.</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-tight mb-1">Verifications</p>
                  <p className="text-[10px] font-bold text-slate-600 leading-tight">Multi-channel resident integrity checks on.</p>
                </div>
              </div>
              
              <div className="pt-2 text-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest shadow-md">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                   Fully Automated
                </span>
              </div>
            </div>
          )}

          {/* Support Card */}
          <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-xs font-black uppercase tracking-widest mb-2">Need Help?</h3>
              <p className="text-[10px] text-slate-400 font-medium mb-4">Our support team is available 24/7 to assist you.</p>
              <button className="w-full py-3 bg-white/10 text-white font-black rounded-xl hover:bg-white/20 transition text-[10px] uppercase tracking-widest border border-white/10">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
