import Order from '../models/Order.js';

export const createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod } = req.body;

        const totalAmount = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const order = await Order.create({
            user: req.user.id,
            orderNumber: `ORD-${Date.now()}`,
            items,
            totalAmount,
            shippingAddress,
            paymentMethod,
            orderStatus: 'pending',
            paymentStatus: 'pending',
        });

        res.status(201).json({
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

export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort(
            '-createdAt'
        );
        res.json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order)
            return res
                .status(404)
                .json({ success: false, message: 'Order not found' });

        if (
            order.user.toString() !== req.user.id &&
            req.user.role !== 'admin'
        ) {
            return res
                .status(403)
                .json({ success: false, message: 'Not authorized' });
        }

        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
            if (order.orderStatus === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    message: 'Order is Already Cancelled',
                });
            }

            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled at this stage',
            });
        }

        order.orderStatus = 'cancelled';
        await order.save();

        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user', 'name email')
            .sort('-createdAt');
        res.json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order)
            return res
                .status(404)
                .json({ success: false, message: 'Order not found' });

        order.orderStatus = status;
        await order.save();

        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updatePaymentStatus = async (req, res) => {
    try {
        const { paymentStatus } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order)
            return res
                .status(404)
                .json({ success: false, message: 'Order not found' });

        order.paymentStatus = paymentStatus;
        await order.save();

        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
