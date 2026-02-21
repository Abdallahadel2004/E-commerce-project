import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Product name is required'],
            trim: true,
            maxlength: [100, 'Product name cannot exceed 100 characters'],
            index: true,
        },

        description: {
            type: String,
            required: [true, 'Product description is required'],
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
        },

        shortDescription: {
            type: String,
            maxlength: [200, 'Short description cannot exceed 200 characters'],
        },

        price: {
            type: Number,
            required: [true, 'Product price is required'],
            min: [0, 'Price cannot be negative'],
            set: (v) => Math.round(v * 100) / 100,
        },

        compareAtPrice: {
            type: Number,
            min: [0, 'Compare price cannot be negative'],
            validate: {
                validator: function (value) {
                    return !value || value > this.price;
                },
                message: 'Compare at price must be greater than regular price',
            },
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: [true, 'Product category is required'],
            index: true,
        },

        // CHANGED: 'seller' to 'createdBy' - more generic for admin/user
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator information is required'],
            index: true,
        },

        images: [
            {
                url: {
                    type: String,
                    required: true,
                },
                publicId: {
                    type: String,
                    required: true,
                },
                alt: {
                    type: String,
                    default: 'Product image',
                },
                isPrimary: {
                    type: Boolean,
                    default: false,
                },
            },
        ],

        sku: {
            type: String,
            required: [true, 'SKU is required'],
            unique: true,
            uppercase: true,
            trim: true,
        },

        inventory: {
            quantity: {
                type: Number,
                required: true,
                min: [0, 'Inventory cannot be negative'],
                default: 0,
            },
            lowStockThreshold: {
                type: Number,
                default: 5,
            },
            trackInventory: {
                type: Boolean,
                default: true,
            },
        },

        variants: [
            {
                name: {
                    type: String,
                    required: true,
                },
                options: [
                    {
                        value: String,
                        sku: String,
                        price: Number,
                        quantity: Number,
                        images: [String],
                    },
                ],
            },
        ],

        attributes: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
        },

        seo: {
            title: String,
            description: String,
            keywords: [String],
            slug: {
                type: String,
                unique: true,
                lowercase: true,
            },
        },

        ratings: {
            average: {
                type: Number,
                default: 0,
                min: 0,
                max: 5,
                set: (v) => Math.round(v * 10) / 10,
            },
            count: {
                type: Number,
                default: 0,
            },
        },

        views: {
            type: Number,
            default: 0,
        },

        soldCount: {
            type: Number,
            default: 0,
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },

        isFeatured: {
            type: Boolean,
            default: false,
            index: true,
        },

        deletedAt: {
            type: Date,
            default: null,
            index: true,
        },

        shipping: {
            weight: {
                value: Number,
                unit: {
                    type: String,
                    enum: ['kg', 'g', 'lb', 'oz'],
                    default: 'kg',
                },
            },
            dimensions: {
                length: Number,
                width: Number,
                height: Number,
                unit: {
                    type: String,
                    enum: ['cm', 'in'],
                    default: 'cm',
                },
            },
            freeShipping: {
                type: Boolean,
                default: false,
            },
            shippingRate: Number,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

productSchema.virtual('discountPercentage').get(function () {
    if (this.compareAtPrice && this.compareAtPrice > this.price) {
        return Math.round(
            ((this.compareAtPrice - this.price) / this.compareAtPrice) * 100
        );
    }
    return 0;
});

productSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'product',
    options: { sort: { createdAt: -1 } },
});

productSchema.virtual('inStock').get(function () {
    if (!this.inventory.trackInventory) return true;
    return this.inventory.quantity > 0;
});

// Indexes
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ price: 1, createdAt: -1 });
productSchema.index({ category: 1, isActive: 1 });
// CHANGED: Index for createdBy instead of seller
productSchema.index({ createdBy: 1, isActive: 1 });

// Pre-save Middleware
// productSchema.pre('save', function(next) {
//   if (!this.seo || !this.seo.slug) {
//     this.seo = this.seo || {};
//     this.seo.slug = this.name
//       .toLowerCase()
//       .replace(/[^a-z0-9]+/g, '-')
//       .replace(/^-|-$/g, '');
//   }
//   next();
// });

// Instance Methods
productSchema.methods.isInStock = function (quantity = 1) {
    if (!this.inventory.trackInventory) return true;
    return this.inventory.quantity >= quantity;
};

productSchema.methods.reduceInventory = async function (quantity) {
    if (this.inventory.trackInventory) {
        this.inventory.quantity -= quantity;
        this.soldCount += quantity;

        if (this.inventory.quantity <= this.inventory.lowStockThreshold) {
            console.log(`Low stock alert for product: ${this.name}`);
        }

        await this.save();
    }
    return this;
};

productSchema.methods.increaseInventory = async function (quantity) {
    if (this.inventory.trackInventory) {
        this.inventory.quantity += quantity;
        await this.save();
    }
    return this;
};

productSchema.methods.addImage = async function (imageData) {
    if (this.images.length === 0) {
        imageData.isPrimary = true;
    }

    this.images.push(imageData);
    await this.save();
    return this;
};

productSchema.methods.removeImage = async function (imageId) {
    const imageIndex = this.images.findIndex((img) => img.publicId === imageId);

    if (imageIndex > -1) {
        if (this.images[imageIndex].isPrimary && this.images.length > 1) {
            const newPrimaryIndex = imageIndex === 0 ? 1 : 0;
            this.images[newPrimaryIndex].isPrimary = true;
        }

        this.images.splice(imageIndex, 1);
        await this.save();
    }

    return this;
};

productSchema.methods.setPrimaryImage = async function (imageId) {
    this.images.forEach((img) => {
        img.isPrimary = img.publicId === imageId;
    });
    await this.save();
    return this;
};

// Static Methods
productSchema.statics.findByCategory = function (
    categoryId,
    page = 1,
    limit = 10
) {
    const skip = (page - 1) * limit;

    return this.find({
        category: categoryId,
        isActive: true,
        deletedAt: null,
    })
        .populate('category', 'name')
        .skip(skip)
        .limit(limit)
        .sort('-createdAt');
};

productSchema.statics.search = function (
    query,
    filters = {},
    page = 1,
    limit = 10
) {
    const searchQuery = {
        isActive: true,
        deletedAt: null,
        ...filters,
    };

    if (query) {
        searchQuery.$text = { $search: query };
    }

    const skip = (page - 1) * limit;

    return (
        this.find(searchQuery)
            .populate('category', 'name')
            // CHANGED: populate createdBy instead of seller
            .populate('createdBy', 'name email')
            .skip(skip)
            .limit(limit)
            .sort(query ? { score: { $meta: 'textScore' } } : '-createdAt')
    );
};

// CHANGED: Get products created by a specific user
productSchema.statics.getUserProducts = function (userId) {
    return this.find({
        createdBy: userId,
        isActive: true,
        deletedAt: null,
    }).sort('-createdAt');
};

// CHANGED: Get low stock products (admin only - no seller filter)
productSchema.statics.getLowStockProducts = function () {
    return this.find({
        'inventory.trackInventory': true,
        $expr: {
            $lte: ['$inventory.quantity', '$inventory.lowStockThreshold'],
        },
        isActive: true,
        deletedAt: null,
    });
};
const Product = mongoose.model('Product', productSchema);
export default Product;
