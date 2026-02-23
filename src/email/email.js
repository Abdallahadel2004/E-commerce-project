import nodemailer from 'nodemailer';
import { emailTemplate } from './emailTemplate.js';
import jwt from 'jsonwebtoken';

import dotenv from 'dotenv';

dotenv.config();

console.log('email used in email', process.env.EMAIL_USER);
export default async function sendEmail(email) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const emailToken = jwt.sign(email, 'newemail');

    const info = await transporter.sendMail({
        from: '"Note APP" <omarabdelstar2002@gmail.com>',
        to: email,
        subject: 'Hello',
        text: 'Hello world?',
        html: emailTemplate(emailToken),
    });
}
