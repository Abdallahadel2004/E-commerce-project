import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateSignin, validateSignup } from '../middleware/validation.js';
import sendEmail from '../utils/emailService.js';

export const signup = async (req, res) => {
    console.log('1');
    try {
        console.log('2');

        const valid = validateSignup(req.body);
        console.log('3');

        if (!valid) {
            console.log('4');

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

        console.log('8');

        await sendEmail(
            email,
            `Welcome to our Website Mr/Ms: ${name}`,
            'Welcome.'
        );

        console.log('9');

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

const resetPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Old password incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
