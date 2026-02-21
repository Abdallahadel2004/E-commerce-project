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

export const createCategory = async (req, res) => {
    try {
        // console.log('c1');
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admin can create categories',
            });
        }

        // console.log('c2');

        const { name, description, slug } = req.body;

        const exists = await Category.findOne({ name });
        // console.log('c3');

        if (exists) {
            return res
                .status(400)
                .json({ success: false, message: 'Category already exists' });
        }
        // console.log('c4');

        const category = await Category.create({ name, description, slug });
        // console.log('c5');

        res.status(201).json({ success: true, category });
    } catch (error) {
        // console.log('c6');

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
//delete category - Admin only

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
