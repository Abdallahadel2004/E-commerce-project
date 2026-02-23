import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  // Link to User model (one-to-one relationship)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
   
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  profilePicture: {
    url: { type: String, default: 'https://via.placeholder.com/150' },
    publicId: String,
    alt: { type: String, default: 'Profile picture' }
  },
  coverPicture: {
    url: String,
    publicId: String,
    alt: { type: String, default: 'Cover photo' }
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    default: 'prefer-not-to-say'
  },
  occupation: String,
  company: String,
  website: String,
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
  },
  alternatePhone: String,
  socialLinks: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String,
    github: String,
    youtube: String
  },

  // ===== ADDRESSES =====
  addresses: [{
    addressId: { 
      type: mongoose.Schema.Types.ObjectId, 
      default: () => new mongoose.Types.ObjectId() 
    },
    addressType: { 
      type: String, 
      enum: ['home', 'work', 'other', 'shipping', 'billing'], 
      default: 'home' 
    },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true, default: 'USA' },
    postalCode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    isBilling: { type: Boolean, default: false },
    isShipping: { type: Boolean, default: true },
    deliveryInstructions: String,
    createdAt: { type: Date, default: Date.now }
  }],

  paymentMethods: [{
    methodId: { 
      type: mongoose.Schema.Types.ObjectId, 
      default: () => new mongoose.Types.ObjectId() 
    },
    methodType: { 
      type: String, 
      enum: ['card', 'paypal', 'bank', 'applepay', 'googlepay'], 
      required: true 
    },
    isDefault: { type: Boolean, default: false },
    
    // Card details (store only last 4 digits for security)
    cardLast4: String,
    cardBrand: String,
    cardHolderName: String,
    expiryMonth: String,
    expiryYear: String,
    paypalEmail: String,
    bankName: String,
    accountLast4: String,
    accountType: { type: String, enum: ['checking', 'savings'] },
    
    // Billing address reference
    billingAddressId: mongoose.Schema.Types.ObjectId,
    
    // Payment gateway reference
    paymentGatewayId: String,
    paymentGatewayCustomerId: String,
    
    createdAt: { type: Date, default: Date.now }
  }],

  // ===== PREFERENCES =====
  preferences: {
    newsletter: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    marketingEmails: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'America/New_York' },
    dateFormat: { type: String, default: 'MM/DD/YYYY' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    twoFactorAuth: { type: Boolean, default: false }
  },

  // ===== STATISTICS =====
  stats: {
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    favoriteCategory: String,
    lastActive: Date,
    loginCount: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    wishlistCount: { type: Number, default: 0 }
  },

  // ===== METADATA =====
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  profileCompletionScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  lastProfileUpdate: Date,
  verificationBadges: [{
    type: { type: String, enum: ['email', 'phone', 'identity', 'seller'] },
    verifiedAt: Date,
    status: { type: String, enum: ['pending', 'verified', 'rejected'] }
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ===== VIRTUAL FIELDS =====

// Full name virtual
profileSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.displayName || '';
});

// Default address
profileSchema.virtual('defaultAddress').get(function() {
  return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
});

// Default shipping address
profileSchema.virtual('defaultShippingAddress').get(function() {
  return this.addresses.find(addr => addr.isShipping && addr.isDefault) || 
         this.addresses.find(addr => addr.isShipping) ||
         this.defaultAddress;
});

// Default billing address
profileSchema.virtual('defaultBillingAddress').get(function() {
  return this.addresses.find(addr => addr.isBilling) || this.defaultAddress;
});

// Default payment method
profileSchema.virtual('defaultPaymentMethod').get(function() {
  return this.paymentMethods.find(method => method.isDefault) || this.paymentMethods[0];
});

// Profile completion
profileSchema.virtual('completion').get(function() {
  const fields = [
    'firstName', 'lastName', 'phone', 'bio', 
    'profilePicture.url', 'dateOfBirth'
  ];
  const completed = fields.filter(field => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      return this[parent] && this[parent][child];
    }
    return this[field];
  }).length;
  
  return Math.round((completed / fields.length) * 100);
});

profileSchema.index({ 'addresses.postalCode': 1 });
profileSchema.index({ 'paymentMethods.methodType': 1 });
profileSchema.index({ isProfileComplete: 1 });


// Calculate profile completion score
profileSchema.methods.calculateCompletionScore = function() {
  const fields = [
    'firstName', 'lastName', 'phone', 'bio', 
    'profilePicture.url', 'dateOfBirth', 'addresses.length'
  ];
  
  let score = 0;
  const totalFields = fields.length;
  
  fields.forEach(field => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (this[parent] && this[parent][child]) score += 1;
    } else if (field.includes('.length')) {
      const [parent] = field.split('.');
      if (this[parent] && this[parent].length > 0) score += 1;
    } else {
      if (this[field]) score += 1;
    }
  });
  
  this.profileCompletionScore = Math.round((score / totalFields) * 100);
  this.isProfileComplete = this.profileCompletionScore >= 70;
  return this.profileCompletionScore;
};

// Add address
profileSchema.methods.addAddress = async function(addressData) {
  if (this.addresses.length === 0 || addressData.isDefault) {
    this.addresses.forEach(addr => {
      addr.isDefault = false;
    });
    addressData.isDefault = true;
  }
  
  this.addresses.push(addressData);
  await this.save();
  return this;
};

// Update address
profileSchema.methods.updateAddress = async function(addressId, updateData) {
  const address = this.addresses.id(addressId);
  if (!address) throw new Error('Address not found');
  
  // Handle default address change
  if (updateData.isDefault && !address.isDefault) {
    this.addresses.forEach(addr => {
      addr.isDefault = false;
    });
  }
  
  Object.assign(address, updateData);
  await this.save();
  return this;
};

// Delete address
profileSchema.methods.deleteAddress = async function(addressId) {
  const address = this.addresses.id(addressId);
  if (!address) throw new Error('Address not found');
  
  // If deleting default address, set another as default
  if (address.isDefault && this.addresses.length > 1) {
    const remainingAddresses = this.addresses.filter(
      addr => addr._id.toString() !== addressId
    );
    remainingAddresses[0].isDefault = true;
  }
  
  address.deleteOne();
  await this.save();
  return this;
};

// Add payment method
profileSchema.methods.addPaymentMethod = async function(methodData) {
  // Handle default payment method
  if (this.paymentMethods.length === 0 || methodData.isDefault) {
    this.paymentMethods.forEach(method => {
      method.isDefault = false;
    });
    methodData.isDefault = true;
  }
  
  this.paymentMethods.push(methodData);
  await this.save();
  return this;
};

// Delete payment method
profileSchema.methods.deletePaymentMethod = async function(methodId) {
  const method = this.paymentMethods.id(methodId);
  if (!method) throw new Error('Payment method not found');
  
  // If deleting default method, set another as default
  if (method.isDefault && this.paymentMethods.length > 1) {
    const remainingMethods = this.paymentMethods.filter(
      m => m._id.toString() !== methodId
    );
    remainingMethods[0].isDefault = true;
  }
  
  method.deleteOne();
  await this.save();
  return this;
};

// Update preferences
profileSchema.methods.updatePreferences = async function(prefData) {
  Object.assign(this.preferences, prefData);
  await this.save();
  return this;
};

// Update stats after order
profileSchema.methods.updateOrderStats = async function(orderAmount) {
  this.stats.totalOrders += 1;
  this.stats.totalSpent += orderAmount;
  this.stats.averageOrderValue = this.stats.totalSpent / this.stats.totalOrders;
  this.stats.lastActive = new Date();
  await this.save();
  return this;
};

// Find or create profile for user
profileSchema.statics.findOrCreate = async function(userId) {
  let profile = await this.findOne({ userId });
  
  if (!profile) {
    profile = await this.create({ userId });
  }
  
  return profile;
};

// Get profiles with incomplete data
profileSchema.statics.getIncompleteProfiles = function(threshold = 50) {
  return this.find({ 
    profileCompletionScore: { $lt: threshold },
    isProfileComplete: false 
  }).populate('userId', 'email');
};

const Profile = mongoose.model('Profile', profileSchema);
export default Profile;
