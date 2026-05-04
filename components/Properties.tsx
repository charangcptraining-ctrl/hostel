
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockData';
import { formatCurrency } from '../constants';
import { Property, PLAN_LIMITS, SubscriptionTier, UserRole, getTierValue } from '../types';
import UpgradeModal from './UpgradeModal';

interface PropertiesProps {
  role: UserRole;
  ownerId: string;
  onUpgrade: () => void;
  forceOpenModal?: boolean;
  onModalClose?: () => void;
  onManageRooms: (propertyId: string) => void;
  assignedPropertyIds?: string[];
  plan?: SubscriptionTier;
  isBasicHost?: boolean;
}

const Properties: React.FC<PropertiesProps> = ({ role, ownerId, onUpgrade, forceOpenModal, onModalClose, onManageRooms, assignedPropertyIds, plan, isBasicHost }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [userPlan, setUserPlan] = useState<any>(PLAN_LIMITS[plan || SubscriptionTier.TRIAL]);
  
  // Update internal plan state when prop changes
  useEffect(() => {
    setUserPlan(PLAN_LIMITS[plan || SubscriptionTier.TRIAL]);
  }, [plan]);
  
  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('Boys');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rooms, setRooms] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLiteView = isBasicHost || getTierValue(plan || SubscriptionTier.TRIAL) <= 1;

  const fetchProperties = async () => {
    setLoading(true);
    try {
      let props = await db.getProperties(ownerId);
      
      // Filter if assignedPropertyIds is provided (for STAFF)
      if (assignedPropertyIds && assignedPropertyIds.length > 0) {
        props = props.filter((p: any) => assignedPropertyIds.includes(p.id) || assignedPropertyIds.includes(p._id));
      }

      setProperties(props);
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [ownerId, assignedPropertyIds]);

  // Handle force open from Dashboard
  useEffect(() => {
    const checkForceOpen = async () => {
      if (forceOpenModal) {
        const currentProps = await db.getProperties(ownerId);
        const limitInfo = PLAN_LIMITS[plan || SubscriptionTier.TRIAL];

        if (limitInfo.properties !== null && currentProps.length >= limitInfo.properties) {
          setShowUpgradeModal(true);
        } else {
          setShowAddModal(true);
        }
        
        // Notify App that we've processed the force open
        if (onModalClose) onModalClose();
      }
    };
    checkForceOpen();
  }, [forceOpenModal, ownerId, onModalClose, plan]);

  const handleTryAdd = () => {
    if (role !== UserRole.OWNER) return;
    if (userPlan.properties !== null && properties.length >= userPlan.properties) {
      setShowUpgradeModal(true);
      return;
    }
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setEditingProperty(null);
    // Reset form
    setName(''); setType('Boys'); setAddress(''); setCity('');
    setState(''); setZipCode(''); setRooms(''); 
    setContactPerson(''); setContactPhone('');
    setImageUrl('');
  };

  const handleEditProperty = (prop: Property) => {
    if (role !== UserRole.OWNER) return;
    setEditingProperty(prop);
    setName(prop.name);
    setType(prop.type);
    setAddress(prop.address);
    setCity(prop.city);
    setState(prop.state);
    setZipCode(prop.zipCode);
    setRooms(prop.totalRooms.toString());
    setContactPerson(prop.contactPerson);
    setContactPhone(prop.contactPhone);
    setImageUrl(prop.imageUrl || '');
    setShowAddModal(true);
  };

  const handleDeleteProperty = async (id: string) => {
    if (role !== UserRole.OWNER) return;
    setIsSubmitting(true);
    try {
      await db.deleteProperty(id);
      await fetchProperties();
      setShowDeleteConfirm(null);
    } catch (err: any) {
      console.error("Error deleting property:", err);
      setError(err.message || "Failed to delete property.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingProperty) {
        const updatedProp: Property = {
          ...editingProperty,
          name,
          type,
          address,
          city,
          state: state || 'N/A',
          zipCode: zipCode || 'N/A',
          totalRooms: parseInt(rooms) || 0,
          contactPerson,
          contactPhone,
          imageUrl
        };
        await db.updateProperty(updatedProp);
      } else {
        const newProp: Property = {
          id: `PROP-${Date.now()}`,
          ownerId,
          name,
          type,
          address,
          city,
          state: state || 'N/A',
          zipCode: zipCode || 'N/A',
          totalRooms: parseInt(rooms) || 0,
          occupiedRooms: 0,
          revenue: 0,
          contactPerson,
          contactPhone,
          assignedStaffIds: [],
          imageUrl
        };
        await db.saveProperty(newProp);
      }
      await fetchProperties();
      handleCloseAddModal();
    } catch (err: any) {
      console.error("Error saving property:", err);
      setFormError(err.message || "Failed to save property. Please try again.");
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">My Hostels</h1>
          <p className="text-slate-500 font-medium text-sm md:text-base">Manage all your physical properties here.</p>
        </div>
        {role === UserRole.OWNER && (
          <button 
            onClick={handleTryAdd}
            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-xl shadow-blue-100"
          >
            + Add New Property
          </button>
        )}
      </div>

      <UpgradeModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => {
          setShowUpgradeModal(false);
          onUpgrade();
        }}
        limitType="properties"
        limitValue={userPlan.properties || 0}
      />

      {properties.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] md:rounded-[2.5rem] p-10 md:p-20 text-center">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center text-slate-400 mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
           </div>
           <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">
             {role === UserRole.OWNER ? 'Setup Your First Property' : 'No Properties Found'}
           </h3>
           <p className="text-slate-500 max-w-xs mx-auto mb-8 text-sm font-medium">
             {role === UserRole.OWNER 
               ? 'Start managing your hostel rooms and residents efficiently.' 
               : "You haven't been assigned to any properties yet. Please contact the owner."}
           </p>
           {role === UserRole.OWNER && (
             <button 
               onClick={handleTryAdd}
               className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-xl shadow-blue-100"
             >
               + Add My First Property
             </button>
           )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {properties.map((p) => (
            <div key={p.id} className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
              <div className="h-40 md:h-44 bg-slate-50 flex items-center justify-center relative overflow-hidden">
                 {p.imageUrl ? (
                   <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                 ) : (
                   <svg className="w-12 h-12 md:w-16 md:h-16 text-slate-200 group-hover:scale-110 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                 )}
                 <div className="absolute top-4 right-4">
                    <span className="px-2.5 py-1 bg-white/80  text-blue-600 border border-blue-100 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm">
                      {p.type}
                    </span>
                 </div>
              </div>
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-xl font-black text-slate-900 leading-tight mb-1 truncate">{p.name}</h3>
                    <p className="text-[10px] md:text-sm font-medium text-slate-500 truncate">{p.city}, {p.address}</p>
                  </div>
                  {role === UserRole.OWNER && (
                    <div className="flex gap-2 ml-2">
                      <button 
                        onClick={() => handleEditProperty(p)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Property"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(p.id || (p as any)._id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Property"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}
                </div>

                {role === UserRole.OWNER && (
                  <button 
                    onClick={() => onManageRooms(p.id)}
                    className="w-full mb-6 md:mb-8 py-3 bg-blue-50 text-blue-700 font-black rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all text-[9px] md:text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    Add / View Rooms
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="bg-slate-50/50 p-3 md:p-4 rounded-2xl border border-slate-100">
                      <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase mb-1 tracking-tighter">Capacity</p>
                      <p className="text-base md:text-lg font-black text-slate-900">{p.totalRooms} Rms</p>
                    </div>
                    {role === UserRole.OWNER && (
                      <div className="bg-emerald-50/50 p-3 md:p-4 rounded-2xl border border-emerald-100">
                        <p className="text-[9px] md:text-[10px] text-emerald-400 font-black uppercase mb-1 tracking-tighter">Revenue</p>
                        <p className="text-base md:text-lg font-black text-emerald-600">{formatCurrency(p.revenue)}</p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={handleCloseAddModal}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[2rem] md:rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[95vh] border border-slate-100">
            <div className="p-6 md:p-10 pb-4 relative shrink-0">
              <button 
                onClick={handleCloseAddModal} 
                className="absolute top-6 md:top-10 right-6 md:right-10 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">
                {editingProperty ? 'Edit Property' : 'Add New Property'}
              </h2>
              <p className="text-slate-500 text-[10px] md:text-sm mt-1 font-medium italic">
                {editingProperty ? 'Update your hostel details' : 'Define your hostel or PG establishment'}
              </p>
            </div>

            <form onSubmit={handleAddProperty} className="p-6 md:p-10 pt-4 space-y-5 md:space-y-6 overflow-y-auto scrollbar-hide flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Property Name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="e.g., Sunrise PG" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                  <div className="relative">
                    <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold appearance-none pr-10">
                      <option value="Girls/Women">Girls/Women</option>
                      <option value="Boys">Boys</option>
                      <option value="Co-live">Co-live</option>
                    </select>
                    <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                <input required value={address} onChange={(e) => setAddress(e.target.value)} type="text" placeholder="Street address" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
              </div>

              {!isLiteView && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label>
                    <input required={!isLiteView} value={city} onChange={(e) => setCity(e.target.value)} type="text" placeholder="City" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State</label>
                    <input required={!isLiteView} value={state} onChange={(e) => setState(e.target.value)} type="text" placeholder="State" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                  </div>
                </div>
              )}

              {isLiteView && (
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label>
                  <input required value={city} onChange={(e) => setCity(e.target.value)} type="text" placeholder="City" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                {!isLiteView && (
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ZIP Code</label>
                    <input required={!isLiteView} value={zipCode} onChange={(e) => setZipCode(e.target.value)} type="text" placeholder="ZIP" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                  </div>
                )}
                <div className={`space-y-1.5 md:space-y-2 ${isLiteView ? 'sm:col-span-2' : ''}`}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Est. Rooms</label>
                  <input required value={rooms} onChange={(e) => setRooms(e.target.value)} type="number" placeholder="Count" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Person</label>
                  <input required value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} type="text" placeholder="Manager Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                  <input required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} type="tel" placeholder="Phone Number" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold" />
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hostel Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="hidden" 
                      id="hostel-image-upload" 
                    />
                    <label 
                      htmlFor="hostel-image-upload"
                      className="inline-block px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
                    >
                      {imageUrl ? 'Change Image' : 'Upload Image'}
                    </label>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1">JPG, PNG or WEBP. Max 1MB.</p>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold animate-shake">
                  {formError}
                </div>
              )}

              <div className="flex gap-4 pt-4 sticky bottom-0 bg-white pb-2">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={handleCloseAddModal}
                  className="flex-1 py-4 border border-slate-100 text-slate-400 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Cancel
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
                    editingProperty ? 'Update Property' : 'Confirm Property'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowDeleteConfirm(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl animate-in zoom-in duration-300 p-8 text-center border border-slate-100 max-h-[95vh] overflow-y-auto scrollbar-hide">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Delete Property?</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">This will permanently remove the property and all associated data (rooms, residents, payments). This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteProperty(showDeleteConfirm)}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Properties;
