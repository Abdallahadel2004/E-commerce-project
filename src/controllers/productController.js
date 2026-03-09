import mongoose from "mongoose";
import Product from "../models/product.js";
import Category from "../models/category.js";
import { embedProduct } from "../services/autoEmbedService.js"; // ← NEW

// GET all products
export const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      minPrice,
      maxPrice,
      search,
    } = req.query;
    const query = { isActive: true, deletedAt: null };
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (search) query.$text = { $search: search };

    const skip = (page - 1) * limit;
    const products = await Product.find(query)
      .populate("category", "name")
      .populate("createdBy", "name email")
      .skip(skip)
      .limit(parseInt(limit))
      .sort("-createdAt");
    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET single product
export const getProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("createdBy", "name email");
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    product.views += 1;
    res.json({ success: true, product });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE product — auto-embeds after save
export const createProduct = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admin can create products" });
    }

    const { name, description, price, category, sku, inventory } = req.body;

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res
        .status(400)
        .json({ success: false, message: "Category not found" });
    }

    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res
        .status(400)
        .json({ success: false, message: "SKU already exists" });
    }

    const product = await Product.create({
      name,
      description,
      price,
      category,
      createdBy: req.user.id,
      sku,
      inventory: { quantity: inventory || 0 },
    });

    // ─── AUTO-EMBED: awaited so errors surface in logs ───────────────────
    try {
      await embedProduct(product);
    } catch (e) {
      console.error("Auto-embed failed on create:", e.message);
    }

    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE product — re-embeds after save so search stays accurate
export const updateProduct = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admin can update products" });
    }

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // ─── RE-EMBED: awaited so errors surface in logs ─────────────────────
    try {
      await embedProduct(product);
    } catch (e) {
      console.error("Auto-embed failed on update:", e.message);
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE product (soft delete)
export const deleteProduct = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admin can delete products" });
    }
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    product.isActive = false;
    product.deletedAt = new Date();
    await product.save();
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ADD images
export const addImages = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    const { images } = req.body;
    for (const img of images) {
      if (product.images.length === 0) img.isPrimary = true;
      product.images.push(img);
    }
    await product.save();
    res.json({ success: true, images: product.images });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET user products
export const getUserProducts = async (req, res) => {
  try {
    const products = await Product.find({
      createdBy: req.user.id,
      deletedAt: null,
    }).sort("-createdAt");
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET low stock
export const getLowStockProducts = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admin can view low stock" });
    }
    const products = await Product.find({
      "inventory.trackInventory": true,
      $expr: { $lte: ["$inventory.quantity", "$inventory.lowStockThreshold"] },
      isActive: true,
      deletedAt: null,
    });
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// SEARCH products
export const searchProducts = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const products = await Product.find({
      $text: { $search: q },
      isActive: true,
      deletedAt: null,
    })
      .populate("category", "name")
      .populate("createdBy", "name email")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ score: { $meta: "textScore" } });

    const total = await Product.countDocuments({
      $text: { $search: q },
      isActive: true,
      deletedAt: null,
    });
    res.json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
