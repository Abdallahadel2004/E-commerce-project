import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
    {
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        method: {
            type: String,
            required: true,
            enum: [
                'card',
                'credit_card',
                'paypal',
                'cash_on_delivery',
                'wallet',
            ],
        },
        status: {
            type: String,
            required: true,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending',
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        stripeSessionId: {
            type: String,
            required: true,
        },
        stripePaymentIntentId: {
            type: String,
        },
    },
    { timestamps: true }
);

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
