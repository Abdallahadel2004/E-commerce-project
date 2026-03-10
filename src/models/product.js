import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
      index: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    shortDescription: {
      type: String,
      maxlength: [200, "Short description cannot exceed 200 characters"],
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
      set: (v) => Math.round(v * 100) / 100,
    },
    compareAtPrice: {
      type: Number,
      min: [0, "Compare price cannot be negative"],
      validate: {
        validator: function (value) {
          return !value || value > this.price;
        },
        message: "Compare at price must be greater than regular price",
      },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator information is required"],
      index: true,
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        alt: { type: String, default: "Product image" },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    inventory: {
      quantity: { type: Number, default: 0 },
      lowStockThreshold: { type: Number, default: 5 },
      trackInventory: { type: Boolean, default: true },
    },
    variants: [
      {
        name: { type: String, required: true },
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
    attributes: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    seo: {
      title: String,
      description: String,
      keywords: [String],
      slug: {
        type: String,
        lowercase: true,
        trim: true,
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
      count: { type: Number, default: 0 },
    },
    views: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
    shipping: {
      weight: {
        value: Number,
        unit: {
          type: String,
          enum: ["kg", "g", "lb", "oz"],
          default: "kg",
        },
      },
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: { type: String, enum: ["cm", "in"], default: "cm" },
      },
      freeShipping: { type: Boolean, default: false },
      shippingRate: Number,
    },

    // ─── TEXT Embedding (chat / semantic search) ──────────────────────────
    // 384-dimensional vector — sentence-transformers/all-MiniLM-L6-v2
    // Atlas index : product_vector_index  (numDimensions: 384, cosine)
    // Populated by: scripts/generateEmbeddings.js  +  post-save hook
    embedding: {
      type: [Number],
      default: undefined,
      select: false, // never returned in normal API responses
    },

    // ─── IMAGE Embedding (visual product search) ──────────────────────────
    // 512-dimensional vector — openai/clip-vit-base-patch32
    // Atlas index : product_image_vector_index  (numDimensions: 512, cosine)
    // Populated by: scripts/generateImageEmbeddings.js
    //               POST /api/visual-search/embed/:productId
    imageEmbedding: {
      type: [Number],
      default: undefined,
      select: false, // never returned in normal API responses
    },
    imageEmbeddingGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Static helpers used by embedding scripts ─────────────────────────────

/** Products missing image embeddings — used by generateImageEmbeddings.js */
productSchema.statics.findWithoutImageEmbedding = function () {
  return this.find({
    $or: [
      { imageEmbedding: { $exists: false } },
      { imageEmbedding: { $size: 0 } },
    ],
    isActive: { $ne: false },
    deletedAt: null,
  }).select("+imageEmbedding name images");
};

const Product = mongoose.model("Product", productSchema);
export default Product;
