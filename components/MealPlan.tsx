
import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../services/mockData';
import { MealPlan as MealPlanType, UserRole, Property } from '../types';
import { Coffee, Utensils, Pizza, Cookie, Save, Loader2, AlertCircle, CheckCircle2, Building2, Calendar, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MealPlanProps {
  ownerId: string;
  role: UserRole;
  propertyId?: string;
  assignedPropertyIds?: string[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatTo12Hr = (timeStr?: string) => {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const MealPlan: React.FC<MealPlanProps> = ({ ownerId, role, propertyId, assignedPropertyIds }) => {
  const [mealPlans, setMealPlans] = useState<MealPlanType[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEditable = role === UserRole.OWNER || role === UserRole.STAFF;

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [props] = await Promise.all([
          db.getProperties(ownerId)
        ]);
        
        let filteredProps = props;
        if (role === UserRole.STAFF && assignedPropertyIds) {
          filteredProps = props.filter(p => assignedPropertyIds.includes(p.id));
        }

        setProperties(filteredProps);
        
        if (propertyId) {
          setSelectedPropertyId(propertyId);
        } else if (filteredProps.length > 0) {
          setSelectedPropertyId(filteredProps[0].id);
        }
      } catch (err: any) {
        setError('Failed to load meal plan dependencies.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [ownerId, role, propertyId, assignedPropertyIds]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchMealPlans();
    }
  }, [selectedPropertyId]);

  const fetchMealPlans = async () => {
    try {
      setLoading(true);
      const data = await db.getMealPlans(ownerId, selectedPropertyId);
      // Ensure we have a plan for each day
      const fullWeek = DAYS.map(day => {
        const existing = data.find((p: any) => p.day === day);
        return existing || {
          day,
          breakfast: '',
          breakfastStart: '',
          breakfastEnd: '',
          lunch: '',
          lunchStart: '',
          lunchEnd: '',
          snacks: '',
          snacksStart: '',
          snacksEnd: '',
          dinner: '',
          dinnerStart: '',
          dinnerEnd: '',
          propertyId: selectedPropertyId,
          ownerId
        };
      });
      setMealPlans(fullWeek);
    } catch (err: any) {
      setError('Failed to fetch meal plans.');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    return {
      totalMeals: mealPlans.reduce((acc, p) => {
        let count = 0;
        if (p.breakfast) count++;
        if (p.lunch) count++;
        if (p.snacks) count++;
        if (p.dinner) count++;
        return acc + count;
      }, 0),
      avgPerDay: (mealPlans.reduce((acc, p) => {
        let count = 0;
        if (p.breakfast) count++;
        if (p.lunch) count++;
        if (p.snacks) count++;
        if (p.dinner) count++;
        return acc + count;
      }, 0) / 7).toFixed(1)
    };
  }, [mealPlans]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    const propertyName = properties.find(p => p.id === selectedPropertyId)?.name || 'Property';
    
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('Weekly Meal Schedule', 40, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Property: ${propertyName}`, 40, 70);
    doc.text(`Generated Date: ${new Date().toLocaleDateString('en-IN')}`, 40, 85);

    const tableData = mealPlans.map(p => [
      p.day,
      `${p.breakfast}\n(${formatTo12Hr(p.breakfastStart)} - ${formatTo12Hr(p.breakfastEnd)})`,
      `${p.lunch}\n(${formatTo12Hr(p.lunchStart)} - ${formatTo12Hr(p.lunchEnd)})`,
      `${p.snacks}\n(${formatTo12Hr(p.snacksStart)} - ${formatTo12Hr(p.snacksEnd)})`,
      `${p.dinner}\n(${formatTo12Hr(p.dinnerStart)} - ${formatTo12Hr(p.dinnerEnd)})`
    ]);

    autoTable(doc, {
      startY: 110,
      head: [['Day', 'Breakfast', 'Lunch', 'Snacks', 'Dinner']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 10, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { cellWidth: 160 },
        2: { cellWidth: 160 },
        3: { cellWidth: 160 },
        4: { cellWidth: 160 }
      }
    });

    doc.save(`Meal_Plan_${propertyName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleUpdateMeal = (day: string, field: keyof MealPlanType, value: string) => {
    setMealPlans(prev => prev.map(p => p.day === day ? { ...p, [field]: value } : p));
  };

  const saveMealPlan = async (dayPlan: any) => {
    try {
      setSaving(true);
      setError(null);
      await db.updateMealPlan({
        ...dayPlan,
        ownerId,
        propertyId: selectedPropertyId
      });
      setSuccess(`Meal plan for ${dayPlan.day} updated!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(`Failed to save meal plan for ${dayPlan.day}.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading && mealPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Loading Meal Schedule...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20">
              <Utensils className="w-8 h-8 text-white" />
            </div>
            Hostel Meal Table
          </h2>
          <p className="text-slate-400 text-sm font-medium italic mt-2 ml-16">Weekly Dining Schedule & Gourmet Menu</p>
        </div>

        <div className="flex items-center gap-3">
          {properties.length > 0 && (
            <div className="relative">
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full md:w-60 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest appearance-none pr-12 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-sm"
              >
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          )}
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 whitespace-nowrap"
          >
            <FileText size={14} /> Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center group">
          <p className="text-3xl md:text-5xl font-black text-slate-900 mb-2">{stats.totalMeals}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Total Menu Items</p>
        </div>
        <div className="bg-blue-50/50 p-6 md:p-8 rounded-[2rem] border border-blue-100 shadow-sm text-center">
          <p className="text-3xl md:text-5xl font-black text-blue-600 mb-2">{stats.avgPerDay}</p>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-tight">Avg Meals/Day</p>
        </div>
        <div className="hidden lg:block bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-sm text-center">
          <p className="text-3xl md:text-5xl font-black text-white mb-2">100%</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Schedule Coverage</p>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meal Grid - Desktop */}
      <div className="hidden md:block overflow-x-auto rounded-[2rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/50">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="p-6 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day of Week</span>
                </div>
              </th>
              <th className="p-6">
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-orange-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Breakfast</span>
                </div>
              </th>
              <th className="p-6">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lunch</span>
                </div>
              </th>
              <th className="p-6">
                <div className="flex items-center gap-2">
                  <Cookie className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Snacks</span>
                </div>
              </th>
              <th className="p-6">
                <div className="flex items-center gap-2">
                  <Pizza className="w-4 h-4 text-rose-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dinner</span>
                </div>
              </th>
              {isEditable && <th className="p-6 bg-slate-50/50 text-right w-32"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {mealPlans.map((plan) => (
              <tr key={plan.day} className="group hover:bg-slate-50/50 transition-colors">
                <td className="p-6 font-black text-slate-900 uppercase tracking-tight bg-slate-50/30 w-40">
                  {plan.day}
                </td>
                <td className="p-6">
                  {isEditable ? (
                    <div className="space-y-2">
                      <textarea
                        value={plan.breakfast}
                        onChange={(e) => handleUpdateMeal(plan.day, 'breakfast', e.target.value)}
                        placeholder="Enter breakfast items..."
                        className="w-full bg-slate-50/50 p-3 rounded-xl text-sm font-bold border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none transition-all resize-none h-20"
                      />
                      <div className="flex items-center gap-1">
                        <input 
                          type="time"
                          value={plan.breakfastStart}
                          onChange={(e) => handleUpdateMeal(plan.day, 'breakfastStart', e.target.value)}
                          className="flex-1 bg-slate-50/30 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-black">to</span>
                        <input 
                          type="time"
                          value={plan.breakfastEnd}
                          onChange={(e) => handleUpdateMeal(plan.day, 'breakfastEnd', e.target.value)}
                          className="flex-1 bg-slate-50/30 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed">{plan.breakfast || 'Not Scheduled'}</p>
                      {(plan.breakfastStart || plan.breakfastEnd) && (
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">
                          {formatTo12Hr(plan.breakfastStart)} - {formatTo12Hr(plan.breakfastEnd)}
                        </p>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-6">
                  {isEditable ? (
                    <div className="space-y-2">
                      <textarea
                        value={plan.lunch}
                        onChange={(e) => handleUpdateMeal(plan.day, 'lunch', e.target.value)}
                        placeholder="Enter lunch menu..."
                        className="w-full bg-slate-50/50 p-3 rounded-xl text-sm font-bold border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none transition-all resize-none h-20"
                      />
                      <div className="flex items-center gap-1">
                        <input 
                          type="time"
                          value={plan.lunchStart}
                          onChange={(e) => handleUpdateMeal(plan.day, 'lunchStart', e.target.value)}
                          className="flex-1 bg-slate-50/30 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-black">to</span>
                        <input 
                          type="time"
                          value={plan.lunchEnd}
                          onChange={(e) => handleUpdateMeal(plan.day, 'lunchEnd', e.target.value)}
                          className="flex-1 bg-slate-50/30 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed">{plan.lunch || 'Not Scheduled'}</p>
                      {(plan.lunchStart || plan.lunchEnd) && (
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">
                          {formatTo12Hr(plan.lunchStart)} - {formatTo12Hr(plan.lunchEnd)}
                        </p>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-6">
                  {isEditable ? (
                    <div className="space-y-2">
                      <textarea
                        value={plan.snacks}
                        onChange={(e) => handleUpdateMeal(plan.day, 'snacks', e.target.value)}
                        placeholder="Enter snacks/tea..."
                        className="w-full bg-slate-50/50 p-3 rounded-xl text-sm font-bold border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none transition-all resize-none h-20"
                      />
                      <div className="flex items-center gap-1">
                        <input 
                          type="time"
                          value={plan.snacksStart}
                          onChange={(e) => handleUpdateMeal(plan.day, 'snacksStart', e.target.value)}
                          className="flex-1 bg-slate-50/30 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-black">to</span>
                        <input 
                          type="time"
                          value={plan.snacksEnd}
                          onChange={(e) => handleUpdateMeal(plan.day, 'snacksEnd', e.target.value)}
                          className="flex-1 bg-slate-50/30 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed">{plan.snacks || 'Not Scheduled'}</p>
                      {(plan.snacksStart || plan.snacksEnd) && (
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">
                          {formatTo12Hr(plan.snacksStart)} - {formatTo12Hr(plan.snacksEnd)}
                        </p>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-6">
                  {isEditable ? (
                    <div className="space-y-2">
                      <textarea
                        value={plan.dinner}
                        onChange={(e) => handleUpdateMeal(plan.day, 'dinner', e.target.value)}
                        placeholder="Enter dinner menu..."
                        className="w-full bg-slate-50/50 p-3 rounded-xl text-sm font-bold border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none transition-all resize-none h-20"
                      />
                      <div className="flex items-center gap-1">
                        <input 
                          type="time"
                          value={plan.dinnerStart}
                          onChange={(e) => handleUpdateMeal(plan.day, 'dinnerStart', e.target.value)}
                          className="flex-1 bg-slate-50/30 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-black">to</span>
                        <input 
                          type="time"
                          value={plan.dinnerEnd}
                          onChange={(e) => handleUpdateMeal(plan.day, 'dinnerEnd', e.target.value)}
                          className="flex-1 bg-slate-50/30 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-600 leading-relaxed">{plan.dinner || 'Not Scheduled'}</p>
                      {(plan.dinnerStart || plan.dinnerEnd) && (
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">
                          {formatTo12Hr(plan.dinnerStart)} - {formatTo12Hr(plan.dinnerEnd)}
                        </p>
                      )}
                    </div>
                  )}
                </td>
                {isEditable && (
                  <td className="p-6 bg-slate-50/30 text-right">
                    <button
                      onClick={() => saveMealPlan(plan)}
                      disabled={saving}
                      className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                      title="Save Daily Plan"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Meal Cards */}
      <div className="md:hidden space-y-6">
        {mealPlans.map((plan) => (
          <div key={plan.day} className="bg-white rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900 uppercase tracking-tight">{plan.day}</h3>
              {isEditable && (
                <button
                  onClick={() => saveMealPlan(plan)}
                  disabled={saving}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-90 transition shadow-md shadow-blue-500/20 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span className="text-[9px] font-black uppercase tracking-widest pr-1">Save Plan</span>
                </button>
              )}
            </div>
            
            <div className="p-6 space-y-6">
              {/* Breakfast */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Breakfast</span>
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-1">
                      <input 
                        type="time"
                        value={plan.breakfastStart}
                        onChange={(e) => handleUpdateMeal(plan.day, 'breakfastStart', e.target.value)}
                        className="w-16 bg-slate-50 border border-slate-100 px-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 focus:outline-none focus:border-blue-200"
                      />
                      <span className="text-[8px] text-slate-400 font-black">to</span>
                      <input 
                        type="time"
                        value={plan.breakfastEnd}
                        onChange={(e) => handleUpdateMeal(plan.day, 'breakfastEnd', e.target.value)}
                        className="w-16 bg-slate-50 border border-slate-100 px-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 focus:outline-none focus:border-blue-200"
                      />
                    </div>
                  )}
                  {!isEditable && (plan.breakfastStart || plan.breakfastEnd) && (
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{formatTo12Hr(plan.breakfastStart)} - {formatTo12Hr(plan.breakfastEnd)}</span>
                  )}
                </div>
                {isEditable ? (
                  <textarea
                    value={plan.breakfast}
                    onChange={(e) => handleUpdateMeal(plan.day, 'breakfast', e.target.value)}
                    placeholder="Enter breakfast items..."
                    className="w-full bg-slate-50/50 p-4 rounded-xl text-sm font-bold border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none transition-all resize-none h-24"
                  />
                ) : (
                  <p className="text-sm font-bold text-slate-600 bg-slate-50/30 p-4 rounded-xl border border-slate-50">{plan.breakfast || 'Not Scheduled'}</p>
                )}
              </div>

              {/* Lunch */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lunch</span>
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-1">
                      <input 
                        type="time"
                        value={plan.lunchStart}
                        onChange={(e) => handleUpdateMeal(plan.day, 'lunchStart', e.target.value)}
                        className="w-16 bg-slate-50 border border-slate-100 px-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 focus:outline-none focus:border-blue-200"
                      />
                      <span className="text-[8px] text-slate-400 font-black">to</span>
                      <input 
                        type="time"
                        value={plan.lunchEnd}
                        onChange={(e) => handleUpdateMeal(plan.day, 'lunchEnd', e.target.value)}
                        className="w-16 bg-slate-50 border border-slate-100 px-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 focus:outline-none focus:border-blue-200"
                      />
                    </div>
                  )}
                  {!isEditable && (plan.lunchStart || plan.lunchEnd) && (
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{formatTo12Hr(plan.lunchStart)} - {formatTo12Hr(plan.lunchEnd)}</span>
                  )}
                </div>
                {isEditable ? (
                  <textarea
                    value={plan.lunch}
                    onChange={(e) => handleUpdateMeal(plan.day, 'lunch', e.target.value)}
                    placeholder="Enter lunch menu..."
                    className="w-full bg-slate-50/50 p-4 rounded-xl text-sm font-bold border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none transition-all resize-none h-24"
                  />
                ) : (
                  <p className="text-sm font-bold text-slate-600 bg-slate-50/30 p-4 rounded-xl border border-slate-50">{plan.lunch || 'Not Scheduled'}</p>
                )}
              </div>

              {/* Snacks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cookie className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Snacks</span>
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-1">
                      <input 
                        type="time"
                        value={plan.snacksStart}
                        onChange={(e) => handleUpdateMeal(plan.day, 'snacksStart', e.target.value)}
                        className="w-16 bg-slate-50 border border-slate-100 px-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 focus:outline-none focus:border-blue-200"
                      />
                      <span className="text-[8px] text-slate-400 font-black">to</span>
                      <input 
                        type="time"
                        value={plan.snacksEnd}
                        onChange={(e) => handleUpdateMeal(plan.day, 'snacksEnd', e.target.value)}
                        className="w-16 bg-slate-50 border border-slate-100 px-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 focus:outline-none focus:border-blue-200"
                      />
                    </div>
                  )}
                  {!isEditable && (plan.snacksStart || plan.snacksEnd) && (
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{formatTo12Hr(plan.snacksStart)} - {formatTo12Hr(plan.snacksEnd)}</span>
                  )}
                </div>
                {isEditable ? (
                  <textarea
                    value={plan.snacks}
                    onChange={(e) => handleUpdateMeal(plan.day, 'snacks', e.target.value)}
                    placeholder="Enter snacks menu..."
                    className="w-full bg-slate-50/50 p-4 rounded-xl text-sm font-bold border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none transition-all resize-none h-24"
                  />
                ) : (
                  <p className="text-sm font-bold text-slate-600 bg-slate-50/30 p-4 rounded-xl border border-slate-50">{plan.snacks || 'Not Scheduled'}</p>
                )}
              </div>

              {/* Dinner */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pizza className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dinner</span>
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-1">
                      <input 
                        type="time"
                        value={plan.dinnerStart}
                        onChange={(e) => handleUpdateMeal(plan.day, 'dinnerStart', e.target.value)}
                        className="w-16 bg-slate-50 border border-slate-100 px-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 focus:outline-none focus:border-blue-200"
                      />
                      <span className="text-[8px] text-slate-400 font-black">to</span>
                      <input 
                        type="time"
                        value={plan.dinnerEnd}
                        onChange={(e) => handleUpdateMeal(plan.day, 'dinnerEnd', e.target.value)}
                        className="w-16 bg-slate-50 border border-slate-100 px-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 focus:outline-none focus:border-blue-200"
                      />
                    </div>
                  )}
                  {!isEditable && (plan.dinnerStart || plan.dinnerEnd) && (
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{formatTo12Hr(plan.dinnerStart)} - {formatTo12Hr(plan.dinnerEnd)}</span>
                  )}
                </div>
                {isEditable ? (
                  <textarea
                    value={plan.dinner}
                    onChange={(e) => handleUpdateMeal(plan.day, 'dinner', e.target.value)}
                    placeholder="Enter dinner menu..."
                    className="w-full bg-slate-50/50 p-4 rounded-xl text-sm font-bold border border-transparent focus:border-blue-100 focus:bg-white focus:outline-none transition-all resize-none h-24"
                  />
                ) : (
                  <p className="text-sm font-bold text-slate-600 bg-slate-50/30 p-4 rounded-xl border border-slate-50">{plan.dinner || 'Not Scheduled'}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isEditable && (
        <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-[1.5rem] flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Management Instructions</h4>
            <p className="text-xs text-blue-600/80 font-bold mt-1 leading-relaxed">
              Updates to the meal plan are instant for residents of the selected property. Please click the save icon for each day after making changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlan;
