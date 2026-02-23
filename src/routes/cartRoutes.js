import express from "express";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { auth } from "../middleware/auth.middleware.js";
import {
  addToCart,
  removeItemFromCart,
  updateCartItemQuantity,
  getCart,
  clearCart,
  checkout,
} from "../controllers/cartController.js";

const router = express.Router();

router.use(optionalAuth);

router.get("/", getCart);
router.post("/items", addToCart);
router.patch("/items/:productId", updateCartItemQuantity);
router.delete("/items/:productId", removeItemFromCart);
router.delete("/", clearCart);

// Checkout requires full authentication
router.post("/checkout", auth, checkout);

export default router;

