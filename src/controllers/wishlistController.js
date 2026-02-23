import Wishlist from '../models/wishlist.js';

export const getWishlist = async (req, res) => {
    console.log('get wishlist');

    try {
        let wishlist = await Wishlist.findOne({
            user_id: req.user._id,
        }).populate('products.product', 'name price images');

        if (!wishlist) {
            wishlist = await Wishlist.create({
                user_id: req.user._id,
                products: [],
            });
        }

        res.json({
            success: true,
            wishlist,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const addToWishlist = async (req, res) => {
    console.log('add to wishlist');
    try {
        const { productId } = req.params;

        let wishlist = await Wishlist.findOne({ user_id: req.user._id });

        if (!wishlist) {
            wishlist = await Wishlist.create({
                user_id: req.user._id,
                products: [],
            });
        }

        const exists = wishlist.products.some(
            (item) => item.product.toString() === productId
        );

        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Product already in wishlist',
            });
        }

        wishlist.products.push({ product: productId });
        await wishlist.save();

        res.json({
            success: true,
            message: 'Product added to wishlist',
            wishlist,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const removeFromWishlist = async (req, res) => {
    // console.log('remove to wishlist');

    try {
        const { productId } = req.params;
        // console.log(productId);

        const wishlist = await Wishlist.findOne({ user_id: req.user._id });
        console.log(wishlist);

        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found',
            });
        }

        wishlist.products = wishlist.products.filter(
            (item) => item.product.toString() !== productId
        );

        await wishlist.save();

        res.json({
            success: true,
            message: 'Product removed from wishlist',
            wishlist,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const clearWishlist = async (req, res) => {
    console.log('clear wishlist');

    try {
        const wishlist = await Wishlist.findOne({ user_id: req.user._id });

        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found',
            });
        }

        wishlist.products = [];
        await wishlist.save();

        res.json({
            success: true,
            message: 'Wishlist cleared',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
