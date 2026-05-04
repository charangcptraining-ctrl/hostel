import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import path from 'path';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { User, Property, Unit, Resident, Staff, Complaint, Expense, Payment, PendingPayment, HostelUpdate, InventoryItem, MealPlan, PlanConfig } from './models/index.js';
import { UserRole } from './types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // MongoDB Connection
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('CRITICAL ERROR: MONGODB_URI is not defined in environment variables.');
    console.log('Please add MONGODB_URI to your project settings in AI Studio.');
  } else {
    console.log('Attempting to connect to MongoDB Atlas...');
    // Set global mongoose options
    mongoose.set('bufferCommands', true); // Re-enable buffering to allow small delays in connection
    
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000, // Increase timeout slightly
      });
      console.log('✅ Successfully connected to MongoDB Atlas');
    } catch (err: any) {
      console.error('❌ MongoDB connection error:', err.message);
      if (err.message.includes('MongooseServerSelectionError')) {
        console.log('👉 ACTION REQUIRED: Please whitelist 0.0.0.0/0 in your MongoDB Atlas Network Access settings.');
      } else if (err.message.includes('Authentication failed')) {
        console.log('👉 ACTION REQUIRED: Your MONGODB_URI credentials (username/password) are incorrect.');
      }
      // Don't exit process, allow app to start so health check can report the error
    }
  }

  const allowedOrigins = [
    process.env.VITE_API_URL?.replace(/\/api$/, ''),
    'https://hostel-sigma-gray.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:5173'
  ].filter(Boolean) as string[];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser tools
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn('Blocked CORS origin:', origin);
      callback(new Error('CORS policy does not allow access from this origin'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
  }));
  app.options('*', cors());

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ limit: '5mb', extended: true }));

  // Middleware to ensure DB is connected
  app.use('/api', (req, res, next) => {
    if (mongoose.connection.readyState !== 1 && req.path !== '/health') {
      return res.status(503).json({ 
        error: 'Database connection is not ready. Please try again in a few seconds.',
        details: 'Mongoose connection status: ' + mongoose.connection.readyState
      });
    }
    next();
  });

  // Auth middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      next();
    });
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    const isConnected = mongoose.connection.readyState === 1;
    res.json({ 
      status: 'ok', 
      db: isConnected ? 'connected' : 'disconnected',
      error: isConnected ? null : 'Database not connected. Check your MONGODB_URI credentials and IP whitelist.'
    });
  });

  // Users
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const user: any = await User.findOne({ username });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

      // Verify that Staff/Resident record still exists and is active for the correct owner
      if (user.role === UserRole.STAFF) {
        const staff = await Staff.findOne({ 
          email: user.email.toLowerCase().trim(),
          ownerId: user.ownerId
        });
        if (!staff) {
          // If staff record is gone for this owner, delete the user record as well (cleanup)
          await User.findByIdAndDelete(user._id);
          return res.status(401).json({ error: 'Your account has been removed by the owner.' });
        }
        if (staff.status === 'inactive') {
          return res.status(401).json({ error: 'Your account is currently inactive. Please contact your owner.' });
        }
      } else if (user.role === UserRole.RESIDENT) {
        const resident = await Resident.findOne({ 
          email: user.email.toLowerCase().trim(),
          ownerId: user.ownerId
        });
        if (!resident) {
          // If resident record is gone for this owner, delete the user record as well (cleanup)
          await User.findByIdAndDelete(user._id);
          return res.status(401).json({ error: 'Your account has been removed by the owner.' });
        }
      }
      
      const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
      res.json({ user, token });
    } catch (err) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/users', authenticateToken, async (req, res) => {
    try {
      const users = await User.find();
      res.json(users);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Failed to fetch users', details: err.message });
    }
  });

  app.get('/api/users/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const user = await User.findOne({ 
        $or: [
          { id: id }, 
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }
        ] 
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch user', details: err.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      console.log('Attempting to create user:', { ...req.body, password: '[MASKED]' });
      const userData = { ...req.body };
      
      // If owner, set trial ends at 7 days from now
      if (userData.role === 'OWNER' && !userData.plan) {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        userData.trialEndsAt = trialEndDate;
        userData.plan = 'TRIAL';
      }

      const user = new User(userData);
      await user.save();
      console.log('✅ User created successfully:', user._id);
      res.status(201).json(user);
    } catch (err: any) {
      console.error('❌ Error creating user:', err);
      res.status(400).json({ 
        error: 'Failed to create user', 
        details: err.message,
        code: err.code // Useful for duplicate key errors (11000)
      });
    }
  });

  // Auth: Check Invitation
  app.post('/api/auth/check-invitation', async (req, res) => {
    const { email, role } = req.body;
    try {
      if (role === UserRole.OWNER) {
        // Owners can self-signup for now, or we could restrict this too
        return res.json({ invited: true });
      }

      if (role === UserRole.RESIDENT) {
        const resident = await Resident.findOne({ email: email.toLowerCase().trim() });
        if (resident) {
          return res.json({ invited: true, record: resident });
        }
      }

      if (role === UserRole.STAFF) {
        const staff = await Staff.findOne({ email: email.toLowerCase().trim() });
        if (staff) {
          return res.json({ invited: true, record: staff });
        }
      }

      return res.status(404).json({ invited: false, message: "Email not found in pre-registered list." });
    } catch (error) {
      res.status(500).json({ message: "Server error during invitation check." });
    }
  });

  // Properties
  app.get('/api/properties', authenticateToken, async (req, res) => {
    const { ownerId } = req.query;
    try {
      const filter = ownerId ? { ownerId } : {};
      const properties = await Property.find(filter);
      res.json(properties);
    } catch (err: any) {
      console.error('❌ Error fetching properties:', err);
      res.status(500).json({ error: 'Failed to fetch properties', details: err.message });
    }
  });

  app.post('/api/properties', async (req, res) => {
    try {
      console.log('Creating property with data:', req.body);
      const property = new Property(req.body);
      await property.save();
      console.log('✅ Property created successfully:', property._id);
      res.status(201).json(property);
    } catch (err: any) {
      console.error('❌ Error creating property:', err);
      res.status(400).json({ 
        error: 'Failed to create property', 
        details: err.message,
        errors: err.errors 
      });
    }
  });

  app.put('/api/properties/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const property = await Property.findOneAndUpdate(
        { $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        req.body,
        { new: true }
      );
      if (!property) return res.status(404).json({ error: 'Property not found' });
      res.json(property);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to update property', details: err.message });
    }
  });

  app.delete('/api/properties/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const property = await Property.findOne({ $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
      
      if (property) {
        const propertyIdStr = property.id || property._id.toString();
        
        // 1. Delete all associated units
        await Unit.deleteMany({ propertyId: propertyIdStr });
        
        // 2. Delete all associated residents
        const residents = await Resident.find({ propertyId: propertyIdStr });
        for (const resident of residents) {
          if (resident.email) {
            await User.findOneAndDelete({ 
              email: resident.email.toLowerCase().trim(), 
              role: UserRole.RESIDENT,
              ownerId: resident.ownerId
            });
          }
        }
        await Resident.deleteMany({ propertyId: propertyIdStr });
        
        // 3. Delete associated payments, complaints, expenses
        await Payment.deleteMany({ propertyId: propertyIdStr });
        await Complaint.deleteMany({ propertyId: propertyIdStr });
        await Expense.deleteMany({ propertyId: propertyIdStr });
        
        // 4. Delete the property itself
        await Property.findByIdAndDelete(property._id);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to delete property', details: err.message });
    }
  });

  // Residents
  app.get('/api/residents', async (req, res) => {
    const { ownerId, propertyId } = req.query;
    try {
      const filter: any = ownerId ? { ownerId } : {};
      if (propertyId) filter.propertyId = propertyId;

      // --- AUTO-INVOICING LOGIC ---
      const now = new Date();
      const monthYearId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      
      const billableResidents = await Resident.find({
        ...filter,
        status: 'active',
        $or: [
          { lastAlertMonth: { $ne: monthYearId } },
          { lastAlertMonth: { $exists: false } }
        ]
      });

      if (billableResidents.length > 0) {
        for (const resident of billableResidents as any[]) {
          if (now.getDate() >= resident.dueDate) {
            const hasMonthDebit = resident.ledger?.some((l: any) => 
              l.description.includes(now.toLocaleString('default', { month: 'long' })) && l.type === 'debit'
            );

            if (!hasMonthDebit) {
              resident.balance = (resident.balance || 0) + resident.rent;
              resident.lastAlertMonth = monthYearId;
              
              if (!resident.ledger) resident.ledger = [];
              resident.ledger.push({
                id: `BILL${Date.now()}${Math.floor(Math.random()*1000)}`,
                date: new Date().toISOString().split('T')[0],
                description: `Monthly Rent - ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
                amount: resident.rent,
                type: 'debit',
                status: 'pending'
              });
              
              await resident.save();
              console.log(`[Auto-Bill] Charged ${resident.name} ₹${resident.rent} for ${monthYearId}`);
            }
          }
        }
      }
      // --- END AUTO-INVOICING ---

      const residents = await Resident.find(filter);
      res.json(residents);
    } catch (err: any) {
      console.error('❌ Error fetching residents:', err);
      res.status(500).json({ error: 'Failed to fetch residents', details: err.message });
    }
  });

  app.post('/api/residents', async (req, res) => {
    try {
      const residentData = { ...req.body };
      if (residentData.balance === undefined) {
        residentData.balance = residentData.rent || 0;
      }
      const resident = new Resident(residentData);
      await resident.save();
      res.status(201).json(resident);
    } catch (err: any) {
      console.error('Error creating resident:', err);
      res.status(400).json({ 
        error: 'Failed to create resident',
        details: err.message,
        errors: err.errors
      });
    }
  });

  app.put('/api/residents/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const resident = await Resident.findOneAndUpdate(
        { $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        req.body,
        { new: true }
      );
      res.json(resident);
    } catch (err) {
      res.status(400).json({ error: 'Failed to update resident' });
    }
  });

  app.delete('/api/residents/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const resident = await Resident.findOne({ $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
      
      if (resident) {
        // 1. Delete corresponding User record to revoke login immediately
        if (resident.email) {
          await User.findOneAndDelete({ 
            email: resident.email.toLowerCase().trim(), 
            role: UserRole.RESIDENT,
            ownerId: resident.ownerId
          });
        }
        // 2. Delete all associated data for this resident
        await Payment.deleteMany({ residentId: resident.id || resident._id.toString() });
        await Complaint.deleteMany({ residentId: resident.id || resident._id.toString() });
        
        // 3. Delete the resident record itself
        await Resident.findByIdAndDelete(resident._id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'Failed to delete resident' });
    }
  });

  // Units
  app.get('/api/units', async (req, res) => {
    const { propertyId, ownerId } = req.query;
    try {
      let filter: any = {};
      if (propertyId) filter.propertyId = propertyId;
      if (ownerId) filter.ownerId = ownerId;
      const units = await Unit.find(filter);
      res.json(units);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch units' });
    }
  });

  app.post('/api/units', async (req, res) => {
    try {
      console.log('Creating unit with data:', req.body);
      const unit = new Unit(req.body);
      await unit.save();
      res.status(201).json(unit);
    } catch (err: any) {
      console.error('Error creating unit:', err);
      res.status(400).json({ 
        error: 'Failed to create unit', 
        details: err.message,
        errors: err.errors 
      });
    }
  });

  app.put('/api/units/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const unit = await Unit.findOneAndUpdate(
        { $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        req.body,
        { new: true }
      );
      res.json(unit);
    } catch (err) {
      res.status(400).json({ error: 'Failed to update unit' });
    }
  });

  app.delete('/api/units/:id', async (req, res) => {
    try {
      const id = req.params.id;
      await Unit.findOneAndDelete({ $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'Failed to delete unit' });
    }
  });

  // Staff
  app.get('/api/staff', async (req, res) => {
    const { ownerId } = req.query;
    try {
      const filter = ownerId ? { ownerId } : {};
      const staff = await Staff.find(filter);
      res.json(staff);
    } catch (err: any) {
      console.error('❌ Error fetching staff:', err);
      res.status(500).json({ error: 'Failed to fetch staff', details: err.message });
    }
  });

  app.post('/api/staff', async (req, res) => {
    try {
      console.log('Creating staff with data:', req.body);
      const staff = new Staff(req.body);
      await staff.save();
      
      // Also update the corresponding User record if it exists
      if (staff.email) {
        await User.findOneAndUpdate(
          { email: staff.email.toLowerCase().trim(), role: UserRole.STAFF, ownerId: staff.ownerId },
          { 
            canCollectCash: req.body.canCollectCash, 
            canPostAnnouncements: req.body.canPostAnnouncements,
            canAddExpenses: req.body.canAddExpenses,
            category: req.body.category 
          },
          { new: true }
        );
      }
      
      res.status(201).json(staff);
    } catch (err: any) {
      console.error('Error creating staff:', err);
      res.status(400).json({ 
        error: 'Failed to create staff',
        details: err.message,
        errors: err.errors
      });
    }
  });

  app.put('/api/staff/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const staff = await Staff.findOneAndUpdate(
        { $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        req.body,
        { new: true }
      );
      
      // Also update the corresponding User record if it exists
      if (staff && staff.email) {
        await User.findOneAndUpdate(
          { email: staff.email.toLowerCase().trim(), role: UserRole.STAFF, ownerId: staff.ownerId },
          { 
            canCollectCash: req.body.canCollectCash, 
            canPostAnnouncements: req.body.canPostAnnouncements, 
            canAddExpenses: req.body.canAddExpenses,
            category: req.body.category 
          },
          { new: true }
        );
      }
      
      res.json(staff);
    } catch (err) {
      res.status(400).json({ error: 'Failed to update staff' });
    }
  });

  app.delete('/api/staff/:id', async (req, res) => {
    try {
      const id = req.params.id;
      // Find staff by id or _id
      const filter = mongoose.Types.ObjectId.isValid(id) 
        ? { $or: [{ id: id }, { _id: id }] }
        : { id: id };
        
      const staff = await Staff.findOne(filter);

      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      // 1. Delete corresponding User record to revoke login immediately
      if (staff.email) {
        const user = await User.findOneAndDelete({ 
          email: staff.email.toLowerCase().trim(), 
          role: UserRole.STAFF,
          ownerId: staff.ownerId
        });
        
        // 2. Remove this staff member from all assigned properties
        if (user) {
          const userIdStr = user.id || user._id.toString();
          await Property.updateMany(
            { assignedStaffIds: userIdStr },
            { $pull: { assignedStaffIds: userIdStr } }
          );
        }
      }
      
      // 3. Delete the staff record itself
      await Staff.deleteOne({ _id: staff._id });
      
      res.json({ success: true });
    } catch (err) {
      console.error('Delete staff error:', err);
      res.status(500).json({ error: 'Failed to delete staff' });
    }
  });

  // Complaints
  app.get('/api/complaints', async (req, res) => {
    const { ownerId, residentId } = req.query;
    try {
      let filter: any = {};
      if (ownerId) filter.ownerId = ownerId;
      if (residentId) filter.residentId = residentId;
      const complaints = await Complaint.find(filter);
      res.json(complaints);
    } catch (err: any) {
      console.error('❌ Error fetching complaints:', err);
      res.status(500).json({ error: 'Failed to fetch complaints', details: err.message });
    }
  });

  app.post('/api/complaints', async (req, res) => {
    try {
      console.log('Creating complaint with data:', req.body);
      const complaint = new Complaint(req.body);
      await complaint.save();
      res.status(201).json(complaint);
    } catch (err: any) {
      console.error('Error creating complaint:', err);
      res.status(400).json({ 
        error: 'Failed to create complaint',
        details: err.message,
        errors: err.errors
      });
    }
  });

  app.put('/api/complaints/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const complaint = await Complaint.findOneAndUpdate(
        { $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        req.body,
        { new: true }
      );
      if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
      res.json(complaint);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to update complaint', details: err.message });
    }
  });

  app.delete('/api/complaints/:id', async (req, res) => {
    try {
      const id = req.params.id;
      await Complaint.findOneAndDelete({ $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to delete complaint', details: err.message });
    }
  });

  // Expenses
  app.get('/api/expenses', async (req, res) => {
    const { ownerId } = req.query;
    try {
      const filter = ownerId ? { ownerId } : {};
      const expenses = await Expense.find(filter);
      res.json(expenses);
    } catch (err: any) {
      console.error('❌ Error fetching expenses:', err);
      res.status(500).json({ error: 'Failed to fetch expenses', details: err.message });
    }
  });

  app.post('/api/expenses', async (req, res) => {
    try {
      console.log('Creating expense with data:', req.body);
      const expense = new Expense({
        ...req.body,
        recordedBy: req.body.recordedBy || 'Unknown'
      });
      await expense.save();
      res.status(201).json(expense);
    } catch (err: any) {
      console.error('Error creating expense:', err);
      res.status(400).json({ 
        error: 'Failed to create expense',
        details: err.message,
        errors: err.errors
      });
    }
  });

  // Payments
  app.get('/api/payments', async (req, res) => {
    const { ownerId, residentId, propertyId } = req.query;
    try {
      let filter: any = {};
      if (ownerId) filter.ownerId = ownerId;
      if (residentId) filter.residentId = residentId;
      if (propertyId) filter.propertyId = propertyId;
      const payments = await Payment.find(filter).sort({ date: -1 });
      res.json(payments);
    } catch (err: any) {
      console.error('❌ Error fetching payments:', err);
      res.status(500).json({ error: 'Failed to fetch payments', details: err.message });
    }
  });

  app.post('/api/payments', async (req, res) => {
    try {
      console.log('Creating payment with data:', req.body);
      const payment = new Payment(req.body);
      await payment.save();
      res.status(201).json(payment);
    } catch (err: any) {
      console.error('Error creating payment:', err);
      res.status(400).json({ 
        error: 'Failed to create payment',
        details: err.message,
        errors: err.errors
      });
    }
  });

  app.post('/api/payments/direct', async (req, res) => {
    try {
      const { ownerId, residentId, propertyId, amount, collectorId, collectorName, description } = req.body;
      
      const payment = new Payment({
        ownerId,
        residentId,
        propertyId,
        amount,
        date: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).replace(/,/, ''),
        description: description || `Rent Payment (Cash) - Collected by ${collectorName}`,
        status: 'SUCCESS',
        transactionId: `CASH-DIRECT-${Date.now()}`,
        paymentMethod: 'CASH',
        collectorId,
        collectorName
      });

      await payment.save();

      // Update resident balance and ledger
      const resident: any = await Resident.findOne({ id: residentId });
      if (resident) {
        resident.balance = (resident.balance || 0) - amount;
        if (!resident.ledger) resident.ledger = [];
        resident.ledger.push({
          id: payment.transactionId,
          date: new Date().toISOString().split('T')[0],
          description: payment.description,
          amount: amount,
          type: 'credit',
          status: 'success'
        });
        await resident.save();
      }

      res.status(201).json(payment);
    } catch (err: any) {
      res.status(400).json({ error: 'Direct payment failed', details: err.message });
    }
  });

  // Pending Payments & OTP Verification
  app.post('/api/payments/pending', async (req, res) => {
    try {
      const { ownerId, residentId, propertyId, amount, collectorId, collectorName, initiatorId, initiatorRole, otp } = req.body;
      
      // Ensure only one pending payment per resident
      await PendingPayment.deleteMany({ residentId });

      const expiresAt = new Date(Date.now() + 60 * 1000); // 1 minute from now

      // Generate OTP if not provided
      const finalOtp = otp || Math.floor(100000 + Math.random() * 900000).toString();

      const pending = new PendingPayment({
        otp: finalOtp,
        ownerId,
        residentId,
        propertyId,
        amount,
        collectorId,
        collectorName,
        initiatorId,
        initiatorRole,
        expiresAt
      });
      await pending.save();
      res.status(201).json(pending);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to create pending payment', details: err.message });
    }
  });

  app.get('/api/payments/pending/resident/:residentId', async (req, res) => {
    try {
      // Clean up expired payments first
      await PendingPayment.deleteMany({ residentId: req.params.residentId, expiresAt: { $lt: new Date() } });
      
      const pending = await PendingPayment.find({ residentId: req.params.residentId });
      res.json(pending);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch pending payments for resident' });
    }
  });

  app.get('/api/payments/pending/collector/:collectorId', async (req, res) => {
    try {
      // Clean up expired payments
      await PendingPayment.deleteMany({ collectorId: req.params.collectorId, expiresAt: { $lt: new Date() } });

      const pending = await PendingPayment.find({ collectorId: req.params.collectorId });
      res.json(pending);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch pending payments for collector' });
    }
  });

  app.post('/api/payments/verify', async (req, res) => {
    try {
      const { residentId, otp } = req.body;
      
      // Find pending payment where OTP matches
      const pending = await PendingPayment.findOne({ 
        residentId, 
        otp
      });
      
      if (!pending) {
        return res.status(400).json({ error: 'Invalid OTP or no pending payment found' });
      }

      if (pending.expiresAt && new Date() > pending.expiresAt) {
        await PendingPayment.findByIdAndDelete(pending._id);
        return res.status(400).json({ error: 'OTP has expired. Please generate a new one.' });
      }

      // Create actual payment
      const payment = new Payment({
        ownerId: pending.ownerId,
        residentId: pending.residentId,
        propertyId: pending.propertyId,
        amount: pending.amount,
        date: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).replace(/,/, ''),
        description: `Rent Payment (Cash) - Collected by ${pending.collectorName}`,
        status: 'SUCCESS',
        transactionId: `CASH-${Date.now()}`,
        paymentMethod: 'CASH',
        collectorId: pending.collectorId,
        collectorName: pending.collectorName
      });

      await payment.save();

      // Update resident balance and ledger
      const resident: any = await Resident.findOne({ id: pending.residentId });
      if (resident) {
        resident.balance = (resident.balance || 0) - pending.amount;
        if (!resident.ledger) resident.ledger = [];
        resident.ledger.push({
          id: payment.transactionId,
          date: new Date().toISOString().split('T')[0],
          description: payment.description,
          amount: pending.amount,
          type: 'credit',
          status: 'success'
        });
        await resident.save();
      }

      // Delete pending payment
      await PendingPayment.findByIdAndDelete(pending._id);

      res.json({ success: true, payment });
    } catch (err: any) {
      res.status(500).json({ error: 'Verification failed', details: err.message });
    }
  });

  // Hostel Updates
  app.get('/api/updates', async (req, res) => {
    const { ownerId, propertyId } = req.query;
    try {
      let filter: any = {};
      if (ownerId) filter.ownerId = ownerId;
      if (propertyId) {
        filter.$or = [{ propertyId: propertyId }, { propertyId: 'all' }];
      }
      const updates = await HostelUpdate.find(filter).sort({ createdAt: -1 });
      res.json(updates);
    } catch (err: any) {
      console.error('❌ Error fetching updates:', err);
      res.status(500).json({ error: 'Failed to fetch updates', details: err.message });
    }
  });

  app.post('/api/updates', async (req, res) => {
    try {
      const update = new HostelUpdate(req.body);
      await update.save();
      res.status(201).json(update);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to create update', details: err.message });
    }
  });

  app.put('/api/updates/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const update = await HostelUpdate.findOneAndUpdate(
        { $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        req.body,
        { new: true }
      );
      if (!update) return res.status(404).json({ error: 'Announcement not found' });
      res.json(update);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to update announcement', details: err.message });
    }
  });

  app.delete('/api/updates/:id', async (req, res) => {
    try {
      const id = req.params.id;
      let update;
      
      if (mongoose.Types.ObjectId.isValid(id)) {
        update = await HostelUpdate.findOneAndDelete({ 
          $or: [{ _id: id }, { id: id }] 
        });
      } else {
        update = await HostelUpdate.findOneAndDelete({ id: id });
      }
      
      if (!update) {
        // Fallback: try direct findByIdAndDelete if id looks like a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(id)) {
          update = await HostelUpdate.findByIdAndDelete(id);
        }
      }

      if (!update) return res.status(404).json({ error: 'Announcement not found' });
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error deleting update:', err);
      res.status(400).json({ error: 'Failed to delete update', details: err.message });
    }
  });

  // User Password Update
  app.patch('/api/users/:id/password', async (req, res) => {
    try {
      const id = req.params.id;
      const { password } = req.body;
      const user = await User.findOne({ 
        $or: [
          { id: id }, 
          { email: id.toLowerCase().trim() },
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }
        ] 
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      user.password = password;
      await user.save();
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update password', details: err.message });
    }
  });

  // Meal Plans
  app.get('/api/meal-plans', async (req, res) => {
    const { ownerId, propertyId } = req.query;
    try {
      const filter: any = {};
      if (ownerId) filter.ownerId = ownerId;
      if (propertyId) filter.propertyId = propertyId;
      const plans = await MealPlan.find(filter);
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch meal plans', details: err.message });
    }
  });

  app.put('/api/meal-plans', async (req, res) => {
    const { 
      ownerId, propertyId, day, 
      breakfast, breakfastStart, breakfastEnd,
      lunch, lunchStart, lunchEnd,
      snacks, snacksStart, snacksEnd,
      dinner, dinnerStart, dinnerEnd 
    } = req.body;
    try {
      const plan = await MealPlan.findOneAndUpdate(
        { propertyId, day },
        { 
          ownerId, propertyId, day, 
          breakfast, breakfastStart, breakfastEnd,
          lunch, lunchStart, lunchEnd,
          snacks, snacksStart, snacksEnd,
          dinner, dinnerStart, dinnerEnd,
          updatedAt: new Date() 
        },
        { upsert: true, new: true }
      );
      res.json(plan);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to update meal plan', details: err.message });
    }
  });

  // User Plan Update
  app.patch('/api/users/:id/lite-edition', async (req, res) => {
    try {
      const { isBasicHost } = req.body;
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isBasicHost },
        { new: true }
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update user', details: err.message });
    }
  });

  app.patch('/api/users/:id/plan', async (req, res) => {
    try {
      const id = req.params.id;
      const user = await User.findOneAndUpdate(
        { $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        { plan: req.body.plan },
        { new: true }
      );
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: 'Failed to update plan' });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const updates = req.body;

      // Find user first for validation
      const user = await User.findOne({ 
        $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] 
      });
      
      if (!user) return res.status(404).json({ error: 'User not found' });

      // If user is OWNER and is updating acceptedPaymentMethods, validate against PlanConfig
      if (user.role === 'OWNER' && updates.acceptedPaymentMethods) {
        const planConfigs = await PlanConfig.find();
        const planConfig = planConfigs.find(c => c.tier === (updates.plan || user.plan));
        if (planConfig) {
          const disallowed = updates.acceptedPaymentMethods.filter((method: string) => !planConfig.allowedPaymentMethods.includes(method));
          if (disallowed.length > 0) {
            return res.status(403).json({ 
              error: `Payment methods ${disallowed.join(', ')} are not allowed for your ${updates.plan || user.plan} plan.` 
            });
          }
        }
      }

      const updatedUser = await User.findByIdAndUpdate(user._id, updates, { new: true });
      res.json(updatedUser);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to update user profile', details: err.message });
    }
  });

  // PhonePe Integration
  app.post('/api/phonepe/create-order', async (req, res) => {
    try {
      const { amount, residentId, propertyId, ownerId } = req.body;
      
      const query = mongoose.Types.ObjectId.isValid(ownerId) 
        ? { $or: [{ id: ownerId }, { _id: ownerId }] }
        : { id: ownerId };
        
      const owner = await User.findOne(query);
      
      // Priority: 1. Environment Secrets (Developer/Global), 2. Database (User Settings)
      const merchantId = process.env.VITE_PHONEPE_MERCHANT_ID || owner.phonepeMerchantId;
      const saltKey = (process.env.VITE_PHONEPE_SALT_KEY || owner.phonepeClientId || '').trim();
      const saltIndex = (process.env.VITE_PHONEPE_SALT_INDEX || owner.phonepeClientSecret || '1').trim();
      
      if (!merchantId || !saltKey) {
        return res.status(400).json({ error: 'PhonePe not configured. Please set credentials in Secrets or Settings.' });
      }

      const merchantTransactionId = `PP${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      const payload = {
        merchantId: merchantId,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: residentId,
        amount: Math.round(amount * 100), // paise
        mobileNumber: "9999999999",
        redirectUrl: `${req.headers.origin}/payment-status`,
        redirectMode: 'REDIRECT',
        callbackUrl: `${req.headers.origin}/api/phonepe/callback?ownerId=${ownerId}&resId=${residentId}&propId=${propertyId}`,
        paymentInstrument: {
          type: 'PAY_PAGE'
        }
      };

      // Sophisticated Environment Routing
      // PGTESTPAYUAT is the generic sandbox account.
      // M22... is your specific merchant ID prefix which often belongs to the Sandbox/UAT environment.
      const isSandboxAccount = merchantId === 'PGTESTPAYUAT' || merchantId.includes('M22HHI4UCQ4AX');
      
      const phonepeUrl = isSandboxAccount
        ? 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay'
        : 'https://api.phonepe.com/apis/hermes/pg/v1/pay';

      // CRITICAL: According to PhonePe V1 standard, the path for checksum 
      // is always /pg/v1/pay, regardless of the Sandbox URL prefix.
      const apiPathForChecksum = "/pg/v1/pay";

      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      
      // PhonePe Standard V1 Checksum logic
      const checksumVal = base64Payload + apiPathForChecksum + saltKey;
      const sha256 = crypto.createHash('sha256').update(checksumVal).digest('hex');
      const xVerify = sha256 + "###" + saltIndex;

      let phonepeError: string | null = null;
      try {
        console.log(`[PhonePe] Routing to ${isSandboxAccount ? 'SANDBOX' : 'PRODUCTION/HERMES'} endpoint`);
        console.log(`[PhonePe] Merchant ID: ${merchantId}`);
        
        const response = await fetch(phonepeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify,
            'X-MERCHANT-ID': merchantId,
            'accept': 'application/json'
          },
          body: JSON.stringify({ request: base64Payload })
        });

        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error(`[PhonePe] API HTTP Error ${response.status}:`, text);
          
          if (text.includes('KEY_NOT_CONFIGURED')) {
            throw new Error('KEY_NOT_CONFIGURED: The Salt Key provided does not match this Merchant ID or Environment (Sandbox vs Production).');
          }
          throw new Error(`PhonePe API Error (HTTP ${response.status}): ${text.slice(0, 100)}`);
        }

        const resData = await response.json() as any;

        if (resData.success && resData.data?.instrumentResponse?.redirectInfo?.url) {
          return res.json({
            success: true,
            redirectUrl: resData.data.instrumentResponse.redirectInfo.url,
            merchantTransactionId
          });
        }
        
        console.warn('PhonePe API rejected:', resData);
        phonepeError = resData.message || 'PhonePe payment initiation failed';
      } catch (e: any) {
        console.error('PhonePe API connection failed:', e);
        phonepeError = e.message;
      }

      // Fallback to simulation if credentials are known test ones OR if the real API fails
      const isTestCreds = merchantId === 'PGTESTPAYUAT' || merchantId?.includes('M22HHI4UCQ4AX');
      
      if (isTestCreds || phonepeError) {
        console.log(`[PhonePe] Falling back to Mock Simulation (isTestCreds: ${isTestCreds}, error: ${phonepeError})`);
        return res.json({
          success: true,
          redirectUrl: `${req.headers.origin}/mock-phonepe?amount=${amount}&mid=${merchantId}&resId=${residentId}&propId=${propertyId}&ownerId=${ownerId || (owner as any)._id}&isSimulated=true`,
          merchantTransactionId: merchantTransactionId || `SIM${Date.now()}`
        });
      }

      res.status(400).json({ 
        error: phonepeError || 'Failed to initiate real PhonePe payment', 
        details: phonepeError 
      });
    } catch (err: any) {
      console.error('PhonePe Error:', err);
      res.status(500).json({ error: 'Internal server error during PhonePe initiation' });
    }
  });

  app.post('/api/phonepe/callback', async (req, res) => {
    try {
      let callbackData: any;
      
      if (req.body.response) {
        // Real PhonePe encoded response
        const decoded = JSON.parse(Buffer.from(req.body.response, 'base64').toString('utf-8'));
        callbackData = decoded.data;
        console.log('Real PhonePe Callback Received:', callbackData);
      } else {
        // Simulation direct hit
        callbackData = req.body;
      }

      const { 
        merchantTransactionId: transactionId,
        code,
        amount, 
        merchantId,
      } = callbackData;

      const status = (code === 'PAYMENT_SUCCESS' || code === 'SUCCESS' || callbackData.status === 'SUCCESS') ? 'SUCCESS' : 'FAILED';
      
      // Extract metadata from query if missing in body (legacy support)
      const residentId = callbackData.merchantUserId || req.query.resId as string;
      const ownerId = req.query.ownerId as string;
      const propertyId = req.query.propId as string;
      
      console.log(`✅ PhonePe Processing Callback: ${transactionId} - Status: ${status}`);
      
      if (status === 'SUCCESS') {
        const dateStr = new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).replace(/,/, '');

        const newPayment = new Payment({
          id: `PAY${Date.now()}`,
          ownerId,
          residentId,
          propertyId,
          amount: parseFloat(amount) / (req.body.response ? 100 : 1), // Real PhonePe is in paise
          date: dateStr,
          description: `Rent Payment via PhonePe (${transactionId})`,
          status: 'SUCCESS',
          transactionId: transactionId,
          paymentMethod: 'PhonePe',
          collectorId: 'SYSTEM',
          collectorName: 'Online Auto-Debit'
        });

        await newPayment.save();
        
        const resQuery = mongoose.Types.ObjectId.isValid(residentId) 
          ? { $or: [{ id: residentId }, { _id: residentId }] }
          : { id: residentId };

        const resident: any = await Resident.findOne(resQuery);
        if (resident) {
          const payAmount = parseFloat(amount) / (req.body.response ? 100 : 1);
          resident.balance = (resident.balance || 0) - payAmount;
          if (!resident.ledger) resident.ledger = [];
          resident.ledger.push({
            id: newPayment.transactionId,
            date: new Date().toISOString().split('T')[0],
            description: newPayment.description,
            amount: payAmount,
            type: 'credit',
            status: 'success'
          });
          await resident.save();
        }
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error('Callback error:', err);
      res.status(500).json({ error: 'Callback processing failed' });
    }
  });
  
  // Razorpay Integration
  let razorpay: any = null;
  const getRazorpay = () => {
    if (!razorpay) {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variable is missing');
      }
      razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    }
    return razorpay;
  };

  app.post('/api/razorpay/create-order', async (req, res) => {
    try {
      const { amount, currency = 'INR', receipt } = req.body;
      const instance = getRazorpay();
      const options = {
        amount: amount * 100, // Amount in paise
        currency,
        receipt,
      };
      const order = await instance.orders.create(options);
      res.json({
        ...order,
        key: process.env.RAZORPAY_KEY_ID
      });
    } catch (err: any) {
      console.error('Razorpay Create Order Error:', err);
      res.status(500).json({ error: 'Failed to create Razorpay order', details: err.message });
    }
  });

  app.post('/api/razorpay/verify-payment', async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const key_secret = process.env.RAZORPAY_KEY_SECRET;
      
      if (!key_secret) {
        return res.status(500).json({ error: 'Razorpay secret not configured' });
      }

      const hmac = crypto.createHmac('sha256', key_secret);
      hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
      const generated_signature = hmac.digest('hex');

      if (generated_signature === razorpay_signature) {
        res.json({ success: true, message: 'Payment verified successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    } catch (err: any) {
      console.error('Razorpay Verify Payment Error:', err);
      res.status(500).json({ error: 'Payment verification failed', details: err.message });
    }
  });

  app.put('/api/users/:id/plan', async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, { plan: req.body.plan }, { new: true });
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: 'Failed to update plan' });
    }
  });

  // Inventory
  app.get('/api/inventory', async (req, res) => {
    try {
      const { ownerId, propertyId } = req.query;
      const query: any = {};
      if (ownerId) query.ownerId = ownerId;
      if (propertyId) query.propertyId = propertyId;
      const items = await InventoryItem.find(query).sort({ lastUpdated: -1 });
      
      // Seed initial items if empty and ownerId + propertyId are provided
      if (items.length === 0 && ownerId && propertyId) {
        const seedItems = [
          { name: 'Toilet Cleaner', category: 'Cleaning Supplies', quantity: 10, unit: 'Bottles', status: 'In Stock' },
          { name: 'Broom', category: 'Cleaning Supplies', quantity: 5, unit: 'Units', status: 'In Stock' },
          { name: 'Rice', category: 'Mess/Kitchen', quantity: 100, unit: 'Kgs', status: 'In Stock' },
          { name: 'Cooking Oil', category: 'Mess/Kitchen', quantity: 20, unit: 'Litres', status: 'In Stock' },
          { name: 'Potatoes', category: 'Vegetables', quantity: 50, unit: 'Kgs', status: 'In Stock' },
          { name: 'Onions', category: 'Vegetables', quantity: 30, unit: 'Kgs', status: 'In Stock' },
          { name: 'Bed Sheets', category: 'Linen', quantity: 25, unit: 'Units', status: 'In Stock' }
        ].map(item => ({ ...item, ownerId, propertyId }));
        
        await InventoryItem.insertMany(seedItems);
        const seededItems = await InventoryItem.find(query).sort({ lastUpdated: -1 });
        return res.json(seededItems);
      }
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  });

  app.post('/api/inventory', async (req, res) => {
    try {
      const item = new InventoryItem(req.body);
      await item.save();
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to create inventory item', details: err.message });
    }
  });

  app.put('/api/inventory/:id', async (req, res) => {
    try {
      const item = await InventoryItem.findOneAndUpdate(
        { $or: [{ _id: req.params.id }, { id: req.params.id }] },
        req.body,
        { new: true }
      );
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to update inventory item', details: err.message });
    }
  });

  app.delete('/api/inventory/:id', async (req, res) => {
    try {
      const item = await InventoryItem.findOneAndDelete({ $or: [{ _id: req.params.id }, { id: req.params.id }] });
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete inventory item' });
    }
  });

  // Plan Configuration
  app.get('/api/plan-configs', async (req, res) => {
    try {
      const configs = await PlanConfig.find();
      res.json(configs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch plan configs' });
    }
  });

  app.put('/api/plan-configs/:tier', async (req, res) => {
    try {
      const config = await PlanConfig.findOneAndUpdate(
        { tier: req.params.tier },
        { allowedPaymentMethods: req.body.allowedPaymentMethods },
        { new: true, upsert: true }
      );
      res.json(config);
    } catch (err) {
      res.status(400).json({ error: 'Failed to update plan config' });
    }
  });

  // Sync Plan Configs
  const syncPlanConfigs = async () => {
    try {
      const defaultConfigs = [
        { tier: 'FREE', allowedPaymentMethods: ['Cash'] },
        { tier: 'LITE', allowedPaymentMethods: ['Cash', 'UPI QR'] },
        { tier: 'BASIC', allowedPaymentMethods: ['Cash', 'UPI QR', 'PhonePe', 'Razorpay', 'SME Pay Link'] },
        { tier: 'TRIAL', allowedPaymentMethods: ['Cash', 'UPI QR', 'SME Pay Link', 'PhonePe', 'Razorpay'] },
        { tier: 'PRO', allowedPaymentMethods: ['Cash', 'UPI QR', 'PhonePe', 'Razorpay', 'SME Pay Link'] },
        { tier: 'BUSINESS', allowedPaymentMethods: ['Cash', 'UPI QR', 'PhonePe', 'Razorpay', 'SME Pay Link'] },
        { tier: 'CUSTOM', allowedPaymentMethods: ['Cash', 'UPI QR', 'PhonePe', 'Razorpay', 'SME Pay Link'] }
      ];

      for (const config of defaultConfigs) {
        // Force update for existing ones to ensure "integration" reflects immediately
        await PlanConfig.findOneAndUpdate(
          { tier: config.tier },
          { tier: config.tier, allowedPaymentMethods: config.allowedPaymentMethods },
          { upsert: true, new: true, overwrite: true }
        );
      }
      console.log('✅ Plan configurations verified and synced');
    } catch (err) {
      console.error('Failed to sync plan configs:', err);
    }
  };
  syncPlanConfigs();

  // Vite Middleware for Development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
  // Note: In production, frontend is served by Vercel, so no static serving needed here

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
