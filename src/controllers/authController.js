import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateSignin, validateSignup } from '../middleware/validation.js';
import sendEmail from '../email/email.js';

export const signup = async (req, res) => {
    try {
        const valid = validateSignup(req.body);

        if (!valid) {
            return res.status(400).json({
                timestamp: new Date(),
                success: false,
                errors: validateSignup.errors,
            });
        }

        const { name, email, password, phone, address } = req.body;
        console.log('4');

        const existingUser = await User.findOne({ email });
        console.log('5');

        if (existingUser) {
            return res.status(400).json({
                timestamp: new Date(),
                success: false,
                message: 'Email already exists',
            });
        }
        console.log('6');

        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('7');

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            address,
        });

        await sendEmail(req.body.email);

        res.status(201).json({
            timestamp: new Date(),
            success: true,
            message: `Welcome to out website ${user.name}`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isConfirmed: user.isConfirmed,
            },
        });
    } catch (error) {
        console.log('10');

        res.status(500).json({
            timestamp: new Date(),
            success: false,
            message: error.message,
        });
    }
};

export const signin = async (req, res) => {
    try {
        // Validate request body
        const valid = validateSignin(req.body);
        if (!valid) {
            return res.status(400).json({
                timestamp: new Date(),
                success: false,
                errors: validateSignin.errors,
            });
        }

        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                timestamp: new Date(),
                success: false,
                message: 'Invalid Email or password',
            });
        }

        // Check if password matches
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                timestamp: new Date(),
                success: false,
                message: 'Invalid Email or password',
            });
        }

        // Check if email is confirmed
        if (user.isConfirmed === false) {
            return res.status(401).json({
                timestamp: new Date(),
                success: false,
                message: 'Please verify your email before signing in',
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '2d' }
        );

        // Respond with success
        res.status(200).json({
            timestamp: new Date(),
            success: true,
            message: `Welcome back ${user.name}`,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(500).json({
            timestamp: new Date(),
            success: false,
            message: error.message,
        });
    }
};

export const verifyEmail = async (req, res) => {
    jwt.verify(req.params.email, 'newemail', async (err, decoded) => {
        if (err) {
            return res.status(401).json('invalid token');
        }
        console.log(decoded);
        await User.findOneAndUpdate({ email: decoded }, { isConfirmed: true });
        res.status(200).json('email verified');
    });
};

export const resetPassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Old password incorrect',
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
