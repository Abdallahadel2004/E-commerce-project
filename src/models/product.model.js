import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true, 
    maxlength: [100, 'Product name cannot exceed 100 characters'],
    index: true 
  },
  
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  

  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'],
    set: v => Math.round(v * 100) / 100 
  },
  
  compareAtPrice: { 
    type: Number,
    min: [0, 'Compare price cannot be negative'],
    validate: {
      validator: function(value) {

        return !value || value > this.price;
      },
      message: 'Compare at price must be greater than regular price'
    }
  },
  

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category', 
    required: [true, 'Product category is required'],
    index: true
  },
  
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: [true, 'Seller information is required'],
    index: true
  },
  

  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: { 
      type: String,
      required: true
    },
    alt: { 
      type: String,
      default: 'Product image'
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Inventory
  sku: { // Stock Keeping Unit - unique identifier
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  
  inventory: {
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Inventory cannot be negative'],
      default: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 5
    },
    trackInventory: {
      type: Boolean,
      default: true
    }
  },
  
  // Variants (for products with options like size, color)
  variants: [{
    name: { // e.g., "Size", "Color"
      type: String,
      required: true
    },
    options: [{
      value: String, // e.g., "Large", "Red"
      sku: String, // Unique SKU for this variant
      price: Number, // Optional variant-specific price
      quantity: Number, // Variant-specific inventory
      images: [String] // Variant-specific images
    }]
  }],
  
  // Attributes (dynamic product specifications)
  attributes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed, // Can store any type
    default: {}
  },
  
  // SEO fields
  seo: {
    title: String,
    description: String,
    keywords: [String],
    slug: {
      type: String,
      unique: true,
      lowercase: true
    }
  },
  
  // Ratings (aggregated from reviews)
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: v => Math.round(v * 10) / 10 // Round to 1 decimal
    },
    count: {
      type: Number,
      default: 0
    }
  },
  
  // Statistics
  views: {
    type: Number,
    default: 0
  },
  
  soldCount: {
    type: Number,
    default: 0
  },
  
  // Status flags
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Soft delete
  deletedAt: {
    type: Date,
    default: null,
    index: true
  },
  
  // Shipping
  shipping: {
    weight: {
      value: Number,
      unit: {
        type: String,
        enum: ['kg', 'g', 'lb', 'oz'],
        default: 'kg'
      }
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['cm', 'in'],
        default: 'cm'
      }
    },
    freeShipping: {
      type: Boolean,
      default: false
    },
    shippingRate: Number // Flat rate if not free
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true }, // Include virtuals when converting to JSON
  toObject: { virtuals: true } // Include virtuals when converting to object
});



// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
  return 0;
});

// Virtual for reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
  options: { sort: { createdAt: -1 } } // Sort by newest first
});

// Virtual for inStock status
productSchema.virtual('inStock').get(function() {
  if (!this.inventory.trackInventory) return true;
  return this.inventory.quantity > 0;
});

/**
 * Indexes for better query performance
 */
productSchema.index({ name: 'text', description: 'text' }); // Text search index
productSchema.index({ price: 1, createdAt: -1 }); // Compound index for sorting
productSchema.index({ category: 1, isActive: 1 }); // Category filter index
productSchema.index({ seller: 1, isActive: 1 }); // Seller products index

/**
 * Pre-save Middleware
 * Runs before saving the document
 */
productSchema.pre('save', function(next) {
  // Generate SEO slug if not provided
  if (!this.seo || !this.seo.slug) {
    this.seo = this.seo || {};
    this.seo.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace special chars with hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }
  next();
});

/**
 * Instance Methods
 * Available on each product document
 */

// Check if product is in stock for given quantity
productSchema.methods.isInStock = function(quantity = 1) {
  if (!this.inventory.trackInventory) return true;
  return this.inventory.quantity >= quantity;
};

// Reduce inventory when order is placed
productSchema.methods.reduceInventory = async function(quantity) {
  if (this.inventory.trackInventory) {
    this.inventory.quantity -= quantity;
    this.soldCount += quantity;
    
    // Check if stock is low
    if (this.inventory.quantity <= this.inventory.lowStockThreshold) {
      // Trigger low stock notification (we'll implement this later)
      console.log(`Low stock alert for product: ${this.name}`);
    }
    
    await this.save();
  }
  return this;
};

// Increase inventory when order is cancelled
productSchema.methods.increaseInventory = async function(quantity) {
  if (this.inventory.trackInventory) {
    this.inventory.quantity += quantity;
    await this.save();
  }
  return this;
};

// Add product image
productSchema.methods.addImage = async function(imageData) {
  // If this is the first image, make it primary
  if (this.images.length === 0) {
    imageData.isPrimary = true;
  }
  
  this.images.push(imageData);
  await this.save();
  return this;
};

// Remove product image
productSchema.methods.removeImage = async function(imageId) {
  const imageIndex = this.images.findIndex(img => img.publicId === imageId);
  
  if (imageIndex > -1) {
    // If removing primary image, set another as primary
    if (this.images[imageIndex].isPrimary && this.images.length > 1) {
      const newPrimaryIndex = imageIndex === 0 ? 1 : 0;
      this.images[newPrimaryIndex].isPrimary = true;
    }
    
    this.images.splice(imageIndex, 1);
    await this.save();
  }
  
  return this;
};

// Set primary image
productSchema.methods.setPrimaryImage = async function(imageId) {
  this.images.forEach(img => {
    img.isPrimary = img.publicId === imageId;
  });
  await this.save();
  return this;
};

/**
 * Static Methods
 * Available on the Product model itself
 */

// Find products by category with pagination
productSchema.statics.findByCategory = function(categoryId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  return this.find({ 
    category: categoryId,
    isActive: true,
    deletedAt: null 
  })
    .populate('category', 'name')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');
};

// Search products with filters
productSchema.statics.search = function(query, filters = {}, page = 1, limit = 10) {
  const searchQuery = {
    isActive: true,
    deletedAt: null,
    ...filters
  };
  
  // If search term provided, use text search
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  const skip = (page - 1) * limit;
  
  return this.find(searchQuery)
    .populate('category', 'name')
    .populate('seller', 'name')
    .skip(skip)
    .limit(limit)
    .sort(query ? { score: { $meta: 'textScore' } } : '-createdAt');
};

// Get low stock products for seller
productSchema.statics.getLowStockProducts = function(sellerId) {
  return this.find({
    seller: sellerId,
    'inventory.trackInventory': true,
    $expr: { $lte: ['$inventory.quantity', '$inventory.lowStockThreshold'] },
    isActive: true,
    deletedAt: null
  });
};

const Product = mongoose.model('Product', productSchema);
export default Product;
