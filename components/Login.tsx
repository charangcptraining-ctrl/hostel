
import React, { useState } from 'react';
import { UserRole } from '../types';
import { db } from '../services/mockData';

interface LoginProps {
  onLogin: (role: UserRole, userId: string) => void;
  onNavigateToSignup: () => void;
  error?: string | null;
}

type LoginView = 'login' | 'forgot' | 'otp' | 'reset';

const Login: React.FC<LoginProps> = ({ onLogin, onNavigateToSignup, error: externalError }) => {
  const [view, setView] = useState<LoginView>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const displayError = error || externalError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Superadmin override
    if (username === 'superadmin' && password === 'Admin@123') {
      onLogin(UserRole.SUPERADMIN, 'SUPERADMIN');
      return;
    }

    try {
      const user = await db.login({ username, password });
      if (user) {
        onLogin(user.role, user.id || user._id);
      } else {
        setError('Invalid credentials. Please check your details.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Mock sending OTP
    setSuccess(`Reset code sent to ${recoveryEmail}`);
    setTimeout(() => {
      setSuccess('');
      setView('otp');
    }, 1500);
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp === '123456') {
      setView('reset');
    } else {
      setError('Invalid code. Use 123456 for demo.');
    }
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('Password updated successfully!');
    setTimeout(() => {
      setSuccess('');
      setView('login');
    }, 1500);
  };

  const renderForm = () => {
    switch (view) {
      case 'forgot':
        return (
          <form onSubmit={handleForgotSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Recovery Email</label>
              <input 
                required
                type="email" 
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-bold text-sm" 
                placeholder="Enter your registered email"
              />
            </div>
            {success && <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-3 rounded-xl">{success}</p>}
            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition">
              Send Reset Code
            </button>
            <button type="button" onClick={() => setView('login')} className="w-full text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition">
              Back to Login
            </button>
          </form>
        );
      case 'otp':
        return (
          <form onSubmit={handleOtpSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Enter 6-Digit Code</label>
              <input 
                required
                type="text" 
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full text-center tracking-[0.5em] text-2xl font-black py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all" 
                placeholder="000000"
              />
            </div>
            {displayError && <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl">{displayError}</p>}
            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition">
              Verify Code
            </button>
            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-tight italic">Demo Code: 123456</p>
          </form>
        );
      case 'reset':
        return (
          <form onSubmit={handleResetSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">New Password</label>
              <input 
                required
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-bold text-sm" 
                placeholder="••••••••"
              />
            </div>
            {success && <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-3 rounded-xl">{success}</p>}
            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition">
              Update Password
            </button>
          </form>
        );
      default:
        return (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Username or Email</label>
              <input 
                required
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-bold text-sm" 
                placeholder="e.g. rahul_hostel"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <button 
                  type="button" 
                  onClick={() => setView('forgot')}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input 
                required
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-bold text-sm" 
                placeholder="••••••••"
              />
            </div>
            {displayError && <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl">{displayError}</p>}
            <button 
              type="submit"
              className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition active:scale-95"
            >
              Sign In to Dashboard
            </button>
          </form>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 md:mb-10">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-[1.5rem] md:rounded-[2rem] mx-auto flex items-center justify-center text-white text-3xl md:text-4xl font-black mb-4 md:mb-6 shadow-2xl shadow-blue-200">H</div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Hostel Pro</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-[10px] mt-2 italic opacity-60">SaaS Management Platform</p>
        </div>

        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 md:p-10 border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          
          <div className="relative z-10">
            {renderForm()}
          </div>
          
          <div className="mt-8 md:mt-10 pt-6 md:pt-8 border-t border-slate-50 text-center relative z-10">
            <p className="text-xs md:text-sm font-bold text-slate-500">
              {view === 'login' ? "Don't have an account?" : "Remembered your password?"} {' '}
              <button 
                onClick={view === 'login' ? onNavigateToSignup : () => setView('login')}
                className="text-blue-600 font-black uppercase tracking-widest text-[10px] md:text-xs hover:underline ml-1"
              >
                {view === 'login' ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
        
        <p className="text-center text-[9px] md:text-[10px] font-black text-slate-300 mt-8 md:mt-12 uppercase tracking-[0.2em] opacity-40 px-4">
          Empowering Property Owners Globally
        </p>
      </div>
    </div>
  );
};

export default Login;
