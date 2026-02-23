import { validateUserUpdate } from '../middleware/validation.js';
import User from '../models/user.model.js';
import { success } from './paymentController.js';

export const getUserById = async (req, res) => {
    console.log('by id');
    try {
        const id = req.params.id;
        const user = await User.findById(id);
        if (!user) {
            res.status(404).json({
                success: false,
                timestamps: new Date(),
                message: 'user not found',
            });
        }

        res.status(200).json({
            success: true,
            timestamps: new Date(),
            user,
        });
    } catch (error) {
        res.status(500).json({
            timestamps: new Date(),
            message: error.message,
        });
    }
};

export const getAllUsers = async (req, res) => {
    console.log('all users');
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        const query = {
            name: { $regex: search, $options: 'i' },
        };

        const users = await User.find(query)
            .select('-password')
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await User.countDocuments(query);

        res.json({
            timestamps: new Date(),
            success: true,
            page,
            pages: Math.ceil(total / limit),
            UsersNumber: total,
            users,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            timestamps: new Date(),
            message: error.message,
        });
    }
};

export const updateUser = async (req, res) => {
    try {
        const valid = validateUserUpdate(req.body);
        if (!valid) {
            return res.status(400).json({
                timestamps: new Date(),
                success: false,
                errors: validateUserUpdate.errors,
            });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                timestamp: new Date(),
                success: false,
                message: 'User not found',
            });
        }

        Object.assign(user, req.body);

        await user.save();

        res.json({
            timestamps: new Date(),

            success: true,
            message: 'User updated successfully',
            user,
        });
    } catch (error) {
        res.status(500).json({
            timestamps: new Date(),

            success: false,
            message: error.message,
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({
                message: 'Admin cannot delete himself',
            });
        }

        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            timestamp: new Date(),
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const changeUserRole = async (req, res) => {
    try {
        const role = req.body.role.toLowerCase();
        // console.log('role');

        if (!['admin', 'customer'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (
            req.user._id.toString() === user._id.toString() &&
            role !== 'admin'
        ) {
            return res.status(400).json({
                success: false,
                timestamp: new Date(),
                message: 'Admins only can change role',
            });
        }

        user.role = role;
        await user.save();

        res.json({
            success: true,
            message: 'Role updated successfully',
            user,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
