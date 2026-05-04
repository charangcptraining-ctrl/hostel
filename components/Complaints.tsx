
import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserRole, ComplaintStatus, Complaint, Resident, Staff, Property } from '../types';
import { db } from '../services/mockData';
import { Search, Filter, CheckCircle2, Clock, AlertCircle, List, ArrowRight, User, Shield, Users, X } from 'lucide-react';
import { formatCurrency, Icons } from '../constants';

interface ComplaintsProps {
  role: UserRole;
  ownerId: string;
  userId?: string;
  propertyId?: string;
  assignedPropertyIds?: string[];
  residentId?: string;
}

const Complaints: React.FC<ComplaintsProps> = ({ role, ownerId, userId, propertyId, assignedPropertyIds, residentId }) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [tempStatus, setTempStatus] = useState<ComplaintStatus>(ComplaintStatus.OPEN);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    category: 'Maintenance', 
    targetType: (role === UserRole.RESIDENT ? 'PROPERTY' : 'RESIDENT') as 'RESIDENT' | 'STAFF' | 'PROPERTY', 
    targetId: '' 
  });
  const [residents, setResidents] = useState<Resident[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'pending' | 'progress' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSearchQuery('');
    setFilterStatus('all');
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [complaintsData, residentsData, staffData, propertiesData] = await Promise.all([
        db.getComplaints(ownerId),
        db.getResidents(ownerId),
        db.getStaff(ownerId),
        db.getProperties(ownerId)
      ]);

      let filteredComplaints = complaintsData;
      setProperties(propertiesData);
      if (role === UserRole.RESIDENT && residentId) {
        const resident = residentsData.find((r: any) => r.id === residentId || r.email === residentId);
        const actualId = resident ? resident.id : residentId;
        filteredComplaints = filteredComplaints.filter((c: any) => c.residentId === actualId || (c.targetType === 'RESIDENT' && c.targetId === actualId));
      } else if (role === UserRole.STAFF) {
        // Staff sees complaints assigned to them, about them, or in their properties
        filteredComplaints = filteredComplaints.filter((c: any) => {
          const isTarget = c.targetType === 'STAFF' && c.staffId === userId;
          const inProperty = propertyId ? c.propertyId === propertyId : (assignedPropertyIds && assignedPropertyIds.includes(c.propertyId));
          return isTarget || inProperty;
        });
      } else if (propertyId) {
        filteredComplaints = filteredComplaints.filter((c: any) => c.propertyId === propertyId);
      } else if (assignedPropertyIds && assignedPropertyIds.length > 0) {
        filteredComplaints = filteredComplaints.filter((c: any) => assignedPropertyIds.includes(c.propertyId));
      }

      setComplaints(filteredComplaints);
      setResidents(residentsData);
      setStaff(staffData);
    } catch (error) {
      console.error("Error fetching complaints data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ownerId, propertyId, assignedPropertyIds, residentId]);

  const filteredComplaintsByProperty = useMemo(() => {
    let filtered = complaints;
    if (selectedPropId !== 'all') {
      filtered = filtered.filter(c => c.propertyId === selectedPropId);
    } else if (assignedPropertyIds && assignedPropertyIds.length > 0) {
      filtered = filtered.filter(c => assignedPropertyIds.includes(c.propertyId));
    }
    return filtered;
  }, [complaints, selectedPropId, assignedPropertyIds]);

  const stats = useMemo(() => {
    return {
      total: filteredComplaintsByProperty.length,
      open: filteredComplaintsByProperty.filter(c => c.status === ComplaintStatus.OPEN).length,
      progress: filteredComplaintsByProperty.filter(c => c.status === ComplaintStatus.IN_PROGRESS).length,
      resolved: filteredComplaintsByProperty.filter(c => c.status === ComplaintStatus.RESOLVED).length,
      urgent: filteredComplaintsByProperty.filter(c => c.priority === 'High' && c.status !== ComplaintStatus.RESOLVED).length
    };
  }, [filteredComplaintsByProperty]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    const propertyName = selectedPropId !== 'all' ? (properties.find(p => p.id === selectedPropId)?.name || 'Property') : 'All Properties';
    
    // Add Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Complaints Directory Report', 40, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Property Filter: ${propertyName}`, 40, 70);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 40, 85);
    doc.text(`Generated by: Hostel Management Pro`, 40, 100);

    // Table Data
    const tableData = filteredComplaintsByProperty.map(c => [
      c.title,
      c.category,
      c.targetType === 'STAFF' ? (c.staffName || 'Staff') : (c.residentName || 'Resident'),
      properties.find(p => p.id === c.propertyId)?.name || '-',
      c.date,
      c.priority,
      c.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 120,
      head: [['Title', 'Category', 'Target', 'Property', 'Date', 'Priority', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [225, 29, 72], // rose-600
        textColor: 255, 
        fontSize: 9, 
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 150 },
        6: { halign: 'center' }
      },
      styles: { fontSize: 8, cellPadding: 6 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Complaints_Report_${propertyName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-IN')}.pdf`);
  };

  const handleUpdateStatus = async (status: ComplaintStatus) => {
    if (!selectedComplaint) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updatedComplaint = { ...selectedComplaint, status };
      await db.updateComplaint(updatedComplaint);
      setShowUpdateModal(false);
      setSelectedComplaint(null);
      await fetchData();
      setSuccess(`Status updated to ${status}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error updating status:", error);
      setError('Failed to update status.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateModal = (c: Complaint) => {
    setSelectedComplaint(c);
    setTempStatus(c.status);
    setShowUpdateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let newComplaint: Partial<Complaint>;

      if (role === UserRole.RESIDENT && residentId) {
        const resident = residents.find(r => r.id === residentId || r.email === residentId);
        if (!resident) throw new Error("Resident not found");

        newComplaint = {
          id: Math.random().toString(36).substr(2, 9),
          ownerId: resident.ownerId,
          title: formData.title,
          description: formData.description,
          residentId: resident.id,
          residentName: resident.name,
          targetType: 'PROPERTY',
          propertyId: resident.propertyId,
          category: formData.category,
          priority: 'Medium',
          status: ComplaintStatus.OPEN,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          createdBy: UserRole.RESIDENT,
          creatorId: resident.id
        };
      } else if (role === UserRole.OWNER || role === UserRole.STAFF) {
        // Owner/Staff creating complaint against someone
        const targetId = formData.targetId;
        const targetType = formData.targetType;
        
        let targetName = '';
        let targetPropertyId = propertyId || (assignedPropertyIds && assignedPropertyIds[0]) || '';

        if (targetType === 'RESIDENT') {
          const r = residents.find(res => res.id === targetId);
          targetName = r?.name || 'Unknown Resident';
          targetPropertyId = r?.propertyId || targetPropertyId;
        } else {
          const s = staff.find(st => st.id === targetId);
          targetName = s?.name || 'Unknown Staff';
          // Staff might be across multiple properties, use current context
        }

        newComplaint = {
          id: Math.random().toString(36).substr(2, 9),
          ownerId: ownerId,
          title: formData.title,
          description: formData.description,
          targetType: targetType,
          targetId: targetId,
          residentId: targetType === 'RESIDENT' ? targetId : undefined,
          residentName: targetType === 'RESIDENT' ? targetName : undefined,
          staffId: targetType === 'STAFF' ? targetId : undefined,
          staffName: targetType === 'STAFF' ? targetName : undefined,
          propertyId: targetPropertyId,
          category: formData.category,
          priority: 'High',
          status: ComplaintStatus.OPEN,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          createdBy: role,
          creatorId: ownerId // Or staff ID if we had it
        };
      } else {
        throw new Error("Unauthorized");
      }

      await db.saveComplaint(newComplaint as Complaint);
      setShowModal(false);
      setFormData({ title: '', description: '', category: 'Maintenance', targetType: 'RESIDENT', targetId: '' });
      await fetchData();
      setSuccess('Complaint recorded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error raising complaint:", error);
      setError('Failed to record complaint.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {(success || error) && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            success ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            {success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <p className="text-sm font-black uppercase tracking-tight">{success || error}</p>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase">Complaints Desk</h1>
          <p className="text-slate-400 text-sm font-medium italic mt-1">
            {role === UserRole.RESIDENT 
              ? 'Track and manage your service requests.' 
              : 'Service requests from your residents.'}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <select 
              value={selectedPropId} 
              onChange={(e) => setSelectedPropId(e.target.value)}
              className="w-full md:w-60 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest appearance-none pr-12 outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500 transition-all shadow-sm"
            >
              <option value="all">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
          <button 
            onClick={() => {
              setFormData({ 
                title: '', 
                description: '', 
                category: role === UserRole.RESIDENT ? 'Maintenance' : 'Behavioral', 
                targetType: role === UserRole.RESIDENT ? 'PROPERTY' : 'RESIDENT', 
                targetId: '' 
              });
              setShowModal(true);
            }}
            className="whitespace-nowrap bg-rose-600 text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-700 transition-all flex items-center gap-3 shadow-xl shadow-rose-500/20 active:scale-95"
          >
            <AlertCircle size={14} /> Raise Ticket
          </button>
        </div>
      </div>

      {showUpdateModal && selectedComplaint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowUpdateModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-100">
            <button 
              onClick={() => setShowUpdateModal(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all z-10"
            >
              <X size={20} />
            </button>
            <div className="shrink-0 p-8 pb-0">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border ${
                    selectedComplaint.category === 'Maintenance' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    selectedComplaint.category === 'Housekeeping' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                    selectedComplaint.category === 'Vegetables' ? 'bg-lime-50 text-lime-600 border-lime-100' :
                    selectedComplaint.category === 'Security' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    {selectedComplaint.category === 'Maintenance' ? '🛠️' : selectedComplaint.category === 'Housekeeping' ? '🧹' : selectedComplaint.category === 'Vegetables' ? '🥦' : selectedComplaint.category === 'Security' ? '🛡️' : selectedComplaint.category === 'Billing' ? '💰' : '📝'}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Complaint Details</h2>
                    <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">{selectedComplaint.category} • {selectedComplaint.date}</p>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm border ${
                  selectedComplaint.status === ComplaintStatus.OPEN ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  selectedComplaint.status === ComplaintStatus.IN_PROGRESS ? 'bg-orange-50 text-orange-600 border-orange-100' :
                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {selectedComplaint.status}
                </span>
              </div>
            </div>

            <div className="overflow-y-auto p-8 pt-0 scrollbar-hide">

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Issue Title</label>
                  <p className="text-slate-900 font-bold text-lg mt-1">{selectedComplaint.title}</p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-1">
                    <p className="text-slate-600 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedComplaint.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                        selectedComplaint.targetType === 'STAFF' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedComplaint.targetType === 'STAFF' ? <Shield size={10} /> : <User size={10} />}
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        {selectedComplaint.targetType === 'STAFF' ? selectedComplaint.staffName : selectedComplaint.residentName}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Created By</label>
                    <p className="text-xs font-bold text-slate-700 mt-1">
                      {selectedComplaint.createdBy === UserRole.OWNER ? 'Owner' : selectedComplaint.createdBy === UserRole.STAFF ? 'Staff' : 'Resident'}
                    </p>
                  </div>
                </div>

                {(role === UserRole.OWNER || role === UserRole.STAFF) && (
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Change Status</label>
                    <select 
                      value={tempStatus}
                      onChange={(e) => setTempStatus(e.target.value as ComplaintStatus)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold appearance-none cursor-pointer"
                    >
                      <option value={ComplaintStatus.OPEN}>Open</option>
                      <option value={ComplaintStatus.IN_PROGRESS}>In Progress</option>
                      <option value={ComplaintStatus.RESOLVED}>Resolved</option>
                    </select>
                    <p className="mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center px-4 italic">
                      Staff will be notified through the app dashboard only.
                    </p>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => handleUpdateStatus(tempStatus)}
                    disabled={submitting || (selectedComplaint && tempStatus === selectedComplaint.status)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    {submitting ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-100">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all z-10"
            >
              <X size={20} />
            </button>
            <div className="shrink-0 p-8 md:p-10 pb-0">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Raise New Complaint</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    {role === UserRole.RESIDENT ? 'Report an issue to the management' : 'Record an issue against a resident or staff member'}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-8 md:p-10 pt-0 scrollbar-hide">

              <form onSubmit={handleSubmit} className="space-y-6">
                {(role === UserRole.OWNER || role === UserRole.STAFF) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Type</label>
                      <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, targetType: 'RESIDENT', targetId: '', category: 'Behavioral'})}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            formData.targetType === 'RESIDENT' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Resident
                        </button>
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, targetType: 'STAFF', targetId: '', category: 'Behavior/Conduct'})}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            formData.targetType === 'STAFF' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Staff
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select {formData.targetType === 'RESIDENT' ? 'Resident' : 'Staff'}</label>
                      <select 
                        value={formData.targetId}
                        onChange={(e) => setFormData({...formData, targetId: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                        required
                      >
                        <option value="">Choose...</option>
                        {formData.targetType === 'RESIDENT' ? (
                          residents.map(r => <option key={r.id} value={r.id}>{r.name} ({r.roomNumber})</option>)
                        ) : (
                          staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)
                        )}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold"
                    >
                      {role === UserRole.RESIDENT || formData.targetType === 'PROPERTY' ? (
                        <>
                          <option>Maintenance</option>
                          <option>Housekeeping</option>
                          <option>Water Issue</option>
                          <option>Electricity/Electrical</option>
                          <option>Internet/Wi-Fi</option>
                          <option>Security</option>
                          <option>Billing</option>
                          <option>Mess/Food</option>
                          <option>Other</option>
                        </>
                      ) : formData.targetType === 'STAFF' ? (
                        <>
                          <option>Behavior/Conduct</option>
                          <option>Service Quality</option>
                          <option>Negligence</option>
                          <option>Security Issue</option>
                          <option>Other</option>
                        </>
                      ) : (
                        <>
                          <option>Behavioral</option>
                          <option>Late Payment</option>
                          <option>Noise Complaint</option>
                          <option>Cleanliness</option>
                          <option>Property Damage</option>
                          <option>Other</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Issue Title</label>
                    <input 
                      type="text" 
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                      placeholder="Brief summary of the issue"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detailed Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold min-h-[120px]" 
                    placeholder="Provide more details about the issue..."
                    required
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting || ((role === UserRole.OWNER || role === UserRole.STAFF) && !formData.targetId)} 
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-200 hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Processing...' : (
                      <>
                        {role === UserRole.RESIDENT ? 'Submit Ticket' : 'Record Complaint'}
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        <div className="bg-white p-5 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm text-center group hover:border-rose-200 hover:shadow-xl hover:shadow-rose-500/5 transition-all duration-500">
          <p className="text-3xl md:text-6xl font-black text-slate-900 mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">{stats.total}</p>
          <p className="text-[7px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Total Tickets</p>
        </div>
        <div className="bg-blue-50/30 p-5 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-blue-100/50 shadow-sm text-center group hover:bg-blue-50 hover:border-blue-200 transition-all duration-500">
          <p className="text-3xl md:text-6xl font-black text-blue-600 mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">{stats.open}</p>
          <p className="text-[7px] md:text-[11px] font-black text-blue-400 uppercase tracking-[0.2em] leading-none">Open Now</p>
        </div>
        <div className="bg-emerald-50/30 p-5 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-emerald-100/50 shadow-sm text-center group hover:bg-emerald-50 hover:border-emerald-200 transition-all duration-500">
          <p className="text-3xl md:text-6xl font-black text-emerald-600 mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">{stats.resolved}</p>
          <p className="text-[7px] md:text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-none">Resolved</p>
        </div>
        <div className="bg-rose-600 p-5 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-rose-500 shadow-xl shadow-rose-200 text-center group hover:bg-rose-700 transition-all duration-500">
          <p className="text-3xl md:text-6xl font-black text-white mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">{stats.urgent}</p>
          <p className="text-[7px] md:text-[11px] font-black text-rose-100 uppercase tracking-[0.2em] leading-none">Urgent Actions</p>
        </div>
      </div>

      {/* Segmented Control Navigation */}
      <div className="bg-slate-100/50 p-2 rounded-[2.5rem] flex gap-2 relative z-10 border border-slate-200/50">
        <button 
          onClick={() => setActiveSubTab('all')}
          className={`flex-1 flex items-center justify-center gap-3 py-4 md:py-5 px-4 rounded-[2rem] transition-all duration-500 ${
            activeSubTab === 'all' 
              ? 'bg-white shadow-xl shadow-slate-200/50 text-slate-900 scale-[1.02]' 
              : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
          }`}
        >
          <List size={20} className={activeSubTab === 'all' ? 'text-slate-900' : 'text-slate-400'} strokeWidth={2.5} />
          <span className="hidden md:block text-xs font-black uppercase tracking-[0.2em]">All Tickets</span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
            activeSubTab === 'all' ? 'bg-slate-100 text-slate-900' : 'bg-slate-200/50 text-slate-400'
          }`}>
            {complaints.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveSubTab('pending')}
          className={`flex-1 flex items-center justify-center gap-3 py-4 md:py-5 px-4 rounded-[2rem] transition-all duration-500 ${
            activeSubTab === 'pending' 
              ? 'bg-white shadow-xl shadow-blue-200/50 text-blue-600 scale-[1.02]' 
              : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
          }`}
        >
          <AlertCircle size={20} className={activeSubTab === 'pending' ? 'text-blue-600' : 'text-slate-400'} strokeWidth={2.5} />
          <span className="hidden md:block text-xs font-black uppercase tracking-[0.2em]">Pending</span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
            activeSubTab === 'pending' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200/50 text-slate-400'
          }`}>
            {complaints.filter(c => c.status === ComplaintStatus.OPEN).length}
          </span>
        </button>

        <button 
          onClick={() => setActiveSubTab('progress')}
          className={`flex-1 flex items-center justify-center gap-3 py-4 md:py-5 px-4 rounded-[2rem] transition-all duration-500 ${
            activeSubTab === 'progress' 
              ? 'bg-white shadow-xl shadow-orange-200/50 text-orange-600 scale-[1.02]' 
              : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
          }`}
        >
          <Clock size={20} className={activeSubTab === 'progress' ? 'text-orange-600' : 'text-slate-400'} strokeWidth={2.5} />
          <span className="hidden md:block text-xs font-black uppercase tracking-[0.2em]">In Progress</span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
            activeSubTab === 'progress' ? 'bg-orange-50 text-orange-600' : 'bg-slate-200/50 text-slate-400'
          }`}>
            {complaints.filter(c => c.status === ComplaintStatus.IN_PROGRESS).length}
          </span>
        </button>

        <button 
          onClick={() => setActiveSubTab('resolved')}
          className={`flex-1 flex items-center justify-center gap-3 py-4 md:py-5 px-4 rounded-[2rem] transition-all duration-500 ${
            activeSubTab === 'resolved' 
              ? 'bg-white shadow-xl shadow-emerald-200/50 text-emerald-600 scale-[1.02]' 
              : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
          }`}
        >
          <CheckCircle2 size={20} className={activeSubTab === 'resolved' ? 'text-emerald-600' : 'text-slate-400'} strokeWidth={2.5} />
          <span className="hidden md:block text-xs font-black uppercase tracking-[0.2em]">Resolved</span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
            activeSubTab === 'resolved' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200/50 text-slate-400'
          }`}>
            {stats.resolved}
          </span>
        </button>
      </div>

      <div className="relative z-0">
        <div className={`bg-white rounded-[3rem] shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700 border ${
          activeSubTab === 'all' ? 'border-slate-100' :
          activeSubTab === 'pending' ? 'border-blue-100' :
          activeSubTab === 'progress' ? 'border-orange-100' :
          'border-emerald-100'
        }`}>
          <div className="p-8 md:p-14 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex flex-col gap-2">
              <h3 className={`font-black uppercase tracking-[0.2em] text-sm md:text-lg ${
                activeSubTab === 'all' ? 'text-slate-800' :
                activeSubTab === 'pending' ? 'text-blue-600' :
                activeSubTab === 'progress' ? 'text-orange-600' :
                'text-emerald-600'
              }`}>
                {activeSubTab === 'all' ? 'Complaints Library' :
                 activeSubTab === 'pending' ? 'Pending Tickets' :
                 activeSubTab === 'progress' ? 'Tickets In Progress' :
                 'Resolved Tickets'}
              </h3>
              <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest leading-loose">Complete history and current status of service reports</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 max-w-2xl">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input 
                  type="text"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-slate-500/5 focus:bg-white transition-all"
                />
              </div>
              <div className="relative w-full sm:w-48">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full pl-12 pr-8 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-4 focus:ring-slate-500/5 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Housekeeping">Housekeeping</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Security">Security</option>
                  <option value="Billing">Billing</option>
                  <option value="Mess/Food">Mess/Food</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <button
                onClick={handleDownloadPDF}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-lg shadow-slate-100 group"
              >
                <Icons.Inventory className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                Export
              </button>
            </div>
          </div>

          <div className="p-8 md:p-14 bg-slate-50/20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredComplaintsByProperty
                .filter(c => {
                  if (activeSubTab === 'pending' && c.status !== ComplaintStatus.OPEN) return false;
                  if (activeSubTab === 'progress' && c.status !== ComplaintStatus.IN_PROGRESS) return false;
                  if (activeSubTab === 'resolved' && c.status !== ComplaintStatus.RESOLVED) return false;
                  const query = searchQuery.toLowerCase();
                  const titleMatch = c.title.toLowerCase().includes(query);
                  const residentMatch = (c.residentName || '').toLowerCase().includes(query);
                  const descMatch = c.description.toLowerCase().includes(query);
                  const categoryMatch = filterStatus === 'all' || c.category === filterStatus;
                  return (titleMatch || residentMatch || descMatch) && categoryMatch;
                }).length === 0 ? (
                  <div className="col-span-full py-24 text-center">
                    <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-sm">
                      <Icons.Complaints className="w-12 h-12 text-slate-200" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">No matching tickets</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-loose">Adjust your filters or search query to find what you're looking for.</p>
                  </div>
                ) : (
                  filteredComplaintsByProperty
                    .filter(c => {
                      if (activeSubTab === 'pending' && c.status !== ComplaintStatus.OPEN) return false;
                      if (activeSubTab === 'progress' && c.status !== ComplaintStatus.IN_PROGRESS) return false;
                      if (activeSubTab === 'resolved' && c.status !== ComplaintStatus.RESOLVED) return false;
                      const query = searchQuery.toLowerCase();
                      const titleMatch = c.title.toLowerCase().includes(query);
                      const residentMatch = (c.residentName || '').toLowerCase().includes(query);
                      const descMatch = c.description.toLowerCase().includes(query);
                      const categoryMatch = filterStatus === 'all' || c.category === filterStatus;
                      return (titleMatch || residentMatch || descMatch) && categoryMatch;
                    })
                    .map((c) => (
                      <div 
                        key={c.id} 
                        onClick={() => openUpdateModal(c)}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-500 flex flex-col group relative cursor-pointer"
                      >
                        <div className={`absolute top-10 left-10 w-2 h-2 rounded-full ${
                          c.status === ComplaintStatus.OPEN ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]' :
                          c.status === ComplaintStatus.IN_PROGRESS ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]' :
                          'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
                        }`} />

                        <div className="pl-6 flex-1 flex flex-col">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{c.date}</span>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.1em] ${
                                  c.priority === 'High' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'
                                }`}>
                                  {c.priority}
                                </span>
                              </div>
                            </div>
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm border shadow-sm transition-all duration-500 group-hover:scale-110 ${
                              c.category === 'Maintenance' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                              c.category === 'Housekeeping' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                              c.category === 'Vegetables' ? 'bg-lime-50 text-lime-600 border-lime-100' :
                              c.category === 'Security' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              'bg-slate-50 text-slate-600 border-slate-100'
                            }`}>
                              {c.category === 'Maintenance' ? '🛠️' : c.category === 'Housekeeping' ? '🧹' : c.category === 'Vegetables' ? '🥦' : c.category === 'Security' ? '🛡️' : c.category === 'Billing' ? '💰' : '📝'}
                            </div>
                          </div>

                          <h4 className="text-lg font-black text-slate-900 leading-tight mb-4 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{c.title}</h4>
                          <p className="text-sm text-slate-500 font-medium leading-[1.8] line-clamp-3 mb-8">{c.description}</p>
                          
                          <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black border shadow-sm transition-colors duration-500 ${
                                c.targetType === 'STAFF' ? 'bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-600 group-hover:text-white' : 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-slate-900 group-hover:text-white'
                              }`}>
                                {c.targetType === 'STAFF' ? <Shield size={16} /> : <User size={16} />}
                              </div>
                              <div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.1em] leading-none mb-1.5">{c.targetType === 'STAFF' ? c.staffName : c.residentName}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.category}</p>
                              </div>
                            </div>
                            
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                              c.status === ComplaintStatus.OPEN ? 'bg-blue-50 text-blue-600 border-blue-100' :
                              c.status === ComplaintStatus.IN_PROGRESS ? 'bg-orange-50 text-orange-600 border-orange-100' :
                              'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                              {c.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Complaints;
