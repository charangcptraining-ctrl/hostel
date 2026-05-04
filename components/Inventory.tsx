
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockData';
import { InventoryItem, Property } from '../types';
import { Icons, COLORS } from '../constants';

interface InventoryProps {
  ownerId: string;
  propertyId?: string;
  assignedPropertyIds?: string[];
}

const CATEGORIES = [
  'Vegetables',
  'Groceries',
  'Dairy',
  'Cleaning Supplies',
  'Toiletries',
  'Bedding & Linen',
  'Maintenance',
  'Kitchen Equipment',
  'Safety & First Aid',
  'Transport',
  'Other'
];

const Inventory: React.FC<InventoryProps> = ({ ownerId, propertyId, assignedPropertyIds }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'Groceries',
    quantity: 0,
    unit: 'Units',
    status: 'In Stock' as const,
    propertyId: '',
  });

  useEffect(() => {
    fetchData();
  }, [ownerId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allProps, allItems] = await Promise.all([
        db.getProperties(ownerId),
        db.getInventory(ownerId)
      ]);
      
      const filteredProps = assignedPropertyIds 
        ? allProps.filter((p: Property) => assignedPropertyIds.includes(p.id))
        : allProps;
        
      setProperties(filteredProps);
      setItems(allItems);
      
      if (propertyId) {
        setSelectedPropId(propertyId);
      } else if (filteredProps.length > 0) {
        setSelectedPropId('all');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    selectedPropId === 'all' || item.propertyId === selectedPropId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await db.updateInventoryItem({ ...editingItem, ...formData });
      } else {
        await db.saveInventoryItem({
          ...formData,
          ownerId,
          id: `inv_${Date.now()}`,
          lastUpdated: new Date().toISOString()
        });
      }
      setShowModal(false);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const deleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await db.deleteInventoryItem(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: 'Groceries',
      quantity: 0,
      unit: 'kg',
      status: 'In Stock',
      propertyId: propertyId || (properties.length > 0 ? properties[0].id : ''),
    });
    setShowModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status,
      propertyId: item.propertyId,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Inventory Management</h1>
          <p className="text-slate-500 font-medium">Track your hostel supplies and stock levels</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-100"
        >
          <Icons.Plus /> Add Inventory Item
        </button>
      </div>

      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedPropId('all')}
            className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
              selectedPropId === 'all' 
                ? 'bg-slate-900 text-white shadow-lg' 
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            All Properties
          </button>
          {properties.map(prop => (
            <button
              key={prop.id}
              onClick={() => setSelectedPropId(prop.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                selectedPropId === prop.id 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {prop.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mb-4"></div>
            <p className="text-[10px] font-black uppercase tracking-widest">Scanning Inventory...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center max-w-xs mx-auto">
            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
              <Icons.Inventory size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Inventory Items</h3>
            <p className="text-slate-400 text-sm font-medium mt-1">Start tracking your supplies by adding your first item.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-serif">Item Details</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-serif">Category</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-serif">Quantity</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-serif">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-serif">Property</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-serif text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map(item => (
                  <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Updated: {new Date(item.lastUpdated).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-sm font-bold text-slate-700">{item.quantity} <span className="text-slate-400 font-medium">{item.unit}</span></p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                        item.status === 'In Stock' ? 'bg-emerald-50 text-emerald-600' :
                        item.status === 'Low Stock' ? 'bg-amber-50 text-amber-600' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-600">
                        {properties.find(p => p.id === item.propertyId)?.name || 'Unknown'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                       <button 
                        onClick={() => openEditModal(item)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                       >
                         <Icons.Edit size={16} />
                       </button>
                       <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                       >
                         <Icons.Delete size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 " onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white rounded-[32px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[95vh] scrollbar-hide">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {editingItem ? 'Edit Item' : 'New Inventory Item'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <Icons.Close />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Item Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Basmati Rice, Detergent"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-blue-600 outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none appearance-none"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Property</label>
                    <select
                      required
                      value={formData.propertyId}
                      onChange={e => setFormData({...formData, propertyId: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none appearance-none"
                    >
                      <option value="">Select Property</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Quantity</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.quantity}
                      onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Unit</label>
                    <input
                      type="text"
                      required
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      placeholder="e.g. kg, Ltr, Units"
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Status</label>
                  <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl">
                    {(['In Stock', 'Low Stock', 'Out of Stock'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({...formData, status: s})}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          formData.status === s 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                  >
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
