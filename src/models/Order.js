import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Product',
                    required: true,
                },
                name: String,
                price: Number,
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
            },
        ],
        totalAmount: {
            type: Number,
            required: true,
        },
        shippingAddress: {
            address: String,
            city: String,
            postalCode: String,
            country: String,
        },
        paymentMethod: {
            type: String,
            enum: [
                'card',
                'credit_card',
                'paypal',
                'cash_on_delivery',
                'wallet',
            ],
            default: 'card',
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed'],
            default: 'pending',
        },
        orderStatus: {
            type: String,
            enum: [
                'pending',
                'processing',
                'shipped',
                'delivered',
                'cancelled',
            ],
            default: 'pending',
        },
        orderNumber: {
            type: String,
            unique: true,
            sparse: true,
        },
        isPaid: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// OrderSchema.pre('save', function (next) {
//     if (!this.orderNumber) {
//         this.orderNumber = `ORD-${uuidv4().slice(0, 8)}`;
//     }
//     next();
// });

const Order = mongoose.model('Order', OrderSchema);
export default Order;
