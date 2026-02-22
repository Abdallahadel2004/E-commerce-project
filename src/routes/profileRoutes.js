import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getMyProfile,
  updateMyProfile,
  uploadProfilePicture,
  uploadCoverPicture,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getPreferences,
  updatePreferences,
  getProfileCompletion
} from '../controllers/profileController.js';
import { auth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'coverPicture' ? 'covers' : 'profiles';
    cb(null, `uploads/${folder}/`);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const field = file.fieldname === 'coverPicture' ? 'cover' : 'profile';
    cb(null, `${field}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// All routes require authentication
router.use(auth);

router.get('/', getMyProfile);
router.put('/', updateMyProfile);
router.post('/picture', upload.single('profilePicture'), uploadProfilePicture);
router.post('/cover', upload.single('coverPicture'), uploadCoverPicture);
router.get('/completion', getProfileCompletion);
router.get('/addresses', getAddresses);
router.post('/addresses', addAddress);
router.put('/addresses/:addressId', updateAddress);
router.delete('/addresses/:addressId', deleteAddress);
router.patch('/addresses/:addressId/default', setDefaultAddress);
router.get('/payment-methods', getPaymentMethods);
router.post('/payment-methods', addPaymentMethod);
router.delete('/payment-methods/:methodId', deletePaymentMethod);
router.patch('/payment-methods/:methodId/default', setDefaultPaymentMethod);
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

export default router;
