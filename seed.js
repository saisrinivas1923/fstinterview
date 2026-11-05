const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./database');

async function seed() {
  console.log('🌱 Starting database seed for Future Sprint Technologies...');

  // 1. Permanent Admin: defaults to admin@futuresprintech.com / Krishnamohan@123, overridable via env
  const permanentAdminEmail = (process.env.ADMIN_EMAIL || 'admin@futuresprintech.com').trim().toLowerCase();
  const permanentAdminPass = process.env.ADMIN_PASS || 'Krishnamohan@123';

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
    // Keep existing admin password up to date with env if configured, remove mobile number for admin
    db.prepare(`
      UPDATE users SET
        name = 'Future Sprint Director (Admin)',
        password_hash = ?,
        phone = '',
        role = 'admin',
        is_verified = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = ?
    `).run(adminPasswordHash, permanentAdminEmail);
    console.log(`✅ Permanent Admin verified: ${permanentAdminEmail}`);
  }

  // 2. Ensure SMTP and Resend settings exist in database
  const upsertSetting = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    upsertSetting.run('smtp_user', process.env.SMTP_USER.trim());
    upsertSetting.run('smtp_pass', process.env.SMTP_PASS.replace(/\s+/g, ''));
    if (process.env.SMTP_HOST) upsertSetting.run('smtp_host', process.env.SMTP_HOST.trim());
    if (process.env.SMTP_PORT) upsertSetting.run('smtp_port', String(process.env.SMTP_PORT).trim());
    if (process.env.FROM_EMAIL) upsertSetting.run('from_email', process.env.FROM_EMAIL.trim());
    console.log(`✅ SMTP settings initialized from environment for: ${process.env.SMTP_USER}`);
  } else {
    const existingSmtp = db.prepare("SELECT value FROM settings WHERE key = 'smtp_user'").get();
    if (!existingSmtp || !existingSmtp.value) {
      const smtpUser = 'futuresprintinterview@gmail.com';
      const smtpPass = 'smldivdyibnqvobv';
      const smtpHost = 'smtp.gmail.com';
      const smtpPort = '465';
      const fromEmail = '"Future Sprint Technologies" <futuresprintinterview@gmail.com>';

      upsertSetting.run('smtp_host', smtpHost);
      upsertSetting.run('smtp_port', String(smtpPort));
      upsertSetting.run('smtp_user', smtpUser);
      upsertSetting.run('smtp_pass', smtpPass);
      upsertSetting.run('from_email', fromEmail);
      console.log(`✅ Default SMTP settings initialized for: ${smtpUser}`);
    }
  }

  // Initialize Resend HTTPS API Key from environment if provided
  if (process.env.RESEND_API_KEY) {
    upsertSetting.run('resend_api_key', process.env.RESEND_API_KEY.trim());
    console.log('✅ Resend HTTPS API settings initialized from environment');
  }
  const resendFrom = process.env.RESEND_FROM || 'Future Sprint Technologies <onboarding@resend.dev>';
  upsertSetting.run('resend_from', resendFrom);

  // 3. Production Deployed Website Mode:
  // Student accounts and interview records are created in real time by enrolled students.
  console.log('✨ Seed complete (Production Deployed Mode: Clean database with Permanent Admin verified).');
}

if (require.main === module) {
  seed().catch(console.error);
}

module.exports = seed;
