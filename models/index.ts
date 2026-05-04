import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const schemaOptions = {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
};

const UserSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['SUPERADMIN', 'OWNER', 'STAFF', 'RESIDENT'], default: 'OWNER' },
  plan: { type: String, enum: ['TRIAL', 'STARTER', 'PRO', 'BUSINESS', 'SCALE', 'ENTERPRISE'], default: 'TRIAL' },
  trialEndsAt: { type: Date },
  ownerId: { type: String, ref: 'User' },
  propertyId: { type: String, ref: 'Property' },
  assignedPropertyIds: [{ type: String, ref: 'Property' }],
  canCollectCash: { type: Boolean, default: false },
  canPostAnnouncements: { type: Boolean, default: false },
  canAddExpenses: { type: Boolean, default: false },
  category: { type: String },
  upiId: { type: String },
  qrImageUrl: { type: String },
  smePayLink: { type: String },
  phonepeMerchantId: { type: String },
  phonepeClientId: { type: String },
  phonepeClientSecret: { type: String },
  razorpayKeyId: { type: String },
  razorpayKeySecret: { type: String },
  acceptedPaymentMethods: [{ type: String, default: ['Cash', 'PhonePe', 'Razorpay', 'UPI QR', 'SME Pay Link'] }],
  createdAt: { type: Date, default: Date.now }
}, schemaOptions);

UserSchema.pre('save', async function(this: any) {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = function(this: any, candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', UserSchema);

const PropertySchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String },
  zipCode: { type: String },
  address: { type: String, required: true },
  totalRooms: { type: Number, default: 0 },
  occupiedRooms: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  contactPerson: { type: String, required: true },
  contactPhone: { type: String, required: true },
  assignedStaffIds: [{ type: String, ref: 'User' }],
  imageUrl: { type: String }
}, schemaOptions);

export const Property = mongoose.model('Property', PropertySchema);

const UnitSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  propertyId: { type: String, ref: 'Property', required: true },
  propertyName: { type: String, required: true },
  roomNumber: { type: String, required: true },
  type: { type: String, required: true },
  capacity: { type: Number, required: true },
  currentOccupants: { type: Number, default: 0 },
  price: { type: Number, required: true },
  status: { type: String, enum: ['Vacant', 'Partially Occupied', 'Full', 'Maintenance'], default: 'Vacant' },
  floorNumber: { type: String, required: true },
  amenities: [String],
  notes: String
}, schemaOptions);

export const Unit = mongoose.model('Unit', UnitSchema);

const ResidentSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  name: { type: String, required: true },
  username: String,
  phone: { type: String, required: true },
  email: { type: String, required: true },
  dob: { type: String, required: true },
  permanentAddress: { type: String, required: true },
  unitId: { type: String, ref: 'Unit', required: true },
  propertyId: { type: String, ref: 'Property', required: true },
  roomNumber: { type: String, required: true },
  moveInDate: { type: String, required: true },
  dueDate: { type: Number, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  rent: { type: Number, required: true },
  balance: { type: Number, default: 0 },
  securityDeposit: { type: Number, default: 0 },
  returnableAmount: { type: Number, default: 0 },
  idProofType: { type: String, required: true },
  idNumber: { type: String, required: true },
  ledger: [{
    id: String,
    date: String,
    description: String,
    amount: Number,
    type: { type: String, enum: ['debit', 'credit'] },
    status: { type: String, enum: ['success', 'pending', 'failed'], default: 'success' }
  }],
  lastAlertMonth: String
}, schemaOptions);

export const Resident = mongoose.model('Resident', ResidentSchema);

const StaffSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  salary: { type: Number, required: true },
  category: { type: String, enum: ['Manager', 'Cooking', 'Cleaning', 'Security', 'Maintenance', 'Other'], default: 'Other' },
  assignedPropertyIds: [{ type: String, ref: 'Property' }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  canCollectCash: { type: Boolean, default: false },
  canPostAnnouncements: { type: Boolean, default: false },
  canAddExpenses: { type: Boolean, default: false }
}, schemaOptions);

export const Staff = mongoose.model('Staff', StaffSchema);

const ComplaintSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  residentId: { type: String, ref: 'Resident', required: true },
  residentName: { type: String, required: true },
  propertyId: { type: String, ref: 'Property', required: true },
  category: { type: String, required: true },
  priority: { type: String, required: true },
  status: { type: String, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
  date: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, schemaOptions);

export const Complaint = mongoose.model('Complaint', ComplaintSchema);

const ExpenseSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  propertyId: { type: String, ref: 'Property', required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  description: { type: String, required: true },
  recordedBy: { type: String, required: true }
}, schemaOptions);

export const Expense = mongoose.model('Expense', ExpenseSchema);
const PaymentSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  residentId: { type: String, ref: 'Resident', required: true },
  propertyId: { type: String, ref: 'Property', required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['SUCCESS', 'PENDING', 'FAILED'], default: 'SUCCESS' },
  transactionId: { type: String, required: true },
  paymentMethod: { type: String, default: 'Offline' },
  collectorId: { type: String },
  collectorName: { type: String }
}, schemaOptions);

export const Payment = mongoose.model('Payment', PaymentSchema);

const PendingPaymentSchema = new mongoose.Schema({
  otp: { type: String, required: true },
  ownerId: { type: String, required: true },
  residentId: { type: String, required: true },
  propertyId: { type: String, required: true },
  amount: { type: Number, required: true },
  collectorId: { type: String, required: true },
  collectorName: { type: String, required: true },
  initiatorId: { type: String, required: true },
  initiatorRole: { type: String, enum: ['OWNER', 'STAFF', 'RESIDENT'], required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 } // Expire after 1 minute
}, schemaOptions);

export const PendingPayment = mongoose.model('PendingPayment', PendingPaymentSchema);

const HostelUpdateSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  propertyId: { type: String, required: true }, // 'all' or specific propertyId
  title: { type: String, required: true },
  content: { type: String, required: true },
  date: { type: String, required: true },
  authorName: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  createdAt: { type: Date, default: Date.now }
}, schemaOptions);

export const HostelUpdate = mongoose.model('HostelUpdate', HostelUpdateSchema);

const InventoryItemSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  ownerId: { type: String, ref: 'User', required: true },
  propertyId: { type: String, ref: 'Property', required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, required: true },
  status: { type: String, enum: ['In Stock', 'Low Stock', 'Out of Stock'], default: 'In Stock' },
  lastUpdated: { type: Date, default: Date.now }
}, schemaOptions);

export const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);

const MealPlanSchema = new mongoose.Schema({
  ownerId: { type: String, ref: 'User', required: true },
  propertyId: { type: String, required: true }, // 'all' or specific propertyId
  day: { type: String, required: true }, // 'Monday', 'Tuesday', etc.
  breakfast: { type: String, default: '' },
  breakfastStart: { type: String, default: '' },
  breakfastEnd: { type: String, default: '' },
  lunch: { type: String, default: '' },
  lunchStart: { type: String, default: '' },
  lunchEnd: { type: String, default: '' },
  snacks: { type: String, default: '' },
  snacksStart: { type: String, default: '' },
  snacksEnd: { type: String, default: '' },
  dinner: { type: String, default: '' },
  dinnerStart: { type: String, default: '' },
  dinnerEnd: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, schemaOptions);

// Compound index to ensure uniqueness per property per day
MealPlanSchema.index({ propertyId: 1, day: 1 }, { unique: true });

export const MealPlan = mongoose.model('MealPlan', MealPlanSchema);

const PlanConfigSchema = new mongoose.Schema({
  tier: { type: String, unique: true, required: true },
  allowedPaymentMethods: [String],
}, schemaOptions);

export const PlanConfig = mongoose.model('PlanConfig', PlanConfigSchema);
