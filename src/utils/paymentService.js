import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

// console.log(process.env.STRIPE_KEY);
const stripe = Stripe(process.env.STRIPE_KEY);

export default stripe;
