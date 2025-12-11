// utils/emailSender.js

const nodemailer = require('nodemailer');

// Configure the transporter
const transporter = nodemailer.createTransport({
  host: 'mail.dbvertex.com', // GoDaddy SMTP server
  port: 465, // Use 587 for TLS
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // Your full email address
    pass: process.env.EMAIL_PASS, // Your email password
  },
});

// Function to send email
const sendEmail = async (to, subject, text) => {
      // HTML email content
      const htmlContent = `
        <html>
          <head>
            <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: #038CAC;
                  margin: 0;
                  padding: 0;
              }
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #ffffff;
                  padding: 20px;
                  border-radius: 10px;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }
              .header {
                  background-color: #038CAC;
                  padding: 10px;
                  border-radius: 10px 10px 0 0;
                  text-align: center;
                  color: white;
                  font-size: 24px;
              }
              .content {
                  padding: 20px;
                  text-align: center;
                  color: #333;
              }
              .otp {
                  font-size: 30px;
                  color: #038CAC;
                  margin: 20px 0;
              }
              .footer {
                  text-align: center;
                  color: #888;
                  font-size: 12px;
                  margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                Ajugnu
              </div>
              <div class="content">
                  <p>${subject},</p>
                  <p>${text}</p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} Ajugnu. All rights reserved.
              </div>
            </div>
          </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'Welcome to Our Service!',
        html: htmlContent, // Use HTML content here
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully to:', to);
      } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send email');
      }
    };

module.exports = sendEmail;
