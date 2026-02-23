import Profile from '../models/Profile.js';
import User from '../models/user.model.js';

// ===== HELPER FUNCTION =====
const getProfile = async (userId) => {
  let profile = await Profile.findOne({ userId });
  
  if (!profile) {
    const user = await User.findById(userId);
    profile = await Profile.create({
      userId,
      firstName: user.name.split(' ')[0],
      lastName: user.name.split(' ').slice(1).join(' ') || '',
      displayName: user.name
    });
  }
  
  return profile;
};

// ===== PROFILE MANAGEMENT =====

// @desc    Get my profile
// @route   GET /api/profile
// @access  Private
export const getMyProfile = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    // Calculate completion score
    profile.calculateCompletionScore();

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update my profile
// @route   PUT /api/profile
// @access  Private
export const updateMyProfile = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    // Update allowed fields
    const allowedUpdates = [
      'firstName', 'lastName', 'displayName', 'bio', 'dateOfBirth',
      'gender', 'occupation', 'company', 'website', 'phone',
      'alternatePhone', 'socialLinks'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'socialLinks' && typeof req.body[field] === 'object') {
          profile.socialLinks = { ...profile.socialLinks, ...req.body[field] };
        } else {
          profile[field] = req.body[field];
        }
      }
    });

    // Update display name if not set
    if (!profile.displayName && profile.firstName) {
      profile.displayName = `${profile.firstName} ${profile.lastName || ''}`.trim();
    }

    profile.lastProfileUpdate = new Date();
    profile.calculateCompletionScore();
    await profile.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Upload profile picture
// @route   POST /api/profile/picture
// @access  Private
export const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }

    const profile = await getProfile(req.user.id);
    
    // In production, upload to Cloudinary here
    profile.profilePicture = {
      url: `/uploads/profiles/${req.file.filename}`,
      publicId: req.file.filename,
      alt: `${profile.displayName || 'User'}'s profile picture`
    };

    profile.lastProfileUpdate = new Date();
    profile.calculateCompletionScore();
    await profile.save();

    res.json({
      success: true,
      message: 'Profile picture updated',
      profilePicture: profile.profilePicture
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Upload cover picture
// @route   POST /api/profile/cover
// @access  Private
export const uploadCoverPicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }

    const profile = await getProfile(req.user.id);
    
    profile.coverPicture = {
      url: `/uploads/covers/${req.file.filename}`,
      publicId: req.file.filename,
      alt: `${profile.displayName || 'User'}'s cover photo`
    };

    await profile.save();

    res.json({
      success: true,
      message: 'Cover picture updated',
      coverPicture: profile.coverPicture
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ===== ADDRESS MANAGEMENT =====

// @desc    Get all addresses
// @route   GET /api/profile/addresses
// @access  Private
export const getAddresses = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    res.json({
      success: true,
      count: profile.addresses.length,
      addresses: profile.addresses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add new address
// @route   POST /api/profile/addresses
// @access  Private
export const addAddress = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    const addressData = {
      addressType: req.body.addressType || 'home',
      fullName: req.body.fullName || profile.displayName,
      phone: req.body.phone || profile.phone,
      addressLine1: req.body.addressLine1,
      addressLine2: req.body.addressLine2,
      city: req.body.city,
      state: req.body.state,
      country: req.body.country || 'USA',
      postalCode: req.body.postalCode,
      isDefault: req.body.isDefault || false,
      isBilling: req.body.isBilling || false,
      isShipping: req.body.isShipping !== false,
      deliveryInstructions: req.body.deliveryInstructions
    };

    await profile.addAddress(addressData);

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      addresses: profile.addresses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update address
// @route   PUT /api/profile/addresses/:addressId
// @access  Private
export const updateAddress = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    await profile.updateAddress(req.params.addressId, req.body);

    res.json({
      success: true,
      message: 'Address updated successfully',
      addresses: profile.addresses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete address
// @route   DELETE /api/profile/addresses/:addressId
// @access  Private
export const deleteAddress = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    await profile.deleteAddress(req.params.addressId);

    res.json({
      success: true,
      message: 'Address deleted successfully',
      addresses: profile.addresses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Set default address
// @route   PATCH /api/profile/addresses/:addressId/default
// @access  Private
export const setDefaultAddress = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    profile.addresses.forEach(addr => {
      addr.isDefault = false;
    });
    
    const address = profile.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }
    
    address.isDefault = true;
    await profile.save();

    res.json({
      success: true,
      message: 'Default address updated',
      addresses: profile.addresses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ===== PAYMENT METHODS =====

// @desc    Get all payment methods
// @route   GET /api/profile/payment-methods
// @access  Private
export const getPaymentMethods = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    // Mask sensitive data
    const safeMethods = profile.paymentMethods.map(method => {
      const methodObj = method.toObject();
      if (methodObj.cardHolderName) {
        methodObj.cardHolderName = '****';
      }
      return methodObj;
    });

    res.json({
      success: true,
      count: safeMethods.length,
      paymentMethods: safeMethods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add payment method
// @route   POST /api/profile/payment-methods
// @access  Private
export const addPaymentMethod = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    const methodData = {
      methodType: req.body.methodType,
      isDefault: req.body.isDefault || false,
      paymentGatewayId: req.body.paymentGatewayId,
      paymentGatewayCustomerId: req.body.paymentGatewayCustomerId,
      billingAddressId: req.body.billingAddressId
    };

    // Add type-specific fields
    if (req.body.methodType === 'card') {
      methodData.cardLast4 = req.body.cardLast4;
      methodData.cardBrand = req.body.cardBrand;
      methodData.cardHolderName = req.body.cardHolderName;
      methodData.expiryMonth = req.body.expiryMonth;
      methodData.expiryYear = req.body.expiryYear;
    } else if (req.body.methodType === 'paypal') {
      methodData.paypalEmail = req.body.paypalEmail;
    } else if (req.body.methodType === 'bank') {
      methodData.bankName = req.body.bankName;
      methodData.accountLast4 = req.body.accountLast4;
      methodData.accountType = req.body.accountType;
    }

    await profile.addPaymentMethod(methodData);

    res.status(201).json({
      success: true,
      message: 'Payment method added successfully',
      paymentMethods: profile.paymentMethods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete payment method
// @route   DELETE /api/profile/payment-methods/:methodId
// @access  Private
export const deletePaymentMethod = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    await profile.deletePaymentMethod(req.params.methodId);

    res.json({
      success: true,
      message: 'Payment method deleted successfully',
      paymentMethods: profile.paymentMethods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Set default payment method
// @route   PATCH /api/profile/payment-methods/:methodId/default
// @access  Private
export const setDefaultPaymentMethod = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    profile.paymentMethods.forEach(method => {
      method.isDefault = false;
    });
    
    const method = profile.paymentMethods.id(req.params.methodId);
    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    method.isDefault = true;
    await profile.save();

    res.json({
      success: true,
      message: 'Default payment method updated',
      paymentMethods: profile.paymentMethods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ===== PREFERENCES =====

// @desc    Get preferences
// @route   GET /api/profile/preferences
// @access  Private
export const getPreferences = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    
    res.json({
      success: true,
      preferences: profile.preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update preferences
// @route   PUT /api/profile/preferences
// @access  Private
export const updatePreferences = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    await profile.updatePreferences(req.body);

    res.json({
      success: true,
      message: 'Preferences updated',
      preferences: profile.preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ===== PROFILE COMPLETION =====

// @desc    Get profile completion status
// @route   GET /api/profile/completion
// @access  Private
export const getProfileCompletion = async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    const score = profile.calculateCompletionScore();

    res.json({
      success: true,
      completionScore: score,
      isComplete: profile.isProfileComplete,
      missingFields: {
        personalInfo: !profile.firstName || !profile.lastName,
        contactInfo: !profile.phone,
        profilePicture: !profile.profilePicture?.url || profile.profilePicture.url.includes('placeholder'),
        address: profile.addresses.length === 0,
        paymentMethod: profile.paymentMethods.length === 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
