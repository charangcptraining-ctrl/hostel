
import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, Icons } from '../constants';
import { db } from '../services/mockData';
import { SubscriptionTier, getTierValue, Property } from '../types';
import { FileText } from 'lucide-react';

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  propertyId: string;
  recordedBy: string;
}

interface ExpensesProps {
  ownerId: string;
  propertyId?: string;
  assignedPropertyIds?: string[];
  currentUser: any;
  plan?: SubscriptionTier;
  isBasicHost?: boolean;
}

const Expenses: React.FC<ExpensesProps> = ({ ownerId, propertyId, assignedPropertyIds, currentUser, plan, isBasicHost }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [newExpense, setNewExpense] = useState({
    category: 'Maintenance',
    amount: '',
    description: '',
    propertyId: '',
    date: new Date().toISOString().split('T')[0],
    recordedBy: `${currentUser?.name || currentUser?.username || ''} (${currentUser?.role || ''})`
  });
  const [properties, setProperties] = useState<any[]>([]);

  const isLiteView = isBasicHost || getTierValue(plan || SubscriptionTier.TRIAL) <= 1;

  const filteredExpenses = useMemo(() => {
    let filtered = expenses;
    if (selectedPropId !== 'all') {
      filtered = filtered.filter(e => e.propertyId === selectedPropId);
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, selectedPropId]);

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const categoryTotals = filteredExpenses.reduce((acc: any, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});
    const topCat = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a])[0] || 'N/A';
    
    const largest = filteredExpenses.length > 0 
      ? filteredExpenses.reduce((max, e) => e.amount > max.amount ? e : max, filteredExpenses[0])
      : { amount: 0, description: 'N/A' };
    
    return {
      total,
      topCategory: topCat,
      largestAmount: largest.amount,
      largestDesc: largest.description,
      count: filteredExpenses.length,
      avg: filteredExpenses.length > 0 ? total / filteredExpenses.length : 0
    };
  }, [filteredExpenses]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    const propertyName = selectedPropId !== 'all' ? (properties.find(p => p.id === selectedPropId)?.name || 'Property') : 'All Properties';
    
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('Expense Audit Report', 40, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Property Filter: ${propertyName}`, 40, 70);
    doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, 40, 85);
    doc.text(`Total Expenses: ${formatCurrency(stats.total)}`, 40, 100);

    const tableData = filteredExpenses.map(e => [
      e.category,
      e.description,
      properties.find(p => p.id === e.propertyId)?.name || 'Unknown',
      e.date,
      formatCurrency(e.amount),
      e.recordedBy
    ]);

    autoTable(doc, {
      startY: 120,
      head: [['Category', 'Description', 'Property', 'Date', 'Amount', 'Recorded By']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 6 }
    });

    doc.save(`Expense_Report_${propertyName.replace(/\s+/g, '_')}.pdf`);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let [props, allExpenses] = await Promise.all([
          db.getProperties(ownerId),
          db.getExpenses(ownerId)
        ]);

        // Filter based on role and assignments
        if (propertyId) {
          props = props.filter((p: any) => p.id === propertyId || p._id === propertyId);
          allExpenses = allExpenses.filter((e: any) => e.propertyId === propertyId);
        } else if (assignedPropertyIds && assignedPropertyIds.length > 0) {
          props = props.filter((p: any) => assignedPropertyIds.includes(p.id) || assignedPropertyIds.includes(p._id));
          allExpenses = allExpenses.filter((e: any) => assignedPropertyIds.includes(e.propertyId));
        }

        setProperties(props.map((p: any) => ({ ...p, id: p.id || p._id })));
        setExpenses(allExpenses.map((e: any) => ({ ...e, id: e.id || e._id })));
        if (props.length > 0 && !newExpense.propertyId) {
          const firstProp = props[0];
          setNewExpense(prev => ({ ...prev, propertyId: firstProp.id || firstProp._id }));
        }
      } catch (error) {
        console.error("Error fetching expenses:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ownerId, propertyId, assignedPropertyIds]);

  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  const categoryTotals = expenses.reduce((acc: any, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  const topCategory = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a])[0] || 'N/A';

  const handleEditClick = (exp: Expense) => {
    const actualId = exp.id || (exp as any)._id;
    setEditingExpenseId(actualId);
    setNewExpense({
      category: exp.category,
      amount: exp.amount.toString(),
      description: exp.description,
      propertyId: exp.propertyId,
      date: exp.date,
      recordedBy: exp.recordedBy
    });
    setShowAddModal(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expenseData = {
        id: editingExpenseId || undefined,
        ownerId,
        category: newExpense.category,
        amount: Number(newExpense.amount),
        description: newExpense.description,
        propertyId: newExpense.propertyId,
        date: newExpense.date,
        recordedBy: editingExpenseId 
          ? undefined 
          : `${currentUser?.name || currentUser?.username || 'Unknown'} (${currentUser?.role || 'User'})`
      };
      
      if (editingExpenseId) {
        await db.updateExpense(expenseData as any);
        setExpenses(expenses.map(e => (e.id === editingExpenseId || (e as any)._id === editingExpenseId) ? { ...e, ...expenseData, id: e.id || (e as any)._id } as any : e));
      } else {
        const savedExpense = await db.saveExpense(expenseData as any);
        const normalizedExpense = { ...savedExpense, id: savedExpense.id || savedExpense._id };
        setExpenses([normalizedExpense, ...expenses]);
      }
      
      setShowAddModal(false);
      setEditingExpenseId(null);
      setNewExpense({ 
        category: 'Maintenance', 
        amount: '', 
        description: '', 
        propertyId: properties[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        recordedBy: `${currentUser?.name || currentUser?.username || ''} (${currentUser?.role || ''})`
      });
    } catch (error) {
      console.error("Error saving expense:", error);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setExpenseToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setIsSubmitting(true);
    try {
      await db.deleteExpense(expenseToDelete);
      setExpenses(expenses.filter(e => e.id !== expenseToDelete));
      setShowDeleteConfirm(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error("Error deleting expense:", error);
    } finally {
      setIsSubmitting(false);
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
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight">Expense Tracker</h1>
          <p className="text-slate-400 text-sm font-medium italic mt-1">Monitor operational costs and financial flow across your properties.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {!propertyId && (
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
          )}
          {(currentUser?.role === 'OWNER' || currentUser?.canAddExpenses) && (
            <button 
              onClick={() => {
                setEditingExpenseId(null);
                setNewExpense({ 
                  category: 'Maintenance', 
                  amount: '', 
                  description: '', 
                  propertyId: properties[0]?.id || '',
                  date: new Date().toISOString().split('T')[0],
                  recordedBy: `${currentUser?.name || currentUser?.username || ''} (${currentUser?.role || ''})`
                });
                setShowAddModal(true);
              }}
              className="bg-rose-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-rose-500/20 hover:bg-rose-700 transition active:scale-95 flex items-center gap-3"
            >
              <Icons.Inventory size={14} /> Record Entry
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm text-center group">
          <p className="text-3xl md:text-4xl font-black text-rose-600 mb-2 leading-none group-hover:scale-105 transition-transform">{formatCurrency(stats.total).split('.')[0]}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Outflow</p>
        </div>
        <div className="bg-slate-900 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-800 shadow-sm text-center">
          <p className="text-3xl md:text-4xl font-black text-white mb-2 leading-none">{stats.count}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Records</p>
        </div>
        <div className="bg-orange-50/50 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-orange-100 shadow-sm text-center group">
          <p className="text-2xl md:text-3xl font-black text-orange-600 mb-2 leading-none truncate group-hover:scale-105 transition-transform">
            {formatCurrency(stats.largestAmount).split('.')[0]}
          </p>
          <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest truncate">Peak Transaction</p>
        </div>
        <div className="bg-blue-50/50 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-blue-100 shadow-sm text-center">
          <p className="text-3xl md:text-4xl font-black text-blue-600 mb-2 leading-none">{formatCurrency(stats.avg).split('.')[0]}</p>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Avg. Per Entry</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 md:p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm mb-1">Expense Audit Log</h3>
            <p className="text-slate-400 text-[10px] md:text-xs font-medium italic">Detailed record of every rupee spent on operations</p>
          </div>
          <div>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
            >
              <FileText size={14} /> Download Ledger PDF
            </button>
          </div>
        </div>

        <div className="p-4 md:p-8">
          {/* Desktop View Table */}
          <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <div className="min-w-full align-middle">
              <table className="w-full text-left table-auto">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 md:px-8 py-5">Summary</th>
                  <th className="px-6 md:px-8 py-5 hidden lg:table-cell">Property</th>
                  <th className="px-6 md:px-8 py-5 hidden md:table-cell">Timestamp</th>
                  <th className="px-6 md:px-8 py-5 text-right">Amount</th>
                  <th className="px-6 md:px-8 py-5 text-right hidden sm:table-cell w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic">No expense records found for the selection.</td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                <tr 
                  key={exp.id || (exp as any)._id} 
                  onClick={() => handleEditClick(exp)}
                  className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                >
                  <td className="px-6 md:px-10 py-6">
                    <span className="px-2 md:px-3 py-1 md:py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest truncate block md:inline-block">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 md:px-10 py-6">
                    <p className="font-bold text-slate-900 text-xs md:text-sm truncate">{exp.description}</p>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <p className="text-[9px] text-slate-400 font-medium truncate">
                        <span className="font-bold text-slate-500 uppercase tracking-tighter mr-1">Added by:</span>
                        {exp.recordedBy || 'System'}
                      </p>
                      <p className="lg:hidden text-[9px] text-slate-400 truncate">
                        <span className="font-bold text-slate-500 uppercase tracking-tighter mr-1">Property:</span>
                        {properties.find(p => p.id === exp.propertyId || p._id === exp.propertyId)?.name || 'Unknown'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 md:px-10 py-6 hidden lg:table-cell">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight truncate max-w-[120px]">
                      {properties.find(p => p.id === exp.propertyId || p._id === exp.propertyId)?.name || 'Unknown'}
                    </p>
                  </td>
                  <td className="px-6 md:px-10 py-6 hidden md:table-cell">
                    <p className="text-xs font-bold text-slate-500">
                      {exp.date ? new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </p>
                  </td>
                  <td className="px-6 md:px-10 py-6 text-right">
                    <p className="font-black text-rose-600 text-xs md:text-sm">{formatCurrency(exp.amount)}</p>
                  </td>
                  <td className="px-6 md:px-10 py-6 text-right hidden sm:table-cell">
                    {(currentUser?.role === 'OWNER' || currentUser?.canAddExpenses) && (
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditClick(exp); }}
                          className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteExpense(exp.id); }}
                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Icons.Delete className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Mobile-Only Card Layout */}
        <div className="md:hidden space-y-4 px-2 mb-6">
          {filteredExpenses.length === 0 ? (
            <div className="py-20 text-center text-slate-400 italic font-medium bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
              No expense records found.
            </div>
          ) : (
            filteredExpenses.map((exp) => (
              <div 
                key={exp.id || (exp as any)._id} 
                onClick={() => handleEditClick(exp)}
                className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100 shadow-sm shrink-0">
                      <Icons.Inventory size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{exp.category}</p>
                      <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight truncate pr-4">{exp.description}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-rose-600 text-sm leading-none">{formatCurrency(exp.amount)}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Amount Paid</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 mb-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Property</p>
                    <p className="text-[10px] font-bold text-slate-600 truncate">
                      {properties.find(p => p.id === exp.propertyId || p._id === exp.propertyId)?.name || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Timestamp</p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {exp.date ? new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Recorded By</p>
                    <p className="text-[9px] font-bold text-slate-400 truncate max-w-[150px]">{exp.recordedBy || 'System'}</p>
                  </div>
                  
                  {(currentUser?.role === 'OWNER' || currentUser?.canAddExpenses) && (
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={(e) => { e.stopPropagation(); handleEditClick(exp); }}
                        className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-xl"
                      >
                        <Icons.Edit size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteExpense(exp.id); }}
                        className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-xl"
                      >
                        <Icons.Delete size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
    </div>
  </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowAddModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[95vh] border border-slate-100">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight">{editingExpenseId ? 'Edit Expense' : 'Record Expense'}</h2>
            <form onSubmit={handleAddExpense} className="space-y-4 md:space-y-6 flex-1 overflow-y-auto scrollbar-hide pr-1">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                <select 
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold appearance-none"
                >
                  {isLiteView ? (
                    <>
                      <option value="Electricity">Electricity</option>
                      <option value="Water">Water</option>
                      <option value="Repair">Repair</option>
                      <option value="Salary">Salary</option>
                      <option value="Other">Other</option>
                    </>
                  ) : (
                    <>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Staff">Staff</option>
                      <option value="Mess/Food">Mess/Food</option>
                      <option value="Vegetables">Vegetables</option>
                      <option value="Transport">Transport</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Property</label>
                <select 
                  value={newExpense.propertyId}
                  onChange={(e) => setNewExpense({...newExpense, propertyId: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold appearance-none"
                >
                  {properties.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                <input 
                  type="date" 
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (INR)</label>
                <input 
                  type="number" 
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <input 
                  type="text" 
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold" 
                  placeholder="What was this for?"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition">
                  {editingExpenseId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => { if (!isSubmitting) setShowDeleteConfirm(false); }}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 animate-in zoom-in duration-300 text-center border border-slate-100 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-rose-50 text-rose-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Icons.Delete className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirm Deletion</h2>
            <p className="text-slate-500 text-[10px] md:text-sm font-medium mb-8">
              Are you sure you want to delete this expense record? This action cannot be undone.
            </p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteExpense}
                disabled={isSubmitting}
                className="flex-1 py-4 bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl shadow-rose-100 hover:bg-rose-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
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

export default Expenses;
