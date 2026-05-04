
import React, { useState, useEffect } from 'react';
import { UserRole, SubscriptionTier, getTierValue, PLAN_LIMITS } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Properties from './components/Properties';
import Residents from './components/Residents';
import Staff from './components/Staff';
import Payments from './components/Payments';
import Complaints from './components/Complaints';
import Rooms from './components/Rooms';
import Expenses from './components/Expenses';
import SuperAdmin from './components/SuperAdmin';
import EmpireReports from './components/EmpireReports';
import ResidentApp from './components/ResidentApp';
import Login from './components/Login';
import Signup from './components/Signup';
import PlanSelection from './components/PlanSelection';
import Settings from './components/Settings';
import Updates from './components/Updates';
import ResidentSettings from './components/ResidentSettings';
import MealPlan from './components/MealPlan';
import PhonePeMockGateway from './components/PhonePeMockGateway';
import PaymentStatus from './components/PaymentStatus';
import { db } from './services/mockData';
import { Icons } from './constants';

const UpgradeRequired: React.FC<{ onUpgrade: () => void; currentTier: SubscriptionTier; activeTab: string }> = ({ onUpgrade, currentTier, activeTab }) => {
  const getTriggerLine = () => {
    const tierValue = getTierValue(currentTier);
    if (tierValue === 0) return "Start managing your hostel operations properly";
    if (tierValue === 1) return "Automate rent collection and save hours every month";
    if (tierValue === 2) return "Expand your operations and communicate instantly";
    if (tierValue === 3) return "Run your hostel like a data-driven business";
    if (tierValue === 4) return "Build a fully customized hostel management system";
    return "Upgrade to unlock advanced capabilities";
  };

  const getTargetTier = () => {
    const tierValue = getTierValue(currentTier);
    if (tierValue === 0) return "Lite";
    if (tierValue === 1) return "Basic";
    if (tierValue === 2) return "Pro";
    if (tierValue === 3) return "Business";
    if (tierValue === 4) return "Custom";
    return "Premium";
  };

  const isExpired = currentTier === SubscriptionTier.TRIAL;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 md:p-10 animate-in fade-in zoom-in duration-500">
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 animate-bounce ${isExpired ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight mb-3">
        {isExpired ? "Trial Finished" : `Unlock ${getTargetTier()}`}
      </h2>
      <p className={`text-slate-500 max-w-md mx-auto mb-8 font-bold italic border-l-4 pl-4 py-2 ${isExpired ? 'border-rose-600 bg-rose-50/30' : 'border-blue-600 bg-blue-50/30'}`}>
        👉 "{isExpired ? 'Your 7-day trial has concluded. Upgrade now to keep managing your hostel.' : getTriggerLine()}"
      </p>
      <button 
        onClick={onUpgrade}
        className={`px-8 py-4 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl transition-all flex items-center gap-3 ${isExpired ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
      >
        {isExpired ? 'Choose a Plan' : `Upgrade to ${getTargetTier()}`}
        <Icons.Plus className="w-4 h-4 rotate-45" />
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.OWNER);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const path = window.location.pathname;
    if (path === '/mock-phonepe') return 'mock-phonepe';
    if (path === '/payment-status') return 'payment-status';
    return 'dashboard';
  });
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [impersonatingOwner, setImpersonatingOwner] = useState<string | null>(null);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [forceOpenPropertyModal, setForceOpenPropertyModal] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [paymentsInitialView, setPaymentsInitialView] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [planConfigs, setPlanConfigs] = useState<any[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const configs = await db.getPlanConfigs();
        setPlanConfigs(configs);
      } catch (error) {
        console.error("Error fetching global data:", error);
      }
    };
    fetchGlobalData();
  }, []);

  useEffect(() => {
    // Handle local routing for simulated external gateways
    const path = window.location.pathname;
    if (path === '/mock-phonepe') {
      setActiveTab('mock-phonepe');
    } else if (path === '/payment-status') {
      setActiveTab('payment-status');
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const activeId = impersonatingOwner || currentUserId;
      if (activeId) {
        try {
          const [users, allStaff] = await Promise.all([
            db.getUsers(),
            db.getStaff()
          ]);
          
          let found = null;
          
          if (activeId === 'SUPERADMIN') {
            found = { id: 'SUPERADMIN', username: 'superadmin', role: UserRole.SUPERADMIN, name: 'System Administrator' };
          } else {
            found = users.find((u: any) => u.id === activeId || u._id === activeId);
          }
          
          if (found && (found.role === UserRole.STAFF || found.role === UserRole.RESIDENT)) {
            // Inherit plan from owner
            const ownerId = found.ownerId;
            if (ownerId && ownerId !== found.id) {
              const owner = users.find((u: any) => u.id === ownerId || u._id === ownerId);
              if (owner) {
                found = { ...found, plan: owner.plan };
                
                // CRITICAL: Block Staff access if Owner is on Lite/Free plan
                if (found.role === UserRole.STAFF) {
                  const ownerTierLimit = PLAN_LIMITS[owner.plan as SubscriptionTier]?.staff || 0;
                  if (ownerTierLimit === 0) {
                    console.warn(`Access denied: Staff login attempted for owner ${ownerId} on plan ${owner.plan}`);
                    handleLogout("Staff login is not supported on the Owner's current plan (Lite/Free). Please contact the Owner to upgrade.");
                    return;
                  }
                }
              }
            }
          }
          
          if (found && found.role === UserRole.STAFF) {
            const staffRecord = allStaff.find((s: any) => s.email.toLowerCase() === found.email.toLowerCase());
            if (staffRecord) {
              found = { ...found, ...staffRecord };
            }
          }
          
          setUser(found);
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };
    fetchUser();
  }, [currentUserId, currentRole, impersonatingOwner]);

  const handleLoginSuccess = async (role: UserRole, userId: string) => {
    setCurrentRole(role);
    setCurrentUserId(userId);
    setIsAuthenticated(true);
    setActiveTab(role === UserRole.SUPERADMIN ? 'superadmin' : 'dashboard');
  };

  const handleSignupSuccess = (role: UserRole, userId: string) => {
    setCurrentRole(role);
    setCurrentUserId(userId);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    if (role === UserRole.OWNER) {
      setShowPlanSelection(true);
    }
  };

  const handleLogout = (errorMessage?: any) => {
    setIsAuthenticated(false);
    setCurrentUserId(null);
    setImpersonatingOwner(null);
    setShowPlanSelection(false);
    if (typeof errorMessage === 'string') {
      setLoginError(errorMessage);
    } else {
      setLoginError(null);
    }
  };

  const handlePlanSelect = async (tier: SubscriptionTier) => {
    if (!currentUserId) {
      console.error('No user ID found for plan selection');
      return;
    }

    try {
      console.log(`Updating plan for user ${currentUserId} to ${tier}`);
      await db.updateUserPlan(currentUserId, tier);
      
      // Refetch user data to ensure state is synchronized
      const users = await db.getUsers();
      const found = users.find((u: any) => u.id === currentUserId || u._id === currentUserId);
      
      if (found) {
        console.log('User plan updated successfully:', found);
        setUser(found);
        setShowPlanSelection(false);
      } else {
        console.error('User not found after plan update');
        // Fallback: still close the modal if we think it worked on the server
        setShowPlanSelection(false);
      }
    } catch (err) {
      console.error('Failed to update plan:', err);
      alert('Failed to update plan. Please try again.');
    }
  };

  const handleAddPropertyFromDash = () => {
    setActiveTab('properties');
    setForceOpenPropertyModal(true);
  };

  const handleManageRooms = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setActiveTab('rooms');
  };

  if (!isAuthenticated && activeTab !== 'mock-phonepe') {
    if (isSigningUp) {
      return <Signup onSignupSuccess={handleSignupSuccess} onNavigateToLogin={() => setIsSigningUp(false)} />;
    }
    return <Login error={loginError} onLogin={handleLoginSuccess} onNavigateToSignup={() => setIsSigningUp(true)} />;
  }

  if (isAuthenticated && !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Initializing Session...</p>
        </div>
      </div>
    );
  }

  if (showPlanSelection) {
    return <PlanSelection onSelect={handlePlanSelect} onClose={() => setShowPlanSelection(false)} currentTier={user?.plan} user={user} />;
  }

  const effectiveOwnerId = impersonatingOwner || 
    (currentRole === UserRole.OWNER ? currentUserId : user?.ownerId);

  const renderContent = () => {
    if (activeTab === 'mock-phonepe') {
      return <PhonePeMockGateway />;
    }

    if (activeTab === 'payment-status') {
      return <PaymentStatus />;
    }

    // Check for restricted access based on tier
    const currentTier = user?.plan || SubscriptionTier.TRIAL;
    const currentTierValue = getTierValue(currentTier);

    // Trial Expiration Enforcement
    if (user?.plan === SubscriptionTier.TRIAL && user?.trialEndsAt) {
      const isExpired = new Date(user.trialEndsAt).getTime() < new Date().getTime();
      if (isExpired && activeTab !== 'dashboard' && activeTab !== 'settings') {
        return <UpgradeRequired onUpgrade={() => setShowPlanSelection(true)} currentTier={currentTier} activeTab={activeTab} />;
      }
    }

    const tabRequirements: Record<string, number> = {
      'payments': 1,
      'complaints': 2,
      'updates': 2,
      'expenses': 2,
      'staff': 2, // Lite is value 1, Pro is value 2
      'meals': 3  // Business and above
    };

    const requiredValue = tabRequirements[activeTab] || 0;
    
    // Check if the current user (Owner, Staff, or Resident) meets the plan requirements for the active tab
    if (currentTierValue < requiredValue && currentRole !== UserRole.SUPERADMIN) {
      return <UpgradeRequired onUpgrade={() => setShowPlanSelection(true)} currentTier={currentTier} activeTab={activeTab} />;
    }

    if (currentRole === UserRole.SUPERADMIN && !impersonatingOwner) {
      return <SuperAdmin onImpersonate={(ownerId) => {
        setImpersonatingOwner(ownerId);
        setCurrentRole(UserRole.OWNER);
        setActiveTab('dashboard');
      }} />;
    }

    if (currentRole === UserRole.RESIDENT) {
      const resId = user?.email || currentUserId || '';
      if (activeTab === 'dashboard') return <ResidentApp residentId={resId} onNavigate={(tab) => setActiveTab(tab)} plan={user?.plan} />;
      if (activeTab === 'payments') return <Payments role={currentRole} ownerId={effectiveOwnerId || ''} propertyId={user?.propertyId} residentId={resId} plan={user?.plan || SubscriptionTier.TRIAL} onUpgrade={() => setShowPlanSelection(true)} />;
      if (activeTab === 'complaints') return <Complaints role={currentRole} ownerId={effectiveOwnerId || ''} userId={currentUserId || ''} propertyId={user?.propertyId} residentId={resId} />;
      if (activeTab === 'updates') return (
        <Updates 
          ownerId={effectiveOwnerId || ''} 
          role={currentRole}
          assignedPropertyIds={user?.assignedPropertyIds}
          currentUser={user}
        />
      );
      if (activeTab === 'settings') return <ResidentSettings residentId={resId} />;
      if (activeTab === 'meals') return (
        <MealPlan 
          ownerId={effectiveOwnerId || ''} 
          role={currentRole} 
          propertyId={user?.propertyId} 
        />
      );
      return <ResidentApp residentId={resId} onNavigate={(tab) => setActiveTab(tab)} plan={user?.plan} />;
    }

    const isLiteOrFree = user?.plan === SubscriptionTier.LITE || user?.plan === SubscriptionTier.FREE;

    switch (activeTab) {
      case 'dashboard': return (
        <Dashboard 
          role={currentRole} 
          ownerId={effectiveOwnerId || ''} 
          onAddProperty={handleAddPropertyFromDash} 
          onViewComplaints={() => setActiveTab('complaints')}
          onViewPayments={(view?: string) => {
            if (view) setPaymentsInitialView(view);
            setActiveTab('payments');
          }}
          onViewProperty={handleManageRooms}
          propertyId={user?.propertyId}
          assignedPropertyIds={user?.assignedPropertyIds}
          plan={user?.plan || SubscriptionTier.TRIAL}
          canCollectCash={user?.canCollectCash}
          user={user}
          hideRevenue={isLiteOrFree}
        />
      );
      case 'properties': return (
        <Properties 
          role={currentRole}
          ownerId={effectiveOwnerId || ''} 
          onUpgrade={() => setShowPlanSelection(true)} 
          forceOpenModal={forceOpenPropertyModal}
          onModalClose={() => setForceOpenPropertyModal(false)}
          onManageRooms={handleManageRooms}
          assignedPropertyIds={user?.assignedPropertyIds}
          plan={user?.plan}
          isBasicHost={user?.isBasicHost}
        />
      );
      case 'rooms': return (
        <Rooms 
          ownerId={effectiveOwnerId || ''} 
          initialPropertyId={selectedPropertyId || user?.propertyId} 
          onUpgrade={() => setShowPlanSelection(true)} 
          assignedPropertyIds={user?.assignedPropertyIds}
          onViewResident={(resId) => {
            setSelectedResidentId(resId);
            setActiveTab('residents');
          }}
        />
      );
      case 'residents': return (
        <Residents 
          role={currentRole}
          ownerId={effectiveOwnerId || ''} 
          onUpgrade={() => setShowPlanSelection(true)} 
          propertyId={user?.propertyId}
          assignedPropertyIds={user?.assignedPropertyIds}
          initialResidentId={selectedResidentId}
          onClearInitialResident={() => setSelectedResidentId(null)}
          canCollectCash={user?.canCollectCash}
          currentUser={user}
          plan={user?.plan}
          isBasicHost={user?.isBasicHost}
          isLite={isLiteOrFree}
        />
      );
      case 'staff': return (
        <Staff 
          ownerId={effectiveOwnerId || ''} 
          onUpgrade={() => setShowPlanSelection(true)} 
          assignedPropertyIds={user?.assignedPropertyIds}
          plan={user?.plan}
        />
      );
      case 'payments': return (
        <Payments 
          role={currentRole}
          ownerId={effectiveOwnerId || ''} 
          propertyId={user?.propertyId}
          assignedPropertyIds={user?.assignedPropertyIds}
          canCollectCash={user?.canCollectCash}
          user={user}
          plan={user?.plan || SubscriptionTier.TRIAL}
          onUpgrade={() => setShowPlanSelection(true)}
          initialView={paymentsInitialView}
          onClearInitialView={() => setPaymentsInitialView(null)}
          isManualOnly={isLiteOrFree}
        />
      );
      case 'complaints': return (
        <Complaints 
          role={currentRole} 
          ownerId={effectiveOwnerId || ''} 
          userId={currentUserId || ''}
          propertyId={user?.propertyId}
          assignedPropertyIds={user?.assignedPropertyIds}
        />
      );
      case 'updates': return (
        <Updates 
          ownerId={effectiveOwnerId || ''} 
          role={currentRole}
          assignedPropertyIds={user?.assignedPropertyIds}
          currentUser={user}
          plan={user?.plan}
          isBasicHost={user?.isBasicHost}
        />
      );
      case 'expenses': 
        if (currentRole === UserRole.STAFF && !user?.canAddExpenses) {
          return (
            <Dashboard 
              role={currentRole} 
              ownerId={effectiveOwnerId || ''} 
              onAddProperty={handleAddPropertyFromDash} 
              onViewComplaints={() => setActiveTab('complaints')}
              onViewPayments={(view?: string) => {
                if (view) setPaymentsInitialView(view);
                setActiveTab('payments');
              }}
              onViewProperty={handleManageRooms}
              onUpgrade={() => setShowPlanSelection(true)}
              propertyId={user?.propertyId}
              assignedPropertyIds={user?.assignedPropertyIds}
              plan={user?.plan || SubscriptionTier.TRIAL}
              isBasicHost={user?.isBasicHost}
              canCollectCash={user?.canCollectCash}
              user={user}
            />
          );
        }
        return (
          <Expenses 
            ownerId={effectiveOwnerId || ''} 
            propertyId={user?.propertyId}
            assignedPropertyIds={user?.assignedPropertyIds}
            currentUser={user}
            plan={user?.plan}
            isBasicHost={user?.isBasicHost}
          />
        );
      case 'meals': return (
        <MealPlan 
          ownerId={effectiveOwnerId || ''} 
          role={currentRole} 
          propertyId={user?.propertyId}
          assignedPropertyIds={user?.assignedPropertyIds}
        />
      );
      case 'reports': return (
        <EmpireReports 
          ownerId={effectiveOwnerId || ''} 
          plan={user?.plan || SubscriptionTier.TRIAL} 
          onUpgrade={() => setShowPlanSelection(true)} 
        />
      );
      case 'superadmin': return <SuperAdmin onImpersonate={setImpersonatingOwner} />;
      case 'settings': return (
        <Settings 
          user={user} 
          planConfigs={planConfigs}
          onUpdateUser={(updatedUser) => setUser(updatedUser)} 
          onUpgrade={() => setShowPlanSelection(true)} 
        />
      );
      default: return (
        <Dashboard 
          role={currentRole} 
          ownerId={effectiveOwnerId || ''} 
          onAddProperty={handleAddPropertyFromDash} 
          onViewComplaints={() => setActiveTab('complaints')}
          onViewPayments={(view?: string) => {
            if (view) setPaymentsInitialView(view);
            setActiveTab('payments');
          }}
          onViewProperty={handleManageRooms}
          onUpgrade={() => setShowPlanSelection(true)}
          propertyId={user?.propertyId}
          assignedPropertyIds={user?.assignedPropertyIds}
          plan={user?.plan || SubscriptionTier.TRIAL}
          isBasicHost={user?.isBasicHost}
        />
      );
    }
  };

  if (activeTab === 'mock-phonepe') {
    return <PhonePeMockGateway />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {impersonatingOwner && (
        <div className="fixed top-0 left-0 right-0 bg-rose-600 text-white text-center py-2 z-[60] font-bold text-[10px] uppercase tracking-widest flex justify-between px-6 items-center shadow-lg">
          <span>SUPERADMIN ACCESS: VIEWING OWNER <strong>{impersonatingOwner}</strong></span>
          <button 
            onClick={() => {
              setImpersonatingOwner(null);
              setCurrentRole(UserRole.SUPERADMIN);
              setActiveTab('superadmin');
            }}
            className="bg-white text-rose-600 px-3 py-1 rounded-full text-[10px] hover:bg-rose-50 transition"
          >
            Exit Impersonation
          </button>
        </div>
      )}

      <Sidebar 
        isOpen={isSidebarOpen} 
        setOpen={setSidebarOpen} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        role={currentRole}
        planTier={user?.plan}
        trialEndsAt={user?.trialEndsAt}
        canCollectCash={user?.canCollectCash}
        canPostAnnouncements={user?.canPostAnnouncements}
        canAddExpenses={user?.canAddExpenses}
        isBasicHost={user?.isBasicHost}
      />
      
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'} ${impersonatingOwner ? 'pt-10' : ''}`}>
        <Header 
          toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} 
          role={currentRole}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto min-w-0 p-4 md:p-6 lg:p-10">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
