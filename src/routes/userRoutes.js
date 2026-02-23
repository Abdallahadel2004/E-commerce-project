import express from 'express';
import {
    getAllUsers,
    updateUser,
    deleteUser,
    changeUserRole,
    getUserById,
} from '../controllers/userController.js';
import User from '../models/user.model.js';

import { adminOnly, auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth);

router.get('/', getAllUsers);
router.get('/:id', adminOnly, getUserById);
router.put('/:id', authorize(User), updateUser);
router.delete('/:id', deleteUser);
router.patch('/:id/role', changeUserRole);

export default router;
