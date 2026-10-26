const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database');
const mailer = require('../services/mailer');
const { authenticateToken, verifyAdmin, JWT_SECRET } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(verifyAdmin);

// 1. Institute Analytics & Overview
router.get('/overview', (req, res) => {
  try {
    const studentCount = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'student'`).get().count;

    const interviewStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Waiting for Admin Approval' THEN 1 ELSE 0 END) as waiting_approval,
        SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'Attended' THEN 1 ELSE 0 END) as attended,
        SUM(CASE WHEN status = 'Selected' THEN 1 ELSE 0 END) as selected,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'On Hold' THEN 1 ELSE 0 END) as on_hold,
        SUM(CASE WHEN status = 'Waiting for HR Response' THEN 1 ELSE 0 END) as waiting_hr
      FROM interviews
    `).get();

    const domainStats = db.prepare(`
      SELECT 
        u.domain, 
        COUNT(DISTINCT u.id) as count,
        COUNT(DISTINCT CASE WHEN (u.placement_status = 'Placed' OR i.id IS NOT NULL) THEN u.id ELSE NULL END) as placed_count
      FROM users u
      LEFT JOIN interviews i ON u.id = i.student_id AND i.status = 'Selected'
      WHERE u.role = 'student' AND u.domain IS NOT NULL AND TRIM(u.domain) != ''
      GROUP BY u.domain
      ORDER BY placed_count DESC, count DESC
    `).all();

    const totalPlacedRow = db.prepare(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      LEFT JOIN interviews i ON u.id = i.student_id AND i.status = 'Selected'
      WHERE u.role = 'student' AND (u.placement_status = 'Placed' OR i.id IS NOT NULL)
    `).get();
    const placedStudentsCount = totalPlacedRow ? totalPlacedRow.count : 0;

    const topCompanies = db.prepare(`
      SELECT company_name, COUNT(*) as count
      FROM interviews
      GROUP BY company_name
      ORDER BY count DESC
      LIMIT 8
    `).all();

    const upcomingInterviews = db.prepare(`
      SELECT 
        i.*,
        u.name as student_name,
        u.email as student_email,
        u.phone as student_phone,
        u.domain as student_domain
      FROM interviews i
      JOIN users u ON i.student_id = u.id
      ORDER BY i.interview_date DESC, i.id DESC
      LIMIT 8
    `).all();

    res.json({
      success: true,
      stats: {
        totalStudents: studentCount,
        totalInterviews: interviewStats.total || 0,
        waiting_approval: interviewStats.waiting_approval || 0,
        scheduled: interviewStats.scheduled || 0,
        attended: interviewStats.attended || 0,
        selected: Math.max(placedStudentsCount, interviewStats.selected || 0),
        placed_students: placedStudentsCount,
        rejected: interviewStats.rejected || 0,
        on_hold: interviewStats.on_hold || 0,
        waiting_hr: interviewStats.waiting_hr || 0
      },
      domainStats,
      topCompanies,
      upcomingInterviews
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch admin overview.' });
  }
});

// 2. Get list of all students (Name, Email, Phone, Domain, Total Interviews)
router.get('/students', (req, res) => {
  try {
    const { domain, search } = req.query;

    // Fetch dynamic list of all distinct domains with candidate counts
    const domains = db.prepare(`
      SELECT 
        u.domain, 
        COUNT(DISTINCT u.id) as count,
        COUNT(DISTINCT CASE WHEN (u.placement_status = 'Placed' OR i.id IS NOT NULL) THEN u.id ELSE NULL END) as placed_count
      FROM users u 
      LEFT JOIN interviews i ON u.id = i.student_id AND i.status = 'Selected'
      WHERE u.role = 'student' AND u.domain IS NOT NULL AND TRIM(u.domain) != ''
      GROUP BY u.domain
      ORDER BY count DESC, u.domain ASC
    `).all();

    let query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.domain,
        u.placement_status,
        u.created_at,
        u.last_login_at,
        COUNT(i.id) as total_interviews,
        SUM(CASE WHEN i.status = 'Waiting for Admin Approval' THEN 1 ELSE 0 END) as waiting_approval_interviews,
        SUM(CASE WHEN i.status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled_interviews,
        SUM(CASE WHEN i.status = 'Attended' THEN 1 ELSE 0 END) as attended_interviews,
        SUM(CASE WHEN i.status = 'Selected' THEN 1 ELSE 0 END) as selected_interviews
      FROM users u
      LEFT JOIN interviews i ON u.id = i.student_id
      WHERE u.role = 'student'
    `;

    const params = [];

    if (domain && domain !== 'all') {
      query += ` AND LOWER(TRIM(u.domain)) = LOWER(TRIM(?))`;
      params.push(domain);
    }

    if (search && search.trim()) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.domain LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += `
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;

    const students = db.prepare(query).all(...params);

    for (const student of students) {
      const latest = db.prepare(`
        SELECT company_name, role_title, interview_date, interview_time, status, hr_mobile_number, is_rescheduled, original_interview_date, original_interview_time
        FROM interviews
        WHERE student_id = ?
        ORDER BY interview_date DESC, interview_time DESC, id DESC
        LIMIT 1
      `).get(student.id);

      student.latest_interview = latest || null;
    }

    res.json({ success: true, students, domains });
  } catch (err) {
    console.error('Admin get students error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve students list.' });
  }
});

// Delete a student account and all associated records
router.delete('/students/:id', (req, res) => {
  try {
    const studentId = req.params.id;
    const student = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'student'`).get(studentId);

    if (!student) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Student account not found.' });
    }

    // Cascade delete student records
    db.prepare(`DELETE FROM email_otps WHERE email = ?`).run(student.email);
    db.prepare(`DELETE FROM interviews WHERE student_id = ?`).run(studentId);
    db.prepare(`DELETE FROM users WHERE id = ?`).run(studentId);

    res.json({
      success: true,
      message: `Student account "${student.name}" (${student.email}) and all interview records have been permanently deleted.`
    });
  } catch (err) {
    console.error('Admin delete student error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete student account.' });
  }
});

// 2b. Lookup / Check if student data is available in database by ANY detail
router.get('/students/lookup', (req, res) => {
  try {
    const { query } = req.query;

    if (!query || !query.trim()) {
      return res.status(400).json({
        error: 'MISSING_QUERY',
        message: 'Please enter at least one detail (Name, Email, Phone, Domain, or ID) to check.'
      });
    }

    const rawQuery = query.trim();
    const cleanDigits = rawQuery.replace(/[^0-9]/g, '');
    const term = `%${rawQuery}%`;

    let students = db.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.domain,
        u.role,
        u.is_verified,
        u.created_at,
        u.last_login_at,
        COUNT(i.id) as total_interviews,
        SUM(CASE WHEN i.status = 'Attended' THEN 1 ELSE 0 END) as attended_count,
        SUM(CASE WHEN i.status = 'Selected' THEN 1 ELSE 0 END) as selected_count,
        SUM(CASE WHEN i.status = 'On Hold' THEN 1 ELSE 0 END) as on_hold_count,
        SUM(CASE WHEN i.status = 'Waiting for HR Response' THEN 1 ELSE 0 END) as waiting_hr_count,
        SUM(CASE WHEN i.status = 'Rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM users u
      LEFT JOIN interviews i ON u.id = i.student_id
      WHERE u.role = 'student'
        AND (
          u.name LIKE ? 
          OR u.email LIKE ? 
          OR u.domain LIKE ?
          OR CAST(u.id AS TEXT) = ?
          OR (u.phone LIKE ? AND ? != '')
          OR (? != '' AND replace(replace(replace(u.phone, '+', ''), ' ', ''), '-', '') LIKE '%' || ? || '%')
        )
      GROUP BY u.id
      ORDER BY u.id DESC
    `).all(
      term, 
      term, 
      term, 
      rawQuery, 
      `%${rawQuery}%`, 
      rawQuery,
      cleanDigits,
      cleanDigits
    );

    // Fetch latest interview for each matched student
    students = students.map(st => {
      const latest = db.prepare(`
        SELECT company_name, role_title, interview_date, interview_time, interview_mode, round_name, status, hr_mobile_number, is_rescheduled, original_interview_date, original_interview_time
        FROM interviews 
        WHERE student_id = ? 
        ORDER BY interview_date DESC, id DESC 
        LIMIT 1
      `).get(st.id);

      return {
        ...st,
        latest_interview: latest || null
      };
    });

    if (students.length === 0) {
      return res.json({
        success: true,
        found: false,
        query: rawQuery,
        count: 0,
        students: [],
        message: `No candidate data found in Future Sprint database matching "${rawQuery}".`
      });
    }

    return res.json({
      success: true,
      found: true,
      query: rawQuery,
      count: students.length,
      students,
      message: `Found ${students.length} matching candidate record(s) in database.`
    });
  } catch (err) {
    console.error('Student lookup error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to search student records.' });
  }
});

// 3. Drill-down: Click student's name to view their full profile and interview history
router.get('/students/:id', (req, res) => {
  try {
    const student = db.prepare(`
      SELECT id, name, email, phone, domain, role, placement_status, created_at, last_login_at
      FROM users
      WHERE id = ? AND role = 'student'
    `).get(req.params.id);

    if (!student) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Student not found.' });
    }

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
    `).get(student.id);

    const interviews = db.prepare(`
      SELECT *
      FROM interviews
      WHERE student_id = ?
      ORDER BY interview_date DESC, interview_time DESC, id DESC
    `).all(student.id);

    res.json({
      success: true,
      student,
      stats: {
        total: stats.total || 0,
        waiting_approval: stats.waiting_approval || 0,
        scheduled: stats.scheduled || 0,
        attended: stats.attended || 0,
        selected: stats.selected || 0,
        rejected: stats.rejected || 0
      },
      interviews
    });
  } catch (err) {
    console.error('Admin student drill-down error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch student details.' });
  }
});

// 4. Admin updates the Status of any student interview
router.put('/interviews/:id/status', (req, res) => {
  try {
    const interviewId = req.params.id;
    const { status } = req.body;

    const validStatuses = [
      'Waiting for Admin Approval',
      'Attended',
      'Rejected',
      'On Hold',
      'Waiting for HR Response',
      'Scheduled',
      'Selected'
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Invalid interview status provided.' });
    }

    const existing = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Interview record not found.' });
    }

    const result = db.prepare(`
      UPDATE interviews
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, interviewId);

    // Auto-Sync Candidate Placement Status Across Entire Website:
    // If status is Selected / Placed, automatically mark student profile as Placed!
    if (status === 'Selected') {
      db.prepare(`
        UPDATE users SET
          placement_status = 'Placed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND role = 'student'
      `).run(existing.student_id);
      console.log(`🎉 [Auto-Sync] Candidate #${existing.student_id} marked as Placed because interview #${interviewId} was Selected!`);
    } else if (existing.status === 'Selected' && status !== 'Selected') {
      // Reverted from Selected: check if candidate has any other Selected interviews
      const otherSelected = db.prepare(`
        SELECT COUNT(*) as count FROM interviews WHERE student_id = ? AND status = 'Selected' AND id != ?
      `).get(existing.student_id, interviewId);
      if (!otherSelected || otherSelected.count === 0) {
        db.prepare(`
          UPDATE users SET
            placement_status = 'In Training',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND role = 'student'
        `).run(existing.student_id);
        console.log(`⚡ [Auto-Sync] Candidate #${existing.student_id} reverted to In Training.`);
      }
    }

    const updated = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
    res.json({
      success: true,
      message: `Interview status successfully updated to "${status}"! Reflected across entire website.`,
      interview: updated
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update interview status.' });
  }
});

// 4b. Admin updates Student Profile Placement Status (Placed vs In Training)
router.put('/students/:id/placement-status', (req, res) => {
  try {
    const { placement_status } = req.body;
    const studentId = req.params.id;

    if (!placement_status || !['Placed', 'In Training', 'Seeking Placement'].includes(placement_status)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Placement status must be "Placed" or "In Training".'
      });
    }

    const student = db.prepare("SELECT id, name, email, domain FROM users WHERE id = ? AND role = 'student'").get(studentId);
    if (!student) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND', message: 'Student account not found.' });
    }

    db.prepare(`
      UPDATE users SET
        placement_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND role = 'student'
    `).run(placement_status, studentId);

    // If marked as Placed: ensure at least one interview record is marked Selected so history matches
    if (placement_status === 'Placed') {
      const selectedInv = db.prepare(`SELECT id FROM interviews WHERE student_id = ? AND status = 'Selected' LIMIT 1`).get(studentId);
      if (!selectedInv) {
        const latestInv = db.prepare(`SELECT id FROM interviews WHERE student_id = ? ORDER BY interview_date DESC, id DESC LIMIT 1`).get(studentId);
        if (latestInv) {
          db.prepare(`UPDATE interviews SET status = 'Selected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(latestInv.id);
        }
      }
    } else if (placement_status === 'In Training') {
      // If reverted to In Training: revert any Selected interviews to Attended
      db.prepare(`UPDATE interviews SET status = 'Attended', updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND status = 'Selected'`).run(studentId);
    }

    console.log(`🎓 [Placement Update] Student #${studentId} (${student.name}) marked as: ${placement_status} across entire website`);

    res.json({
      success: true,
      message: `Candidate profile placement status updated to "${placement_status}"! Reflected across entire website.`,
      placement_status
    });
  } catch (err) {
    console.error('Update student placement status error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update candidate placement status.' });
  }
});

// 5. Admin updates any interview completely
router.put('/interviews/:id', (req, res) => {
  try {
    const interviewId = req.params.id;
    const existing = db.prepare(`SELECT * FROM interviews WHERE id = ?`).get(interviewId);

    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Interview record not found.' });
    }

    const {
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
    } = req.body;

    let formattedHrPhone = existing.hr_mobile_number;
    if (hr_mobile_number !== undefined && hr_mobile_number !== null) {
      const cleanHrPhone = hr_mobile_number.trim().replace(/[^0-9]/g, '');
      if (cleanHrPhone) {
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
        status = ?,
        hr_mobile_number = ?,
        salary_package = ?,
        job_location = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      company_name !== undefined ? company_name.trim() : existing.company_name,
      role_title !== undefined ? role_title.trim() : existing.role_title,
      interview_date !== undefined ? interview_date : existing.interview_date,
      interview_time !== undefined ? interview_time : existing.interview_time,
      interview_mode !== undefined ? interview_mode : existing.interview_mode,
      round_name !== undefined ? round_name : existing.round_name,
      status !== undefined ? status : existing.status,
      formattedHrPhone,
      salary_package !== undefined ? (salary_package ? salary_package.trim() : null) : existing.salary_package,
      job_location !== undefined ? (job_location ? job_location.trim() : null) : existing.job_location,
      interviewId
    );

    if (status === 'Selected') {
      db.prepare(`UPDATE users SET placement_status = 'Placed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'student'`).run(existing.student_id);
    }

    const updated = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
    res.json({
      success: true,
      message: 'Interview record updated successfully by Admin!',
      interview: updated
    });
  } catch (err) {
    console.error('Admin update interview error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update interview.' });
  }
});

// 6. Admin schedules interview for student
router.post('/students/:id/interviews', (req, res) => {
  try {
    const studentId = req.params.id;
    const student = db.prepare("SELECT id, domain FROM users WHERE id = ? AND role = 'student'").get(studentId);
    if (!student) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Student not found.' });
    }

    const {
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
    } = req.body;

    if (!company_name || !interview_date || !interview_time) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Company Name, Interview Date, and Time are mandatory.'
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

    let formattedHrPhone = null;
    if (hr_mobile_number && hr_mobile_number.trim()) {
      const cleanHr = hr_mobile_number.trim().replace(/[^0-9]/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanHr)) {
        return res.status(400).json({
          error: 'INVALID_HR_PHONE',
          message: 'HR Mobile Number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.'
        });
      }
      formattedHrPhone = `+91 ${cleanHr}`;
    }

    const effectiveRole = (role_title && role_title.trim())
      ? role_title.trim()
      : `${student.domain} Associate`;

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
      studentId,
      company_name.trim(),
      effectiveRole,
      interview_date,
      interview_time,
      interview_mode || 'Online',
      round_name || 'Technical Round 1',
      status || 'Scheduled',
      formattedHrPhone,
      salary_package ? salary_package.trim() : null,
      job_location ? job_location.trim() : null
    );

    const newInterview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(result.lastInsertRowid);

    if (status === 'Selected') {
      db.prepare(`UPDATE users SET placement_status = 'Placed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'student'`).run(studentId);
    }

    res.status(201).json({
      success: true,
      message: 'Interview scheduled successfully by Admin!',
      interview: newInterview
    });
  } catch (err) {
    console.error('Admin add interview error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to add interview.' });
  }
});

// 7. Admin deletes an interview
router.delete('/interviews/:id', (req, res) => {
  try {
    const result = db.prepare(`DELETE FROM interviews WHERE id = ?`).run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Interview record not found.' });
    }
    res.json({ success: true, message: 'Interview record deleted successfully.' });
  } catch (err) {
    console.error('Admin delete interview error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete interview.' });
  }
});

// 7b. Admin manually triggers 2-hour institute office arrival reminder email to student
router.post('/interviews/:id/send-reminder', async (req, res) => {
  try {
    const { dispatchManualReminder } = require('../services/reminderService');
    const result = await dispatchManualReminder(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Admin manual reminder dispatch error:', err);
    res.status(500).json({ error: 'REMINDER_FAILED', message: err.message || 'Failed to dispatch reminder.' });
  }
});

// 8. Digital Master Book
router.get('/interviews', (req, res) => {
  try {
    const { search, status, domain } = req.query;

    let query = `
      SELECT 
        i.*,
        u.name as student_name,
        u.email as student_email,
        u.phone as student_phone,
        u.domain as student_domain,
        u.placement_status as student_placement_status
      FROM interviews i
      JOIN users u ON i.student_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND i.status = ?`;
      params.push(status);
    }

    if (domain && domain !== 'all') {
      query += ` AND u.domain = ?`;
      params.push(domain);
    }

    if (search && search.trim()) {
      query += ` AND (u.name LIKE ? OR u.phone LIKE ? OR i.company_name LIKE ? OR i.role_title LIKE ? OR i.hr_mobile_number LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    query += ` ORDER BY i.interview_date DESC, i.interview_time DESC, i.id DESC`;

    const interviews = db.prepare(query).all(...params);
    res.json({ success: true, interviews });
  } catch (err) {
    console.error('Admin master book error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch interview book.' });
  }
});

// 9. Export to CSV (Includes HR Mobile Number)
router.get('/export/csv', (req, res) => {
  try {
    const interviews = db.prepare(`
      SELECT 
        i.id,
        u.name as student_name,
        u.email as student_email,
        u.phone as student_phone,
        u.domain as student_domain,
        u.placement_status as student_placement_status,
        i.company_name,
        i.role_title,
        i.interview_date,
        i.interview_time,
        i.interview_mode,
        i.round_name,
        i.status,
        i.hr_mobile_number,
        i.salary_package,
        i.job_location,
        i.created_at
      FROM interviews i
      JOIN users u ON i.student_id = u.id
      ORDER BY i.interview_date DESC, i.interview_time DESC
    `).all();

    const headers = [
      'ID',
      'Student Name',
      'Email',
      'Phone',
      'Course Domain',
      'Placement Status',
      'Company Name',
      'Role / Position',
      'Interview Date',
      'Interview Time',
      'Mode',
      'Round',
      'Status',
      'HR Mobile Number',
      'Package (LPA)',
      'Location',
      'Submitted At'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ');
      return `"${clean}"`;
    };

    let csvContent = headers.map(h => `"${h}"`).join(',') + '\n';

    interviews.forEach(row => {
      csvContent += [
        row.id,
        escapeCsv(row.student_name),
        escapeCsv(row.student_email),
        escapeCsv(row.student_phone),
        escapeCsv(row.student_domain),
        escapeCsv(row.student_placement_status || 'In Training'),
        escapeCsv(row.company_name),
        escapeCsv(row.role_title),
        escapeCsv(row.interview_date),
        escapeCsv(row.interview_time),
        escapeCsv(row.interview_mode),
        escapeCsv(row.round_name),
        escapeCsv(row.status),
        escapeCsv(row.hr_mobile_number),
        escapeCsv(row.salary_package),
        escapeCsv(row.job_location),
        escapeCsv(row.created_at)
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Future_Sprint_Interview_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to export CSV.' });
  }
});

// 10. Admin Password Change
router.put('/change-password', async (req, res) => {
  try {
    const current_password = req.body.current_password || req.body.currentPassword;
    const new_password = req.body.new_password || req.body.newPassword;
    const confirm_password = req.body.confirm_password || req.body.confirmPassword;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Current password, new password, and re-type password are all required.'
      });
    }

    // Fetch current admin user
    const admin = db.prepare('SELECT id, email, password_hash FROM users WHERE id = ? AND role = ?').get(req.user.id, 'admin');
    if (!admin) {
      return res.status(404).json({ error: 'ADMIN_NOT_FOUND', message: 'Admin account not found.' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        error: 'WRONG_CURRENT_PASSWORD',
        message: 'The current administrator password entered is incorrect.'
      });
    }

    // Validate new password security rules
    if (new_password.length < 8) {
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

    if (new_password !== confirm_password) {
      return res.status(400).json({
        error: 'PASSWORD_MISMATCH',
        message: 'New password and re-typed password do not match.'
      });
    }

    // Hash new password and generate a fresh session token
    const newHash = await bcrypt.hash(new_password, 10);
    const newSessionToken = crypto.randomUUID();

    db.prepare(`
      UPDATE users SET
        password_hash = ?,
        current_session_token = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND role = 'admin'
    `).run(newHash, newSessionToken, admin.id);

    // Issue refreshed JWT token so active session continues seamlessly
    const secretKey = JWT_SECRET || process.env.JWT_SECRET || 'institute-secret-token-key-2026-secure';
    const updatedToken = jwt.sign(
      { userId: admin.id, email: admin.email, role: 'admin', sessionToken: newSessionToken },
      secretKey,
      { expiresIn: '7d' }
    );

    console.log(`🔐 [Admin Security] Administrator password updated successfully for ${admin.email}`);

    return res.json({
      success: true,
      message: 'Administrator password updated successfully! Your credentials are safe.',
      token: updatedToken
    });
  } catch (err) {
    console.error('Admin password change error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update admin password.' });
  }
});

// 11. Admin Password Change With OTP Verification (Step 1: Request OTP)
router.post('/request-password-otp', async (req, res) => {
  try {
    const admin = db.prepare('SELECT id, name, email FROM users WHERE id = ? AND role = ?').get(req.user.id, 'admin');
    if (!admin) {
      return res.status(404).json({ error: 'ADMIN_NOT_FOUND', message: 'Admin account not found.' });
    }

    // Delete any pending password change OTPs for admin
    db.prepare(`DELETE FROM email_otps WHERE email = ? AND purpose = 'admin_password_change'`).run(admin.email);

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO email_otps (email, otp_code, purpose, expires_at)
      VALUES (?, ?, 'admin_password_change', ?)
    `).run(admin.email, otpCode, expiresAt);

    // Send real email OTP via mailer service
    const mailResult = await mailer.sendPasswordResetOtpEmail(admin.email, admin.name, otpCode);

    if (!mailResult.success) {
      return res.status(503).json({
        error: 'EMAIL_DELIVERY_FAILED',
        message: `Failed to dispatch OTP to ${admin.email}: ${mailResult.error || mailResult.notice}`
      });
    }

    console.log(`📩 [Admin OTP] Dispatched 6-digit OTP to administrator: ${admin.email}`);

    res.json({
      success: true,
      email: admin.email,
      message: `A 6-digit verification OTP has been dispatched to ${admin.email}.`
    });
  } catch (err) {
    console.error('Request admin password OTP error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to dispatch verification OTP.' });
  }
});

// 12. Admin Password Change With OTP Verification (Step 2: Verify OTP & Update Password)
router.post('/change-password-with-otp', async (req, res) => {
  try {
    const { otp_code, new_password, confirm_password } = req.body;
    const admin = db.prepare('SELECT id, name, email, password_hash FROM users WHERE id = ? AND role = ?').get(req.user.id, 'admin');

    if (!admin) {
      return res.status(404).json({ error: 'ADMIN_NOT_FOUND', message: 'Admin account not found.' });
    }

    if (!otp_code) {
      return res.status(400).json({ error: 'OTP_REQUIRED', message: 'Please enter the 6-digit OTP sent to your email.' });
    }

    const cleanOtp = String(otp_code).trim();
    const otpRecord = db.prepare(`
      SELECT * FROM email_otps
      WHERE email = ? AND otp_code = ? AND purpose = 'admin_password_change'
      ORDER BY id DESC LIMIT 1
    `).get(admin.email, cleanOtp);

    if (!otpRecord) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'Invalid OTP code. Please check your email or request a new code.' });
    }

    const now = new Date();
    const expiry = new Date(otpRecord.expires_at);
    if (now > expiry) {
      db.prepare('DELETE FROM email_otps WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({ error: 'OTP_EXPIRED', message: 'The verification OTP has expired. Please request a new code.' });
    }

    // Validate new password security rules
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must be at least 8 characters long.' });
    }
    if (!/[A-Z]/.test(new_password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must contain at least one uppercase letter (A-Z).' });
    }
    if (!/[a-z]/.test(new_password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must contain at least one lowercase letter (a-z).' });
    }
    if (!/[0-9]/.test(new_password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must contain at least one number (0-9).' });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(new_password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must contain at least one special character (!@#$%...).' });
    }
    if (confirm_password && new_password !== confirm_password) {
      return res.status(400).json({ error: 'PASSWORD_MISMATCH', message: 'New password and re-typed password do not match.' });
    }

    // Hash new password and rotate session
    const newHash = await bcrypt.hash(new_password, 10);
    const newSessionToken = crypto.randomUUID();

    db.prepare(`
      UPDATE users SET
        password_hash = ?,
        current_session_token = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND role = 'admin'
    `).run(newHash, newSessionToken, admin.id);

    // Delete used OTP
    db.prepare('DELETE FROM email_otps WHERE email = ? AND purpose = ?').run(admin.email, 'admin_password_change');

    const secretKey = JWT_SECRET || process.env.JWT_SECRET || 'institute-secret-token-key-2026-secure';
    const updatedToken = jwt.sign(
      { userId: admin.id, email: admin.email, role: 'admin', sessionToken: newSessionToken },
      secretKey,
      { expiresIn: '7d' }
    );

    console.log(`🔐 [Admin Security] Admin password updated successfully via OTP for ${admin.email}`);

    res.json({
      success: true,
      message: 'Admin password successfully verified & updated! Your new credentials are safe.',
      token: updatedToken
    });
  } catch (err) {
    console.error('Admin change password with OTP error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update admin password.' });
  }
});

module.exports = router;
