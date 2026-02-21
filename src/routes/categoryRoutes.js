import express from 'express';
import {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../controllers/categoryController.js';
import { adminOnly, auth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:id', getCategory);

router.post('/', auth, adminOnly, createCategory);
router.put('/:id', auth, adminOnly, updateCategory);
router.delete('/:id', auth, adminOnly, deleteCategory);

export default router;
