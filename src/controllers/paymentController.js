import stripe from '../utils/paymentService.js';
import Order from '../models/Order.js';
import Payment from '../models/payment.model.js';
import Product from '../models/product.js';

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
                    unit_amount: Math.round(item.price * 100),
                },
                quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: 'http://localhost:3000/payment/cancel',
            metadata: { orderId: order._id.toString() },
        });
        // console.log('stripeSessionId:' + session.id);
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
    // console.log(1);
    const { session_id } = req.query;
    if (!session_id) return res.status(400).send('No session ID');
    // console.log(2);
    let order;

    try {
        // console.log(3);

        const session = await stripe.checkout.sessions.retrieve(session_id);

        const payment = await Payment.findOne({ stripeSessionId: session.id });
        // console.log(payment);
        if (!payment) return res.send('<h1>Payment not found</h1>');

        // console.log(4);
        order = await Order.findById(payment.order_id);

        if (payment.status === 'pending' && session.payment_status === 'paid') {
            payment.status = 'completed';
            console.log(5);

            await payment.save();
            // console.log(6);

            // console.log(payment.order_id);

            // console.log(order);
            order.paymentStatus = 'paid';
            order.orderStatus = 'processing';
            order.isPaid = true;
            await order.save();

            for (const item of order.items) {
                await Product.updateOne(
                    { _id: item.product },
                    {
                        $inc: {
                            'inventory.quantity': -item.quantity,
                            soldCount: item.quantity,
                        },
                    }
                );
            }
        }

        // console.log(5);
        // console.log(order);

        res.send(`
            <h1>Payment Successful</h1>
            <p>Order #${order.orderNumber} has been confirmed.</p>
            <p>Payment status: ${payment.status}</p>
            <a href="/">Back to home</a>
        `);
    } catch (err) {
        res.status(500).send(err.message);
    }
};
