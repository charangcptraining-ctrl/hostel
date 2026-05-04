import React, { useState } from 'react';
import { UserRole } from '../types';
import { db } from '../services/mockData';

interface SignupProps {
  onSignupSuccess: (role: UserRole, userId: string) => void;
  onNavigateToLogin: () => void;
}

type SignupStep = 'email' | 'setup' | 'verify' | 'success';

const Signup: React.FC<SignupProps> = ({ onSignupSuccess, onNavigateToLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.OWNER);
  const [step, setStep] = useState<SignupStep>('email');
  
  // Form Fields
  const [yourEmail, setYourEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [preRegisteredRecord, setPreRegisteredRecord] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Check for Duplicate User Email
      if (await db.isEmailRegisteredAsUser(yourEmail)) {
        setError('An account with this email already exists. Try signing in.');
        return;
      }

      // 2. Check Invitation (Role-Specific)
      const response = await fetch('/api/auth/check-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: yourEmail, role })
      });

      const data = await response.json();

      if (response.ok && data.invited) {
        setPreRegisteredRecord(data.record);
        setStep('setup');
      } else {
        setError(data.message || "Verification Failed: Your email isn't registered. Ask your Owner to add you first.");
      }
    } catch (err: any) {
      console.error('Email check error:', err);
      setError('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    try {
      // Check for Unique Username
      if (await db.isUsernameTaken(username)) {
        setError(`Username "${username}" is already in use. Please choose a unique identifier.`);
        return;
      }

      setStep('verify');
    } catch (err: any) {
      setError('Validation failed. Please try again.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (otp === '123456') { 
      try {
        // Final persistence check for username uniqueness
        if (await db.isUsernameTaken(username)) {
          setError('Username was just taken! Please go back and choose another.');
          setStep('setup');
          return;
        }

        // Persist the user
        const savedUser = await db.saveUser({
          id: preRegisteredRecord?.id || preRegisteredRecord?._id,
          name: preRegisteredRecord?.name || username, 
          username: username.toLowerCase().trim(),
          email: yourEmail.toLowerCase().trim(),
          password,
          role,
          ownerId: preRegisteredRecord?.ownerId,
          propertyId: preRegisteredRecord?.propertyId,
          assignedPropertyIds: preRegisteredRecord?.assignedPropertyIds,
          canCollectCash: preRegisteredRecord?.canCollectCash || false,
          createdAt: new Date().toISOString()
        });

        setStep('success');
        setTimeout(() => {
          onSignupSuccess(role, savedUser.id || savedUser._id);
        }, 1500);
      } catch (err: any) {
        console.error('Signup error:', err);
        setError(err.message || 'Signup failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('Invalid verification code. Use 123456.');
      setIsLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8 md:mb-10">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-[1.5rem] md:rounded-[2rem] mx-auto flex items-center justify-center text-white text-3xl md:text-4xl font-black mb-4 md:mb-6 shadow-2xl shadow-blue-200">H</div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter">Join Hostel Pro</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-[10px] mt-2 italic opacity-60">Step 1: Email Verification</p>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-slate-200/50 p-8 md:p-12 border border-slate-100 relative overflow-hidden group">
            <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8 md:mb-10 border border-slate-100">
              {[UserRole.OWNER, UserRole.STAFF, UserRole.RESIDENT].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setError(''); }}
                  className={`flex-1 py-3 md:py-3.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${role === r ? 'bg-white text-blue-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {r}
                </button>
              ))}
            </div>

            <form onSubmit={handleEmailCheck} className="space-y-6">
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email" 
                  value={yourEmail}
                  onChange={(e) => setYourEmail(e.target.value)}
                  className="w-full px-5 md:px-6 py-3.5 md:py-4 bg-slate-50 border-2 border-slate-50 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                  placeholder="Enter your registered email"
                  required
                />
                {role !== UserRole.OWNER && (
                  <p className="text-[8px] md:text-[9px] text-blue-500 font-black italic mt-1.5 px-1 uppercase tracking-tighter">
                    * Note: Use the email registered by your hostel owner.
                  </p>
                )}
              </div>

              {error && <p className="text-xs font-bold text-rose-600 bg-rose-50 p-4 rounded-2xl border border-rose-100 animate-shake">{error}</p>}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-4 md:py-5 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl md:rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Verifying...' : 'Continue to Setup'}
              </button>
            </form>

            <div className="mt-8 md:mt-10 pt-6 md:pt-8 border-t border-slate-50 text-center">
              <p className="text-xs md:text-sm font-bold text-slate-500">
                Already a member? {' '}
                <button onClick={onNavigateToLogin} className="text-blue-600 font-black uppercase tracking-widest text-[10px] md:text-xs hover:underline ml-1">Sign in</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8 md:mb-10">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-[1.5rem] md:rounded-[2rem] mx-auto flex items-center justify-center text-white text-3xl md:text-4xl font-black mb-4 md:mb-6 shadow-2xl shadow-blue-200">H</div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter">Account Setup</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-[10px] mt-2 italic opacity-60">Step 2: Create Credentials</p>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-slate-200/50 p-8 md:p-12 border border-slate-100 relative overflow-hidden group">
            <form onSubmit={handleAccountSetup} className="space-y-6">
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unique Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-5 md:px-6 py-3.5 md:py-4 bg-slate-50 border-2 border-slate-50 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                  placeholder="Pick a unique handle"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 md:px-6 py-3.5 md:py-4 bg-slate-50 border-2 border-slate-50 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Repeat</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-5 md:px-6 py-3.5 md:py-4 bg-slate-50 border-2 border-slate-50 rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error && <p className="text-xs font-bold text-rose-600 bg-rose-50 p-4 rounded-2xl border border-rose-100 animate-shake">{error}</p>}

              <button type="submit" className="w-full py-4 md:py-5 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl md:rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95">
                Continue to Verification
              </button>
              <button type="button" onClick={() => setStep('email')} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition">
                Back to Email
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 border border-slate-100 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] mx-auto flex items-center justify-center text-white mb-6 shadow-2xl shadow-blue-100">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Verify Email</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Code sent to: <span className="text-blue-600 tracking-normal lowercase font-bold">{yourEmail}</span></p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Authentication PIN</label>
              <input 
                type="text" 
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full text-center tracking-[1em] text-4xl font-black py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                placeholder="000000"
              />
            </div>
            {error && <p className="text-xs font-bold text-rose-600 text-center bg-rose-50 p-4 rounded-2xl border border-rose-100">{error}</p>}
            <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1">
              Verify & Complete Signup
            </button>
            <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-tight italic">Demo Key: 123456</p>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[3.5rem] shadow-2xl p-20 text-center animate-in zoom-in duration-500 border border-slate-50">
          <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2.5rem] mx-auto flex items-center justify-center mb-8 border-4 border-emerald-100 shadow-xl shadow-emerald-50">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Welcome!</h2>
          <p className="text-slate-500 font-bold italic text-sm">Synchronizing your dashboard...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default Signup;
