import PromoCode from '../models/promo_code.model.js';

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
      message: error.message
    });
  }
};
export const createPromo = async (req, res) => {
  try {
    const promo = await PromoCode.create(req.body);
    res.status(201).json({
      success: true,
      promo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

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
      message: error.message
    });
  }
};
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
      message: error.message
    });
  }
};

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
      message: 'Promo code deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};