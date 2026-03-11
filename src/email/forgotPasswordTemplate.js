export const forgotPasswordTemplate = (name, resetLink) => {
  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>

<body style="margin:0;padding:0;background-color:#f5f7fa;" align="center">
<div style="text-align:center;padding:40px 16px;">

  <table align="center" width="560" cellpadding="0" cellspacing="0"
         style="background-color:#ffffff;border-radius:16px;
                box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

    <!-- Header -->
    <tr>
      <td style="background-color:#1a1a2e;padding:24px 40px;text-align:left;">
        <span style="font-family:'Helvetica',Arial,sans-serif;
                     font-size:18px;font-weight:700;color:#ffffff;">
          E-Commerce Store
        </span>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:48px 40px;text-align:center;">

        <!-- Lock icon -->
        <div style="width:72px;height:72px;border-radius:50%;
                    background-color:#fff3f3;display:inline-block;
                    line-height:72px;margin-bottom:28px;">
          <img src="https://cdn-icons-png.flaticon.com/512/6195/6195699.png"
               width="36" height="36" alt="lock icon"
               style="display:block;margin:18px auto;" />
        </div>

        <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;
                   font-family:'Helvetica',Arial,sans-serif;margin:0 0 12px;">
          Reset Your Password
        </h1>

        <p style="font-size:15px;line-height:24px;color:#6b7280;
                  font-family:'Helvetica',Arial,sans-serif;font-weight:300;
                  margin:0 0 8px;">
          Hi ${name},
        </p>

        <p style="font-size:15px;line-height:24px;color:#6b7280;
                  font-family:'Helvetica',Arial,sans-serif;font-weight:300;
                  max-width:380px;margin:0 auto 32px;">
          We received a request to reset your password. Click the button below to choose a new one.
          This link expires in <strong style="color:#1a1a2e;">15 minutes</strong>.
        </p>

        <a href="${resetLink}"
           target="_blank"
           style="background-color:#e74c3c;
                  font-size:15px;
                  font-family:'Helvetica',Arial,sans-serif;
                  font-weight:500;
                  text-decoration:none;
                  padding:14px 36px;
                  color:#ffffff;
                  border-radius:8px;
                  display:inline-block;">
          Reset Password
        </a>

        <p style="margin-top:32px;font-size:13px;color:#9ca3af;
                  font-family:'Helvetica',Arial,sans-serif;">
          If you didn't request a password reset, you can safely ignore this email.
          Your password will remain unchanged.
        </p>

        <p style="font-size:12px;color:#d1d5db;font-family:'Helvetica',Arial,sans-serif;">
          Or copy this link into your browser:<br/>
          <span style="word-break:break-all;color:#4361ee;">${resetLink}</span>
        </p>

      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color:#f9fafb;padding:20px 40px;text-align:center;
                 border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'Helvetica',Arial,sans-serif;">
          © ${new Date().getFullYear()} E-Commerce Store. All rights reserved.
        </p>
      </td>
    </tr>

  </table>
</div>
</body>
</html>`;
};