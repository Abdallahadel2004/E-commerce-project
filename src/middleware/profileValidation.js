import { body, param } from 'express-validator';

export const validateProfileUpdate = [
  body('firstName').optional().isLength({ min: 2 }).withMessage('First name too short'),
  body('lastName').optional().isLength({ min: 2 }).withMessage('Last name too short'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone required'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date required'),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer-not-to-say'])
];

export const validateAddress = [
  body('addressLine1').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('postalCode').notEmpty().withMessage('Postal code is required'),
  body('country').notEmpty().withMessage('Country is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone required'),
  body('addressType').optional().isIn(['home', 'work', 'other', 'shipping', 'billing'])
];

export const validatePaymentMethod = [
  body('methodType').isIn(['card', 'paypal', 'bank', 'applepay', 'googlepay'])
    .withMessage('Invalid payment method'),
  body('cardLast4').if(body('methodType').equals('card'))
    .isLength({ min: 4, max: 4 }).withMessage('Card last 4 digits required'),
  body('cardBrand').if(body('methodType').equals('card'))
    .notEmpty().withMessage('Card brand required'),
  body('paypalEmail').if(body('methodType').equals('paypal'))
    .isEmail().withMessage('Valid PayPal email required'),
  body('bankName').if(body('methodType').equals('bank'))
    .notEmpty().withMessage('Bank name required'),
  body('accountLast4').if(body('methodType').equals('bank'))
    .isLength({ min: 4, max: 4 }).withMessage('Account last 4 digits required')
];

export const validatePreferences = [
  body('language').optional().isIn(['en', 'es', 'fr', 'de', 'ar', 'zh']),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD']),
  body('timezone').optional().isString(),
  body('theme').optional().isIn(['light', 'dark', 'system']),
  body('newsletter').optional().isBoolean(),
  body('emailNotifications').optional().isBoolean(),
  body('twoFactorAuth').optional().isBoolean()
];
