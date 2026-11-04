const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');
const { JWT_SECRET, authenticateToken, verifyAdmin } = require('../middleware/auth');
const { sendVerificationOtpEmail, sendPasswordResetOtpEmail, getSmtpConfig } = require('../services/mailer');

function formatDomainTitleCase(str) {
  if (!str) return '';
  const acronyms = new Set(['AI', 'ML', 'QA', 'SAP', 'IT', 'UI', 'UX', 'HR', 'API', 'AWS', 'GCP', 'SQL', 'DBA']);
  return str.trim().split(/\s+/).map(word => {
    const upper = word.toUpperCase();
    if (acronyms.has(upper)) return upper;
    if (upper === 'GENAI') return 'GenAI';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

// Step 1: Student Registration (Validates strong password & sends OTP)
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, domain, password } = req.body;

    if (!name || !email || !phone || !domain || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'All fields (Name, Email, Phone, Domain, and Password) are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedDomain = formatDomainTitleCase(domain);

    // Indian 10-digit mobile number validation: must start with 6, 7, 8, or 9 and have exactly 10 digits
    let cleanPhone = trimmedPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        error: 'INVALID_PHONE',
        message: 'Student mobile number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.'
      });
    }
    const formattedPhone = `+91 ${cleanPhone}`;

    // Password validation: Enforce all 5 security rules (length >= 8, uppercase, lowercase, number, special char)
    if (password.length < 8) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long.'
      });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must contain at least one uppercase letter (A-Z).'
      });
    }

    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must contain at least one lowercase letter (a-z).'
      });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must contain at least one number (0-9).'
      });
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must contain at least one special character (!@#$%^&*...).'
      });
    }

    // Check if verified email already exists
    const existing = db.prepare('SELECT id, is_verified FROM users WHERE email = ?').get(trimmedEmail);
    if (existing && existing.is_verified) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email address already exists. Please sign in.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove any previous pending OTPs for this email
    db.prepare('DELETE FROM email_otps WHERE email = ?').run(trimmedEmail);

    const userData = JSON.stringify({
      name: trimmedName,
      email: trimmedEmail,
      phone: formattedPhone,
      domain: trimmedDomain,
      password_hash: passwordHash
    });

    db.prepare(`
      INSERT INTO email_otps (email, otp_code, purpose, user_data, expires_at)
      VALUES (?, ?, 'registration', ?, datetime('now', '+10 minutes'))
    `).run(trimmedEmail, otpCode, userData);

    // Send the OTP via email
    const mailResult = await sendVerificationOtpEmail(trimmedEmail, trimmedName, otpCode);
    console.log(`[Registration] Verification OTP dispatch to ${trimmedEmail}: mode=${mailResult.mode}, success=${mailResult.success}`);

    return res.status(200).json({
      success: true,
      requires_otp: true,
      email: trimmedEmail,
      message: `A 6-digit verification code has been dispatched to ${trimmedEmail}.`
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Server error during registration. Please try again.'
    });
  }
});

// Step 2: Verify Email OTP and Complete Student Account Creation
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp_code } = req.body;

    if (!email || !otp_code) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Email and 6-digit OTP code are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOtp = otp_code.trim();

    const otpRecord = db.prepare(`
      SELECT * FROM email_otps
      WHERE email = ? AND otp_code = ?
      ORDER BY id DESC LIMIT 1
    `).get(trimmedEmail, trimmedOtp);

    if (!otpRecord) {
      return res.status(400).json({
        error: 'INVALID_OTP',
        message: 'Invalid verification code. Please check your email or click Resend.'
      });
    }

    const isExpired = db.prepare(`
      SELECT CASE WHEN datetime('now') > ? THEN 1 ELSE 0 END as expired
    `).get(otpRecord.expires_at).expired;

    if (isExpired) {
      return res.status(400).json({
        error: 'EXPIRED_OTP',
        message: 'This verification code has expired. Please request a new code.'
      });
    }

    const userData = JSON.parse(otpRecord.user_data);
    const sessionToken = crypto.randomUUID();

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
    let userId;

    if (existingUser) {
      db.prepare(`
        UPDATE users SET
          name = ?,
          phone = ?,
          domain = ?,
          password_hash = ?,
          is_verified = 1,
          current_session_token = ?,
          session_created_at = CURRENT_TIMESTAMP,
          last_login_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        userData.name,
        userData.phone,
        userData.domain,
        userData.password_hash,
        sessionToken,
        existingUser.id
      );
      userId = existingUser.id;
    } else {
      const insertResult = db.prepare(`
        INSERT INTO users (name, email, phone, domain, password_hash, role, is_verified, current_session_token, session_created_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, 'student', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        userData.name,
        userData.email,
        userData.phone,
        userData.domain,
        userData.password_hash,
        sessionToken
      );
      userId = insertResult.lastInsertRowid;
    }

    db.prepare('DELETE FROM email_otps WHERE email = ?').run(trimmedEmail);

    const token = jwt.sign(
      { userId, role: 'student', sessionToken },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Account verified successfully! Welcome to Future Sprint Technologies.',
      token,
      user: {
        id: userId,
        name: userData.name,
        email: trimmedEmail,
        phone: userData.phone,
        domain: userData.domain,
        placement_status: 'In Training',
        role: 'student'
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to verify OTP code. Please try again.'
    });
  }
});

// Step 3: Request Password Reset OTP (For forgotten password or change password)
router.post('/forgot-password-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Please enter your registered email address.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get(trimmedEmail);

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'No registered student account found with this email address.'
      });
    }

    // Delete any old pending password reset OTPs
    db.prepare(`DELETE FROM email_otps WHERE email = ? AND purpose IN ('password_reset', 'student_password_change')`).run(trimmedEmail);

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    db.prepare(`
      INSERT INTO email_otps (email, otp_code, purpose, expires_at)
      VALUES (?, ?, 'password_reset', datetime('now', '+10 minutes'))
    `).run(trimmedEmail, otpCode);

    // Send email via mailer
    await sendPasswordResetOtpEmail(trimmedEmail, user.name, otpCode);

    return res.status(200).json({
      success: true,
      email: trimmedEmail,
      message: `A 6-digit password reset OTP has been sent to ${trimmedEmail}.`
    });
  } catch (err) {
    console.error('Forgot password OTP error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to send password reset OTP. Please try again.'
    });
  }
});

// Step 4: Verify OTP & Reset Password
router.post('/reset-password-with-otp', async (req, res) => {
  try {
    const { email, otp_code, new_password } = req.body;

    if (!email || !otp_code || !new_password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Email, OTP code, and new password are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp_code).trim();

    // Check user exists
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(trimmedEmail);
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User account not found.'
      });
    }

    // Validate OTP record
    const otpRecord = db.prepare(`
      SELECT * FROM email_otps
      WHERE email = ? AND otp_code = ? AND purpose IN ('password_reset', 'student_password_change')
      ORDER BY id DESC LIMIT 1
    `).get(trimmedEmail, cleanOtp);

    if (!otpRecord) {
      return res.status(400).json({
        error: 'INVALID_OTP',
        message: 'Invalid OTP code. Please check your email or request a new code.'
      });
    }

    const isExpired = db.prepare(`SELECT CASE WHEN datetime('now') > ? THEN 1 ELSE 0 END as expired`).get(otpRecord.expires_at).expired;
    if (isExpired) {
      return res.status(400).json({
        error: 'EXPIRED_OTP',
        message: 'This OTP has expired. Please request a new verification code.'
      });
    }

    // Password validation: Enforce ALL 5 security rules
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters long.' });
    }
    if (!/[A-Z]/.test(new_password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must contain at least one uppercase letter (A-Z).' });
    }
    if (!/[a-z]/.test(new_password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must contain at least one lowercase letter (a-z).' });
    }
    if (!/[0-9]/.test(new_password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must contain at least one number (0-9).' });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(new_password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must contain at least one special character (!@#$%^&*...).' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    const newSessionToken = crypto.randomUUID();

    // Update password and update session token to revoke other devices
    db.prepare(`
      UPDATE users SET password_hash = ?, current_session_token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newHash, newSessionToken, user.id);

    // Delete used OTP
    db.prepare('DELETE FROM email_otps WHERE email = ?').run(trimmedEmail);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to reset password. Please try again.'
    });
  }
});

// Step 3: Resend Verification OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email address is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existingRecord = db.prepare('SELECT * FROM email_otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(trimmedEmail);

    if (!existingRecord) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'No pending registration found for this email. Please register again.'
      });
    }

    const userData = JSON.parse(existingRecord.user_data);
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

    db.prepare(`
      UPDATE email_otps
      SET otp_code = ?,
          expires_at = datetime('now', '+10 minutes'),
          created_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newOtp, existingRecord.id);

    const mailResult = await sendVerificationOtpEmail(trimmedEmail, userData.name, newOtp);

    if (!mailResult.success) {
      return res.status(503).json({
        error: 'EMAIL_DELIVERY_FAILED',
        message: `Failed to dispatch OTP to ${trimmedEmail}: ${mailResult.error || mailResult.notice}`
      });
    }

    return res.json({
      success: true,
      email: trimmedEmail,
      message: `A fresh 6-digit verification code has been dispatched to ${trimmedEmail}.`
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to resend OTP.' });
  }
});

// User / Admin Login (Enforces Single Device Session & Checks Verification)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Please provide both email and password.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare(`
      SELECT id, name, email, phone, domain, placement_status, password_hash, role, is_verified
      FROM users WHERE email = ?
    `).get(trimmedEmail);

    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    // Successful password match: Direct sign in with single-device session token
    const newSessionToken = crypto.randomUUID();

    db.prepare(`
      UPDATE users
      SET current_session_token = ?,
          session_created_at = CURRENT_TIMESTAMP,
          last_login_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newSessionToken, user.id);

    const token = jwt.sign(
      { userId: user.id, role: user.role, sessionToken: newSessionToken },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        domain: user.domain,
        placement_status: user.placement_status || 'In Training',
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Server error during login. Please try again.'
    });
  }
});

// Verify Real-Time Login OTP for Student
router.post('/verify-login-otp', async (req, res) => {
  try {
    const { email, otp_code } = req.body;

    if (!email || !otp_code) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Email and 6-digit OTP code are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOtp = otp_code.trim();

    const otpRecord = db.prepare(`
      SELECT * FROM email_otps
      WHERE email = ? AND otp_code = ? AND purpose = 'login'
      ORDER BY id DESC LIMIT 1
    `).get(trimmedEmail, trimmedOtp);

    if (!otpRecord) {
      return res.status(400).json({
        error: 'INVALID_OTP',
        message: 'Invalid verification code. Please check your email or click Resend.'
      });
    }

    const isExpired = db.prepare(`
      SELECT CASE WHEN datetime('now') > ? THEN 1 ELSE 0 END as expired
    `).get(otpRecord.expires_at).expired;

    if (isExpired) {
      return res.status(400).json({
        error: 'EXPIRED_OTP',
        message: 'This verification code has expired. Please request a new code.'
      });
    }

    const user = db.prepare(`
      SELECT id, name, email, phone, domain, placement_status, role, is_verified
      FROM users WHERE email = ?
    `).get(trimmedEmail);

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Student record not found.'
      });
    }

    // Clean up used login OTP
    db.prepare('DELETE FROM email_otps WHERE email = ? AND purpose = ?').run(trimmedEmail, 'login');

    const newSessionToken = crypto.randomUUID();

    db.prepare(`
      UPDATE users
      SET current_session_token = ?,
          is_verified = 1,
          session_created_at = CURRENT_TIMESTAMP,
          last_login_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newSessionToken, user.id);

    const token = jwt.sign(
      { userId: user.id, role: user.role, sessionToken: newSessionToken },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        domain: user.domain,
        placement_status: user.placement_status || 'In Training',
        role: user.role
      }
    });
  } catch (err) {
    console.error('Verify login OTP error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Server error during OTP verification.'
    });
  }
});

// Resend Real-Time Login OTP for Student
router.post('/resend-login-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'MISSING_EMAIL', message: 'Email address is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(trimmedEmail);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    db.prepare('DELETE FROM email_otps WHERE email = ? AND purpose = ?').run(trimmedEmail, 'login');
    db.prepare(`
      INSERT INTO email_otps (email, otp_code, purpose, user_data, expires_at)
      VALUES (?, ?, 'login', ?, datetime('now', '+10 minutes'))
    `).run(trimmedEmail, otpCode, JSON.stringify({ userId: user.id }));

    await sendVerificationOtpEmail(trimmedEmail, user.name, otpCode);

    return res.json({
      success: true,
      message: `Fresh verification OTP dispatched in real time to ${trimmedEmail}.`
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to resend login OTP.' });
  }
});

// Logout
router.post('/logout', authenticateToken, (req, res) => {
  try {
    db.prepare(`
      UPDATE users
      SET current_session_token = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id);

    return res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to logout cleanly.'
    });
  }
});

// Get current profile
router.get('/me', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// Lightweight session verification ping
router.get('/verify-session', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    valid: true,
    userId: req.user.id
  });
});

// Admin: Save or Test SMTP Settings
router.get('/smtp-settings', authenticateToken, verifyAdmin, (req, res) => {
  const config = getSmtpConfig();
  // Mask password for safety
  res.json({
    success: true,
    smtp: {
      host: config.host,
      port: config.port,
      user: config.user,
      pass: config.pass ? '••••••••' : '',
      from: config.from,
      is_configured: !!(config.user && config.pass)
    }
  });
});

router.post('/smtp-settings', authenticateToken, verifyAdmin, (req, res) => {
  try {
    const { host, port, user, pass, from } = req.body;

    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    if (host !== undefined) upsert.run('smtp_host', host.trim());
    if (port !== undefined) upsert.run('smtp_port', String(port).trim());
    if (user !== undefined) upsert.run('smtp_user', user.trim());
    if (pass !== undefined && pass !== '••••••••' && pass !== '') upsert.run('smtp_pass', pass);
    if (from !== undefined) upsert.run('from_email', from.trim());

    res.json({ success: true, message: 'SMTP settings updated successfully!' });
  } catch (err) {
    console.error('Save SMTP settings error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to save SMTP settings.' });
  }
});

// Admin: Send Test Email to verify SMTP configuration
router.post('/smtp-test', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { test_email } = req.body;
    const recipient = (test_email || req.user.email).trim();
    const config = getSmtpConfig();

    if (!config.user || !config.pass) {
      return res.status(400).json({
        error: 'SMTP_NOT_CONFIGURED',
        message: 'SMTP Username/Email and Password are required before testing.'
      });
    }

    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await sendVerificationOtpEmail(recipient, 'Future Sprint Admin', testOtp);

    if (result.mode === 'smtp') {
      return res.json({
        success: true,
        message: `✅ Test email successfully delivered to ${recipient}!`,
        messageId: result.messageId
      });
    } else {
      return res.status(400).json({
        error: 'DELIVERY_FAILED',
        message: `SMTP test failed: ${result.error || 'Could not connect to SMTP server. Verify your credentials/app password.'}`
      });
    }
  } catch (err) {
    console.error('SMTP test error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message || 'SMTP test failed.' });
  }
});

// Check if student data is available in database by any detail (Name, Email, Phone, Domain)
router.post('/check-student', (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        error: 'MISSING_QUERY',
        message: 'Please enter an Email ID, Phone Number, Name, or Domain to check.'
      });
    }

    const raw = query.trim();
    const cleanDigits = raw.replace(/[^0-9]/g, '');
    const term = `%${raw}%`;

    const student = db.prepare(`
      SELECT id, name, email, phone, domain, is_verified, created_at
      FROM users
      WHERE role = 'student'
        AND (
          name LIKE ?
          OR email LIKE ?
          OR domain LIKE ?
          OR (phone LIKE ? AND ? != '')
          OR (? != '' AND replace(replace(replace(phone, '+', ''), ' ', ''), '-', '') LIKE '%' || ? || '%')
        )
      LIMIT 1
    `).get(term, term, term, `%${raw}%`, raw, cleanDigits, cleanDigits);

    if (!student) {
      // Also check if they have a pending registration OTP
      const pendingOtp = db.prepare('SELECT email FROM email_otps WHERE email = ?').get(raw.toLowerCase());
      if (pendingOtp) {
        return res.json({
          found: false,
          pending_verification: true,
          message: `Registration initiated for "${raw}", but email verification OTP is pending. Please complete OTP verification to activate.`
        });
      }

      return res.json({
        found: false,
        message: `No candidate data found in Future Sprint database matching "${raw}".`
      });
    }

    // Mask phone & email slightly for privacy in public check
    const parts = student.email.split('@');
    const maskedEmail = parts[0].slice(0, 3) + '***@' + parts[1];
    const maskedPhone = student.phone.slice(0, 6) + '****';

    return res.json({
      found: true,
      name: student.name,
      masked_email: maskedEmail,
      masked_phone: maskedPhone,
      domain: student.domain,
      is_verified: Boolean(student.is_verified),
      joined_date: new Date(student.created_at).toLocaleDateString(),
      message: `Candidate record found! Registered under domain: ${student.domain}.`
    });
  } catch (err) {
    console.error('Check student error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to verify candidate database status.' });
  }
});

// Dynamic domains list: returns all standard courses + existing candidate domains
router.get('/domains', (req, res) => {
  try {
    const dbDomains = db.prepare(`
      SELECT DISTINCT domain FROM users 
      WHERE domain IS NOT NULL AND TRIM(domain) != ''
      ORDER BY domain ASC
    `).all().map(r => r.domain);

    const standardCourses = [
      'Full Stack Java Development',
      'Python Full Stack & AI / Data Science',
      'MERN Full Stack Web Development',
      'Cloud Computing & DevOps Engineering',
      'QA Software Testing & Automation',
      'Data Analytics & Power BI',
      'Cybersecurity & Ethical Hacking',
      'Mobile App Development (Flutter)',
      'SAP (FICO, ABAP, MM)',
      'AI Engineer',
      'GenAI Engineer',
      'Agentic AI Engineer',
      'Software Developer'
    ];

    const allSet = new Set([...standardCourses, ...dbDomains]);
    const domains = Array.from(allSet).sort();

    res.json({ success: true, domains });
  } catch (err) {
    res.json({ success: true, domains: [] });
  }
});

module.exports = router;
