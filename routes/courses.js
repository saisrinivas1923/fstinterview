const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, verifyAdmin } = require('../middleware/auth');

// Public: Get all courses
router.get('/', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM users u WHERE u.domain = c.title AND u.role = 'student') as student_count
      FROM courses c
      ORDER BY c.id ASC
    `).all();

    res.json({ success: true, courses });
  } catch (err) {
    console.error('Fetch courses error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve courses.' });
  }
});

// Admin: Add a new course
router.post('/', authenticateToken, verifyAdmin, (req, res) => {
  try {
    const { title, category, duration, technologies, description } = req.body;
    if (!title || !category || !technologies) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Title, category, and technologies are required.' });
    }

    const existing = db.prepare('SELECT id FROM courses WHERE title = ?').get(title.trim());
    if (existing) {
      return res.status(409).json({ error: 'EXISTS', message: 'A course with this title already exists.' });
    }

    const result = db.prepare(`
      INSERT INTO courses (title, category, duration, technologies, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      category.trim(),
      duration ? duration.trim() : '3 Months',
      technologies.trim(),
      description ? description.trim() : null
    );

    const newCourse = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, course: newCourse });
  } catch (err) {
    console.error('Add course error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create course.' });
  }
});

module.exports = router;
