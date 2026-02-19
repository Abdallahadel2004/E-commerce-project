import express from 'express';
import {
    getAllUsers,
    updateUser,
    deleteUser,
    changeUserRole,
} from '../controllers/userController.js';
import User from '../models/user.model.js';

import { auth, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth, authorize(User));

router.get('/', getAllUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.patch('/:id/role', changeUserRole);

export default router;
