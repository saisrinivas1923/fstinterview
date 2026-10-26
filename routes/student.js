const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const mailer = require('../services/mailer');
const { authenticateToken } = require('../middleware/auth');

// All student routes require authentication
router.use(authenticateToken);

// Student Dashboard Metrics
router.get('/dashboard', (req, res) => {
  try {
    const studentId = req.user.id;

    const studentUser = db.prepare('SELECT id, name, email, phone, domain, placement_status FROM users WHERE id = ?').get(studentId);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Waiting for Admin Approval' THEN 1 ELSE 0 END) as waiting_approval,
        SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'Attended' THEN 1 ELSE 0 END) as attended,
        SUM(CASE WHEN status = 'Selected' THEN 1 ELSE 0 END) as selected,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected
      FROM interviews
      WHERE student_id = ?
    `).get(studentId);

    const isPlaced = studentUser && studentUser.placement_status === 'Placed';
    const effectiveSelected = isPlaced ? Math.max(1, stats.selected || 0) : (stats.selected || 0);

    const upcoming = db.prepare(`
      SELECT * FROM interviews
      WHERE student_id = ?
      ORDER BY interview_date DESC, interview_time DESC, id DESC
      LIMIT 6
    `).all(studentId);

    res.json({
      success: true,
      user: studentUser,
      stats: {
        total: stats.total || 0,
        waiting_approval: stats.waiting_approval || 0,
        scheduled: stats.scheduled || 0,
        attended: stats.attended || 0,
        selected: effectiveSelected,
        rejected: stats.rejected || 0,
        placement_status: studentUser ? studentUser.placement_status : 'In Training'
      },
      upcoming
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch student dashboard.' });
  }
});

// Placements Dashboard (Aggregated domain stats for all students, strictly NO individual names disclosed)
router.get('/placements-dashboard', (req, res) => {
  try {
    // 1. Total placed count across institute
    const totalPlacedRow = db.prepare(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      LEFT JOIN interviews i ON u.id = i.student_id AND i.status = 'Selected'
      WHERE u.role = 'student' AND (u.placement_status = 'Placed' OR i.id IS NOT NULL)
    `).get();
    const totalPlaced = totalPlacedRow ? totalPlacedRow.count : 0;

    const totalStudentsRow = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE role = 'student'
    `).get();
    const totalStudents = totalStudentsRow ? totalStudentsRow.count : 0;

    // 2. Domain-wise breakdown: Placed candidates count & Total candidates in domain
    const domainsRaw = db.prepare(`
      SELECT 
        u.domain,
        COUNT(DISTINCT u.id) as total_candidates,
        COUNT(DISTINCT CASE WHEN (u.placement_status = 'Placed' OR i.id IS NOT NULL) THEN u.id ELSE NULL END) as placed_candidates
      FROM users u
      LEFT JOIN interviews i ON u.id = i.student_id AND i.status = 'Selected'
      WHERE u.role = 'student' AND u.domain IS NOT NULL AND TRIM(u.domain) != ''
      GROUP BY u.domain
      ORDER BY placed_candidates DESC, total_candidates DESC
    `).all();

    // 3. Anonymous Placement Spotlights (strictly NO student names!)
    const recentPlacements = db.prepare(`
      SELECT 
        u.domain,
        COALESCE(i.company_name, 'Leading Tech Firm') as company_name,
        COALESCE(i.role_title, 'Software Engineer') as role_title,
        COALESCE(i.interview_date, date(u.updated_at)) as placed_date,
        COALESCE(i.salary_package, 'Competitive Package') as salary_package
      FROM users u
      LEFT JOIN interviews i ON u.id = i.student_id AND i.status = 'Selected'
      WHERE u.role = 'student' AND (u.placement_status = 'Placed' OR i.id IS NOT NULL)
      ORDER BY COALESCE(i.interview_date, date(u.updated_at)) DESC, u.id DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      totalPlaced,
      totalStudents,
      domains: domainsRaw,
      recentPlacements
    });
  } catch (err) {
    console.error('Placements dashboard error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch placements dashboard.' });
  }
});

// Get all interviews for the logged in student
router.get('/interviews', (req, res) => {
  try {
    const studentId = req.user.id;
    const { status, search } = req.query;

    let query = `SELECT * FROM interviews WHERE student_id = ?`;
    const params = [studentId];

    if (status && status !== 'all') {
      query += ` AND LOWER(status) = LOWER(?)`;
      params.push(status);
    }

    if (search && search.trim()) {
      query += ` AND (company_name LIKE ? OR role_title LIKE ? OR job_location LIKE ? OR hr_mobile_number LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY interview_date DESC, interview_time DESC, id DESC`;

    const interviews = db.prepare(query).all(...params);
    res.json({ success: true, interviews });
  } catch (err) {
    console.error('Fetch student interviews error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve interviews.' });
  }
});

// Get single interview by ID
router.get('/interviews/:id', (req, res) => {
  try {
    const interview = db.prepare(`
      SELECT * FROM interviews WHERE id = ? AND student_id = ?
    `).get(req.params.id, req.user.id);

    if (!interview) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Interview record not found.' });
    }

    res.json({ success: true, interview });
  } catch (err) {
    console.error('Fetch interview error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve interview record.' });
  }
});

// Add a new interview record (Student submits -> Status is permanently 'Waiting for Admin Approval')
router.post('/interviews', (req, res) => {
  try {
    const {
      company_name,
      role_title,
      interview_date,
      interview_time,
      interview_mode,
      round_name,
      hr_mobile_number,
      salary_package,
      job_location
    } = req.body;

    if (!company_name || !interview_date || !interview_time || !hr_mobile_number) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Company Name, Interview Date, Time, and HR Mobile Number are mandatory.'
      });
    }

    // Block previous dates based on today's local date
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (interview_date < todayStr) {
      return res.status(400).json({
        error: 'INVALID_DATE',
        message: 'Interview date cannot be in the past. Please select today or a future date.'
      });
    }

    let cleanHrPhone = hr_mobile_number.replace(/[^0-9]/g, '');
    if (cleanHrPhone.length === 12 && cleanHrPhone.startsWith('91')) {
      cleanHrPhone = cleanHrPhone.slice(2);
    }
    if (!/^[6-9]\d{9}$/.test(cleanHrPhone)) {
      return res.status(400).json({
        error: 'INVALID_HR_PHONE',
        message: 'HR Mobile Number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.'
      });
    }
    const formattedHrPhone = `+91 ${cleanHrPhone}`;

    // Role is fixed and blocked to the candidate's registered Domain
    const effectiveRole = req.user.domain;

    // Candidate cannot set status - defaults to Waiting for Admin Approval
    const initialStatus = 'Waiting for Admin Approval';

    const result = db.prepare(`
      INSERT INTO interviews (
        student_id,
        company_name,
        role_title,
        interview_date,
        interview_time,
        interview_mode,
        round_name,
        status,
        hr_mobile_number,
        salary_package,
        job_location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      company_name.trim(),
      effectiveRole,
      interview_date,
      interview_time,
      interview_mode || 'Online',
      round_name || 'Technical Round 1',
      initialStatus,
      formattedHrPhone,
      salary_package ? salary_package.trim() : null,
      job_location ? job_location.trim() : null
    );

    const newInterview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Interview details submitted successfully! Status: Waiting for Admin Approval.',
      interview: newInterview
    });
  } catch (err) {
    console.error('Add interview error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to save interview record.' });
  }
});

// Update interview record (Student can update details, but status remains admin-controlled)
router.put('/interviews/:id', (req, res) => {
  try {
    const interviewId = req.params.id;
    const existing = db.prepare(`SELECT * FROM interviews WHERE id = ? AND student_id = ?`).get(interviewId, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Interview record not found or unauthorized.' });
    }

    const {
      company_name,
      role_title,
      interview_date,
      interview_time,
      interview_mode,
      round_name,
      hr_mobile_number,
      salary_package,
      job_location
    } = req.body;

    // Block previous dates based on today's local date
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (interview_date && interview_date < todayStr) {
      return res.status(400).json({
        error: 'INVALID_DATE',
        message: 'Interview date cannot be in the past. Please select today or a future date.'
      });
    }

    let formattedHrPhone = existing.hr_mobile_number;
    if (hr_mobile_number !== undefined && hr_mobile_number !== null) {
      let cleanHrPhone = hr_mobile_number.trim().replace(/[^0-9]/g, '');
      if (cleanHrPhone) {
        if (cleanHrPhone.length === 12 && cleanHrPhone.startsWith('91')) {
          cleanHrPhone = cleanHrPhone.slice(2);
        }
        if (!/^[6-9]\d{9}$/.test(cleanHrPhone)) {
          return res.status(400).json({
            error: 'INVALID_HR_PHONE',
            message: 'HR Mobile Number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.'
          });
        }
        formattedHrPhone = `+91 ${cleanHrPhone}`;
      } else {
        formattedHrPhone = null;
      }
    }

    db.prepare(`
      UPDATE interviews SET
        company_name = ?,
        role_title = ?,
        interview_date = ?,
        interview_time = ?,
        interview_mode = ?,
        round_name = ?,
        hr_mobile_number = ?,
        salary_package = ?,
        job_location = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND student_id = ?
    `).run(
      company_name !== undefined ? company_name.trim() : existing.company_name,
      role_title !== undefined ? role_title.trim() : existing.role_title,
      interview_date !== undefined ? interview_date : existing.interview_date,
      interview_time !== undefined ? interview_time : existing.interview_time,
      interview_mode !== undefined ? interview_mode : existing.interview_mode,
      round_name !== undefined ? round_name : existing.round_name,
      formattedHrPhone,
      salary_package !== undefined ? (salary_package ? salary_package.trim() : null) : existing.salary_package,
      job_location !== undefined ? (job_location ? job_location.trim() : null) : existing.job_location,
      interviewId,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
    res.json({
      success: true,
      message: 'Interview record updated successfully!',
      interview: updated
    });
  } catch (err) {
    console.error('Update interview error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update interview record.' });
  }
});

// Student Reschedule Interview: allows student to choose a new Date and Time
router.put('/interviews/:id/reschedule', (req, res) => {
  try {
    const interviewId = req.params.id;
    const existing = db.prepare(`SELECT * FROM interviews WHERE id = ? AND student_id = ?`).get(interviewId, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Interview record not found or unauthorized.' });
    }

    const { interview_date, interview_time } = req.body;

    if (!interview_date || !interview_time) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Please provide both new interview date and new interview time.'
      });
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (interview_date < todayStr) {
      return res.status(400).json({
        error: 'INVALID_DATE',
        message: 'Rescheduled date cannot be in the past. Please choose today or a future date.'
      });
    }

    // Preserve original date & time if this is the first reschedule
    const originalDate = existing.original_interview_date || existing.interview_date;
    const originalTime = existing.original_interview_time || existing.interview_time;

    db.prepare(`
      UPDATE interviews SET
        interview_date = ?,
        interview_time = ?,
        is_rescheduled = 1,
        original_interview_date = ?,
        original_interview_time = ?,
        reminder_sent_2h = 0,
        reminder_sent_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND student_id = ?
    `).run(
      interview_date,
      interview_time,
      originalDate,
      originalTime,
      interviewId,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);

    console.log(`📅 [Interview Rescheduled] ID ${interviewId} rescheduled to ${interview_date} ${interview_time} (Original: ${originalDate}) by student ${req.user.id}`);

    res.json({
      success: true,
      message: `Interview rescheduled successfully to ${interview_date} at ${interview_time}!`,
      interview: updated
    });
  } catch (err) {
    console.error('Reschedule interview error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to reschedule interview.' });
  }
});

// Students are not permitted to delete interviews - only edit option is permitted
router.delete('/interviews/:id', (req, res) => {
  return res.status(403).json({
    error: 'FORBIDDEN',
    message: 'Students are only permitted to edit interview records, not delete them. Please contact Admin if a record needs to be removed.'
  });
});

// Update student profile
router.put('/profile', async (req, res) => {
  try {
    const { name, phone, current_password, new_password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    let passwordHash = user.password_hash;
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'CURRENT_PASSWORD_REQUIRED', message: 'Current password is required to set a new password.' });
      }
      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'WRONG_PASSWORD', message: 'Current password is incorrect.' });
      }
      if (new_password === current_password) {
        return res.status(400).json({
          error: 'PASSWORD_SAME_AS_LAST',
          message: 'The password you entered is same as last password. Create new password'
        });
      }
      if (new_password.length < 8 || !/[A-Z]/.test(new_password)) {
        return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must be at least 8 characters and contain at least one uppercase letter (A-Z).' });
      }
      passwordHash = await bcrypt.hash(new_password, 10);
    }

    let formattedPhone = user.phone;
    if (phone) {
      let cleanPhone = phone.trim().replace(/[^0-9]/g, '');
      if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
        cleanPhone = cleanPhone.slice(2);
      }
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({
          error: 'INVALID_PHONE',
          message: 'Student mobile number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.'
        });
      }
      formattedPhone = `+91 ${cleanPhone}`;
    }

    db.prepare(`
      UPDATE users SET
        name = ?,
        phone = ?,
        password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : user.name,
      formattedPhone,
      passwordHash,
      user.id
    );

    const updatedUser = db.prepare('SELECT id, name, email, phone, domain, role FROM users WHERE id = ?').get(user.id);

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: updatedUser
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update profile.' });
  }
});

// Request 6-digit OTP for changing password via Email
router.post('/request-password-otp', async (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    const { new_password } = req.body;
    if (new_password) {
      const isSameAsCurrent = await bcrypt.compare(new_password, user.password_hash);
      if (isSameAsCurrent) {
        return res.status(400).json({
          error: 'PASSWORD_SAME_AS_LAST',
          message: 'The password you entered is same as last password. Create new password'
        });
      }
    }

    // Delete any old pending password change OTPs for this email
    db.prepare(`DELETE FROM email_otps WHERE email = ? AND purpose = 'student_password_change'`).run(user.email);

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO email_otps (email, otp_code, purpose, expires_at)
      VALUES (?, ?, 'student_password_change', ?)
    `).run(user.email, otpCode, expiresAt);

    // Send real email OTP
    const mailResult = await mailer.sendPasswordResetOtpEmail(user.email, user.name, otpCode);

    if (!mailResult.success) {
      return res.status(503).json({
        error: 'EMAIL_DELIVERY_FAILED',
        message: `Failed to dispatch OTP to ${user.email}: ${mailResult.error || mailResult.notice}`
      });
    }

    res.json({
      success: true,
      email: user.email,
      message: `A 6-digit verification OTP has been dispatched to ${user.email}.`
    });
  } catch (err) {
    console.error('Request password OTP error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to dispatch password verification OTP.' });
  }
});

// Verify OTP & Change Password
router.post('/change-password-with-otp', async (req, res) => {
  try {
    const { otp_code, new_password } = req.body;
    const user = db.prepare('SELECT id, name, email, password_hash FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    if (!otp_code) {
      return res.status(400).json({ error: 'OTP_REQUIRED', message: 'Please enter the 6-digit OTP sent to your email.' });
    }

    if (!new_password || new_password.length < 8) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'New password must be at least 8 characters long.'
      });
    }

    if (!/[A-Z]/.test(new_password)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'New password must contain at least one uppercase letter (A-Z).'
      });
    }

    if (!/[a-z]/.test(new_password)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'New password must contain at least one lowercase letter (a-z).'
      });
    }

    if (!/[0-9]/.test(new_password)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'New password must contain at least one number (0-9).'
      });
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(new_password)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'New password must contain at least one special character (!@#$%^&*...).'
      });
    }

    // Check if new password matches existing/last password
    const isSameAsCurrent = await bcrypt.compare(new_password, user.password_hash);
    if (isSameAsCurrent) {
      return res.status(400).json({
        error: 'PASSWORD_SAME_AS_LAST',
        message: 'The password you entered is same as last password. Create new password'
      });
    }

    const cleanOtp = String(otp_code).trim();
    const otpRecord = db.prepare(`
      SELECT * FROM email_otps
      WHERE email = ? AND otp_code = ? AND purpose = 'student_password_change'
      ORDER BY id DESC LIMIT 1
    `).get(user.email, cleanOtp);

    if (!otpRecord) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'Invalid OTP code. Please check your email or request a new code.' });
    }

    const now = new Date();
    const expiry = new Date(otpRecord.expires_at);
    if (now > expiry) {
      db.prepare(`DELETE FROM email_otps WHERE id = ?`).run(otpRecord.id);
      return res.status(400).json({ error: 'OTP_EXPIRED', message: 'The OTP code has expired. Please request a new OTP.' });
    }

    // Hash new password and update user
    const passwordHash = await bcrypt.hash(new_password, 10);
    const newSessionToken = crypto.randomUUID();

    db.prepare(`
      UPDATE users SET
        password_hash = ?,
        current_session_token = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, newSessionToken, user.id);

    // Delete used OTP
    db.prepare(`DELETE FROM email_otps WHERE email = ? AND purpose = 'student_password_change'`).run(user.email);

    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const updatedToken = jwt.sign(
      { userId: user.id, role: 'student', sessionToken: newSessionToken },
      JWT_SECRET || 'institute-secret-token-key-2026-secure',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Password updated successfully! Single-device session refreshed.',
      token: updatedToken,
      sessionToken: newSessionToken
    });
  } catch (err) {
    console.error('Change password with OTP error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update password.' });
  }
});

module.exports = router;
