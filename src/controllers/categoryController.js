import Category from '../models/category.js';

// GET all categories - Public
export const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.json({ success: true, categories });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET single category
export const getCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res
                .status(404)
                .json({ success: false, message: 'Category not found' });
        }
        res.json({ success: true, category });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// CREATE category - Admin only
export const createCategory = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admin can create categories',
            });
        }

        const { name, description, slug } = req.body;

        const exists = await Category.findOne({ name });
        if (exists) {
            return res
                .status(400)
                .json({ success: false, message: 'Category already exists' });
        }

        const category = await Category.create({
            name,
            description,
            slug,
            isActive: true,
        });

        res.status(201).json({ success: true, category });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// UPDATE category - Admin only
export const updateCategory = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admin can update categories',
            });
        }

        const category = await Category.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!category) {
            return res
                .status(404)
                .json({ success: false, message: 'Category not found' });
        }

        res.json({ success: true, category });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE category - Admin only
export const deleteCategory = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admin can delete categories',
            });
        }

        const category = await Category.findById(req.params.id);
        if (!category) {
            return res
                .status(404)
                .json({ success: false, message: 'Category not found' });
        }

        category.isActive = false;
        await category.save();

        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
