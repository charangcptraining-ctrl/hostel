
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockData';
import { Resident, UserRole } from '../types';
import { Key, User, Phone, Mail, Calendar, MapPin, Building2, CreditCard, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ResidentSettingsProps {
  residentId: string;
}

const ResidentSettings: React.FC<ResidentSettingsProps> = ({ residentId }) => {
  const [resident, setResident] = useState<Resident | null>(null);
  const [propertyName, setPropertyName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    const fetchResident = async () => {
      try {
        setLoading(true);
        const [residents, properties] = await Promise.all([
          db.getResidents(),
          db.getProperties()
        ]);
        const found = residents.find(r => r.id === residentId || r.email === residentId);
        if (found) {
          setResident(found);
          const property = properties.find(p => p.id === found.propertyId || (p as any)._id === found.propertyId);
          if (property) setPropertyName(property.name);
        } else {
          setError("Profile data not found.");
        }
      } catch (err: any) {
        setError("Failed to load profile settings.");
      } finally {
        setLoading(false);
      }
    };
    fetchResident();
  }, [residentId]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setUpdatingPassword(true);
      setError(null);
      await db.updateUserPassword(residentId, newPassword);
      setSuccess("Password updated successfully!");
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Profile...</p>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="p-10 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Access Denied</h2>
        <p className="text-slate-500 font-medium text-sm mt-2">{error || "Could not load settings."}</p>
      </div>
    );
  }

  const InfoCard = ({ title, value, icon: Icon, colorClass = "text-blue-600 bg-blue-50" }: any) => (
    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-sm font-bold text-slate-900 mt-0.5">{value || 'N/A'}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Your Settings</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Manage your account and view profile details</p>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600 uppercase text-[9px] font-black tracking-widest">Dismiss</button>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Info Columns */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Personal Identification</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard title="Full Name" value={resident.name} icon={User} />
              <InfoCard title="Date of Birth" value={resident.dob} icon={Calendar} />
              <InfoCard title="Email Address" value={resident.email} icon={Mail} />
              <InfoCard title="Phone Number" value={resident.phone} icon={Phone} />
              <InfoCard title="Resident ID" value={resident.id} icon={ShieldCheck} />
              <InfoCard title="Gov ID Type" value={resident.idProofType} icon={CreditCard} />
              <InfoCard title="Gov ID Number" value={resident.idNumber} icon={CreditCard} colorClass="text-purple-600 bg-purple-50" />
              <div className="md:col-span-2">
                <InfoCard title="Permanent Address" value={resident.permanentAddress} icon={MapPin} colorClass="text-orange-600 bg-orange-50" />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Hostel Allocation</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard title="Property Name" value={propertyName} icon={Building2} colorClass="text-indigo-600 bg-indigo-50" />
              <InfoCard title="Room Number" value={resident.roomNumber} icon={Building2} colorClass="text-indigo-600 bg-indigo-50" />
              <InfoCard title="Move-in Date" value={resident.moveInDate} icon={Calendar} colorClass="text-indigo-600 bg-indigo-50" />
              <InfoCard title="Monthly Rent" value={`₹${resident.rent}`} icon={CreditCard} colorClass="text-emerald-600 bg-emerald-50" />
              <InfoCard title="Due Date" value={`${resident.dueDate}th of every month`} icon={Calendar} colorClass="text-rose-600 bg-rose-50" />
              <InfoCard title="Security Deposit" value={`₹${resident.securityDeposit}`} icon={ShieldCheck} colorClass="text-amber-600 bg-amber-50" />
              <InfoCard title="Account status" value={resident.status.toUpperCase()} icon={CheckCircle2} colorClass={resident.status === 'active' ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"} />
            </div>
          </section>

          <p className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl text-[10px] text-blue-600 font-bold uppercase tracking-widest leading-relaxed">
            Note: Personal and allocation data is read-only. If any of the information above is incorrect, please contact the hostel management directly for correction.
          </p>
        </div>

        {/* Password Update Column */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm sticky top-8">
            <div className="flex items-center gap-2 mb-6">
              <Key className="w-4 h-4 text-blue-600" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Access Control</h3>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-slate-50 border border-slate-100 font-bold text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-slate-50 border border-slate-100 font-bold text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={updatingPassword}
                className={`w-full py-5 rounded-[1.25rem] font-black uppercase tracking-widest text-[10px] transition shadow-lg shadow-blue-100 flex items-center justify-center gap-2 ${
                  updatingPassword 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }`}
              >
                {updatingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Update Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResidentSettings;
