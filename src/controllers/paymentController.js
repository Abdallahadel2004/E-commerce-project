import stripe from '../utils/paymentService.js';
import Order from '../models/Order.js';
import Payment from '../models/payment.model.js';

export const createCheckoutSession = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.isPaid)
            return res.status(400).json({ message: 'Order already paid' });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: order.items.map((item) => ({
                price_data: {
                    currency: 'egp',
                    product_data: { name: item.name },
                    unit_amount: item.price * 100,
                },
                quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: 'http://localhost:3000/payment/cancel',
            metadata: { orderId: order._id.toString() },
        });
        console.log('stripeSessionId:' + session.id);
        await Payment.create({
            order_id: order._id,
            user_id: order.user,
            method: order.paymentMethod,
            amount: order.totalAmount,
            stripeSessionId: session.id,
            status: 'pending',
        });
        console.log(session.id);
        res.json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const success = async (req, res) => {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).send('No session ID');

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);

        const payment = await Payment.findOne({ stripeSessionId: session.id });
        if (!payment) return res.send('<h1>Payment not found</h1>');
        let order;

        if (payment.status === 'pending' && session.payment_status === 'paid') {
            payment.status = 'completed';
            await payment.save();

            order = await Order.findById(payment.order_id);
            order.paymentStatus = 'paid';
            order.orderStatus = 'processing';
            order.isPaid = true;
            await order.save();
        }

        res.send(`
            <h1>Payment Successful</h1>
            <p>Order #${order.orderNumber} has been confirmed.</p>
            <p>Payment status: ${payment.status}</p>
            <a href="/shop">Back to shop</a>
        `);
    } catch (err) {
        res.status(500).send(err.message);
    }
};
