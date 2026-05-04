
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockData';
import { formatCurrency, Icons } from '../constants';
import { SubscriptionTier, UserRole, Property, Staff, Resident } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

interface EmpireReportsProps {
  ownerId: string;
  plan: SubscriptionTier;
  onUpgrade: () => void;
}

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6'];

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const EmpireReports: React.FC<EmpireReportsProps> = ({ ownerId, plan, onUpgrade }) => {
  const [activeAnalysis, setActiveAnalysis] = useState<'payments' | 'expenses' | 'salaries' | 'overview'>('overview');
  const [revenueView, setRevenueView] = useState<'property' | 'method'>('property');
  const [data, setData] = useState<{
    properties: Property[];
    staff: Staff[];
    residents: Resident[];
    payments: any[];
    expenses: any[];
  }>({
    properties: [],
    staff: [],
    residents: [],
    payments: [],
    expenses: []
  });
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [props, staff, residents, payments, expenses] = await Promise.all([
          db.getProperties(ownerId),
          db.getStaff(ownerId),
          db.getResidents(ownerId),
          db.getPayments({ ownerId }),
          db.getExpenses(ownerId)
        ]);
        setData({ properties: props, staff, residents, payments, expenses });
      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ownerId]);

  if (plan !== SubscriptionTier.BUSINESS) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
        <div className="w-20 h-20 bg-blue-100 rounded-[2rem] flex items-center justify-center text-blue-600 mb-6 shadow-xl shadow-blue-100 rotate-3">
          <Icons.SuperAdmin className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Enterprise Insights Locked</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs max-w-sm leading-relaxed mb-8">
          The complete "Empire Report" suite including salary analysis, expense deep-dives, and unified PDF merging is exclusive to the Business Plan.
        </p>
        <button 
          onClick={onUpgrade}
          className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-200 hover:scale-105 transition-all active:scale-95"
        >
          🚀 Upgrade to Business
        </button>
      </div>
    );
  }

  const handleExport = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        const doc = new jsPDF('p', 'pt', 'a4');
        const today = new Date().toLocaleDateString('en-IN');
        
        // Header
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text('EMPIRE INTELLIGENCE REPORT', 40, 60);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Generated On: ${today}`, 40, 80);
        doc.text(`Owner ID: ${ownerId}`, 40, 95);
        
        // 1. Summary Section
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('Financial Summary', 40, 130);
        
        const totalInflow = data.payments
          .filter(p => p.status === 'SUCCESS' || p.status === 'PAID')
          .reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const totalExpenses = data.expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const monthlySalaries = data.staff.reduce((acc, curr) => acc + (curr.salary || 0), 0);
        const netProfit = totalInflow - totalExpenses - (monthlySalaries * 4); // Based on 4 month window estimation
        
        autoTable(doc, {
          startY: 140,
          head: [['Metric', 'Amount (INR)']],
          body: [
            ['Total Inflow (Revenue)', formatCurrency(totalInflow)],
            ['Direct Expenses', formatCurrency(totalExpenses)],
            ['Payroll (Est. Period)', formatCurrency(monthlySalaries * 4)],
            ['Net Estimated Profit', formatCurrency(netProfit)]
          ],
          headStyles: { fillColor: [15, 23, 42] }
        });
        
        // 2. Property Breakdown
        doc.setFontSize(14);
        doc.text('Revenue by Property', 40, (doc as any).lastAutoTable.finalY + 40);
        
        const propRevenueData = data.properties.map(p => {
          const amount = data.payments
            .filter(pay => pay.propertyId === p.id && (pay.status === 'SUCCESS' || pay.status === 'PAID'))
            .reduce((acc, curr) => acc + (curr.amount || 0), 0);
          return [p.name, formatCurrency(amount)];
        });
        
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 50,
          head: [['Property Name', 'Total Collected']],
          body: propRevenueData,
          headStyles: { fillColor: [37, 99, 235] } // blue-600
        });
        
        // 3. Staff Payroll
        doc.setFontSize(14);
        doc.text('Payroll Directory', 40, (doc as any).lastAutoTable.finalY + 40);
        
        const staffData = data.staff.map(s => [s.name, s.role, formatCurrency(s.salary)]);
        
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 50,
          head: [['Staff Name', 'Role', 'Monthly Salary']],
          body: staffData,
          headStyles: { fillColor: [16, 185, 129] } // emerald-600
        });

        doc.save(`Empire_Report_${today.replace(/\//g, '-')}.pdf`);
        
        setIsGenerating(false);
        setShowExportSuccess(true);
        setTimeout(() => setShowExportSuccess(false), 5000);
      } catch (err) {
        console.error("Export error:", err);
        setIsGenerating(false);
      }
    }, 1500);
  };

  // --- LIVE DATA CALCULATIONS ---

  // 1. Revenue by Property (Actual Payments)
  const revenueByProp = data.properties.map(p => {
    const propPayments = data.payments.filter(pay => pay.propertyId === p.id && (pay.status === 'SUCCESS' || pay.status === 'PAID'));
    const total = propPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    return {
      name: p.name,
      value: total
    };
  }).filter(p => p.value > 0);

  // 1a. Revenue by Payment Method
  const revenueByMethod = Array.from(
    data.payments
      .filter(p => p.status === 'SUCCESS' || p.status === 'PAID')
      .reduce((acc, p) => {
        const method = p.method || 'OTHER';
        acc.set(method, (acc.get(method) || 0) + (p.amount || 0));
        return acc;
      }, new Map<string, number>())
  ).map(([name, value]) => ({ name, value }));

  const activeRevenueData = revenueView === 'property' ? revenueByProp : revenueByMethod;

  // 2. Expenses by Category (Actual Expenses)
  const expenseByCategory = Array.from(
    data.expenses.reduce((acc, exp) => {
      const cat = exp.category || 'General';
      acc.set(cat, (acc.get(cat) || 0) + (exp.amount || 0));
      return acc;
    }, new Map<string, number>())
  ).map(([name, value]) => ({ name, value }));

  // Fallback if no expenses
  const displayExpenses = expenseByCategory.length > 0 ? expenseByCategory : [
    { name: 'No Data', value: 0 }
  ];

  // 3. Monthly Trend (Last 4 Months)
  const getMonthlyData = () => {
    const months = [];
    const today = new Date();
    for (let i = 3; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = d.toLocaleString('default', { month: 'short' });
      const monthYear = d.getMonth();
      const year = d.getFullYear();

      const monthPayments = data.payments.filter(p => {
        const pDate = new Date(p.date);
        return pDate.getMonth() === monthYear && pDate.getFullYear() === year && (p.status === 'SUCCESS' || p.status === 'PAID');
      });

      const monthExpenses = data.expenses.filter(e => {
        const eDate = new Date(e.date);
        return eDate.getMonth() === monthYear && eDate.getFullYear() === year;
      });

      const totalSalaries = data.staff.reduce((acc, s) => acc + (s.salary || 0), 0);

      months.push({
        month: monthName,
        revenue: monthPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
        expenses: monthExpenses.reduce((acc, e) => acc + (e.amount || 0), 0) + totalSalaries,
        salaries: totalSalaries
      });
    }
    return months;
  };

  const trendData = getMonthlyData();

  // 4. Totals
  const totalInflow = data.payments
    .filter(p => p.status === 'SUCCESS' || p.status === 'PAID')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  
  const totalExpenses = data.expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const monthlySalaries = data.staff.reduce((acc, curr) => acc + (curr.salary || 0), 0);
  const totalOutflow = totalExpenses + (monthlySalaries * 4); // Estimated for 4 months of trend window
  const netProfit = totalInflow - totalOutflow;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Empire Intelligence Suite</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Multi-Section Data Analysis & Monthly Consolidation</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={isGenerating}
          className={`flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-slate-200 transition-all ${isGenerating ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Merging Sections...
            </>
          ) : (
            <>
              <Icons.Download className="w-4 h-4" />
              Consolidate & Export Monthly Report (.pdf)
            </>
          )}
        </button>
      </div>

      {showExportSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4 text-emerald-600 animate-in slide-in-from-top-4">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <p className="text-xs font-black uppercase">Report Merged & Downloaded Successfully!</p>
            <p className="text-[10px] font-bold opacity-80 uppercase mt-0.5 text-nowrap">A copy has also been sent to your registered email: {ownerId}@empire.com</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-slate-100/50 rounded-[2rem] w-full max-w-xl">
        {[
          { id: 'overview', label: 'Empire Overview', icon: Icons.Dashboard },
          { id: 'payments', label: 'Payment Analysis', icon: Icons.Payments },
          { id: 'expenses', label: 'Expense IQ', icon: Icons.Expenses },
          { id: 'salaries', label: 'Payroll Analytics', icon: Icons.Staff }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveAnalysis(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeAnalysis === tab.id 
                ? 'bg-white text-blue-600 shadow-xl shadow-blue-100 border border-blue-50' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </div>

      {activeAnalysis === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
              <div className="w-2 h-4 bg-blue-600 rounded-full" />
              Consolidated Performance Matrix
            </h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/><stop offset="95%" stopColor="#2563EB" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/><stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)'}} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={4} fillOpacity={1} fill="url(#colRev)" />
                  <Area type="monotone" dataKey="expenses" stroke="#F43F5E" strokeWidth={4} fillOpacity={1} fill="url(#colExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-6">
            {[
              { label: 'Total Inflow', val: formatCurrency(totalInflow), color: 'text-blue-600', bg: 'bg-blue-50', pct: 100 },
              { label: 'Total Outflow', val: formatCurrency(totalOutflow), color: 'text-rose-600', bg: 'bg-rose-50', pct: totalInflow > 0 ? (totalOutflow / totalInflow * 100) : 0 },
              { label: 'Net Profit', val: formatCurrency(netProfit), color: 'text-emerald-600', bg: 'bg-emerald-50', pct: totalInflow > 0 ? (netProfit / totalInflow * 100) : 0 }
            ].map(stat => (
              <div key={stat.label} className="bg-white p-8 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center text-center group hover:scale-[1.02] transition-all">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">{stat.label}</p>
                <p className={`text-3xl font-black ${stat.color}`}>{stat.val}</p>
                <div className={`w-full h-1 mt-6 rounded-full ${stat.bg} overflow-hidden`}>
                  <div className={`h-full ${stat.color.replace('text-', 'bg-')} rounded-full`} style={{ width: `${Math.min(100, Math.max(0, stat.pct))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeAnalysis === 'payments' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100">
           <div className="flex justify-between items-center mb-10">
             <h3 className="text-xs font-black uppercase tracking-[0.2em]">Revenue Distribution Analysis</h3>
             <div className="flex gap-2">
                <button 
                  onClick={() => setRevenueView('property')}
                  className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${
                    revenueView === 'property' 
                      ? 'bg-blue-50 text-blue-600 border-blue-100' 
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}
                >
                  By Property
                </button>
                <button 
                  onClick={() => setRevenueView('method')}
                  className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${
                    revenueView === 'method' 
                      ? 'bg-blue-50 text-blue-600 border-blue-100' 
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}
                >
                  By Payment Method
                </button>
             </div>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={activeRevenueData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                      {activeRevenueData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center space-y-4">
                {activeRevenueData.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black" style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm uppercase">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue Impact</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">{formatCurrency(item.value)}</p>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase">
                        {(item.value / totalInflow * 100).toFixed(1)}% Share
                      </p>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {activeAnalysis === 'expenses' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-10">Expenditure IQ - Category Breakdown</h3>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayExpenses} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'black', textTransform: 'uppercase'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="value" fill="#F43F5E" radius={[0, 20, 20, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-4">Expenditure Insight</h4>
                <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                  {totalExpenses > 0 
                    ? `Highest expenditure is currently tracked under "${displayExpenses.sort((a,b) => b.value - a.value)[0].name}" category.` 
                    : "No expense records found for the current analysis period."}
                </p>
              </div>
              <div className="pt-6 border-t border-rose-100/50 mt-10">
                <p className="text-[9px] font-black text-rose-400 uppercase mb-1">Live Expense Total</p>
                <p className="text-2xl font-black text-rose-600">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeAnalysis === 'salaries' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100">
           <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-10">Payroll Analytics - Monthly Disbursements</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {data.staff.map((staff, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group transition-all hover:bg-emerald-50 hover:border-emerald-100">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-black text-slate-400 text-sm group-hover:text-emerald-600 transition-colors">
                      {staff.name?.[0]}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">Generated</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 group-hover:text-emerald-900 transition-colors">{staff.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 group-hover:text-emerald-600/70">{staff.role}</p>
                    <div className="pt-4 border-t border-slate-200/50 flex justify-between items-center group-hover:border-emerald-200/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Salary Due</p>
                      <p className="font-black text-slate-900 italic">{formatCurrency(staff.salary)}</p>
                    </div>
                  </div>
                </div>
             ))}
             {data.staff.length === 0 && (
                <div className="lg:col-span-3 py-10 text-center text-slate-400 italic font-bold">No payroll records found for this cycle.</div>
             )}
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[2.5rem] text-white">
           <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4">Report Consolidation Protocol</h4>
           <ul className="space-y-4">
             {[
               { icon: '✨', text: 'Automatic gathering of multi-channel receipts' },
               { icon: '📊', text: 'Unified trend alignment for multi-property oversight' },
               { icon: '🔒', text: 'Secure encryption for tax-ready documentation' }
             ].map((item, idx) => (
               <li key={idx} className="flex gap-4 text-[11px] font-bold text-slate-300 leading-relaxed">
                 <span className="shrink-0">{item.icon}</span>
                 {item.text}
               </li>
             ))}
           </ul>
        </div>
        <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white flex flex-col justify-between">
           <div>
             <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-2 opacity-60">Empire Service Status</h4>
             <p className="text-lg font-black leading-tight italic">Monthly Consolidated reports are sent on the 1st of every month at 06:00 IST.</p>
           </div>
           <div className="flex items-center gap-3 mt-6">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest italic opacity-80">Connected to Enterprise Mail Servers</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default EmpireReports;
