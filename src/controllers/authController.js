import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateSignin, validateSignup } from '../middleware/validation.js';
import sendEmail from '../utils/emailService.js';

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

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                timestamp: new Date(),
                success: false,
                message: 'Email already exists',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            address,
        });

        await sendEmail(
            email,
            `Welcome to our Website Mr/Ms: ${name}`,
            'Welcome.'
        );

        res.status(201).json({
            timestamp: new Date(),
            success: true,
            message: `Welcome to out website ${user.name}`,
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

export const signin = async (req, res) => {
    try {
        const valid = validateSignin(req.body);

        if (!valid) {
            return res.status(400).json({
                timestamp: new Date(),

                success: false,
                errors: validateSignin.errors,
            });
        }

        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                timestamp: new Date(),
                success: false,
                message: 'Invalid Email or password',
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                timestamp: new Date(),

                success: false,
                message: 'Invalid Email or password',
            });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '2d' }
        );

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
