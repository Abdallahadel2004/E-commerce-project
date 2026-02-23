import crypto from 'crypto';
import Cart from '../models/cart.model.js';
import CartItem from '../models/cartItem.model.js';
import Product from '../models/product.js';
import Order from '../models/Order.js';

const COOKIE_NAME = 'guest_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days for cookie

const getOrCreateCart = async (req, res) => {
    const sessionId = req.cookies[COOKIE_NAME];

    // Logged-in user
    if (req.user) {
        let userCart = await Cart.findOne({ user_id: req.user._id });

        // Check if there's a guest cart that should be merged
        if (sessionId) {
            const guestCart = await Cart.findOne({ session_id: sessionId });

            if (guestCart) {
                if (!userCart) {
                    // No user cart yet → convert guest cart to user cart
                    guestCart.user_id = req.user._id;
                    guestCart.session_id = undefined;
                    await guestCart.save();
                    res.clearCookie(COOKIE_NAME);
                    return guestCart;
                }

                // Both exist → merge guest items into user cart
                const guestItems = await CartItem.find({
                    cart_id: guestCart._id,
                });
                for (const item of guestItems) {
                    const existing = await CartItem.findOne({
                        cart_id: userCart._id,
                        product_id: item.product_id,
                    });
                    if (existing) {
                        existing.quantity += item.quantity;
                        await existing.save();
                    } else {
                        item.cart_id = userCart._id;
                        await item.save();
                    }
                }
                // Delete the guest cart
                await CartItem.deleteMany({ cart_id: guestCart._id });
                await guestCart.deleteOne();
                res.clearCookie(COOKIE_NAME);
            }
        }

        if (!userCart) {
            userCart = await Cart.create({ user_id: req.user._id });
        }
        return userCart;
    }

    //  Guest user
    if (!sessionId) {
        const newSessionId = crypto.randomUUID();
        res.cookie(COOKIE_NAME, newSessionId, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            maxAge: COOKIE_MAX_AGE,
        });
        return await Cart.create({ session_id: newSessionId });
    }

    let cart = await Cart.findOne({ session_id: sessionId });
    if (!cart) {
        cart = await Cart.create({ session_id: sessionId });
    }
    return cart;
};

export const addToCart = async (req, res) => {
    try {
        const { product_id, quantity = 1 } = req.body;

        if (!product_id) {
            return res
                .status(400)
                .json({ success: false, message: 'product_id is required' });
        }

        const product = await Product.findById(product_id);
        if (!product) {
            return res
                .status(404)
                .json({ success: false, message: 'Product not found' });
        }

        const cart = await getOrCreateCart(req, res);

        let cartItem = await CartItem.findOne({
            cart_id: cart._id,
            product_id,
        });
        const existingQty = cartItem ? cartItem.quantity : 0;

        if (product.inventory.quantity < existingQty + quantity) {
            return res
                .status(400)
                .json({ success: false, message: 'Not enough stock' });
        }

        if (cartItem) {
            cartItem.quantity += quantity;
            await cartItem.save();
        } else {
            cartItem = await CartItem.create({
                cart_id: cart._id,
                product_id,
                quantity,
            });
        }

        res.status(200).json({
            success: true,
            message: 'Item added to cart',
            cartItem,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const removeItemFromCart = async (req, res) => {
    try {
        const cart = await getOrCreateCart(req, res);

        const cartItem = await CartItem.findOne({
            cart_id: cart._id,
            product_id: req.params.productId,
        });

        if (!cartItem) {
            return res
                .status(404)
                .json({ success: false, message: 'Item not found in cart' });
        }

        await cartItem.deleteOne();
        res.status(200).json({
            success: true,
            message: 'Item removed from cart',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateCartItemQuantity = async (req, res) => {
    try {
        const { quantity } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be at least 1',
            });
        }

        const cart = await getOrCreateCart(req, res);

        const cartItem = await CartItem.findOne({
            cart_id: cart._id,
            product_id: req.params.productId,
        });

        if (!cartItem) {
            return res
                .status(404)
                .json({ success: false, message: 'Item not found in cart' });
        }

        const product = await Product.findById(cartItem.product_id);
        if (product && product.inventory.quantity < quantity) {
            return res
                .status(400)
                .json({ success: false, message: 'Not enough stock' });
        }

        cartItem.quantity = quantity;
        await cartItem.save();

        res.status(200).json({
            success: true,
            message: 'Quantity updated',
            cartItem,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getCart = async (req, res) => {
    try {
        const cart = await getOrCreateCart(req, res);

        const cartItems = await CartItem.find({ cart_id: cart._id }).populate(
            'product_id',
            'name price images inventory'
        );

        let totalPrice = 0;
        const items = cartItems.map((item) => {
            const itemTotal = item.product_id
                ? item.product_id.price * item.quantity
                : 0;
            totalPrice += itemTotal;
            return {
                _id: item._id,
                product: item.product_id,
                quantity: item.quantity,
                itemTotal,
            };
        });

        res.status(200).json({
            success: true,
            cart: {
                _id: cart._id,
                items,
                totalItems: items.length,
                totalPrice,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const clearCart = async (req, res) => {
    try {
        const cart = await getOrCreateCart(req, res);

        await CartItem.deleteMany({ cart_id: cart._id });
        res.status(200).json({ success: true, message: 'Cart cleared' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Checkout – convert cart into a pending Order
// @route   POST /api/cart/checkout
// @access  Private (requires auth)
export const checkout = async (req, res) => {
    console.log('1');
    try {
        console.log('2');

        // 1. Must be logged in to checkout
        if (!req.user) {
            console.log('3');

            return res.status(401).json({
                success: false,
                message: 'Please sign in to checkout',
            });
        }

        console.log('4');

        // 2. Load the cart and its items
        const cart = await getOrCreateCart(req, res);
        const cartItems = await CartItem.find({ cart_id: cart._id }).populate(
            'product_id',
            'name price inventory'
        );

        // console.log('5');

        if (!cartItems.length) {
            return res
                .status(400)
                .json({ success: false, message: 'Cart is empty' });
        }

        // 3. Validate stock and build order items
        const orderItems = [];
        let totalAmount = 0;
        // check product exist and stock
        for (const item of cartItems) {
            if (!item.product_id) {
                return res.status(400).json({
                    success: false,
                    message: `A product in your cart no longer exists. Please remove it and try again.`,
                });
            }

            // console.log('6');

            if (item.product_id.inventory.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for "${item.product_id.name}". Available: ${item.product_id.inventory.quantity}`,
                });
            }

            // console.log('7');

            orderItems.push({
                product: item.product_id._id,
                name: item.product_id.name,
                price: item.product_id.price,
                quantity: item.quantity,
            });

            totalAmount += item.product_id.price * item.quantity;
        }
        // console.log('8');

        // 4. Read shipping And payment info from body
        // console.log(req.body);
        const { shippingAddress, paymentMethod = 'card' } = req.body;
        console.log(shippingAddress);

        if (!shippingAddress) {
            return res.status(400).json({
                success: false,
                message: 'Shipping address is required',
            });
        }

        // 5. Generate order number
        const orderNumber = `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        // 6. Create the Order
        const order = await Order.create({
            user: req.user._id,
            items: orderItems,
            totalAmount,
            shippingAddress,
            paymentMethod,
            orderStatus: 'pending',
            paymentStatus: 'pending',
            orderNumber,
        });

        // 7. Clear the cart
        await CartItem.deleteMany({ cart_id: cart._id });

        // 8. Return order info
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order_id: order._id,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
