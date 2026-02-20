import PromoCode from '../models/promo_code.model.js';

// @desc    Get all promo codes
// @route   GET /api/promos
// @access  Admin
export const getPromos = async (req, res) => {
  try {
    const promos = await PromoCode.find().sort('-createdAt');
    res.json({
      success: true,
      count: promos.length,
      promos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get single promo code
// @route   GET /api/promos/:id
// @access  Admin
export const getPromo = async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    
    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }
    
    res.json({
      success: true,
      promo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Create promo code
// @route   POST /api/promos
// @access  Admin
export const createPromo = async (req, res) => {
  try {
    const { code, type, value, minOrder, maxDiscount, usageLimit, validFrom, validUntil } = req.body;

    // Check if code already exists
    const existingPromo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists'
      });
    }

    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      type,
      value,
      minOrder,
      maxDiscount,
      usageLimit,
      validFrom,
      validUntil
    });

    res.status(201).json({
      success: true,
      promo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update promo code
// @route   PUT /api/promos/:id
// @access  Admin
export const updatePromo = async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    res.json({
      success: true,
      promo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete promo code
// @route   DELETE /api/promos/:id
// @access  Admin
export const deletePromo = async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndDelete(req.params.id);

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Validate promo code
// @route   POST /api/promos/validate
// @access  Public
export const validatePromo = async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    const promo = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired promo code'
      });
    }

    // Check usage limit
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Promo code usage limit exceeded'
      });
    }

    // Check minimum order
    if (orderTotal < promo.minOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is $${promo.minOrder}`
      });
    }

    // Calculate discount
    let discount = 0;
    if (promo.type === 'percentage') {
      discount = (orderTotal * promo.value) / 100;
      if (promo.maxDiscount && discount > promo.maxDiscount) {
        discount = promo.maxDiscount;
      }
    } else {
      discount = promo.value;
    }

    res.json({
      success: true,
      promo: {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        discount: Math.round(discount * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};
