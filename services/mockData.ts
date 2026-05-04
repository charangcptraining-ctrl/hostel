
import { Property, Resident, Complaint, Staff, SubscriptionTier, Unit, UserRole, RoomStatus } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function handleResponse(res: Response) {
  if (!res.ok) {
    let errorMessage = `HTTP error! status: ${res.status}`;
    const text = await res.text().catch(() => '');
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.details || errorData.error || errorMessage;
    } catch (e) {
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return null;
}

function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Simulated Database replaced with real API calls
export const db = {
  getUsers: async () => {
    const res = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
  getUser: async (id: string) => {
    const res = await fetch(`${API_BASE}/users/${id}`);
    return handleResponse(res);
  },
  login: async (credentials: any) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await handleResponse(res);
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }
    return data;
  },
  saveUser: async (user: any) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return handleResponse(res);
  },
  isUsernameTaken: async (username: string) => {
    const users = await db.getUsers();
    return users.some((u: any) => u.username.toLowerCase() === username.toLowerCase());
  },
  isEmailRegisteredAsUser: async (email: string) => {
    const users = await db.getUsers();
    return users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
  },
  updateUserPlan: async (userId: string, plan: SubscriptionTier) => {
    const res = await fetch(`${API_BASE}/users/${userId}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    return handleResponse(res);
  },
  toggleLiteHost: async (userId: string, isBasicHost: boolean) => {
    const res = await fetch(`${API_BASE}/users/${userId}/lite-edition`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBasicHost }),
    });
    return handleResponse(res);
  },
  updateUserPassword: async (userId: string, password: string) => {
    const res = await fetch(`${API_BASE}/users/${userId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return handleResponse(res);
  },
  updateUserProfile: async (userId: string, profileData: any) => {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    return handleResponse(res);
  },
  
  getProperties: async (ownerId?: string) => {
    const url = ownerId ? `${API_BASE}/properties?ownerId=${ownerId}` : `${API_BASE}/properties`;
    const res = await fetch(url);
    return handleResponse(res);
  },
  saveProperty: async (prop: Property) => {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prop),
    });
    return handleResponse(res);
  },
  updateProperty: async (prop: Property) => {
    const res = await fetch(`${API_BASE}/properties/${prop.id || (prop as any)._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prop),
    });
    return handleResponse(res);
  },
  deleteProperty: async (id: string) => {
    const res = await fetch(`${API_BASE}/properties/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  getUnits: async (ownerId?: string) => {
    const url = ownerId ? `${API_BASE}/units?ownerId=${ownerId}` : `${API_BASE}/units`;
    const res = await fetch(url);
    return handleResponse(res);
  },
  saveUnit: async (unit: Unit) => {
    const res = await fetch(`${API_BASE}/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unit),
    });
    return handleResponse(res);
  },
  updateUnit: async (unit: Unit) => {
    const res = await fetch(`${API_BASE}/units/${unit.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unit),
    });
    return handleResponse(res);
  },
  deleteUnit: async (id: string) => {
    const res = await fetch(`${API_BASE}/units/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  getResidents: async (ownerId?: string) => {
    const url = ownerId ? `${API_BASE}/residents?ownerId=${ownerId}` : `${API_BASE}/residents`;
    const res = await fetch(url);
    return handleResponse(res);
  },
  getUpcomingDues: async (ownerId: string) => {
    const residents = await db.getResidents(ownerId);
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    return residents.filter((res: Resident) => {
      let diff = res.dueDate - currentDay;
      if (diff < 0) {
        diff = (daysInMonth - currentDay) + res.dueDate;
      }
      return diff >= 0 && diff <= 3;
    });
  },
  getOverduePayments: async (ownerId: string) => {
    const [residents, payments] = await Promise.all([
      db.getResidents(ownerId),
      db.getPayments({ ownerId })
    ]);
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return residents.filter((res: Resident) => {
      const isPaid = payments.some((p: any) => {
        const pDate = new Date(p.date);
        return p.residentId === res.id && 
               pDate.getMonth() === currentMonth && 
               pDate.getFullYear() === currentYear &&
               p.status === 'SUCCESS';
      });
      return !isPaid && currentDay > res.dueDate;
    }).map((res: Resident) => {
      const daysPassed = currentDay - res.dueDate;
      return { ...res, daysPassed };
    });
  },
  saveResident: async (resData: Resident) => {
    const res = await fetch(`${API_BASE}/residents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resData),
    });
    return handleResponse(res);
  },
  updateResident: async (resData: Resident) => {
    const res = await fetch(`${API_BASE}/residents/${resData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resData),
    });
    return handleResponse(res);
  },
  deleteResident: async (id: string) => {
    const res = await fetch(`${API_BASE}/residents/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  getStaff: async (ownerId?: string) => {
    const url = ownerId ? `${API_BASE}/staff?ownerId=${ownerId}` : `${API_BASE}/staff`;
    const res = await fetch(url);
    return handleResponse(res);
  },
  saveStaff: async (s: Staff) => {
    const res = await fetch(`${API_BASE}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    return handleResponse(res);
  },
  updateStaff: async (s: Staff) => {
    const res = await fetch(`${API_BASE}/staff/${s.id || (s as any)._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    return handleResponse(res);
  },
  deleteStaff: async (id: string) => {
    const res = await fetch(`${API_BASE}/staff/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  getComplaints: async (ownerId?: string) => {
    const url = ownerId ? `${API_BASE}/complaints?ownerId=${ownerId}` : `${API_BASE}/complaints`;
    const res = await fetch(url);
    return handleResponse(res);
  },
  saveComplaint: async (c: Complaint) => {
    const res = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    return handleResponse(res);
  },
  updateComplaint: async (c: Complaint) => {
    const res = await fetch(`${API_BASE}/complaints/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    return handleResponse(res);
  },

  getExpenses: async (ownerId?: string) => {
    const url = ownerId ? `${API_BASE}/expenses?ownerId=${ownerId}` : `${API_BASE}/expenses`;
    const res = await fetch(url);
    return handleResponse(res);
  },
  saveExpense: async (expense: any) => {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense),
    });
    return handleResponse(res);
  },
  updateExpense: async (expense: any) => {
    const res = await fetch(`${API_BASE}/expenses/${expense.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense),
    });
    return handleResponse(res);
  },
  deleteExpense: async (id: string) => {
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
  
  getPayments: async (params: { ownerId?: string, residentId?: string, propertyId?: string }) => {
    const query = new URLSearchParams();
    if (params.ownerId) query.append('ownerId', params.ownerId);
    if (params.residentId) query.append('residentId', params.residentId);
    if (params.propertyId) query.append('propertyId', params.propertyId);
    const res = await fetch(`${API_BASE}/payments?${query.toString()}`);
    return handleResponse(res);
  },
  savePayment: async (payment: any) => {
    const res = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    return handleResponse(res);
  },
  directPayment: async (data: any) => {
    const res = await fetch(`${API_BASE}/payments/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  createPendingPayment: async (data: any) => {
    const res = await fetch(`${API_BASE}/payments/pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  getPendingPaymentsForResident: async (residentId: string) => {
    const res = await fetch(`${API_BASE}/payments/pending/resident/${residentId}`);
    return handleResponse(res);
  },
  getPendingPaymentsForCollector: async (collectorId: string) => {
    const res = await fetch(`${API_BASE}/payments/pending/collector/${collectorId}`);
    return handleResponse(res);
  },
  verifyOtpAndPay: async (data: { residentId: string, otp: string }) => {
    const res = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  
  getUpdates: async (params: { ownerId?: string, propertyId?: string }) => {
    const query = new URLSearchParams();
    if (params.ownerId) query.append('ownerId', params.ownerId);
    if (params.propertyId) query.append('propertyId', params.propertyId);
    const res = await fetch(`${API_BASE}/updates?${query.toString()}`);
    return handleResponse(res);
  },
  saveUpdate: async (update: any) => {
    const res = await fetch(`${API_BASE}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return handleResponse(res);
  },
  deleteUpdate: async (id: string) => {
    const res = await fetch(`${API_BASE}/updates/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
  updateUpdate: async (update: any) => {
    const res = await fetch(`${API_BASE}/updates/${update.id || update._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return handleResponse(res);
  },

  getInventory: async (ownerId?: string, propertyId?: string) => {
    const query = new URLSearchParams();
    if (ownerId) query.append('ownerId', ownerId);
    if (propertyId) query.append('propertyId', propertyId);
    const res = await fetch(`${API_BASE}/inventory?${query.toString()}`);
    return handleResponse(res);
  },
  saveInventoryItem: async (item: any) => {
    const res = await fetch(`${API_BASE}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse(res);
  },
  updateInventoryItem: async (item: any) => {
    const res = await fetch(`${API_BASE}/inventory/${item.id || item._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse(res);
  },
  deleteInventoryItem: async (id: string) => {
    const res = await fetch(`${API_BASE}/inventory/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
  getMealPlans: async (ownerId: string, propertyId?: string) => {
    const url = propertyId 
      ? `${API_BASE}/meal-plans?ownerId=${ownerId}&propertyId=${propertyId}`
      : `${API_BASE}/meal-plans?ownerId=${ownerId}`;
    const res = await fetch(url);
    return handleResponse(res);
  },
  updateMealPlan: async (plan: any) => {
    const res = await fetch(`${API_BASE}/meal-plans`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    return handleResponse(res);
  },
  createPhonePeOrder: async (data: { amount: number, residentId: string, propertyId: string, ownerId: string }) => {
    const res = await fetch(`${API_BASE}/phonepe/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  getPlanConfigs: async () => {
    const res = await fetch(`${API_BASE}/plan-configs`);
    return handleResponse(res);
  },
  updatePlanConfig: async (tier: string, allowedPaymentMethods: string[]) => {
    const res = await fetch(`${API_BASE}/plan-configs/${tier}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedPaymentMethods }),
    });
    return handleResponse(res);
  },

  // SEEDING LOGIC (Empty now as per user request to remove demo data)
  seed: () => {
    console.log('Real backend connected. Demo data seeding skipped.');
  }
};
