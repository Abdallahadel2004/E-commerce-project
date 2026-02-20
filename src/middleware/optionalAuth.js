import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // No token → genuine guest
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    req.user = null;
    return next();
  }

  // Token provided → must be valid
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
  } catch {
    return res.status(401).json({
      success: false,
      message: "Token expired or invalid, please sign in again",
    });
  }

  next();
};
