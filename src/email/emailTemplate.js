export const emailTemplate = (email) => {
  const clientUrl = "http://localhost:3000";
  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Newsletter</title>

<style type="text/css">
  a,a[href],a:hover,a:link,a:visited {
    text-decoration: none!important;
    color: #0000EE;
  }
  .link {
    text-decoration: underline!important;
  }
  p {
    font-size:15px;
    line-height:24px;
    font-family:'Helvetica', Arial, sans-serif;
    font-weight:300;
    color: #000000;
  }
  h1 {
    font-size:22px;
    line-height:24px;
    font-family:'Helvetica', Arial, sans-serif;
    font-weight:normal;
    color: #000000;
  }
</style>
</head>

<body style="margin:0; padding:0; background-color:#f2f4f6;" align="center">
<div style="text-align:center;">

<table align="center" width="600" style="background-color:#ffffff;">
  <tr>
    <td style="padding:40px 30px;">

      <h1 style="font-size:20px; font-weight:600;">
        Confirm Your Email
      </h1>

      <p style="color:#919293;">
        Please confirm your email address by clicking the button below.
      </p>

         <a href="${clientUrl}/auth/verify-email/${encodeURIComponent(email)}"
       target="_blank"
       style="background-color:#000000;
              font-size:15px;
              font-family:'Helvetica', Arial, sans-serif;
              text-decoration:none;
              padding:12px 20px;
              color:#ffffff;
              border-radius:5px;
              display:inline-block;">
      Confirm
    </a>

    </td>
  </tr>
</table>

</div>
</body>
</html>`;
};
