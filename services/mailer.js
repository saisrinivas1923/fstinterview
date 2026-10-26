const nodemailer = require('nodemailer');
const db = require('../database');

function getSmtpConfig() {
  try {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE ? OR key = ?").all('smtp_%', 'from_email');
    const config = {};
    rows.forEach(r => { config[r.key] = r.value; });

    // Ensure dummy placeholder passwords don't block valid .env credentials
    const isDummyPass = config.smtp_pass === 'apppassword1234' || !config.smtp_pass;
    const finalPass = (!isDummyPass && config.smtp_pass) ? config.smtp_pass : (process.env.SMTP_PASS || '');
    const finalUser = (!isDummyPass && config.smtp_user) ? config.smtp_user : (process.env.SMTP_USER || config.smtp_user || '');

    return {
      host: config.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(config.smtp_port || process.env.SMTP_PORT || 465),
      user: finalUser ? finalUser.trim() : '',
      pass: finalPass ? finalPass.replace(/\s+/g, '') : '',
      from: config.from_email || process.env.FROM_EMAIL || '"Future Sprint Technologies" <futuresprintinterview@gmail.com>'
    };
  } catch (e) {
    console.error('getSmtpConfig error:', e.message);
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.FROM_EMAIL || '"Future Sprint Technologies" <admissions@futuresprintech.com>'
    };
  }
}

function createTransporter() {
  const config = getSmtpConfig();
  if (config.user && config.pass) {
    const port = Number(config.port) || 465;
    return nodemailer.createTransport({
      host: config.host || 'smtp.gmail.com',
      port: port,
      secure: port === 465,
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return null;
}

async function sendVerificationOtpEmail(toEmail, toName, otpCode) {
  const config = getSmtpConfig();
  const subject = `Future Sprint Technologies - Account Verification OTP: ${otpCode}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
        .content { padding: 30px 24px; color: #1e293b; }
        .otp-box { background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #4338ca; font-family: monospace; }
        .expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
        .details { font-size: 13px; line-height: 1.6; color: #475569; }
        .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Future Sprint Technologies</h1>
          <p>Student Placement & Interview Dashboard</p>
        </div>
        <div class="content">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${toName || 'Student'}</strong>,</p>
          <p class="details">Welcome to <strong>Future Sprint Technologies</strong>! Please use the 6-digit One-Time Password (OTP) below to verify your email address and activate your account:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
            <div class="expiry">Valid for 10 minutes. Do not disclose this OTP to anyone.</div>
          </div>

          <p class="details">Once verified, your account will be activated and you can access your dashboard to record scheduled interviews, track HR contacts, and monitor admin approvals.</p>
        </div>
        <div class="footer">
          <strong>Future Sprint Technologies</strong><br>
          Allwyn X Roads, Hema Durga Plaza, Flat No: 207, Miyapur, Hyderabad<br>
          Technical Training | Corporate Placements
        </div>
      </div>
    </body>
    </html>
  `;

  console.log('================================================================');
  console.log(`📩 [Future Sprint Real Mail Service] Account Verification OTP`);
  console.log(`👉 Recipient: ${toEmail} (${toName})`);
  console.log(`🔑 OTP Code:  ${otpCode}`);
  console.log(`⏱️ Expiry:    10 Minutes`);
  console.log('================================================================');

  const transporter = createTransporter();

  if (transporter) {
    try {
      const fromAddress = `"Future Sprint Technologies" <${config.user}>`;
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        text: `Hello ${toName || 'Student'},\n\nYour Future Sprint Technologies verification code is: ${otpCode}\n\nThis OTP is valid for 10 minutes. Please enter this code on the portal to activate your account.\n\nFuture Sprint Technologies\nAllwyn X Roads, Hema Durga Plaza, Flat 207, Miyapur, Hyderabad`,
        html: htmlContent
      });
      console.log('✅ Real Email sent successfully! MessageId:', info.messageId, 'Recipient:', toEmail);
      return { success: true, mode: 'smtp', messageId: info.messageId, otp: otpCode };
    } catch (err) {
      console.error('⚠️ Real SMTP delivery failed:', err.message);
      // Fallback: log to terminal so verification is never blocked
      return { success: true, mode: 'logged', error: err.message, otp: otpCode };
    }
  }

  // If no SMTP configured yet in .env, still allow the OTP flow to proceed smoothly like a hosted site
  return {
    success: true,
    mode: 'logged',
    otp: otpCode,
    notice: 'OTP logged to server terminal for instant verification.'
  };
}

async function sendPasswordResetOtpEmail(toEmail, toName, otpCode) {
  const config = getSmtpConfig();
  const subject = `Future Sprint Technologies - Password Reset OTP: ${otpCode}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fcf9ff; margin: 0; padding: 20px; }
        .container { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1px solid rgba(138,108,192,0.25); overflow: hidden; box-shadow: 0 10px 25px rgba(191,96,136,0.12); }
        .header { background: linear-gradient(115deg, #d99a63 0%, #bf6088 50%, #8a6cc0 110%); padding: 30px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.95; }
        .content { padding: 30px 24px; color: #221334; }
        .otp-box { background: #fdf2f7; border: 2px dashed #bf6088; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #8a6cc0; font-family: monospace; }
        .expiry { font-size: 12px; color: #776785; margin-top: 8px; font-weight: 600; }
        .details { font-size: 13.5px; line-height: 1.6; color: #534563; }
        .footer { background: #fcf9ff; padding: 20px 24px; text-align: center; font-size: 11px; color: #776785; border-top: 1px solid rgba(138,108,192,0.15); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Future Sprint Tech</h1>
          <p>Security & Password Management</p>
        </div>
        <div class="content">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${toName || 'Student'}</strong>,</p>
          <p class="details">We received a request to change or reset your password for your <strong>Future Sprint Technologies</strong> account. Use the 6-digit OTP code below to verify your identity:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
            <div class="expiry">Valid for 10 minutes. If you did not request this, please ignore this email.</div>
          </div>

          <p class="details">Ensure your new password is at least 8 characters long and contains at least one uppercase letter (A-Z) for high security.</p>
        </div>
        <div class="footer">
          <strong>Future Sprint Technologies</strong><br>
          Allwyn X Roads, Hema Durga Plaza, Flat No: 207, Miyapur, Hyderabad<br>
          AI & IT Training and Placement
        </div>
      </div>
    </body>
    </html>
  `;

  console.log('================================================================');
  console.log(`🔑 [Future Sprint Security] Password Reset / Change OTP`);
  console.log(`👉 Recipient: ${toEmail} (${toName})`);
  console.log(`🔑 OTP Code:  ${otpCode}`);
  console.log(`⏱️ Expiry:    10 Minutes`);
  console.log('================================================================');

  const transporter = createTransporter();

  if (transporter) {
    try {
      const fromAddress = `"Future Sprint Technologies" <${config.user}>`;
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        text: `Hello ${toName || 'Student'},\n\nYour Future Sprint Technologies password reset code is: ${otpCode}\n\nThis OTP is valid for 10 minutes.\n\nFuture Sprint Technologies\nAllwyn X Roads, Hema Durga Plaza, Flat 207, Miyapur, Hyderabad`,
        html: htmlContent
      });
      console.log('✅ Real Password OTP sent successfully! MessageId:', info.messageId, 'Recipient:', toEmail);
      return { success: true, mode: 'smtp', messageId: info.messageId, otp: otpCode };
    } catch (err) {
      console.error('⚠️ Real SMTP delivery failed:', err.message);
      return { success: true, mode: 'logged', error: err.message, otp: otpCode };
    }
  }

  return {
    success: true,
    mode: 'logged',
    otp: otpCode,
    notice: 'Password OTP logged to server terminal for instant verification.'
  };
}

// 3. Automated 2-Hour Prior Interview Reminder (Reports student to Institute Office)
async function sendInterviewReminderEmail(data) {
  const {
    toEmail,
    toName,
    companyName,
    roleTitle,
    roundName,
    interviewDate,
    interviewTime,
    hrMobileNumber
  } = data;

  const config = getSmtpConfig();
  const subject = `⏰ [2-Hour Reminder] Interview with ${companyName} at ${interviewTime} - Report to Future Sprint Institute Office`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f4fa; margin: 0; padding: 20px; color: #221334; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid rgba(138,108,192,0.22); overflow: hidden; box-shadow: 0 12px 30px rgba(34,19,52,0.08); }
        .header { background: linear-gradient(115deg, #221334 0%, #44225a 50%, #8a6cc0 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 13px; color: #e9d5ff; }
        .content { padding: 32px 26px; }
        .urgent-banner { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 16px; padding: 18px 20px; margin: 20px 0; text-align: center; }
        .urgent-title { font-size: 17px; font-weight: 800; color: #b45309; margin: 0 0 6px 0; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .urgent-sub { font-size: 13px; font-weight: 600; color: #92400e; margin: 0; }
        .table-card { background: #fcf9ff; border: 1px solid rgba(138,108,192,0.2); border-radius: 14px; padding: 18px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid rgba(138,108,192,0.12); font-size: 13px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #776785; font-weight: 600; }
        .detail-val { color: #221334; font-weight: 800; text-align: right; }
        .venue-box { background: linear-gradient(135deg, rgba(138,108,192,0.08) 0%, rgba(191,96,136,0.08) 100%); border: 1.5px solid #8a6cc0; border-radius: 14px; padding: 18px; margin: 22px 0; }
        .venue-title { font-size: 14px; font-weight: 800; color: #6944a6; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .venue-address { font-size: 13.5px; line-height: 1.6; color: #221334; font-weight: 600; margin: 0; }
        .steps-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 20px 0; }
        .steps-box h4 { margin: 0 0 10px 0; font-size: 13px; color: #0f172a; font-weight: 800; }
        .steps-box ul { margin: 0; padding-left: 20px; font-size: 12.5px; line-height: 1.7; color: #475569; }
        .steps-box li { margin-bottom: 6px; }
        .footer { background: #fcf9ff; padding: 22px 24px; text-align: center; font-size: 11px; color: #776785; border-top: 1px solid rgba(138,108,192,0.15); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Future Sprint Technologies</h1>
          <p>Placement & Interview Central Controller</p>
        </div>
        <div class="content">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${toName || 'Student'}</strong>,</p>
          
          <div class="urgent-banner">
            <div class="urgent-title">⏰ INTERVIEW IN 2 HOURS (${interviewTime})</div>
            <div class="urgent-sub">Please report immediately to the Future Sprint Technologies office to attend your interview.</div>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #534563;">
            This is an official automated notification that your interview with <strong>${companyName}</strong> is scheduled in approximately <strong>2 hours</strong> today.
          </p>

          <div class="table-card">
            <div class="detail-row">
              <span class="detail-label">Recruiter / Company:</span>
              <span class="detail-val" style="color: #bf6088; font-size: 14px;">${companyName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Domain / Role:</span>
              <span class="detail-val">${roleTitle || 'Domain Track'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Interview Date:</span>
              <span class="detail-val">${interviewDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Scheduled Time:</span>
              <span class="detail-val" style="color: #6944a6; font-size: 14px;">${interviewTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Stage / Round:</span>
              <span class="detail-val">${roundName || 'Technical Round'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">HR Mobile Contact:</span>
              <span class="detail-val">${hrMobileNumber || 'Available at office reception'}</span>
            </div>
          </div>

          <div class="venue-box">
            <div class="venue-title">🏢 Mandatory Reporting Venue & Office Address:</div>
            <p class="venue-address">
              <strong>Future Sprint Technologies</strong><br>
              Allwyn X Roads, Hema Durga Plaza, Flat No: 207, Miyapur, Hyderabad<br>
              <span style="font-size: 12px; color: #776785;">Landmark: Near Allwyn X Roads signal junction</span>
            </p>
          </div>

          <div class="steps-box">
            <h4>Mandatory Office Attendance Guidelines:</h4>
            <ul>
              <li><strong>Arrive 20-30 minutes early</strong>: Reach Flat No: 207 before ${interviewTime} to configure audio/video testing and review candidate notes.</li>
              <li><strong>Dedicated Interview Cabin</strong>: High-speed fiber Wi-Fi, power backup, and quiet soundproof cabin are ready for you.</li>
              <li><strong>What to Bring</strong>: 2 hard copies of your updated resume, formal dress code, laptop, and earphones.</li>
              <li><strong>Mentor Assistance</strong>: Institute technical mentors will be available on-site to assist you before and after your round.</li>
            </ul>
          </div>

          <p style="font-size: 12px; color: #776785; text-align: center; margin-top: 24px;">
            In case of emergency or transit delay, notify institute administration immediately so we can coordinate with recruiter HR.
          </p>
        </div>
        <div class="footer">
          <strong>Future Sprint Technologies</strong><br>
          Allwyn X Roads, Hema Durga Plaza, Flat No: 207, Miyapur, Hyderabad<br>
          Official Interview & Placement Dispatch Service
        </div>
      </div>
    </body>
    </html>
  `;

  console.log('================================================================');
  console.log(`⏰ [Future Sprint 2-Hour Reminder] Dispatched to Student`);
  console.log(`👉 Student:    ${toName} (${toEmail})`);
  console.log(`🏢 Company:    ${companyName}`);
  console.log(`🕒 Time:       ${interviewTime} on ${interviewDate}`);
  console.log(`📍 Reporting:  Hema Durga Plaza Flat 207, Miyapur`);
  console.log('================================================================');

  const transporter = createTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: config.from,
        to: toEmail,
        subject,
        html: htmlContent
      });
      console.log('✅ Real 2-Hour Reminder Email sent successfully! MessageId:', info.messageId);
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error('⚠️ Real SMTP delivery failed for 2h reminder:', err.message);
      return { success: true, mode: 'logged', error: err.message };
    }
  }

  return {
    success: true,
    mode: 'logged',
    notice: 'Reminder logged to server terminal.'
  };
}

module.exports = {
  getSmtpConfig,
  sendVerificationOtpEmail,
  sendPasswordResetOtpEmail,
  sendInterviewReminderEmail
};
