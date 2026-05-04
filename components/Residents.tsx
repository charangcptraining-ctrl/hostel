
import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../services/mockData';
import { formatCurrency, Icons } from '../constants';
import RentCollectionModal from './RentCollectionModal';
import { Resident, PLAN_LIMITS, Property, Unit, RoomStatus, SubscriptionTier, UserRole, Staff, getTierValue } from '../types';
import UpgradeModal from './UpgradeModal';

interface ResidentsProps {
  role: UserRole;
  ownerId: string;
  onUpgrade: () => void;
  propertyId?: string;
  assignedPropertyIds?: string[];
  initialResidentId?: string | null;
  onClearInitialResident?: () => void;
  canCollectCash?: boolean;
  currentUser?: any;
  plan?: SubscriptionTier;
  isBasicHost?: boolean;
  isLite?: boolean;
}

const Residents: React.FC<ResidentsProps> = ({ 
  role, 
  ownerId, 
  onUpgrade, 
  propertyId, 
  assignedPropertyIds,
  initialResidentId,
  onClearInitialResident,
  canCollectCash,
  currentUser,
  plan,
  isBasicHost,
  isLite
}) => {
  const isLiteView = isBasicHost || getTierValue(plan || SubscriptionTier.FREE) <= 1;
  const isLitePlan = getTierValue(plan || SubscriptionTier.FREE) <= 1;
  const disableRelocation = isLite || isLitePlan;
  const [searchTerm, setSearchTerm] = useState('');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [totalResidentsCount, setTotalResidentsCount] = useState(0);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string>(propertyId || 'all');
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [residentToDelete, setResidentToDelete] = useState<string | null>(null);
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [userPlan, setUserPlan] = useState<any>(PLAN_LIMITS[plan || SubscriptionTier.TRIAL]);

  // Update internal plan state when prop changes
  useEffect(() => {
    setUserPlan(PLAN_LIMITS[plan || SubscriptionTier.TRIAL]);
  }, [plan]);
  
  // Move Resident Modal State
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedResidentForMove, setSelectedResidentForMove] = useState<Resident | null>(null);
  const [targetUnitId, setTargetUnitId] = useState('');

  // Vacate Modal State
  const [showVacateModal, setShowVacateModal] = useState(false);
  const [selectedResidentForVacate, setSelectedResidentForVacate] = useState<Resident | null>(null);
  const [returnableAmount, setReturnableAmount] = useState('');
  const [vacateDate, setVacateDate] = useState(new Date().toISOString().split('T')[0]);
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResidentForDetail, setSelectedResidentForDetail] = useState<Resident | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'payments'>('info');
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [ownerName, setOwnerName] = useState<string>('');
  const [collectingRentFor, setCollectingRentFor] = useState<Resident | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [formPropertyId, setFormPropertyId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [unitId, setUnitId] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [dueDate, setDueDate] = useState('5');
  const [rent, setRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [formReturnableAmount, setFormReturnableAmount] = useState('');
  const [idProofType, setIdProofType] = useState('');
  const [idNumber, setIdNumber] = useState('');

  useEffect(() => {
    if (initialResidentId && residents.length > 0) {
      const resident = residents.find(r => r.id === initialResidentId);
      if (resident) {
        setSelectedResidentForDetail(resident);
        setShowDetailModal(true);
        setActiveDetailTab('info');
        if (onClearInitialResident) onClearInitialResident();
      }
    }
  }, [initialResidentId, residents, onClearInitialResident]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resData, propsData, unitsData, staffData, paymentsData] = await Promise.all([
        db.getResidents(ownerId),
        db.getProperties(ownerId),
        db.getUnits(ownerId),
        db.getStaff(ownerId),
        db.getPayments({ ownerId })
      ]);

      setTotalResidentsCount(resData.length);
      
      const residentLimit = PLAN_LIMITS[plan || SubscriptionTier.FREE]?.residents || 9999;
      const limitedData = resData.slice(0, residentLimit);
      
      setResidents(limitedData);
      setProperties(propsData);
      setUnits(unitsData);
      setAllStaff(staffData);
      setPayments(paymentsData);
      
      if (currentUser) {
        setOwnerName(currentUser.name || 'Owner');
      }
    } catch (error) {
      console.error("Error fetching residents data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ownerId, propertyId, assignedPropertyIds]);

  // Filter units based on selected property
  const availableUnitsForProperty = useMemo(() => {
    if (!formPropertyId) return [];
    return units.filter(u => u.propertyId === formPropertyId);
  }, [formPropertyId, units]);

  // Generate payment history based on actual payment records
  const paymentHistory = useMemo(() => {
    if (!selectedResidentForDetail) return [];
    const history = [];
    const moveIn = new Date(selectedResidentForDetail.moveInDate);
    const today = new Date();
    
    // Sort payments for this resident by date
    const residentPayments = payments.filter(p => {
      const pResId = p.residentId?.toString();
      const rId = selectedResidentForDetail.id?.toString();
      const rObjectId = (selectedResidentForDetail as any)._id?.toString();
      
      return (pResId === rId || (rObjectId && pResId === rObjectId)) &&
             (p.status === 'SUCCESS' || p.status === 'PAID');
    });

    let current = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(moveIn.getFullYear(), moveIn.getMonth(), 1);

    while (current >= end) {
      const monthIndex = current.getMonth();
      const year = current.getFullYear();
      
      const monthPayments = residentPayments.filter(p => {
        if (!p.date) return false;
        let pDate: Date;
        
        // Handle Indian locale string format DD/MM/YYYY
        if (typeof p.date === 'string' && p.date.includes('/')) {
          const [datePart] = p.date.split(',');
          const parts = datePart.trim().split('/');
          if (parts.length === 3) {
            // Assume DD/MM/YYYY if first part is > 12 or if we detect this format
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            const y = parseInt(parts[2]);
            pDate = new Date(y, m - 1, d);
          } else {
            pDate = new Date(p.date);
          }
        } else {
          pDate = new Date(p.date);
        }
        
        return !isNaN(pDate.getTime()) && pDate.getMonth() === monthIndex && pDate.getFullYear() === year;
      });

      const totalPaidForMonth = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      const monthLabel = current.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      // A month is considered paid if the total paid is >= rent
      let status = 'Pending';
      if (totalPaidForMonth >= selectedResidentForDetail.rent) {
        status = 'Paid';
      } else if (totalPaidForMonth > 0) {
        status = 'Partial';
      } else if (current < today) {
        // If past month and no payment, it's unpaid
        const isCurrentMonth = current.getMonth() === today.getMonth() && current.getFullYear() === today.getFullYear();
        if (!isCurrentMonth || today.getDate() > selectedResidentForDetail.dueDate) {
          status = 'Unpaid';
        }
      }

      history.push({
        month: monthLabel,
        amount: totalPaidForMonth > 0 ? totalPaidForMonth : selectedResidentForDetail.rent,
        status: status,
        date: monthPayments.length > 0 ? new Date(monthPayments[0].date).toLocaleDateString() : '-',
        isActual: totalPaidForMonth > 0
      });
      current.setMonth(current.getMonth() - 1);
    }
    return history;
  }, [selectedResidentForDetail, payments]);

  const individualTransactions = useMemo(() => {
    if (!selectedResidentForDetail) return [];
    return payments.filter(p => {
      const pResId = p.residentId?.toString();
      const rId = selectedResidentForDetail.id?.toString();
      const rObjectId = (selectedResidentForDetail as any)._id?.toString();
      
      return (pResId === rId || (rObjectId && pResId === rObjectId)) &&
             (p.status === 'SUCCESS' || p.status === 'PAID');
    }).sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
    });
  }, [selectedResidentForDetail, payments]);

  // Prorated Calculation Helpers
  const getProratedInfo = (resident: Resident, targetUnit: Unit) => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const monthName = now.toLocaleString('default', { month: 'long' });
    
    // Determine when the current billing cycle started for this resident
    // Parse the move-in date string manually to avoid timezone issues with new Date(string)
    const dateStr = resident.moveInDate;
    let moveInDateObj: Date;
    
    if (dateStr && dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-').map(Number);
      moveInDateObj = new Date(y, m - 1, d); // Local date
    } else {
      moveInDateObj = new Date(dateStr || Date.now());
    }

    const isMoveInThisMonth = moveInDateObj.getFullYear() === now.getFullYear() && moveInDateObj.getMonth() === now.getMonth();
    const cycleStartDay = isMoveInThisMonth ? moveInDateObj.getDate() : 1;
    
    // Days spent in the OLD room during THIS month's billing cycle
    const daysSpent = Math.max(0, currentDay - cycleStartDay);
    
    // Days to be spent in the NEW room (including today)
    const remainingDays = daysInMonth - currentDay + 1;
    
    // Total days the resident is active in the property this month
    const totalActiveDays = daysSpent + remainingDays;
    
    const oldDaily = resident.rent / daysInMonth;
    const newDaily = targetUnit.price / daysInMonth;
    
    const oldCost = oldDaily * daysSpent;
    const newCost = newDaily * remainingDays;
    
    // What they would have paid for the whole month if they didn't move
    const originalExpectedTotal = oldDaily * totalActiveDays;
    
    // What they will pay now for the whole month
    const totalAdjusted = oldCost + newCost;
    
    // The difference they need to pay (or get credited)
    const balanceAdjustment = totalAdjusted - originalExpectedTotal;

    return {
      daysInMonth,
      currentDay,
      daysSpent,
      remainingDays,
      totalActiveDays,
      oldCost,
      newCost,
      totalAdjusted,
      balanceAdjustment,
      oldRent: resident.rent,
      newRent: targetUnit.price,
      monthName,
      isLeapYear: (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || (now.getFullYear() % 400 === 0)
    };
  };

  const handleTryAdd = () => {
    if (userPlan.residents !== null && residents.length >= userPlan.residents) {
      if (role === UserRole.OWNER) {
        setShowUpgradeModal(true);
      } else {
        setError("Resident limit reached. Please contact your administrator to upgrade the plan.");
        setTimeout(() => setError(null), 3000);
      }
      return;
    }
    setEditingResidentId(null);
    resetForm();
    setShowAdd(true);
  };

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setDob(''); setAddress('');
    setFormPropertyId(''); setRoomNumber(''); setUnitId(''); setMoveInDate(''); setRent('');
    setDueDate('5'); setIdProofType(''); setIdNumber(''); setSecurityDeposit('');
    setFormReturnableAmount('');
    setEditingResidentId(null);
    setFormError(null);
  };

  const handleEditClick = (r: Resident) => {
    setEditingResidentId(r.id);
    setName(r.name);
    setEmail(r.email);
    setPhone(r.phone);
    setDob(r.dob);
    setAddress(r.permanentAddress);
    setFormPropertyId(r.propertyId);
    setUnitId(r.unitId);
    setRoomNumber(r.roomNumber);
    setMoveInDate(r.moveInDate);
    setDueDate(r.dueDate.toString());
    setRent(r.rent.toString());
    setIdProofType(r.idProofType);
    setIdNumber(r.idNumber);
    setSecurityDeposit(r.securityDeposit?.toString() || '0');
    setFormReturnableAmount(r.returnableAmount?.toString() || '');
    setShowAdd(true);
  };

  const filteredResidentsByProperty = useMemo(() => {
    let filtered = residents;
    if (selectedPropId !== 'all') {
      filtered = filtered.filter(r => r.propertyId === selectedPropId);
    } else if (assignedPropertyIds && assignedPropertyIds.length > 0) {
      filtered = filtered.filter(r => assignedPropertyIds.includes(r.propertyId));
    }
    return filtered;
  }, [residents, selectedPropId, assignedPropertyIds]);

  const filteredResidents = filteredResidentsByProperty.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    const today = new Date();
    const currentMonthLabel = today.toLocaleString('default', { month: 'short' }) + ' ' + today.getFullYear();
    
    return {
      total: filteredResidentsByProperty.length,
      active: filteredResidentsByProperty.filter(r => r.status === 'active').length,
      paid: filteredResidentsByProperty.filter(r => 
        r.ledger && (r.ledger as any).find((l: any) => l.month === currentMonthLabel && l.status === 'Paid')
      ).length,
      due: filteredResidentsByProperty.filter(r => 
        !r.ledger || !(r.ledger as any).find((l: any) => l.month === currentMonthLabel && l.status === 'Paid')
      ).length
    };
  }, [filteredResidentsByProperty]);

  const handleDeleteResident = async (id: string) => {
    setResidentToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteResident = async () => {
    if (!residentToDelete) return;
    setIsSubmitting(true);
    try {
      await db.deleteResident(residentToDelete);
      await fetchData();
      setShowDeleteConfirm(false);
      setResidentToDelete(null);
    } catch (error) {
      console.error("Error deleting resident:", error);
      setFormError("Failed to delete resident. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveResident = async () => {
    if (!selectedResidentForMove || !targetUnitId) return;
    setIsSubmitting(true);
    setFormError(null);

    const targetUnit = units.find(u => u.id === targetUnitId);
    const oldUnitId = selectedResidentForMove.unitId;

    try {
      if (targetUnit) {
        const updatedTarget: Unit = {
          ...targetUnit,
          currentOccupants: targetUnit.currentOccupants + 1,
          status: (targetUnit.currentOccupants + 1) >= targetUnit.capacity ? RoomStatus.FULL : RoomStatus.PARTIAL
        };
        await db.updateUnit(updatedTarget);

        const oldUnit = units.find(u => u.id === oldUnitId);
        if (oldUnit) {
          const updatedOld: Unit = {
            ...oldUnit,
            currentOccupants: Math.max(0, oldUnit.currentOccupants - 1),
            status: (oldUnit.currentOccupants - 1) === 0 ? RoomStatus.VACANT : RoomStatus.PARTIAL
          };
          await db.updateUnit(updatedOld);
        }

        const updatedResident: Resident = {
          ...selectedResidentForMove,
          unitId: targetUnit.id,
          roomNumber: targetUnit.roomNumber,
          rent: targetUnit.price
        };
        await db.updateResident(updatedResident);

        await fetchData();
        setShowMoveModal(false);
        setSelectedResidentForMove(null);
        setTargetUnitId('');
      }
    } catch (error) {
      console.error("Error moving resident:", error);
      setFormError(error instanceof Error ? error.message : "Failed to move resident. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUnitId = e.target.value;
    const unit = availableUnitsForProperty.find(u => u.id === selectedUnitId);
    if (unit) {
      setUnitId(unit.id);
      setRoomNumber(unit.roomNumber);
      if (unit.price) setRent(unit.price.toString());
    } else {
      setUnitId('');
      setRoomNumber('');
    }
  };

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const existingResident = residents.find(r => r.id === editingResidentId);
    const residentData: Resident = {
      id: editingResidentId || `RES-${Date.now()}`,
      ownerId,
      name,
      email,
      phone,
      dob,
      permanentAddress: address,
      unitId: unitId,
      propertyId: formPropertyId,
      roomNumber,
      moveInDate,
      dueDate: parseInt(dueDate) || 5,
      status: existingResident ? existingResident.status : 'active',
      rent: parseInt(rent) || 0,
      securityDeposit: parseInt(securityDeposit) || 0,
      returnableAmount: parseInt(formReturnableAmount) || 0,
      idProofType,
      idNumber
    };

    try {
      if (editingResidentId) {
        await db.updateResident(residentData);
      } else {
        await db.saveResident(residentData);

        const unit = units.find(u => u.id === unitId);
        if (unit) {
          await db.updateUnit({
            ...unit,
            currentOccupants: unit.currentOccupants + 1,
            status: (unit.currentOccupants + 1) >= unit.capacity ? RoomStatus.FULL : RoomStatus.PARTIAL
          });
        }
      }

      await fetchData();
      setShowAdd(false);
      
      // Pro Plan: Simulate Verification
      if (plan === SubscriptionTier.PRO) {
        setSuccess(`Verification SMS & Email sent to ${residentData.name} Successfully!`);
        setTimeout(() => setSuccess(null), 5000);
      }
      
      resetForm();
    } catch (error) {
      console.error("Error saving resident:", error);
      setFormError(error instanceof Error ? error.message : "Failed to save resident. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setOtpSent(true);
    setOtpError(null);
    setSuccess(`OTP sent to ${selectedResidentForVacate?.name}: ${otp}`);
    setTimeout(() => setSuccess(null), 5000);
    console.log(`OTP for ${selectedResidentForVacate?.name}: ${otp}`);
  };

  const handleVacateResident = async () => {
    if (!selectedResidentForVacate) return;
    
    if (enteredOtp !== generatedOtp) {
      setOtpError("Invalid OTP. Please try again.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      // Update unit occupancy
      const unit = units.find(u => u.id === selectedResidentForVacate.unitId);
      if (unit) {
        await db.updateUnit({
          ...unit,
          currentOccupants: Math.max(0, unit.currentOccupants - 1),
          status: (unit.currentOccupants - 1) === 0 ? RoomStatus.VACANT : RoomStatus.PARTIAL
        });
      }

      // Update resident status and returnable amount
      await db.updateResident({
        ...selectedResidentForVacate,
        status: 'inactive',
        returnableAmount: parseInt(returnableAmount) || 0
      });

      await fetchData();
      setShowVacateModal(false);
      setSelectedResidentForVacate(null);
      setReturnableAmount('');
    } catch (error) {
      console.error("Error vacating resident:", error);
      setError("Failed to vacate resident. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnitStatusLabel = (u: Unit) => {
    if (u.status === RoomStatus.MAINTENANCE) return RoomStatus.MAINTENANCE;
    if (u.currentOccupants === 0) return RoomStatus.VACANT;
    if (u.currentOccupants < u.capacity) return RoomStatus.PARTIAL;
    return RoomStatus.FULL;
  };

  const moveEligibleRooms = useMemo(() => {
    if (!selectedResidentForMove) return [];
    return units.filter(u => 
      u.propertyId === selectedResidentForMove.propertyId && 
      u.id !== selectedResidentForMove.unitId &&
      u.status !== RoomStatus.MAINTENANCE
    );
  }, [selectedResidentForMove, units]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    const propertyName = selectedPropId !== 'all' ? (properties.find(p => p.id === selectedPropId)?.name || 'Property') : 'All Properties';
    
    // Add Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Resident Detail Report', 40, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Property: ${propertyName}`, 40, 70);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 40, 85);
    doc.text(`Generated by: Hostel Management Pro`, 40, 100);

    // Table Data
    const tableData = filteredResidentsByProperty.map(r => [
      r.name,
      r.roomNumber || '-',
      r.phone,
      r.email,
      new Date(r.moveInDate).toLocaleDateString('en-IN'),
      formatCurrency(r.rent),
      `Due ${r.dueDate}th`,
      r.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 120,
      head: [['Name', 'Room', 'Phone', 'Email', 'Move-in', 'Rent', 'Due Day', 'Status']],
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
        6: { halign: 'center' },
        7: { halign: 'center' }
      },
      styles: { fontSize: 8, cellPadding: 6 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Residents_Report_${propertyName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-IN')}.pdf`);
  };

  if (role === UserRole.STAFF && !canCollectCash) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
           <Icons.Users />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 max-w-sm">You do not have permission to view resident data. Please contact your administrator if you believe this is an error.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Residents</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-slate-500 font-medium">Manage and view detailed history of your tenants.</p>
            {totalResidentsCount > residents.length && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-100 animate-pulse">
                <Icons.Complaints className="w-2.5 h-2.5" />
                Plan Limit: {residents.length} of {totalResidentsCount} Shown
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 md:flex-none">
            <select 
              value={selectedPropId} 
              onChange={(e) => setSelectedPropId(e.target.value)}
              className="w-full md:w-56 px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none pr-10 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-sm"
            >
              <option value="all">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
          <button 
            onClick={handleTryAdd}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-xl shadow-blue-100"
          >
            + Add Resident
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white p-3 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-100 shadow-sm text-center group hover:border-blue-100 transition-all">
          <p className="text-xl md:text-5xl font-black text-slate-900 mb-1 group-hover:scale-105 transition-transform">{stats.total}</p>
          <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Residents</p>
        </div>
        <div className="bg-emerald-50/50 p-3 md:p-8 rounded-xl md:rounded-[2rem] border border-emerald-100 shadow-sm text-center">
          <p className="text-xl md:text-5xl font-black text-emerald-600 mb-1">{stats.active}</p>
          <p className="text-[7px] md:text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Active Now</p>
        </div>
        <div className="bg-blue-50/50 p-3 md:p-8 rounded-xl md:rounded-[2rem] border border-blue-100 shadow-sm text-center">
          <p className="text-xl md:text-5xl font-black text-blue-600 mb-1">{stats.paid}</p>
          <p className="text-[7px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Rent Paid</p>
        </div>
        <div className="bg-slate-900 p-3 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-800 shadow-sm text-center">
          <p className="text-xl md:text-5xl font-black text-white mb-1">{stats.due}</p>
          <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Payment Due</p>
        </div>
      </div>

      <UpgradeModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => {
          setShowUpgradeModal(false);
          onUpgrade();
        }}
        limitType="residents"
        limitValue={userPlan.residents || 0}
      />

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 md:p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm mb-1">Resident Directory</h3>
            <p className="text-slate-400 text-[10px] md:text-xs font-medium">Comprehensive list of all current and past tenants across your properties</p>
          </div>
          <div>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
            >
              <Icons.Complaints className="w-3 h-3" />
              Download Directory PDF
            </button>
          </div>
        </div>
        
        <div className="p-4 md:p-8">
          <div className="relative mb-6 md:mb-10">
          <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Search email or name..." 
            className="w-full pl-14 pr-8 py-4 md:py-5 bg-slate-50/50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div className="min-w-full align-middle">
            {residents.length === 0 ? (
              <div className="py-24 text-center">
                 <div className="w-20 h-20 bg-slate-50 rounded-full mx-auto flex items-center justify-center text-slate-200 mb-4">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                 </div>
                 <p className="text-slate-400 font-bold italic">No resident records found.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="px-4 md:px-6 py-6">Profile</th>
                    {isLiteView && <th className="px-4 md:px-6 py-6">Status</th>}
                    {isLiteView && <th className="px-4 md:px-6 py-6">Contact</th>}
                    <th className="px-4 md:px-6 py-6 hidden lg:table-cell">Room</th>
                    <th className="px-4 md:px-6 py-6 hidden sm:table-cell">Rent Info</th>
                    <th className="px-4 md:px-6 py-6 hidden xl:table-cell">Status</th>
                    {role === UserRole.OWNER && <th className="px-4 md:px-6 py-6 text-center hidden lg:table-cell">Move</th>}
                    {role === UserRole.OWNER && <th className="px-4 md:px-6 py-6 text-right hidden sm:table-cell">Manage</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredResidents.map((r) => (
                    <tr 
                      key={r.id} 
                      className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                      onClick={() => { setSelectedResidentForDetail(r); setShowDetailModal(true); setActiveDetailTab('info'); }}
                    >
                      <td className="px-4 md:px-6 py-6 md:py-8">
                        <div className="flex items-center gap-3 md:gap-5">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm md:text-base group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">{r.name[0]}</div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 leading-none mb-1 group-hover:text-blue-600 transition-colors truncate text-sm md:text-base">{r.name}</p>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 lowercase truncate">{r.email}</p>
                            <div className="sm:hidden flex items-center gap-2 mt-1.5">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-tight bg-slate-100 px-1.5 py-0.5 rounded">RM {r.roomNumber || 'N/A'}</p>
                              {isLiteView && (
                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                  r.ledger && r.ledger.find(l => l.month === new Date().toLocaleString('default', { month: 'short' }) + ' ' + new Date().getFullYear() && l.status === 'Paid') 
                                  ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                                }`}>
                                  {r.ledger && r.ledger.find(l => l.month === new Date().toLocaleString('default', { month: 'short' }) + ' ' + new Date().getFullYear() && l.status === 'Paid') ? 'PAID' : 'DUE'}
                                </span>
                              )}
                              <p className="text-[9px] font-black text-blue-600 uppercase tracking-tight">{formatCurrency(r.rent)}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      {isLiteView && (
                        <td className="px-4 md:px-6 py-6 md:py-8">
                          <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                            r.ledger && r.ledger.find(l => l.month === new Date().toLocaleString('default', { month: 'short' }) + ' ' + new Date().getFullYear() && l.status === 'Paid') 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                          }`}>
                            {r.ledger && r.ledger.find(l => l.month === new Date().toLocaleString('default', { month: 'short' }) + ' ' + new Date().getFullYear() && l.status === 'Paid') ? 'PAID' : 'DUE'}
                          </span>
                        </td>
                      )}
                      {isLiteView && (
                        <td className="px-4 md:px-6 py-6 md:py-8">
                          <div className="flex items-center gap-2">
                             <a 
                               href={`https://wa.me/${r.phone.replace(/[^0-9]/g, '')}`} 
                               target="_blank" 
                               rel="noreferrer"
                               onClick={(e) => e.stopPropagation()}
                               className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                               title="Chat on WhatsApp"
                             >
                               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.483 8.413-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.308 1.654zm6.749-3.336l.303.18c1.332.793 2.868 1.211 4.434 1.212h.005c5.686 0 10.312-4.626 10.315-10.312.001-2.756-1.072-5.347-3.023-7.299-1.95-1.952-4.542-3.027-7.299-3.027-5.684 0-10.312 4.625-10.314 10.312-.001 1.83.479 3.619 1.391 5.2l.197.339-.997 3.642 3.731-.979zm11.391-7.21c-.269-.134-1.588-.784-1.834-.874-.246-.089-.425-.134-.604.134-.179.269-.693.874-.849 1.054-.157.179-.313.202-.582.067-.269-.134-1.135-.418-2.162-1.334-.799-.713-1.338-1.594-1.495-1.863-.157-.269-.016-.415.118-.549.121-.12.269-.313.403-.47.134-.157.179-.269.269-.448.089-.179.045-.336-.022-.47-.067-.134-.604-1.455-.828-1.994-.218-.532-.458-.458-.629-.467-.162-.008-.348-.01-.533-.01-.185 0-.486.069-.74.347-.253.279-.967.945-.967 2.304 0 1.359.988 2.671 1.127 2.855.139.184 1.944 2.969 4.708 4.161.657.284 1.171.453 1.57.58.66.21 1.261.18 1.735.109.529-.08 1.588-.65 1.811-1.275.223-.625.223-1.163.157-1.275-.067-.112-.246-.179-.515-.313z"/></svg>
                             </a>
                             <span className="text-[10px] font-bold text-slate-500 tabular-nums">{r.phone}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 md:px-6 py-6 md:py-8 text-sm font-black text-slate-700 hidden lg:table-cell">
                        RM {r.roomNumber || 'N/A'}
                      </td>
                      <td className="px-4 md:px-6 py-6 md:py-8 hidden sm:table-cell">
                        <p className="text-sm md:text-base font-black text-slate-900">{formatCurrency(r.rent)}</p>
                        <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Due {r.dueDate}th</p>
                      </td>
                      <td className="px-4 md:px-6 py-6 md:py-8 hidden xl:table-cell">
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest">
                          ACTIVE
                        </span>
                      </td>
                      {role === UserRole.OWNER && !disableRelocation && (
                        <td className="px-4 md:px-6 py-6 md:py-8 text-center hidden lg:table-cell">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedResidentForMove(r); setShowMoveModal(true); }}
                            className="px-3 md:px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm whitespace-nowrap"
                          >
                            Relocate
                          </button>
                        </td>
                      )}
                      {role === UserRole.OWNER && (
                        <td className="px-4 md:px-6 py-6 md:py-8 text-right hidden sm:table-cell">
                           <div className="flex justify-end gap-2">
                             <button 
                              onClick={(e) => { e.stopPropagation(); handleEditClick(r); }}
                              className="p-2 md:p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                             >
                               <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                             </button>
                             <button 
                              onClick={(e) => { e.stopPropagation(); setSelectedResidentForVacate(r); setReturnableAmount(r.securityDeposit?.toString() || '0'); setShowVacateModal(true); }}
                              className="p-2 md:p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Vacate Resident"
                             >
                               <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                             </button>
                             <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteResident(r.id); }}
                              className="p-2 md:p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Delete Record"
                             >
                               <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                           </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Resident Detail Modal */}
      {showDetailModal && selectedResidentForDetail && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-400/20 animate-in fade-in duration-300" onClick={() => setShowDetailModal(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[2rem] md:rounded-[3rem] shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
            <div className="p-6 md:p-10 pb-4 bg-slate-50/50 border-b border-slate-100 relative shrink-0">
               <button onClick={() => setShowDetailModal(false)} className="absolute top-6 md:top-10 right-6 md:right-10 text-slate-400 hover:text-slate-600 transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
               <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[2rem] bg-blue-600 text-white flex items-center justify-center font-black text-2xl md:text-3xl shadow-xl shadow-blue-100 shrink-0">
                    {selectedResidentForDetail.name[0]}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight truncate">{selectedResidentForDetail.name}</h2>
                    <p className="text-blue-600 text-[10px] md:text-sm font-black uppercase tracking-widest mt-1 truncate">Resident ID: {selectedResidentForDetail.id}</p>
                  </div>
               </div>
               
               {/* Tabs */}
               <div className="flex gap-4 md:gap-8 mt-6 md:mt-10 overflow-x-auto scrollbar-hide">
                  <button 
                    onClick={() => setActiveDetailTab('info')}
                    className={`pb-4 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-b-4 shrink-0 ${activeDetailTab === 'info' ? 'border-blue-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Overview
                  </button>
                  <button 
                    onClick={() => setActiveDetailTab('payments')}
                    className={`pb-4 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-b-4 shrink-0 ${activeDetailTab === 'payments' ? 'border-blue-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Payment History
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide">
              {activeDetailTab === 'info' ? (
                <div className="space-y-8 md:space-y-10 animate-in fade-in duration-300">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Move-in Date</p>
                        <p className="font-bold text-slate-900 text-sm md:text-base">{new Date(selectedResidentForDetail.moveInDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Room</p>
                        <p className="font-bold text-slate-900 text-sm md:text-base">RM {selectedResidentForDetail.roomNumber}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Rent</p>
                        <p className="font-black text-blue-600 text-lg md:text-xl">{formatCurrency(selectedResidentForDetail.rent)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Security Deposit</p>
                        <p className="font-black text-slate-900 text-lg md:text-xl">{formatCurrency(selectedResidentForDetail.securityDeposit || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          {selectedResidentForDetail.status === 'active' ? 'Expected Returnable' : 'Returned Amount'}
                        </p>
                        <p className={`font-black text-lg md:text-xl ${selectedResidentForDetail.status === 'active' ? 'text-blue-600' : 'text-emerald-600'}`}>
                          {formatCurrency(selectedResidentForDetail.returnableAmount || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${
                          selectedResidentForDetail.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-slate-50 text-slate-600 border-slate-100'
                        }`}>
                          {selectedResidentForDetail.status}
                        </span>
                      </div>
                   </div>

                   <div className="space-y-4 pt-6 border-t border-slate-50">
                      <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                        Contact Information
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                          <p className="text-xs md:text-sm font-bold text-slate-700 truncate">{selectedResidentForDetail.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                          <p className="text-xs md:text-sm font-bold text-slate-700">{selectedResidentForDetail.phone}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Permanent Address</p>
                        <p className="text-xs md:text-sm font-bold text-slate-700 leading-relaxed">{selectedResidentForDetail.permanentAddress}</p>
                      </div>
                   </div>

                   <div className="space-y-4 pt-6 border-t border-slate-50">
                      <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                        KYC Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Proof Type</p>
                          <p className="text-xs md:text-sm font-bold text-slate-700">{selectedResidentForDetail.idProofType}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Number</p>
                          <p className="text-xs md:text-sm font-bold text-slate-700">{selectedResidentForDetail.idNumber}</p>
                        </div>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Transaction History Section */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                       Transaction Ledger
                    </h4>
                    {individualTransactions.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 italic">No individual transactions recorded.</p>
                      </div>
                    ) : (
                    <div className="space-y-4 max-w-full overflow-x-hidden p-1">
                      {individualTransactions.map((p, idx) => (
                         <div key={p.id || p._id || idx} className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-emerald-100 transition-colors">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-sm shrink-0">
                                  <Icons.Payments className="w-5 h-5" />
                               </div>
                               <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900">{formatCurrency(p.amount)}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase truncate">
                                    {p.paymentMethod || 'CASH'} • {p.date ? (p.date.includes('/') ? p.date.split(',')[0] : new Date(p.date).toLocaleDateString()) : 'N/A'}
                                  </p>
                                  {p.description && (
                                    <p className="text-[9px] font-medium text-blue-500 italic mt-0.5 truncate">{p.description}</p>
                                  )}
                               </div>
                            </div>
                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-50">
                               <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tight">SUCCESS</span>
                               <p className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter mt-1 tabular-nums">{p.transactionId || p.id || p._id}</p>
                            </div>
                         </div>
                      ))}
                    </div>
                    )}
                  </div>

                  {/* Monthly Billing Summary */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                       Monthly Billing Summary
                    </h4>
                    {paymentHistory.length === 0 ? (
                      <p className="text-center py-10 text-slate-400 italic">No billing history found.</p>
                    ) : (
                      <div className="space-y-3">
                        {/* Desktop Table View */}
                        <div className="hidden md:block border border-slate-100 rounded-[2rem] overflow-hidden">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                               <th className="px-6 py-4">Billing Month</th>
                               <th className="px-6 py-4">Amount</th>
                               <th className="px-6 py-4">Status</th>
                               <th className="px-6 py-4 text-right">Date Paid</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {paymentHistory.map((p, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-xs font-black text-slate-700">{p.month}</td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-900">{formatCurrency(p.amount)}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg border ${
                                    p.status === 'Paid' || p.status === 'CLEARED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                    p.status === 'Partial' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                    p.status === 'ADVANCE' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    p.status === 'Unpaid' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                    'bg-slate-50 text-slate-600 border-slate-100'
                                  }`}>
                                    {p.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right text-xs font-bold text-slate-400">{p.date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {paymentHistory.map((p, idx) => (
                          <div key={idx} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Billing Month</p>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{p.month}</p>
                              </div>
                              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                                p.status === 'Paid' || p.status === 'CLEARED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                p.status === 'Partial' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                p.status === 'ADVANCE' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                p.status === 'Unpaid' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                'bg-slate-50 text-slate-600 border-slate-100'
                              }`}>
                                {p.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100/50">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Amount</p>
                                <p className="text-sm font-black text-blue-600">{formatCurrency(p.amount)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Paid On</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{p.date}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

            <div className="p-6 md:p-10 pt-0 shrink-0 grid grid-cols-2 gap-4">
               {(role === UserRole.OWNER || canCollectCash) && (
                 <>
                   <button 
                     onClick={() => {
                       setShowDetailModal(false);
                       setCollectingRentFor(selectedResidentForDetail);
                     }}
                     className="col-span-2 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:bg-emerald-700 transition flex items-center justify-center gap-2 mb-2"
                   >
                     <Icons.Dashboard className="w-4 h-4" />
                     Collect Rent
                   </button>
                   <button 
                     onClick={() => {
                       setShowDetailModal(false);
                       handleEditClick(selectedResidentForDetail);
                     }}
                     className="py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
                   >
                     <Icons.Edit className="w-4 h-4" />
                     Edit Profile
                   </button>
                   <button 
                     onClick={() => {
                       setShowDetailModal(false);
                       setSelectedResidentForMove(selectedResidentForDetail);
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
                       setSelectedResidentForVacate(selectedResidentForDetail);
                       setReturnableAmount(selectedResidentForDetail.securityDeposit?.toString() || '0');
                       setShowVacateModal(true);
                     }}
                     className="py-4 bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:bg-rose-700 transition flex items-center justify-center gap-2"
                   >
                     <Icons.Exit className="w-4 h-4" />
                     Vacate
                   </button>
                 </>
               )}
               <button 
                 onClick={() => setShowDetailModal(false)}
                 className={`py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-2xl shadow-xl hover:-translate-y-0.5 transition flex items-center justify-center gap-2 ${role === UserRole.OWNER ? '' : 'col-span-2'}`}
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Resident Modal */}
      {showMoveModal && selectedResidentForMove && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowMoveModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[95vh] border border-slate-100 overflow-hidden">
            <div className="p-10 pb-4 relative shrink-0">
              <button onClick={() => setShowMoveModal(false)} className="absolute top-10 right-10 text-slate-400 hover:text-slate-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Relocate Resident</h2>
              <p className="text-slate-500 text-sm mt-1 font-medium italic">Moving {selectedResidentForMove.name} from RM {selectedResidentForMove.roomNumber}</p>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto scrollbar-hide">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Choose New Room</label>
                <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                  {moveEligibleRooms.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400 italic">No other rooms available in this property.</p>
                    </div>
                  ) : (
                    moveEligibleRooms.map(u => {
                      const vacantBeds = u.capacity - u.currentOccupants;
                      const isFull = vacantBeds === 0;
                      const isVacant = vacantBeds === u.capacity;
                      const isPartial = !isFull && !isVacant;
                      const statusLabel = isFull ? RoomStatus.FULL : isVacant ? RoomStatus.VACANT : isPartial ? RoomStatus.PARTIAL : u.status;
                      
                      let statusColor = 'text-slate-400';
                      let bgColor = 'bg-slate-50';
                      let borderColor = 'border-slate-100';
                      
                      if (isFull) {
                        statusColor = 'text-rose-600';
                        bgColor = 'bg-rose-50/30';
                        borderColor = 'border-rose-100';
                      } else if (isVacant) {
                        statusColor = 'text-emerald-600';
                        bgColor = 'bg-emerald-50/30';
                        borderColor = 'border-emerald-100';
                      } else if (isPartial) {
                        statusColor = 'text-blue-600';
                        bgColor = 'bg-blue-50/30';
                        borderColor = 'border-blue-100';
                      }

                      const isSelected = targetUnitId === u.id;

                      return (
                        <button
                          key={u.id}
                          disabled={isFull}
                          onClick={() => setTargetUnitId(u.id)}
                          className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                            isSelected 
                              ? 'border-blue-600 bg-blue-50/50 shadow-md' 
                              : isFull 
                                ? 'opacity-60 cursor-not-allowed border-slate-100 bg-slate-50' 
                                : `${borderColor} ${bgColor} hover:border-blue-300`
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 border border-slate-100'
                            }`}>
                              {u.roomNumber}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">RM {u.roomNumber}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                {u.type} • {formatCurrency(u.price)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-[9px] font-black uppercase tracking-tight leading-tight ${statusColor}`}>
                              {statusLabel}
                            </p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">({vacantBeds}/{u.capacity}) Available</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {targetUnitId && !disableRelocation && (
                <div className="bg-blue-50/50 rounded-3xl p-8 border border-blue-100 animate-in slide-in-from-top-4 duration-500">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Prorated Fee Calculation
                  </h4>
                  
                  {(() => {
                    const target = units.find(u => u.id === targetUnitId);
                    if (!target) return null;
                    const info = getProratedInfo(selectedResidentForMove, target);
                    return (
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tight mb-2">
                          Cycle: {info.monthName} ({info.daysInMonth} Days) {info.isLeapYear && info.daysInMonth === 29 ? '- Leap Year' : ''}
                          {info.totalActiveDays < info.daysInMonth && ` • Active: ${info.totalActiveDays} Days`}
                        </p>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                          <span>Old RM {selectedResidentForMove.roomNumber} ({info.daysSpent} days)</span>
                          <span className="text-slate-900">{formatCurrency(info.oldCost)}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 ml-4 italic">Formula: ({info.oldRent} / {info.daysInMonth}) × {info.daysSpent}</p>
                        
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 mt-2">
                          <span>New RM {target.roomNumber} ({info.remainingDays} days)</span>
                          <span className="text-slate-900">{formatCurrency(info.newCost)}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 ml-4 italic">Formula: ({info.newRent} / {info.daysInMonth}) × {info.remainingDays}</p>

                        <div className="pt-4 mt-4 border-t border-blue-100 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-blue-700 uppercase">Total Adjusted Rent (Month)</span>
                            <span className="text-lg font-black text-blue-900">{formatCurrency(info.totalAdjusted)}</span>
                          </div>
                          <div className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-blue-100/50">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              {info.balanceAdjustment >= 0 ? 'Additional Due' : 'Credit Balance'}
                            </span>
                            <span className={`text-sm font-black ${info.balanceAdjustment >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {info.balanceAdjustment >= 0 ? '+' : ''}{formatCurrency(info.balanceAdjustment)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => setShowMoveModal(false)}
                  className="flex-1 py-4 border border-slate-100 text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-50 transition"
                >
                  Discard
                </button>
                <button 
                  disabled={!targetUnitId}
                  onClick={handleMoveResident}
                  className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition disabled:opacity-50 disabled:shadow-none"
                >
                  Confirm Move
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowAdd(false)}></div>
          <div className="relative bg-white w-full max-w-xl h-full max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border border-slate-100">
             
             {/* Header */}
             <div className="p-6 md:p-10 pb-4 relative shrink-0">
               <button onClick={() => setShowAdd(false)} className="absolute top-6 md:top-10 right-6 md:right-10 text-slate-400 hover:text-slate-600 transition">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
               <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">{editingResidentId ? 'Edit Resident' : 'Add Resident'}</h2>
               <p className="text-slate-500 text-[10px] md:text-sm mt-1 font-medium italic">{editingResidentId ? 'Update tenant profile information' : 'Create an onboarding profile for a new tenant'}</p>
             </div>

             {formError && (
               <div className="mx-6 md:mx-10 mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold">
                 {formError}
               </div>
             )}

             {/* Form Content - Scrollable */}
             <form onSubmit={handleAddResident} className="flex-1 overflow-y-auto p-6 md:p-10 pt-4 space-y-8 md:space-y-10 scrollbar-hide">
               
               {/* Section 1: Personal Information */}
               <div className="space-y-6">
                 <h3 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    Personal Details
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                     <input required value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Resident name" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                     <input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="contact@email.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                   </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Phone</label>
                     <input required value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+91 00000 00000" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                     <input required value={dob} onChange={(e) => setDob(e.target.value)} type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Permanent Address</label>
                   <textarea required value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Complete home address" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold resize-none" />
                 </div>
               </div>

               {/* Section 2: Room Assignment */}
               <div className="space-y-6">
                 <h3 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    Unit Assignment
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Property</label>
                     <div className="relative">
                       <select 
                         required 
                         value={formPropertyId} 
                         onChange={(e) => { 
                           setFormPropertyId(e.target.value); 
                           setUnitId(''); 
                           setRoomNumber(''); 
                         }} 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold appearance-none pr-10"
                       >
                         <option value="">Select property</option>
                         {properties.map(p => (
                           <option key={p.id} value={p.id}>{p.name}</option>
                         ))}
                       </select>
                       <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                     </div>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Room No. (Available)</label>
                     <div className="relative">
                        <select 
                          required 
                          disabled={!formPropertyId}
                          value={unitId} 
                          onChange={handleUnitChange}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold appearance-none pr-10 disabled:opacity-50"
                        >
                          <option value="">{formPropertyId ? 'Choose a Room' : 'Select property first'}</option>
                          {availableUnitsForProperty.map(u => (
                            <option 
                              key={u.id} 
                              value={u.id} 
                              disabled={u.status === RoomStatus.FULL || u.status === RoomStatus.MAINTENANCE}
                            >
                              RM {u.roomNumber} - {getUnitStatusLabel(u)} ({u.currentOccupants}/{u.capacity})
                            </option>
                          ))}
                        </select>
                        <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                     </div>
                   </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Move-in Date</label>
                     <input required value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rent Due Date (Day)</label>
                     <div className="relative">
                        <select 
                          required 
                          value={dueDate} 
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold appearance-none pr-10"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of month</option>
                          ))}
                        </select>
                        <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                     </div>
                   </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monthly Rent</label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                         <input required value={rent} onChange={(e) => setRent(e.target.value)} type="number" placeholder="Amount" className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Deposit</label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                         <input required value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} type="number" placeholder="Deposit" className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Returnable Amount</label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                         <input required value={formReturnableAmount} onChange={(e) => setFormReturnableAmount(e.target.value)} type="number" placeholder="Returnable" className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                      </div>
                    </div>
                 </div>
               </div>

               {/* Section 3: KYC Documents */}
               <div className="space-y-6 pb-4">
                 <h3 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    KYC Compliance
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Document Type</label>
                     <div className="relative">
                       <select required value={idProofType} onChange={(e) => setIdProofType(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold appearance-none pr-10">
                         <option value="">Select ID type</option>
                         <option value="Aadhaar">Aadhaar Card</option>
                         <option value="PAN">PAN Card</option>
                         <option value="Voter ID">Voter ID</option>
                         <option value="Passport">Passport</option>
                         <option value="Driving License">Driving License</option>
                       </select>
                       <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                     </div>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Serial Number</label>
                     <input required value={idNumber} onChange={(e) => setIdNumber(e.target.value)} type="text" placeholder="ID proof number" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                   </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Attachments</label>
                    <div className="w-full px-4 py-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-between group cursor-pointer hover:border-blue-300 transition-colors">
                       <span className="text-xs font-bold text-slate-400">Choose Files <span className="text-slate-300 ml-2 font-medium">(No file chosen)</span></span>
                       <input type="file" className="hidden" id="tenant-files" />
                       <label htmlFor="tenant-files" className="text-[10px] font-black text-blue-600 cursor-pointer uppercase tracking-widest bg-white border border-blue-100 px-3 py-1.5 rounded-lg">Browse</label>
                    </div>
                 </div>
               </div>

               {/* Footer Buttons */}
               <div className="flex gap-4 pt-6 sticky bottom-0 bg-white pb-6">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-4 border border-slate-100 text-slate-400 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    editingResidentId ? 'Update Profile' : 'Complete Onboarding'
                  )}
                </button>
              </div>
             </form>
          </div>
        </div>
      )}
       {showVacateModal && selectedResidentForVacate && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowVacateModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-100">
            <div className="p-6 md:p-8 bg-rose-50 border-b border-rose-100 relative shrink-0">
               <button onClick={() => setShowVacateModal(false)} className="absolute top-6 md:top-8 right-6 md:right-8 text-rose-300 hover:text-rose-600 transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
               <h2 className="text-xl md:text-2xl font-black text-rose-900 uppercase tracking-tight">Vacate Resident</h2>
               <p className="text-rose-600 text-[10px] md:text-xs font-bold mt-1 uppercase tracking-widest">Final Settlement for {selectedResidentForVacate.name}</p>
            </div>
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto scrollbar-hide">
               <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Deposit</span>
                    <span className="font-black text-slate-900">{formatCurrency(selectedResidentForVacate.securityDeposit || 0)}</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Returnable Amount</label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                       <input 
                        disabled={otpSent}
                        value={returnableAmount} 
                        onChange={(e) => setReturnableAmount(e.target.value)} 
                        type="number" 
                        placeholder="Amount to return" 
                        className="w-full pl-8 pr-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold disabled:opacity-50" 
                       />
                    </div>
                    <p className="text-[9px] text-slate-400 italic">Enter the final amount to be returned after any deductions.</p>
                  </div>

                  {otpSent && (
                    <div className="space-y-2 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enter OTP sent to resident</label>
                      <input 
                        value={enteredOtp} 
                        onChange={(e) => setEnteredOtp(e.target.value)} 
                        type="text" 
                        maxLength={6}
                        placeholder="6-digit OTP" 
                        className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold text-center tracking-[0.5em]" 
                      />
                      {otpError && <p className="text-[10px] text-rose-500 font-bold">{otpError}</p>}
                    </div>
                  )}
               </div>

               <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setShowVacateModal(false);
                      setOtpSent(false);
                      setGeneratedOtp('');
                      setEnteredOtp('');
                      setOtpError(null);
                    }}
                    className="flex-1 py-4 border border-slate-100 text-slate-400 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  {!otpSent ? (
                    <button 
                      onClick={handleSendOtp}
                      className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition"
                    >
                      Send OTP
                    </button>
                  ) : (
                    <button 
                      onClick={handleVacateResident}
                      disabled={isSubmitting || enteredOtp.length < 6}
                      className="flex-1 py-4 bg-rose-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-rose-100 hover:bg-rose-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Processing...' : 'Verify & Vacate'}
                    </button>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
      {/* Rent Collection Modal */}
      <RentCollectionModal 
        resident={collectingRentFor}
        onClose={() => setCollectingRentFor(null)}
        onSuccess={fetchData}
        ownerId={ownerId}
        ownerName={ownerName}
        allStaff={allStaff}
        currentUser={currentUser}
        plan={plan}
        onUpgrade={onUpgrade}
      />

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => { if (!isSubmitting) setShowDeleteConfirm(false); }}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] md:rounded-[2.5rem] shadow-2xl p-6 md:p-10 animate-in zoom-in duration-300 text-center border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-rose-50 text-rose-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Icons.Delete className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirm Removal</h2>
            <p className="text-slate-500 text-[10px] md:text-sm font-medium mb-8">
              Are you sure you want to remove this resident? This action cannot be undone.
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
                onClick={confirmDeleteResident}
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

export default Residents;
