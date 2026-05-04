
import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../services/mockData';
import { HostelUpdate, Property, UserRole, SubscriptionTier, getTierValue } from '../types';
import { Icons, formatCurrency } from '../constants';

interface UpdatesProps {
  ownerId: string;
  role: UserRole;
  assignedPropertyIds?: string[];
  currentUser: any;
  plan?: SubscriptionTier;
  isBasicHost?: boolean;
}

const Updates: React.FC<UpdatesProps> = ({ ownerId, role, assignedPropertyIds, currentUser, plan, isBasicHost }) => {
  const [updates, setUpdates] = useState<HostelUpdate[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updateToDelete, setUpdateToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    propertyId: 'all',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });

  const isLiteView = isBasicHost || getTierValue(plan || SubscriptionTier.TRIAL) <= 1;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [updatesList, propsList] = await Promise.all([
        db.getUpdates({ ownerId }),
        db.getProperties(ownerId)
      ]);
      
      let filteredProps = propsList;
      if (role === UserRole.STAFF && assignedPropertyIds) {
        filteredProps = propsList.filter((p: Property) => assignedPropertyIds.includes(p.id || (p as any)._id));
      }
      
      setUpdates(updatesList);
      setProperties(filteredProps);
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ownerId]);

  const filteredUpdates = useMemo(() => {
    let filtered = updates;
    if (selectedPropId !== 'all') {
      filtered = filtered.filter(u => u.propertyId === selectedPropId || u.propertyId === 'all');
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [updates, selectedPropId]);

  const stats = useMemo(() => {
    return {
      total: filteredUpdates.length,
      highPriority: filteredUpdates.filter(u => u.priority === 'high').length,
      propertySpecific: filteredUpdates.filter(u => u.propertyId !== 'all').length,
      recent: filteredUpdates.filter(u => {
        const updateDate = new Date(u.date);
        const now = new Date();
        const diffDays = Math.ceil(Math.abs(now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }).length
    };
  }, [filteredUpdates]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    const propertyName = selectedPropId !== 'all' ? (properties.find(p => p.id === selectedPropId || (p as any)._id === selectedPropId)?.name || 'Property') : 'All Properties';
    
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('Hostel Announcements Report', 40, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Property Filter: ${propertyName}`, 40, 70);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 40, 85);

    const tableData = filteredUpdates.map(u => [
      u.title,
      u.priority.toUpperCase(),
      u.propertyId === 'all' ? 'All Properties' : properties.find(p => p.id === u.propertyId || (p as any)._id === u.propertyId)?.name || 'Specific',
      u.date,
      u.content,
      u.authorName
    ]);

    autoTable(doc, {
      startY: 110,
      head: [['Title', 'Priority', 'Target', 'Date', 'Content', 'Author']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      columnStyles: { 4: { cellWidth: 250 } },
      styles: { fontSize: 8, cellPadding: 6 }
    });

    doc.save(`Announcements_${propertyName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await db.updateUpdate({
          ...formData,
          id: editingId,
          ownerId,
          authorName: currentUser?.name || 'Management',
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        await db.saveUpdate({
          ...formData,
          ownerId,
          authorName: currentUser?.name || 'Management',
          date: new Date().toISOString().split('T')[0]
        });
      }
      
      setShowAddModal(false);
      setEditingId(null);
      setFormData({ title: '', content: '', propertyId: 'all', priority: 'medium' });
      fetchData();
    } catch (error) {
      console.error('Error saving update:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (update: HostelUpdate) => {
    setEditingId(update.id || (update as any)._id);
    setFormData({
      title: update.title,
      content: update.content,
      propertyId: update.propertyId,
      priority: update.priority as any
    });
    setShowAddModal(true);
  };

  const handleDelete = (id?: string) => {
    if (!id) return;
    setUpdateToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!updateToDelete) return;
    setSubmitting(true);
    try {
      await db.deleteUpdate(updateToDelete);
      setShowDeleteConfirm(false);
      setUpdateToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting update:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight">Hostel Updates</h2>
          <p className="text-slate-400 text-sm font-medium italic mt-1">
            {role === UserRole.RESIDENT ? 'Stay updated with management announcements.' : 'Broadcast announcements to your residents.'}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {!isLiteView && (role === UserRole.OWNER || role === UserRole.STAFF) && (
            <div className="relative flex-1 md:flex-none">
              <select 
                value={selectedPropId} 
                onChange={(e) => setSelectedPropId(e.target.value)}
                className="w-full md:w-60 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest appearance-none pr-12 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-sm"
              >
                <option value="all">All Properties</option>
                {properties.map(p => <option key={p.id || (p as any)._id} value={p.id || (p as any)._id}>{p.name}</option>)}
              </select>
              <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          )}
          {(role === UserRole.OWNER || role === UserRole.STAFF) && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Icons.Complaints className="w-4 h-4" />
              New Announcement
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 md:gap-8">
        <div className="bg-white p-3 md:p-10 rounded-xl md:rounded-[2.5rem] border border-slate-100 shadow-sm text-center group hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500">
          <p className="text-xl md:text-6xl font-black text-slate-900 mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">{stats.total}</p>
          <p className="text-[6px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest md:tracking-[0.2em] leading-none">Total Posts</p>
        </div>
        <div className="bg-rose-50/30 p-3 md:p-10 rounded-xl md:rounded-[2.5rem] border border-rose-100/50 shadow-sm text-center group hover:bg-rose-50 hover:border-rose-200 transition-all duration-500">
          <p className="text-xl md:text-6xl font-black text-rose-600 mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">{stats.highPriority}</p>
          <p className="text-[6px] md:text-[11px] font-black text-rose-400 uppercase tracking-widest md:tracking-[0.2em] leading-none">High Alerts</p>
        </div>
        <div className="bg-blue-50/30 p-3 md:p-10 rounded-xl md:rounded-[2.5rem] border border-blue-100/50 shadow-sm text-center group hover:bg-blue-50 hover:border-blue-200 transition-all duration-500">
          <p className="text-xl md:text-6xl font-black text-blue-600 mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">{stats.recent}</p>
          <p className="text-[6px] md:text-[11px] font-black text-blue-400 uppercase tracking-widest md:tracking-[0.2em] leading-none">Last 7 Days</p>
        </div>
        <div className="bg-slate-900 p-3 md:p-10 rounded-xl md:rounded-[2.5rem] border border-slate-800 shadow-xl shadow-slate-200 text-center group hover:bg-slate-800 transition-all duration-500">
          <p className="text-xl md:text-6xl font-black text-white mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">{stats.propertySpecific}</p>
          <p className="text-[6px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest md:tracking-[0.2em] leading-none">Property Specific</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 md:p-14 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm md:text-lg mb-2">Broadcast Library</h3>
            <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest leading-loose">Complete history of news and announcements</p>
          </div>
          <div>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-3 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-lg shadow-slate-100 group"
            >
              <Icons.Inventory className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              Export Archive PDF
            </button>
          </div>
        </div>

        <div className="p-6 md:p-14 bg-slate-50/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredUpdates.length > 0 ? (
              filteredUpdates.map((update) => (
            <div key={update.id || (update as any)._id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-500 flex flex-col group relative">
                {/* Priority Indicator Dot */}
                <div className={`absolute top-10 left-10 w-2 h-2 rounded-full ${
                  update.priority === 'high' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]' :
                  update.priority === 'medium' ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]' :
                  'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                }`} />

              <div className="pl-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{update.date}</span>
                    {!isLiteView && (
                    <div className="flex items-center gap-2">
                      <Icons.Property className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        {update.propertyId === 'all' ? 'All Properties' : properties.find(p => p.id === update.propertyId || (p as any)._id === update.propertyId)?.name || 'Specific Property'}
                      </span>
                    </div>
                    )}
                  </div>

                  {(role === UserRole.OWNER || role === UserRole.STAFF) && (
                    <div className="flex items-center bg-slate-50 border border-slate-100 rounded-xl p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(update)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit Announcement"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button 
                        onClick={() => {
                          const id = update.id || (update as any)._id;
                          handleDelete(id);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete Announcement"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}
                </div>
                
                <h4 className="text-lg font-black text-slate-900 leading-tight mb-4 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{update.title}</h4>
                <p className="text-sm text-slate-500 font-medium leading-[1.8] line-clamp-4 mb-8 whitespace-pre-line">{update.content}</p>
                
                <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-sm font-black text-blue-600 border border-blue-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                      {update.authorName[0]}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.1em] leading-none">{update.authorName}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 underline decoration-blue-200 decoration-2 underline-offset-4">Management</p>
                    </div>
                  </div>
                  
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                    update.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    update.priority === 'medium' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }`}>
                    {update.priority}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-[3rem] border-2 border-dashed border-slate-100 p-24 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-slate-50 shadow-inner">
              <Icons.Complaints className="w-12 h-12 text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Announcement Archive Empty</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest max-w-[300px] mx-auto leading-loose">There are no news broadcasts matching your current property filters.</p>
          </div>
        )}
      </div>
    </div>
  </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => {
            if (!submitting) {
              setShowAddModal(false);
              setEditingId(null);
              setFormData({ title: '', content: '', propertyId: 'all', priority: 'medium' });
            }
          }} />
          <div className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200 scrollbar-hide">
            <div className="p-8 border-b border-slate-50 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {editingId ? 'Edit Announcement' : 'New Announcement'}
                </h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                  {editingId ? 'Modify your broadcast message' : 'Fill in the details for your broadcast'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingId(null);
                  setFormData({ title: '', content: '', propertyId: 'all', priority: 'medium' });
                }}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 placeholder:text-slate-300"
                    placeholder="e.g., Maintenance Scheduled"
                  />
                </div>

                {!isLiteView && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Property</label>
                      <select
                        value={formData.propertyId}
                        onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900"
                      >
                        <option value="all">All Properties</option>
                        {properties.map(p => (
                          <option key={p.id || (p as any)._id} value={p.id || (p as any)._id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
                <textarea
                  required
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 placeholder:text-slate-300 resize-none"
                  placeholder="Write your announcement here..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    editingId ? 'Update Announcement' : 'Notify & Post'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowDeleteConfirm(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-in zoom-in duration-200 max-h-[95vh] overflow-y-auto scrollbar-hide">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-6">
              <Icons.Delete className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Delete Announcement?</h3>
            <p className="text-slate-500 font-medium text-sm mb-8">This action cannot be undone. Are you sure you want to remove this announcement permanently?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition"
              >
                No, Keep it
              </button>
              <button
                onClick={confirmDelete}
                disabled={submitting}
                className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-100 hover:bg-rose-700 transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Updates;
