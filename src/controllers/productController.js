const Product = require('../models/Product');
const Category = require('../models/Category');
const Seller = require('../models/Seller');
const { validationResult } = require('express-validator');
const cloudinary = require('../config/cloudinary');
const helpers = require('../utils/helpers');


exports.getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      minPrice,
      maxPrice,
      minRating,
      sort,
      search,
      seller,
      inStock,
      featured
    } = req.query;


    const filter = {
      isActive: true,
      deletedAt: null
    };

  
    if (category) {
      // Get category and all subcategories
      const categories = await Category.find({
        $or: [
          { _id: category },
          { parentCategory: category }
        ]
      }).distinct('_id');
      
      filter.category = { $in: categories };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Rating filter
    if (minRating) {
      filter['ratings.average'] = { $gte: parseFloat(minRating) };
    }

    // Seller filter
    if (seller) {
      filter.seller = seller;
    }

    // Stock filter
    if (inStock === 'true') {
      filter.$or = [
        { 'inventory.trackInventory': false },
        { 'inventory.quantity': { $gt: 0 } }
      ];
    }

    // Featured filter
    if (featured === 'true') {
      filter.isFeatured = true;
    }

    // Search filter
    let productsQuery;
    if (search) {
      // Use text search for better results
      productsQuery = Product.find(
        { $text: { $search: search }, ...filter },
        { score: { $meta: 'textScore' } }
      );
    } else {
      productsQuery = Product.find(filter);
    }

    // Sorting
    const sortOptions = {
      'price-asc': { price: 1 },
      'price-desc': { price: -1 },
      'rating-desc': { 'ratings.average': -1 },
      'newest': { createdAt: -1 },
      'popular': { soldCount: -1 },
      'relevance': search ? { score: { $meta: 'textScore' } } : { createdAt: -1 }
    };

    const sortField = sortOptions[sort] || sortOptions.newest;

    // Apply sorting
    productsQuery.sort(sortField);

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    productsQuery.skip(skip).limit(limitNum);

    // Populate references
    productsQuery
      .populate('category', 'name slug')
      .populate('seller', 'name email');

    // Execute query
    const products = await productsQuery;
    const total = await Product.countDocuments(filter);

    // Increment view count for each product (background process)
    products.forEach(product => {
      product.views += 1;
      product.save().catch(err => console.error('Failed to update view count:', err));
    });

    // Calculate discount for each product
    const productsWithDiscount = products.map(product => {
      const productObj = product.toObject();
      productObj.discountPercentage = product.discountPercentage;
      return productObj;
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      products: productsWithDiscount
    });
  } catch (error) {
    next(error);
  }
};


exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
      deletedAt: null
    })
      .populate('category', 'name description slug')
      .populate('seller', 'name email storeName')
      .populate({
        path: 'reviews',
        match: { isApproved: true },
        populate: {
          path: 'user',
          select: 'name profilePicture'
        },
        options: { limit: 10, sort: { createdAt: -1 } }
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment view count
    product.views += 1;
    await product.save();

    // Get related products (same category, excluding current)
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true,
      deletedAt: null
    })
      .limit(5)
      .select('name price images ratings average');

    res.status(200).json({
      success: true,
      product: {
        ...product.toObject(),
        discountPercentage: product.discountPercentage,
        inStock: product.inStock
      },
      relatedProducts
    });
  } catch (error) {
    next(error);
  }
};


exports.createProduct = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check if seller profile exists and is verified
    const seller = await Seller.findOne({ user: req.user.id });
    if (!seller || seller.verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'You need a verified seller account to create products'
      });
    }

    // Generate SKU if not provided
    if (!req.body.sku) {
      req.body.sku = helpers.generateSKU(
        req.body.name,
        req.body.category,
        Date.now().toString()
      );
    }

    // Check if SKU already exists
    const existingProduct = await Product.findOne({ sku: req.body.sku });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists'
      });
    }

    // Create product with seller ID
    const productData = {
      ...req.body,
      seller: req.user.id,
      'inventory.quantity': req.body.inventory || 0,
      'inventory.lowStockThreshold': req.body.lowStockThreshold || 5,
      'inventory.trackInventory': req.body.trackInventory !== false
    };

    const product = await Product.create(productData);

    // Update seller's product count
    seller.totalProducts += 1;
    await seller.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    next(error);
  }
};


exports.updateProduct = async (req, res, next) => {
  try {
    // Build query based on user role
    let query = { _id: req.params.id };
    
    // Sellers can only update their own products
    if (req.user.role === 'seller') {
      query.seller = req.user.id;
    }

    // Find product
    let product = await Product.findOne(query);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you do not have permission'
      });
    }

    // Prevent SKU change if it would cause duplicate
    if (req.body.sku && req.body.sku !== product.sku) {
      const existingProduct = await Product.findOne({ 
        sku: req.body.sku,
        _id: { $ne: product._id }
      });
      
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this SKU already exists'
        });
      }
    }

    // Update product
    product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    next(error);
  }
};



exports.deleteProduct = async (req, res, next) => {
  try {
    // Build query based on user role
    let query = { _id: req.params.id };
    
    if (req.user.role === 'seller') {
      query.seller = req.user.id;
    }

    const product = await Product.findOne(query);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you do not have permission'
      });
    }

    // Soft delete - set deletedAt and isActive
    product.deletedAt = new Date();
    product.isActive = false;
    await product.save();

    // Update seller's product count
    if (req.user.role === 'seller') {
      await Seller.findOneAndUpdate(
        { user: req.user.id },
        { $inc: { totalProducts: -1 } }
      );
    }

    // Delete images from cloud storage (optional)
    if (product.images && product.images.length > 0) {
      // Queue image deletion as background task
      product.images.forEach(image => {
        cloudinary.uploader.destroy(image.publicId)
          .catch(err => console.error('Failed to delete image:', err));
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};


exports.uploadImages = async (req, res, next) => {
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one image'
      });
    }

    // Find product
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you do not have permission'
      });
    }

    const uploadedImages = [];

    // Upload each image to Cloudinary
    for (const file of req.files) {
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'ecommerce/products',
          transformation: [
            { width: 1000, height: 1000, crop: 'limit' },
            { quality: 'auto' }
          ]
        });

        // Add image to product
        await product.addImage({
          url: result.secure_url,
          publicId: result.public_id,
          alt: req.body.alt || product.name
        });

        uploadedImages.push({
          url: result.secure_url,
          publicId: result.public_id
        });
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
      }
    }

    res.status(200).json({
      success: true,
      message: `${uploadedImages.length} images uploaded successfully`,
      images: uploadedImages
    });
  } catch (error) {
    next(error);
  }
};


exports.deleteImage = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you do not have permission'
      });
    }

    // Find image
    const image = product.images.find(img => img.publicId === req.params.imageId);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(image.publicId);

    // Remove from product
    await product.removeImage(req.params.imageId);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};


exports.setPrimaryImage = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you do not have permission'
      });
    }

    await product.setPrimaryImage(req.params.imageId);

    res.status(200).json({
      success: true,
      message: 'Primary image updated successfully'
    });
  } catch (error) {
    next(error);
  }
};


exports.getProductsByCategory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort } = req.query;

    const category = await Category.findById(req.params.categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get category and all subcategories
    const categories = await Category.find({
      $or: [
        { _id: req.params.categoryId },
        { parentCategory: req.params.categoryId }
      ]
    }).distinct('_id');

    // Build sort options
    const sortOptions = {
      'price-asc': { price: 1 },
      'price-desc': { price: -1 },
      'newest': { createdAt: -1 },
      'popular': { soldCount: -1 }
    };

    const sortOption = sortOptions[sort] || sortOptions.newest;

    // Get products
    const products = await Product.find({
      category: { $in: categories },
      isActive: true,
      deletedAt: null
    })
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('seller', 'name');

    const total = await Product.countDocuments({
      category: { $in: categories },
      isActive: true,
      deletedAt: null
    });

    res.status(200).json({
      success: true,
      category: {
        id: category._id,
        name: category.name,
        description: category.description
      },
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      products
    });
  } catch (error) {
    next(error);
  }
};


exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;

    const products = await Product.find({
      isFeatured: true,
      isActive: true,
      deletedAt: null
    })
      .limit(parseInt(limit))
      .populate('category', 'name')
      .populate('seller', 'name')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
};

exports.getRelatedProducts = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const products = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
      deletedAt: null
    })
      .limit(5)
      .select('name price images ratings average')
      .populate('category', 'name');

    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    next(error);
  }
};


exports.checkStock = async (req, res, next) => {
  try {
    const { quantity = 1 } = req.query;

    const product = await Product.findById(req.params.id)
      .select('name inventory sku');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const inStock = product.isInStock(parseInt(quantity));

    res.status(200).json({
      success: true,
      product: product.name,
      sku: product.sku,
      inStock,
      availableQuantity: product.inventory.quantity,
      requestedQuantity: parseInt(quantity),
      trackInventory: product.inventory.trackInventory
    });
  } catch (error) {
    next(error);
  }
};


exports.bulkUpdateProducts = async (req, res, next) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of products'
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const productData of products) {
      try {
        const product = await Product.findByIdAndUpdate(
          productData.id,
          productData.updates,
          { new: true, runValidators: true }
        );

        if (product) {
          results.successful.push({
            id: productData.id,
            message: 'Updated successfully'
          });
        } else {
          results.failed.push({
            id: productData.id,
            message: 'Product not found'
          });
        }
      } catch (error) {
        results.failed.push({
          id: productData.id,
          message: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Updated ${results.successful.length} products, ${results.failed.length} failed`,
      results
    });
  } catch (error) {
    next(error);
  }
};