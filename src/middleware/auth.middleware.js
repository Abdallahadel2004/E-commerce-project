import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

import dotenv from 'dotenv';
dotenv.config();

export const auth = async (req, res, next) => {
    try {
        let token;

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                timestamp: new Date(),
                message: 'Please Signin',
            });
        }

        // console.log('lll: ' + process.env.JWT_SECRET);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                timestamp: new Date(),
                success: false,
                message: 'User not found',
            });
        }

        req.user = user;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, Please Sing in',
            error: error.message,
        });
    }
};

export const authorize = (Model) => {
    return async (req, res, next) => {
        try {
            const resource = await Model.findById(req.params.id);

            if (!resource) {
                return res.status(404).json({
                    timestamp: new Date(),
                    message: `${Model.modelName} Not found`,
                });
            }

            if (req.user.role === 'admin') {
                req.resource = resource;
                return next();
            }

            if (Model.modelName === 'User') {
                if (req.user._id.toString() !== resource._id.toString()) {
                    return res.status(403).json({ message: 'Not Allowed' });
                }
            } else {
                if (resource.user_id.toString() !== req.user._id.toString()) {
                    return res.status(403).json({ message: 'Not Allowed' });
                }
            }

            req.resource = resource;
            next();
        } catch (error) {
            return res
                .status(500)
                .json({ message: 'Server Error', error: error.message });
        }
    };
};

export const adminOnly = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only access' });
        }

        next();
    } catch (error) {
        return res.status(500).json({
            timestamp: new Date(),
            message: 'Server Error',
            error: error.message,
        });
    }
};
