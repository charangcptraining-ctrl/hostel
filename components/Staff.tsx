
import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../services/mockData';
import { Staff, Property, PLAN_LIMITS, StaffCategory, SubscriptionTier } from '../types';
import { formatCurrency, formatCompactCurrency, Icons } from '../constants';

interface StaffProps {
  ownerId: string;
  onUpgrade: () => void;
  assignedPropertyIds?: string[];
  plan?: SubscriptionTier;
}

const StaffManagement: React.FC<StaffProps> = ({ ownerId, onUpgrade, assignedPropertyIds, plan }) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<any>(PLAN_LIMITS[plan || SubscriptionTier.TRIAL]);

  // Update internal plan state when prop changes
  useEffect(() => {
    setUserPlan(PLAN_LIMITS[plan || SubscriptionTier.TRIAL]);
  }, [plan]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStaffForDetail, setSelectedStaffForDetail] = useState<Staff | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'salary'>('info');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedStaffForMove, setSelectedStaffForMove] = useState<Staff | null>(null);
  const [targetPropertyIds, setTargetPropertyIds] = useState<string[]>([]);

  const getSalaryHistory = (staff: Staff) => {
    const history = [];
    const date = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      history.push({
        month: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
        amount: staff.salary,
        status: i === 0 ? 'Pending' : 'Paid',
        date: i === 0 ? '-' : new Date(date.getFullYear(), date.getMonth() - i, 5).toLocaleDateString('en-IN')
      });
    }
    return history;
  };

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [salary, setSalary] = useState('');
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([]);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [canCollectCash, setCanCollectCash] = useState(false);
  const [canPostAnnouncements, setCanPostAnnouncements] = useState(false);
  const [canAddExpenses, setCanAddExpenses] = useState(false);
  const [category, setCategory] = useState<StaffCategory>(StaffCategory.OTHER);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffData, propsData] = await Promise.all([
        db.getStaff(ownerId),
        db.getProperties(ownerId)
      ]);
      
      setStaff(staffData);
      setProperties(propsData);
    } catch (error) {
      console.error("Error fetching staff data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ownerId]);

  const filteredStaffByProperty = useMemo(() => {
    let filtered = staff;
    if (selectedPropId !== 'all') {
      filtered = filtered.filter(s => s.assignedPropertyIds?.includes(selectedPropId));
    } else if (assignedPropertyIds && assignedPropertyIds.length > 0) {
      filtered = filtered.filter(s => s.assignedPropertyIds?.some(id => assignedPropertyIds.includes(id)));
    }
    return filtered;
  }, [staff, selectedPropId, assignedPropertyIds]);

  const stats = useMemo(() => {
    return {
      total: filteredStaffByProperty.length,
      active: filteredStaffByProperty.filter(s => s.status === 'active').length,
      payroll: filteredStaffByProperty.reduce((acc, s) => acc + s.salary, 0),
      propertiesCovered: new Set(filteredStaffByProperty.flatMap(s => s.assignedPropertyIds || [])).size
    };
  }, [filteredStaffByProperty]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    const propertyName = selectedPropId !== 'all' ? (properties.find(p => p.id === selectedPropId)?.name || 'Property') : 'All Properties';
    
    // Add Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Staff Directory Report', 40, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Property Filter: ${propertyName}`, 40, 70);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 40, 85);
    doc.text(`Generated by: Hostel Management Pro`, 40, 100);

    // Table Data
    const tableData = filteredStaffByProperty.map(s => [
      s.name,
      s.category,
      s.email,
      s.phone,
      s.assignedPropertyIds?.map(pid => properties.find(p => p.id === pid)?.name).filter(Boolean).join(', ') || '-',
      formatCurrency(s.salary),
      s.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 120,
      head: [['Name', 'Category', 'Email', 'Phone', 'Assignments', 'Salary', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [37, 99, 235], // blue-600
        textColor: 255, 
        fontSize: 9, 
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        5: { halign: 'right' },
        6: { halign: 'center' }
      },
      styles: { fontSize: 8, cellPadding: 6 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Staff_Report_${propertyName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-IN')}.pdf`);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setDob('');
    setSalary('');
    setSelectedPropIds([]);
    setStatus('active');
    setCanCollectCash(false);
    setCanPostAnnouncements(false);
    setCanAddExpenses(false);
    setCategory(StaffCategory.OTHER);
    setEditingStaffId(null);
    setFormError(null);
  };

  const handleEditClick = (s: Staff) => {
    setEditingStaffId(s.id || (s as any)._id);
    setName(s.name);
    setEmail(s.email);
    setPhone(s.phone);
    setDob(s.dob || '');
    setSalary(s.salary.toString());
    setSelectedPropIds(s.assignedPropertyIds || []);
    setStatus(s.status);
    setCanCollectCash(s.canCollectCash || false);
    setCanPostAnnouncements(s.canPostAnnouncements || false);
    setCanAddExpenses(s.canAddExpenses || false);
    setCategory(s.category || StaffCategory.OTHER);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userPlan.staff !== null && staff.length >= userPlan.staff && !editingStaffId) {
      onUpgrade();
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const staffData: Staff = {
      id: editingStaffId || `STAFF-${Date.now()}`,
      ownerId,
      name,
      username: email.split('@')[0] + Math.floor(Math.random() * 1000), // Simple username generation
      email,
      phone,
      dob,
      salary: parseInt(salary) || 0,
      category,
      assignedPropertyIds: selectedPropIds,
      status,
      canCollectCash,
      canPostAnnouncements,
      canAddExpenses
    };

    try {
      if (editingStaffId) {
        await db.updateStaff(staffData);
      } else {
        await db.saveStaff(staffData);
      }
      await fetchData();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving staff:", error);
      setFormError(error instanceof Error ? error.message : "Failed to save staff member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setStaffToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;
    setIsSubmitting(true);
    try {
      const result = await db.deleteStaff(staffToDelete);
      if (result.error) {
        throw new Error(result.error);
      }
      await fetchData();
      setShowDeleteConfirm(false);
      setStaffToDelete(null);
    } catch (error) {
      console.error("Error deleting staff:", error);
      setFormError(error instanceof Error ? error.message : "Failed to delete staff member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTargetProperty = (id: string) => {
    setTargetPropertyIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const confirmMove = async () => {
    if (!selectedStaffForMove) return;
    setIsSubmitting(true);
    try {
      await db.updateStaff({
        ...selectedStaffForMove,
        assignedPropertyIds: targetPropertyIds
      });
      await fetchData();
      setShowMoveModal(false);
      setSelectedStaffForMove(null);
    } catch (error) {
      console.error("Error moving staff:", error);
      setFormError(error instanceof Error ? error.message : "Failed to move staff.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProperty = (id: string) => {
    setSelectedPropIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Notifications */}
      {(success || error) && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            success ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            <div className={`w-2 h-2 rounded-full ${success ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <p className="text-sm font-black uppercase tracking-tight">{success || error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase">Staff Directory</h1>
          <p className="text-slate-400 text-sm font-medium italic mt-1">Manage your workforce, assignments, and payroll.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <select 
              value={selectedPropId} 
              onChange={(e) => setSelectedPropId(e.target.value)}
              className="w-full md:w-60 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest appearance-none pr-12 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-sm"
            >
              <option value="all">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
          <button 
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="whitespace-nowrap bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all flex items-center gap-3 shadow-xl shadow-blue-500/20 active:scale-95"
          >
            <span className="text-xl leading-none">+</span> Add Staff Member
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white p-3 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm group hover:border-blue-100 transition-all text-center">
          <p className="text-xl md:text-5xl font-black text-blue-600 mb-1 group-hover:scale-105 transition-transform">{stats.total}</p>
          <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Staff</p>
        </div>
        <div className="bg-white p-3 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm group hover:border-emerald-100 transition-all text-center">
          <p className="text-xl md:text-5xl font-black text-emerald-600 mb-1 group-hover:scale-105 transition-transform">{stats.active}</p>
          <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Active Members</p>
        </div>
        <div className="bg-white p-3 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm group hover:border-rose-100 transition-all text-center">
          <p className="text-lg md:text-4xl font-black text-rose-600 mb-1 group-hover:scale-105 transition-transform truncate">{formatCompactCurrency(stats.payroll)}</p>
          <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Monthly Payroll</p>
        </div>
        <div className="bg-white p-3 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm group hover:border-slate-200 transition-all text-center">
          <p className="text-xl md:text-5xl font-black text-slate-900 mb-1 group-hover:scale-105 transition-transform">{stats.propertiesCovered}</p>
          <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Properties Covered</p>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 md:p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm mb-1">Staff Roster</h3>
            <p className="text-slate-400 text-[10px] md:text-xs font-medium">Detailed view of your workforce across all assigned properties</p>
          </div>
          <div>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
            >
              <Icons.Complaints className="w-3 h-3" />
              Download Staff PDF
            </button>
          </div>
        </div>
        
        {/* Mobile View: Card-like List */}
        <div className="md:hidden space-y-4 px-4 bg-slate-50/30 py-6">
          {filteredStaffByProperty.length === 0 ? (
            <div className="px-10 py-20 text-center text-slate-400 italic font-medium bg-white rounded-3xl border border-slate-100">No staff members found.</div>
          ) : (
            filteredStaffByProperty.map((s) => (
              <div 
                key={s.id || (s as any)._id} 
                onClick={() => {
                  setSelectedStaffForDetail(s);
                  setShowDetailModal(true);
                  setActiveDetailTab('info');
                }}
                className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden group"
              >
                <div className={`absolute top-0 right-0 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-bl-2xl ${
                  s.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  {s.status}
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center font-black text-lg text-blue-600 border border-blue-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                    {s.name?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 text-sm md:text-base leading-none mb-1 group-hover:text-blue-600 transition-colors truncate pr-16">{s.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{s.category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 mb-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Contact Details</p>
                    <p className="text-[10px] font-bold text-slate-600 truncate">{s.phone || 'No phone'}</p>
                    <p className="text-[9px] font-medium text-slate-400 lowercase truncate">{s.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Compensation</p>
                    <p className="text-sm font-black text-blue-600 leading-none">{formatCurrency(s.salary)}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monthly Salary</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {s.assignedPropertyIds?.slice(0, 3).map((pid, idx) => (
                      <div key={pid} className="w-6 h-6 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-[7px] font-black text-slate-400 uppercase">
                        {properties.find(p => p.id === pid || (p as any)._id === pid)?.name?.[0] || '?'}
                      </div>
                    ))}
                    {(s.assignedPropertyIds?.length || 0) > 3 && (
                      <div className="w-6 h-6 rounded-full border-2 border-white bg-blue-50 flex items-center justify-center text-[7px] font-black text-blue-600">
                        +{(s.assignedPropertyIds?.length || 0) - 3}
                      </div>
                    )}
                    {(s.assignedPropertyIds?.length === 0) && <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">No Assignments</span>}
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditClick(s); }}
                      className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-xl"
                    >
                      <Icons.Edit size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id || (s as any)._id); }}
                      className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-xl"
                    >
                      <Icons.Delete size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div className="min-w-full align-middle">
            <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                <th className="px-6 md:px-10 py-6">Staff Member</th>
                <th className="px-6 md:px-10 py-6 hidden lg:table-cell">Contact</th>
                <th className="px-6 md:px-10 py-6 hidden xl:table-cell">Assignments</th>
                <th className="px-6 md:px-10 py-6 text-right md:text-left hidden sm:table-cell">Salary</th>
                <th className="px-6 md:px-10 py-6 hidden lg:table-cell">Status</th>
                <th className="px-6 md:px-10 py-6 text-right hidden sm:table-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStaffByProperty.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-10 py-20 text-center text-slate-400 italic font-medium">No staff members found matching the criteria.</td>
                </tr>
              ) : (
                filteredStaffByProperty.map((s) => (
                  <tr 
                    key={s.id || (s as any)._id} 
                    onClick={() => {
                      setSelectedStaffForDetail(s);
                      setShowDetailModal(true);
                      setActiveDetailTab('info');
                    }}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 md:px-10 py-6">
                      <div className="flex items-center gap-3 md:gap-5">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-50 flex items-center justify-center font-black text-sm md:text-base text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0 border border-blue-100 shadow-sm">
                          {s.name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-sm md:text-base leading-none mb-1 group-hover:text-blue-600 transition-colors truncate">{s.name}</p>
                          <p className="text-[10px] md:text-xs font-bold text-slate-400 lowercase tracking-tight truncate">{s.email}</p>
                          <div className="sm:hidden flex items-center gap-2 mt-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ${
                              s.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>{s.status}</span>
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-tight">{formatCurrency(s.salary)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 md:px-10 py-6 hidden lg:table-cell">
                      <p className="text-xs font-bold text-slate-600 truncate max-w-[150px]">{s.email}</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1">{s.phone}</p>
                    </td>
                    <td className="px-6 md:px-10 py-6 hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                        {s.assignedPropertyIds && s.assignedPropertyIds.length > 0 ? (
                          s.assignedPropertyIds.map(pid => {
                            const p = properties.find(prop => prop.id === pid || (prop as any)._id === pid);
                            return (
                              <span key={pid} className="px-2 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-tight rounded-lg border border-slate-200">
                                {p?.name || 'Unknown'}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[10px] text-slate-300 italic font-medium">No assignments</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 md:px-10 py-6 text-right md:text-left hidden sm:table-cell">
                      <p className="font-black text-slate-900 text-sm">{formatCurrency(s.salary)}</p>
                    </td>
                    <td className="px-10 py-6 hidden lg:table-cell">
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm border ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditClick(s); }}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(s.id || (s as any)._id); }}
                          className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Icons.Delete className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => { setShowAddModal(false); resetForm(); }}></div>
          <div className="relative bg-white w-full max-w-xl rounded-[2rem] md:rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-100">
            <div className="p-6 md:p-10 pb-4 relative shrink-0">
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="absolute top-6 md:top-10 right-6 md:right-10 text-slate-400 hover:text-slate-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">{editingStaffId ? 'Edit Staff Member' : 'Add New Staff'}</h2>
              <p className="text-slate-500 text-[10px] md:text-sm mt-1 font-medium italic">Define roles, assignments, and compensation</p>
            </div>

            {formError && (
              <div className="mx-6 md:mx-10 mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-10 pt-4 space-y-6 md:space-y-8 scrollbar-hide flex flex-col">
              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="e.g., Rajesh Kumar" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="rajesh@example.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input required value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+91 98765 43210" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                  <input value={dob} onChange={(e) => setDob(e.target.value)} type="date" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monthly Salary</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input required value={salary} onChange={(e) => setSalary(e.target.value)} type="number" placeholder="15000" className="w-full pl-10 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold appearance-none pr-10">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as StaffCategory)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold appearance-none pr-10">
                    {Object.values(StaffCategory).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setCanCollectCash(!canCollectCash)}>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${canCollectCash ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'}`}>
                    {canCollectCash && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Allow Cash Collection</p>
                    <p className="text-[10px] font-medium text-slate-400">This staff member will be able to collect rent in cash from residents.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setCanPostAnnouncements(!canPostAnnouncements)}>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${canPostAnnouncements ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'}`}>
                    {canPostAnnouncements && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Allow Posting Announcements</p>
                    <p className="text-[10px] font-medium text-slate-400">This staff member will be able to post updates regarding the hostel.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setCanAddExpenses(!canAddExpenses)}>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${canAddExpenses ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'}`}>
                    {canAddExpenses && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Allow Adding Expenses</p>
                    <p className="text-[10px] font-medium text-slate-400">This staff member will be able to record expenses for assigned properties.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign to Properties</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {properties.map(p => (
                      <button
                        key={p.id || (p as any)._id}
                        type="button"
                        onClick={() => toggleProperty(p.id || (p as any)._id)}
                        className={`px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border text-left flex items-center justify-between ${
                          selectedPropIds.includes(p.id || (p as any)._id)
                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100'
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <span className="truncate mr-2">{p.name}</span>
                        {selectedPropIds.includes(p.id || (p as any)._id) && (
                          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 sticky bottom-0 bg-white pb-6">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 py-4 border border-slate-100 text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    editingStaffId ? 'Update Member' : 'Confirm Staff'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Detail Modal */}
      {showDetailModal && selectedStaffForDetail && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowDetailModal(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[2rem] md:rounded-[3rem] shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[95vh] border border-slate-100">
            <div className="p-6 md:p-10 pb-4 bg-slate-50/50 border-b border-slate-100 relative shrink-0">
               <button onClick={() => setShowDetailModal(false)} className="absolute top-6 md:top-10 right-6 md:right-10 text-slate-400 hover:text-slate-600 transition">
                  <Icons.Close className="w-6 h-6" />
               </button>
               <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center font-black text-2xl md:text-3xl shadow-xl shadow-indigo-100 shrink-0">
                    {selectedStaffForDetail.name[0]}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight truncate">{selectedStaffForDetail.name}</h2>
                    <p className="text-indigo-600 text-[10px] md:text-sm font-black uppercase tracking-widest mt-1 truncate">{selectedStaffForDetail.category} • ID: {selectedStaffForDetail.id}</p>
                  </div>
               </div>
               
               <div className="flex gap-4 md:gap-8 mt-6 md:mt-10 overflow-x-auto scrollbar-hide">
                  <button 
                    onClick={() => setActiveDetailTab('info')}
                    className={`pb-4 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-b-4 shrink-0 ${activeDetailTab === 'info' ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Overview
                  </button>
                  <button 
                    onClick={() => setActiveDetailTab('salary')}
                    className={`pb-4 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-b-4 shrink-0 ${activeDetailTab === 'salary' ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Salary History
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide">
              {activeDetailTab === 'info' ? (
                <div className="space-y-8 animate-in fade-in duration-300">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Salary</p>
                        <p className="font-black text-indigo-600 text-lg md:text-xl">{formatCurrency(selectedStaffForDetail.salary)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${
                          selectedStaffForDetail.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                          {selectedStaffForDetail.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                        <p className="font-bold text-slate-900 text-sm md:text-base truncate">{selectedStaffForDetail.email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                        <p className="font-bold text-slate-900 text-sm md:text-base">{selectedStaffForDetail.phone}</p>
                      </div>
                   </div>

                   <div className="space-y-4 pt-6 border-t border-slate-50">
                      <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                        Assignments
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedStaffForDetail.assignedPropertyIds?.length > 0 ? (
                          selectedStaffForDetail.assignedPropertyIds.map(pid => {
                            const p = properties.find(prop => prop.id === pid || (prop as any)._id === pid);
                            return (
                               <div key={pid} className="px-3 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0">
                                 {p?.name || 'Unknown Property'}
                               </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-400 italic">No properties assigned yet.</p>
                        )}
                      </div>
                   </div>

                   <div className="space-y-4 pt-6 border-t border-slate-50">
                      <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                        Permissions
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className={`p-4 rounded-2xl border flex items-center gap-3 ${selectedStaffForDetail.canCollectCash ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                           <Icons.Payments className={`w-5 h-5 ${selectedStaffForDetail.canCollectCash ? 'text-emerald-600' : 'text-slate-300'}`} />
                           <p className={`text-[10px] font-black uppercase tracking-widest ${selectedStaffForDetail.canCollectCash ? 'text-emerald-900' : 'text-slate-400'}`}>Cash Collection</p>
                         </div>
                         <div className={`p-4 rounded-2xl border flex items-center gap-3 ${selectedStaffForDetail.canPostAnnouncements ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                           <Icons.Check className={`w-5 h-5 ${selectedStaffForDetail.canPostAnnouncements ? 'text-emerald-600' : 'text-slate-300'}`} />
                           <p className={`text-[10px] font-black uppercase tracking-widest ${selectedStaffForDetail.canPostAnnouncements ? 'text-emerald-900' : 'text-slate-400'}`}>Announcements</p>
                         </div>
                         <div className={`p-4 rounded-2xl border flex items-center gap-3 ${selectedStaffForDetail.canAddExpenses ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                           <Icons.Plus className={`w-5 h-5 ${selectedStaffForDetail.canAddExpenses ? 'text-emerald-600' : 'text-slate-300'}`} />
                           <p className={`text-[10px] font-black uppercase tracking-widest ${selectedStaffForDetail.canAddExpenses ? 'text-emerald-900' : 'text-slate-400'}`}>Add Expenses</p>
                         </div>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="border border-slate-100 rounded-2xl md:rounded-[2rem] overflow-hidden overflow-x-auto">
                     <table className="w-full text-left min-w-[400px]">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                             <th className="px-4 md:px-6 py-4">Payroll Month</th>
                             <th className="px-4 md:px-6 py-4">Amount</th>
                             <th className="px-4 md:px-6 py-4">Status</th>
                             <th className="px-4 md:px-6 py-4 text-right">Date Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {getSalaryHistory(selectedStaffForDetail).map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 md:px-6 py-4 text-[10px] md:text-xs font-black text-slate-700">{p.month}</td>
                              <td className="px-4 md:px-6 py-4 text-[10px] md:text-xs font-bold text-slate-900">{formatCurrency(p.amount)}</td>
                              <td className="px-4 md:px-6 py-4">
                                <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg ${p.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-4 md:px-6 py-4 text-right text-[10px] md:text-xs font-bold text-slate-400">{p.date}</td>
                            </tr>
                          ))}
                        </tbody>
                     </table>
                  </div>
                  <p className="text-[9px] text-slate-400 italic text-center mt-6 uppercase tracking-tight">* Salary records are simulated based on employment data.</p>
                </div>
              )}
            </div>

            <div className="p-6 md:p-10 pt-0 shrink-0 grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    // This is just a UI simulation
                    setSuccess("Salary Disbursal Process Initiated Successfully!");
                    setTimeout(() => setSuccess(null), 3000);
                  }}
                  className="col-span-2 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:bg-emerald-700 transition flex items-center justify-center gap-2 mb-2"
                >
                  <Icons.Payments className="w-4 h-4" />
                  Pay Salary
                </button>
                <button 
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEditClick(selectedStaffForDetail);
                  }}
                  className="py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Icons.Edit className="w-4 h-4" />
                  Edit Profile
                </button>
                <button 
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedStaffForMove(selectedStaffForDetail);
                    setTargetPropertyIds(selectedStaffForDetail.assignedPropertyIds || []);
                    setShowMoveModal(true);
                  }}
                  className="py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                >
                  <Icons.Move className="w-4 h-4" />
                  Relocate
                </button>
                <button 
                  onClick={() => {
                    setShowDetailModal(false);
                    handleDelete(selectedStaffForDetail.id || (selectedStaffForDetail as any)._id);
                  }}
                  className="py-4 bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:bg-rose-700 transition flex items-center justify-center gap-2"
                >
                  <Icons.Exit className="w-4 h-4" />
                  Vacate
                </button>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:bg-slate-900 transition flex items-center justify-center gap-2"
                >
                  Close
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Relocate Staff Modal */}
      {showMoveModal && selectedStaffForMove && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowMoveModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[95vh] border border-slate-100">
            <div className="p-10 pb-4 relative shrink-0">
              <button onClick={() => setShowMoveModal(false)} className="absolute top-10 right-10 text-slate-400 hover:text-slate-600 transition">
                <Icons.Close className="w-6 h-6" />
              </button>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Reassign Staff</h2>
              <p className="text-slate-500 text-sm mt-1 font-medium italic">Managing property assignments for {selectedStaffForMove.name}</p>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto scrollbar-hide flex-1">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Assigned Properties</label>
                <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                  {properties.map(p => {
                    const isSelected = targetPropertyIds.includes(p.id || (p as any)._id);
                    return (
                      <button
                        key={p.id || (p as any)._id}
                        onClick={() => toggleTargetProperty(p.id || (p as any)._id)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                            : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 border border-slate-100'
                          }`}>
                            {p.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{p.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[200px]">{p.address}</p>
                          </div>
                        </div>
                        {isSelected && (
                           <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                             <Icons.Check className="w-4 h-4" />
                           </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowMoveModal(false)}
                  className="flex-1 py-4 border border-slate-100 text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-50 transition"
                >
                  Discard
                </button>
                <button 
                  onClick={confirmMove}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Save Assignments'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => { if (!isSubmitting) setShowDeleteConfirm(false); }}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] md:rounded-[2.5rem] shadow-2xl p-6 md:p-10 animate-in zoom-in duration-300 text-center border border-slate-100">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-rose-50 text-rose-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Icons.Delete className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirm Removal</h2>
            <p className="text-slate-500 text-[10px] md:text-sm font-medium mb-8">
              Are you sure you want to remove this staff member? This will also revoke their account access and remove them from all assigned properties.
            </p>
            
            {formError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest">
                {formError}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs hover:text-slate-600 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isSubmitting}
                className="flex-1 py-4 bg-rose-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-rose-100 hover:bg-rose-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Yes, Remove'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
