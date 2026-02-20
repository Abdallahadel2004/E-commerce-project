import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    session_id: {
      type: String,
    },
  },
  { timestamps: true }
);

cartSchema.index({ user_id: 1 }, { unique: true, sparse: true });
cartSchema.index({ session_id: 1 }, { unique: true, sparse: true });

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;
