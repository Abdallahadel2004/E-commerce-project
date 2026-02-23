import express from 'express';
import User from '../models/user.model.js';
import { auth } from '../middleware/auth.middleware.js';
import {
    signin,
    signup,
    verifyEmail,
    resetPassword,
} from '../controllers/authController.js';

const router = express.Router();

router.post('/signup', signup);

router.post('/signin', signin);

router.get('/verify-email/:email', verifyEmail);
router.put('/reset-password', auth, resetPassword);

// router.get('/confirm/:email', async (req, res) => {
//     try {
//         const email = decodeURIComponent(req.params.email);
//         const user = await User.findOne({ email });
//         if (!user) return res.status(400).send('Invalid email');
//         if (user.isConfirmed) {
//             return res.send('Email already confirmed!');
//         }
//         user.isConfirmed = true;
//         await user.save();
//         res.send('Email confirmed! You can now log in.');
//     } catch (err) {
//         console.error(err);
//         res.status(400).send('Error confirming email');
//     }
// });
export default router;
