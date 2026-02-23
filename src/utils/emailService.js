// import nodemailer from "nodemailer";
// import { emailTemplate } from "./emailTemplate.js";
// import jwt from "jsonwebtoken";
// console.log(process.env.EMAIL_USER);
// console.log(process.env.EMAIL_PASS);

// export default async (to, subject, text) => {
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   const mailOptions = {
//     from: "Ecommerce ITI",
//     to,
//     subject,
//     text,
//   };

//   await transporter.sendMail(mailOptions);
// };
