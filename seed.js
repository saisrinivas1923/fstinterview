const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./database');

async function seed() {
  console.log('🌱 Starting database seed for Future Sprint Technologies...');

  // 1. Permanent Admin: admin@futuresprintech.com / Krishnamohan@123
  const permanentAdminEmail = 'admin@futuresprintech.com';
  const permanentAdminPass = 'Krishnamohan@123';

  // Delete any other admin account
  db.prepare("DELETE FROM users WHERE role = 'admin' AND email != ?").run(permanentAdminEmail);

  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(permanentAdminEmail);
  const adminPasswordHash = await bcrypt.hash(permanentAdminPass, 10);

  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (name, email, phone, domain, password_hash, role, is_verified, current_session_token, session_created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      'Future Sprint Director (Admin)',
      permanentAdminEmail,
      '',
      'Future Sprint Technologies Administration',
      adminPasswordHash,
      crypto.randomUUID()
    );
    console.log(`✅ Permanent Admin created: ${permanentAdminEmail}`);
  } else {
    // Keep existing admin password safe and intact if already configured, remove mobile number for admin
    db.prepare(`
      UPDATE users SET
        name = 'Future Sprint Director (Admin)',
        phone = '',
        role = 'admin',
        is_verified = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = ?
    `).run(permanentAdminEmail);
    console.log(`✅ Permanent Admin verified: ${permanentAdminEmail}`);
  }

  // 2. Ensure SMTP settings exist in database
  const existingSmtp = db.prepare("SELECT value FROM settings WHERE key = 'smtp_user'").get();
  if (!existingSmtp || !existingSmtp.value) {
    const upsertSetting = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    const smtpUser = process.env.SMTP_USER || 'futuresprintinterview@gmail.com';
    const smtpPass = process.env.SMTP_PASS || 'smldivdyibnqvobv';
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = process.env.SMTP_PORT || '465';
    const fromEmail = process.env.FROM_EMAIL || '"Future Sprint Technologies" <futuresprintinterview@gmail.com>';

    upsertSetting.run('smtp_host', smtpHost);
    upsertSetting.run('smtp_port', String(smtpPort));
    upsertSetting.run('smtp_user', smtpUser);
    upsertSetting.run('smtp_pass', smtpPass);
    upsertSetting.run('from_email', fromEmail);
    console.log(`✅ Default SMTP settings initialized for: ${smtpUser}`);
  }

  // 3. Production Deployed Website Mode:
  // Student accounts and interview records are created in real time by enrolled students.
  console.log('✨ Seed complete (Production Deployed Mode: Clean database with Permanent Admin verified).');
}

if (require.main === module) {
  seed().catch(console.error);
}

module.exports = seed;
