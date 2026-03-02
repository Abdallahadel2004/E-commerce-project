import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { validateSignin, validateSignup } from "../middleware/validation.js";
import sendEmail from "../email/email.js";
import { forgotPasswordTemplate } from "../email/forgotPasswordTemplate.js";

// ─────────────────────────────────────────
//  SIGNUP
// ─────────────────────────────────────────
export const signup = async (req, res) => {
  try {
    const valid = validateSignup(req.body);
    if (!valid) {
      return res.status(400).json({
        timestamp: new Date(),
        success: false,
        errors: validateSignup.errors,
      });
    }

    const { name, email, password, phone, address } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        timestamp: new Date(),
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
    });

    sendEmail(user.email).catch((err) =>
      console.error("Failed to send confirmation email:", err),
    );

    res.status(201).json({
      timestamp: new Date(),
      success: true,
      message: `Welcome ${user.name}! Please check your email to confirm your account.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isConfirmed: user.isConfirmed,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ timestamp: new Date(), success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
//  SIGNIN
// ─────────────────────────────────────────
export const signin = async (req, res) => {
  try {
    // 1. Validation check (Assuming validateSignin is defined in your controller file)
    const valid = validateSignin(req.body);
    if (!valid) {
      return res.status(400).json({
        timestamp: new Date(),
        success: false,
        errors: validateSignin.errors,
      });
    }

    const { email, password } = req.body;

    // 2. Find user by email
    const user = await User.findOne({ email });

    // 3. Verify user existence and password match
    // Using 401 (Unauthorized) so the interceptor knows it's an auth failure
    if (!user) {
      return res.status(401).json({
        timestamp: new Date(),
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        timestamp: new Date(),
        success: false,
        message: "Invalid email or password",
      });
    }

    // 4. Check email confirmation
    // Using 403 (Forbidden) for verified account checks
    if (!user.isConfirmed) {
      return res.status(403).json({
        timestamp: new Date(),
        success: false,
        message: "Please verify your email before signing in",
      });
    }

    // 5. Generate JWT Token
    // Dynamic expiration based on "Remember Me" toggle
    const expiresIn = req.body.rememberMe ? "7d" : "2d";

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn },
    );

    // 6. Success Response
    return res.status(200).json({
      timestamp: new Date(),
      success: true,
      message: `Welcome back ${user.name}`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    // 7. Internal Server Error
    return res.status(500).json({
      timestamp: new Date(),
      success: false,
      message: error.message || "An unexpected error occurred during sign-in",
    });
  }
};
// ─────────────────────────────────────────
//  VERIFY EMAIL
// ─────────────────────────────────────────
export const verifyEmail = async (req, res) => {
  const secret = process.env.JWT_EMAIL_SECRET || process.env.JWT_SECRET;

  jwt.verify(req.params.token, secret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        timestamp: new Date(),
        success: false,
        message: "Verification link is invalid or has expired.",
      });
    }

    const user = await User.findOneAndUpdate(
      { email: decoded.email },
      { isConfirmed: true },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        timestamp: new Date(),
        success: false,
        message: "No account found for this email.",
      });
    }

    res.status(200).json({
      timestamp: new Date(),
      success: true,
      message: "Email verified successfully. You can now sign in.",
    });
  });
};

// ─────────────────────────────────────────
//  FORGOT PASSWORD
// ─────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });
    }

    const user = await User.findOne({ email });

    // Always return the same message — never leak whether an email exists
    const genericResponse = {
      success: true,
      message: "If that email is registered, a reset link has been sent.",
    };

    if (!user) return res.status(200).json(genericResponse);

    // Secret = JWT_SECRET + current password hash.
    // This makes every token single-use: after the password changes,
    // the old token becomes invalid automatically.
    const resetSecret = process.env.JWT_SECRET + user.password;
    const resetToken = jwt.sign(
      { id: String(user._id), email: user.email },
      resetSecret,
      { expiresIn: "15m" },
    );

    const clientUrl = process.env.CLIENT_URL || "http://localhost:4200";
    const resetLink = `${clientUrl}/reset-password/${user._id}/${encodeURIComponent(resetToken)}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"Note App" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Reset your password — Note App",
      html: forgotPasswordTemplate(user.name, resetLink),
    });

    res.status(200).json(genericResponse);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
//  RESET PASSWORD VIA TOKEN  (from email link)
// ─────────────────────────────────────────
export const resetPasswordViaToken = async (req, res) => {
  try {
    const { id, token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const resetSecret = process.env.JWT_SECRET + user.password;

    let decoded;
    try {
      decoded = jwt.verify(decodeURIComponent(token), resetSecret);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Reset link is invalid or has expired.",
      });
    }

    if (decoded.id !== id) {
      return res
        .status(401)
        .json({ success: false, message: "Reset link is invalid." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
//  RESET PASSWORD (logged-in user)
// ─────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Old password incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
