
export const UserRole = {
  SUPERADMIN: 'SUPERADMIN',
  OWNER: 'OWNER',
  STAFF: 'STAFF',
  RESIDENT: 'RESIDENT'
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const SubscriptionTier = {
  FREE: 'FREE',
  TRIAL: 'TRIAL',
  LITE: 'LITE',
  BASIC: 'BASIC',
  PRO: 'PRO',
  BUSINESS: 'BUSINESS',
  CUSTOM: 'CUSTOM'
} as const;

export type SubscriptionTier = typeof SubscriptionTier[keyof typeof SubscriptionTier];

export interface PlanLimit {
  properties: number | null;
  staff: number | null;
  residents: number | null;
  price: number;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimit> = {
  [SubscriptionTier.FREE]: { properties: 1, staff: 0, residents: 10, price: 0 },
  [SubscriptionTier.TRIAL]: { properties: 3, staff: 10, residents: 150, price: 0 },
  [SubscriptionTier.LITE]: { properties: 1, staff: 0, residents: 20, price: 149 },
  [SubscriptionTier.BASIC]: { properties: 2, staff: 8, residents: 99, price: 699 },
  [SubscriptionTier.PRO]: { properties: 4, staff: 20, residents: 150, price: 999 },
  [SubscriptionTier.BUSINESS]: { properties: null, staff: 50, residents: 300, price: 2499 },
  [SubscriptionTier.CUSTOM]: { properties: null, staff: null, residents: null, price: 0 }
};

export const getTierValue = (tier: SubscriptionTier): number => {
  const values: Record<SubscriptionTier, number> = {
    [SubscriptionTier.FREE]: 0,
    [SubscriptionTier.LITE]: 1,
    [SubscriptionTier.BASIC]: 2, // Old PRO
    [SubscriptionTier.TRIAL]: 3, // Trial now gives New PRO level access (Old BUSINESS)
    [SubscriptionTier.PRO]: 3,    // Old BUSINESS
    [SubscriptionTier.BUSINESS]: 4, // Old SCALE
    [SubscriptionTier.CUSTOM]: 5    // Old ENTERPRISE
  };
  return values[tier] || 0;
};

export const RoomStatus = {
  VACANT: 'Vacant',
  PARTIAL: 'Partially Occupied',
  FULL: 'Full',
  MAINTENANCE: 'Maintenance'
} as const;

export type RoomStatus = typeof RoomStatus[keyof typeof RoomStatus];

export const ComplaintStatus = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved'
} as const;

export type ComplaintStatus = typeof ComplaintStatus[keyof typeof ComplaintStatus];

export type AlertChannel = 'APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';

export const StaffCategory = {
  MANAGER: 'Manager',
  COOKING: 'Cooking',
  CLEANING: 'Cleaning',
  SECURITY: 'Security',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other'
} as const;

export type StaffCategory = typeof StaffCategory[keyof typeof StaffCategory];

export const PLAN_ALERTS: Record<SubscriptionTier, AlertChannel[]> = {
  [SubscriptionTier.FREE]: [],
  [SubscriptionTier.LITE]: ['APP'],
  [SubscriptionTier.BASIC]: ['APP', 'EMAIL'],
  [SubscriptionTier.TRIAL]: ['APP', 'EMAIL', 'SMS', 'WHATSAPP'],
  [SubscriptionTier.PRO]: ['APP', 'EMAIL', 'SMS'],
  [SubscriptionTier.BUSINESS]: ['APP', 'EMAIL', 'SMS', 'WHATSAPP'],
  [SubscriptionTier.CUSTOM]: ['APP', 'EMAIL', 'SMS', 'WHATSAPP']
};

export const PLAN_PAYMENT_METHODS: Record<SubscriptionTier, string[]> = {
  [SubscriptionTier.FREE]: ['Cash'],
  [SubscriptionTier.LITE]: ['Cash', 'UPI QR'],
  [SubscriptionTier.BASIC]: ['Cash', 'UPI QR', 'PhonePe', 'Razorpay', 'SME Pay Link'],
  [SubscriptionTier.TRIAL]: ['Cash', 'UPI QR', 'SME Pay Link', 'PhonePe', 'Razorpay'],
  [SubscriptionTier.PRO]: ['Cash', 'UPI QR', 'SME Pay Link', 'PhonePe', 'Razorpay'],
  [SubscriptionTier.BUSINESS]: ['Cash', 'UPI QR', 'SME Pay Link', 'PhonePe', 'Razorpay'],
  [SubscriptionTier.CUSTOM]: ['Cash', 'UPI QR', 'SME Pay Link', 'PhonePe', 'Razorpay']
};

export const isPaymentMethodAllowed = (tier: SubscriptionTier, method: string): boolean => {
  return PLAN_PAYMENT_METHODS[tier]?.includes(method) || false;
};

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  plan: SubscriptionTier;
  createdAt: string;
  ownerId?: string; // For Staff and Residents
  propertyId?: string; // For Residents
  assignedPropertyIds?: string[]; // For Staff
  canCollectCash?: boolean; // For Staff
  canPostAnnouncements?: boolean; // For Staff
  canAddExpenses?: boolean; // For Staff
  isBasicHost?: boolean; // New: Simplified Dashboard Mode
  trialEndsAt?: string; // New: Trial expiration date
  upiId?: string; // New: For direct UPI payments
  qrImageUrl?: string; // New: For direct QR payments
  smePayLink?: string; // New: For SMEPay integration
  phonepeMerchantId?: string; // New: PhonePe Business
  phonepeClientId?: string; // New: PhonePe Business
  phonepeClientSecret?: string; // New: PhonePe Business
  razorpayKeyId?: string; // New: Razorpay Integration
  razorpayKeySecret?: string; // New: Razorpay Integration
  acceptedPaymentMethods?: string[]; // New: List of accepted payment methods
}

export interface Property {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  city: string;
  state?: string;
  zipCode?: string;
  address: string;
  totalRooms: number;
  occupiedRooms: number;
  revenue: number;
  contactPerson: string;
  contactPhone: string;
  assignedStaffIds: string[];
  imageUrl?: string;
}

export interface Unit {
  id: string;
  ownerId: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  type: string;
  capacity: number;
  currentOccupants: number;
  price: number;
  status: RoomStatus;
  floorNumber: string;
  amenities: string[];
  tenantName?: string;
  notes?: string;
}

export interface Resident {
  id: string;
  ownerId: string;
  name: string;
  username?: string;
  phone: string;
  email: string;
  dob: string;
  permanentAddress: string;
  unitId: string;
  propertyId: string;
  roomNumber: string;
  moveInDate: string;
  dueDate: number;
  status: 'active' | 'inactive';
  rent: number;
  balance?: number;
  idProofType: string;
  idNumber: string;
  securityDeposit: number;
  returnableAmount?: number;
  ledger?: LedgerEntry[];
  lastAlertMonth?: string; // Format: YYYY-MM
  lastUpdateSeen?: string; // ID of the last seen update
}

export interface HostelUpdate {
  id: string;
  ownerId: string;
  propertyId: string; // 'all' or specific propertyId
  title: string;
  content: string;
  date: string;
  authorName: string;
  priority: 'low' | 'medium' | 'high';
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  status: 'paid' | 'pending';
}

export interface Payment {
  id: string;
  ownerId: string;
  residentId: string;
  propertyId: string;
  amount: number;
  date: string;
  description: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  transactionId: string;
  paymentMethod: string;
  collectorId?: string;
  collectorName?: string;
}

export interface Expense {
  id: string;
  ownerId: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  recordedBy: string;
}

export interface Staff {
  id: string;
  ownerId: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  dob?: string;
  salary: number;
  category: StaffCategory;
  assignedPropertyIds: string[];
  status: 'active' | 'inactive';
  canCollectCash?: boolean;
  canPostAnnouncements?: boolean;
  canAddExpenses?: boolean;
}

export interface Complaint {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  residentId?: string;
  residentName?: string;
  staffId?: string;
  staffName?: string;
  targetType: 'RESIDENT' | 'STAFF' | 'PROPERTY';
  targetId?: string;
  propertyId: string;
  category: string;
  priority: string;
  status: ComplaintStatus;
  date: string;
  createdAt: string;
  createdBy: UserRole;
  creatorId: string;
}

export interface InventoryItem {
  id: string;
  ownerId: string;
  propertyId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  lastUpdated: string;
}

export interface MealPlan {
  id: string;
  ownerId: string;
  propertyId: string;
  day: string;
  breakfast: string;
  breakfastStart?: string;
  breakfastEnd?: string;
  lunch: string;
  lunchStart?: string;
  lunchEnd?: string;
  snacks: string;
  snacksStart?: string;
  snacksEnd?: string;
  dinner: string;
  dinnerStart?: string;
  dinnerEnd?: string;
  updatedAt: string;
}
