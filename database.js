const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'institute.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      phone TEXT NOT NULL,
      domain TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      is_verified INTEGER NOT NULL DEFAULT 1,
      placement_status TEXT NOT NULL DEFAULT 'In Training',
      current_session_token TEXT,
      session_created_at DATETIME,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL COLLATE NOCASE,
      otp_code TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'registration',
      user_data TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      duration TEXT NOT NULL DEFAULT '3 Months',
      technologies TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company_name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      interview_date TEXT NOT NULL,
      interview_time TEXT NOT NULL,
      interview_mode TEXT NOT NULL DEFAULT 'Online',
      round_name TEXT NOT NULL DEFAULT 'Technical Round 1',
      status TEXT NOT NULL DEFAULT 'Waiting for Admin Approval',
      hr_mobile_number TEXT,
      salary_package TEXT,
      job_location TEXT,
      reminder_sent_2h INTEGER NOT NULL DEFAULT 0,
      reminder_sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_email_otps ON email_otps(email);
    CREATE INDEX IF NOT EXISTS idx_interviews_student ON interviews(student_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews(interview_date);
    CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
  `);

  // Migration: Ensure is_verified exists in users
  try {
    const userTableInfo = db.prepare(`PRAGMA table_info(users)`).all();
    if (!userTableInfo.some(col => col.name === 'is_verified')) {
      db.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 1;`);
    }
    if (!userTableInfo.some(col => col.name === 'placement_status')) {
      db.exec(`ALTER TABLE users ADD COLUMN placement_status TEXT NOT NULL DEFAULT 'In Training';`);
    }
  } catch (e) {
    console.error('Migration is_verified / placement_status error:', e.message);
  }

  // Migration: Ensure hr_mobile_number & reminder columns exist in interviews
  try {
    const interviewTableInfo = db.prepare(`PRAGMA table_info(interviews)`).all();
    if (!interviewTableInfo.some(col => col.name === 'hr_mobile_number')) {
      db.exec(`ALTER TABLE interviews ADD COLUMN hr_mobile_number TEXT;`);
    }
    if (!interviewTableInfo.some(col => col.name === 'reminder_sent_2h')) {
      db.exec(`ALTER TABLE interviews ADD COLUMN reminder_sent_2h INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!interviewTableInfo.some(col => col.name === 'reminder_sent_at')) {
      db.exec(`ALTER TABLE interviews ADD COLUMN reminder_sent_at DATETIME;`);
    }
    if (!interviewTableInfo.some(col => col.name === 'is_rescheduled')) {
      db.exec(`ALTER TABLE interviews ADD COLUMN is_rescheduled INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!interviewTableInfo.some(col => col.name === 'original_interview_date')) {
      db.exec(`ALTER TABLE interviews ADD COLUMN original_interview_date TEXT;`);
    }
    if (!interviewTableInfo.some(col => col.name === 'original_interview_time')) {
      db.exec(`ALTER TABLE interviews ADD COLUMN original_interview_time TEXT;`);
    }
  } catch (e) {
    console.error('Migration interviews reminder columns error:', e.message);
  }

  // Seed default Future Sprint Technologies courses if empty
  const courseCount = db.prepare('SELECT COUNT(*) as count FROM courses').get().count;
  if (courseCount === 0) {
    const defaultCourses = [
      {
        title: 'Full Stack Java Development',
        category: 'Software Engineering',
        duration: '4 Months',
        technologies: 'Core Java, Spring Boot, Microservices, Hibernate, React.js, MySQL, AWS, Docker',
        description: 'Comprehensive industry program mastering backend microservices and modern frontend architectures.'
      },
      {
        title: 'Python Full Stack & AI / Data Science',
        category: 'Data & AI',
        duration: '4 Months',
        technologies: 'Python, Django, FastAPI, Pandas, NumPy, Machine Learning, Power BI, SQL',
        description: 'Practical training covering Python backend development, predictive models, and business intelligence.'
      },
      {
        title: 'MERN Full Stack Web Development',
        category: 'Web Development',
        duration: '3.5 Months',
        technologies: 'MongoDB, Express.js, React.js, Node.js, Next.js, Redux Toolkit, Tailwind CSS',
        description: 'Modern JavaScript full stack development with scalable cloud deployments.'
      },
      {
        title: 'Cloud Computing & DevOps Engineering',
        category: 'Infrastructure',
        duration: '3.5 Months',
        technologies: 'AWS, Azure, Docker, Kubernetes, Jenkins, Terraform, CI/CD, Linux',
        description: 'Hands-on enterprise cloud architecture and automation pipeline engineering.'
      },
      {
        title: 'QA Software Testing & Automation',
        category: 'Quality Assurance',
        duration: '3 Months',
        technologies: 'Manual Testing, Selenium WebDriver, Java, TestNG, Cucumber BDD, Postman, API Testing',
        description: 'Complete quality assurance training with real-time test automation frameworks.'
      },
      {
        title: 'Data Analytics & Power BI',
        category: 'Analytics',
        duration: '3 Months',
        technologies: 'Advanced Excel, SQL Queries, Power BI, Tableau, Python for Analytics, ETL',
        description: 'Business data analytics, KPI dashboard design, and enterprise reporting.'
      },
      {
        title: 'Cybersecurity & Ethical Hacking',
        category: 'Security',
        duration: '4 Months',
        technologies: 'Network Defense, Ethical Hacking, SIEM, Penetration Testing, Kali Linux, OWASP',
        description: 'Security fundamentals, vulnerability assessment, and threat hunting.'
      },
      {
        title: 'Mobile App Development (Flutter)',
        category: 'Mobile Apps',
        duration: '3 Months',
        technologies: 'Flutter, Dart, Firebase, REST APIs, Provider/Bloc, Android & iOS Deployment',
        description: 'Cross-platform mobile application engineering from concept to app store release.'
      }
    ];

    const insertCourse = db.prepare(`
      INSERT INTO courses (title, category, duration, technologies, description)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const c of defaultCourses) {
      insertCourse.run(c.title, c.category, c.duration, c.technologies, c.description);
    }
  }
}

initializeDatabase();

module.exports = db;
