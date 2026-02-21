import Order from '../models/order.model.js';
import { v4 as uuidv4 } from 'uuid';

import Product from '../models/product.js';

export const createOrder = async (req, res) => {
    try {
        console.log('1');
        const { items, shippingAddress, paymentMethod } = req.body;
        console.log('2');

        const populatedItems = await Promise.all(
            items.map(async (item) => {
                const product = await Product.findById(item.product);
                if (!product)
                    throw new Error(`Product not found: ${item.product}`);

                return {
                    product: product._id,
                    name: product.name,
                    price: product.price,
                    quantity: item.quantity,
                };
            })
        );
        console.log('3');

        const totalAmount = populatedItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        console.log('4');

        const order = await Order.create({
            orderNumber: `ORD-${uuidv4().slice(0, 8)}`,
            user: req.user.id,
            items: populatedItems,
            totalAmount,
            shippingAddress,
            paymentMethod,
            orderStatus: 'pending',
            isPaid: false,
        });
        console.log('5');

        res.status(201).json({
            success: true,
            data: order,
        });
    } catch (error) {
        console.log('6');

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort(
            '-createdAt'
        );

        res.json({
            success: true,
            count: orders.length,
            data: orders,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        // Check if order belongs to user or user is admin
        if (
            order.user.toString() !== req.user.id &&
            req.user.role !== 'admin'
        ) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            });
        }

        res.json({
            success: true,
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        order.orderStatus = status;
        await order.save();

        res.json({
            success: true,
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        if (order.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            });
        }

        if (order.orderStatus !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled at this stage',
            });
        }

        order.orderStatus = 'cancelled';
        await order.save();

        res.json({
            success: true,
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user', 'name email')
            .sort('-createdAt');

        res.json({
            success: true,
            count: orders.length,
            data: orders,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const updatePaymentStatus = async (req, res) => {
    try {
        const { paymentStatus } = req.body;

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        order.paymentStatus = paymentStatus;
        await order.save();

        res.json({
            success: true,
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
