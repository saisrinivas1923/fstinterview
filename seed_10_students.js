const bcrypt = require('bcryptjs');
const db = require('C:\\Users\\saisr\\.gemini\\antigravity\\scratch\\institute-interview-tracker\\database');

async function seed10Students() {
  console.log('🌱 Seeding 10 realistic students and diverse interview records for Future Sprint Technologies...');

  // Reset student records & interviews, keep admin intact
  db.prepare("DELETE FROM interviews").run();
  db.prepare("DELETE FROM email_otps").run();
  db.prepare("DELETE FROM users WHERE role != 'admin'").run();

  const passwordHash = await bcrypt.hash('Student@123', 10);

  const mockStudents = [
    {
      name: 'Rahul Sharma',
      email: 'rahul.sharma@futuresprint.in',
      phone: '9848011221',
      domain: 'Full Stack Java Development',
      placement_status: 'Placed',
      company: 'Infosys',
      role: 'Java Backend Specialist',
      date: '2026-10-28',
      time: '10:30 AM',
      mode: 'Online',
      round: 'Technical Round 2',
      status: 'Selected',
      hrName: 'Swati Sen',
      hrPhone: '9876543211',
      salary: '8.5 LPA'
    },
    {
      name: 'Priya Patel',
      email: 'priya.patel@futuresprint.in',
      phone: '9949422332',
      domain: 'Python Full Stack & AI',
      placement_status: 'Placed',
      company: 'Microsoft',
      role: 'Associate AI Engineer',
      date: '2026-10-29',
      time: '02:00 PM',
      mode: 'Online',
      round: 'Technical Round 2',
      status: 'Selected',
      hrName: 'Amit Verma',
      hrPhone: '9876543212',
      salary: '14.0 LPA'
    },
    {
      name: 'Sneha Reddy',
      email: 'sneha.reddy@futuresprint.in',
      phone: '8978533443',
      domain: 'QA Automation & Testing',
      placement_status: 'In Training',
      company: 'TCS',
      role: 'Automation Test Engineer',
      date: '2026-10-27',
      time: '11:00 AM',
      mode: 'Offline',
      round: 'Technical Round 1',
      status: 'Attended',
      hrName: 'Ramesh Babu',
      hrPhone: '9876543213',
      salary: '6.5 LPA'
    },
    {
      name: 'Vikram Verma',
      email: 'vikram.verma@futuresprint.in',
      phone: '7893044554',
      domain: 'Cloud & DevOps Engineering',
      placement_status: 'In Training',
      company: 'Amazon',
      role: 'Cloud Operations Associate',
      date: '2026-10-26',
      time: '03:30 PM',
      mode: 'Online',
      round: 'System Architecture',
      status: 'Attended',
      hrName: 'Kavita Roy',
      hrPhone: '9876543214',
      salary: '12.0 LPA'
    },
    {
      name: 'Ananya Roy',
      email: 'ananya.roy@futuresprint.in',
      phone: '9123455665',
      domain: 'MERN Stack Web Development',
      placement_status: 'In Training',
      company: 'Wipro',
      role: 'Full Stack React Developer',
      date: '2026-10-28',
      time: '04:00 PM',
      mode: 'Online',
      round: 'Coding Round',
      status: 'Attended',
      hrName: 'Deepak Rao',
      hrPhone: '9876543215',
      salary: '7.2 LPA'
    },
    {
      name: 'Rohan Gupta',
      email: 'rohan.gupta@futuresprint.in',
      phone: '9848066776',
      domain: 'Data Analytics & Power BI',
      placement_status: 'In Training',
      company: 'Accenture',
      role: 'Data Insights Analyst',
      date: '2026-10-30',
      time: '10:00 AM',
      mode: 'Online',
      round: 'Technical Round 1',
      status: 'Waiting for HR Response',
      hrName: 'Megha Nair',
      hrPhone: '9876543216',
      salary: '7.8 LPA'
    },
    {
      name: 'Karthik Nair',
      email: 'karthik.nair@futuresprint.in',
      phone: '9949477887',
      domain: 'Full Stack Java Development',
      placement_status: 'In Training',
      company: 'Cognizant',
      role: 'Junior Java Developer',
      date: '2026-10-31',
      time: '01:30 PM',
      mode: 'Online',
      round: 'HR Interview',
      status: 'Waiting for Admin Approval',
      hrName: 'Sanjay Kumar',
      hrPhone: '9876543217',
      salary: '6.0 LPA'
    },
    {
      name: 'Meera Iyer',
      email: 'meera.iyer@futuresprint.in',
      phone: '8978588998',
      domain: 'Python Full Stack & AI',
      placement_status: 'Placed',
      company: 'Google',
      role: 'Junior AI Programmer',
      date: '2026-10-28',
      time: '05:00 PM',
      mode: 'Online',
      round: 'Final Offer Discussion',
      status: 'Selected',
      hrName: 'Pooja Hegde',
      hrPhone: '9876543218',
      salary: '16.5 LPA'
    },
    {
      name: 'Aditya Joshi',
      email: 'aditya.joshi@futuresprint.in',
      phone: '7893099009',
      domain: 'Cybersecurity & Ethical Hacking',
      placement_status: 'In Training',
      company: 'Deloitte',
      role: 'Security Analyst Trainee',
      date: '2026-11-01',
      time: '11:30 AM',
      mode: 'Offline',
      round: 'Technical Round 1',
      status: 'Scheduled',
      hrName: 'Manoj Joshi',
      hrPhone: '9876543219',
      salary: '8.0 LPA'
    },
    {
      name: 'Divya Rao',
      email: 'divya.rao@futuresprint.in',
      phone: '9123400110',
      domain: 'Cloud & DevOps Engineering',
      placement_status: 'In Training',
      company: 'Oracle',
      role: 'DevOps & SRE Associate',
      date: '2026-11-02',
      time: '02:30 PM',
      mode: 'Online',
      round: 'Managerial Round',
      status: 'On Hold',
      hrName: 'Sunita Pillai',
      hrPhone: '9876543220',
      salary: '9.0 LPA'
    }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, phone, domain, password_hash, role, is_verified, placement_status)
    VALUES (?, ?, ?, ?, ?, 'student', 1, ?)
  `);

  const insertInterview = db.prepare(`
    INSERT INTO interviews (
      student_id, company_name, role_title, interview_date, interview_time,
      interview_mode, round_name, status, hr_mobile_number, salary_package,
      job_location
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of mockStudents) {
    const userRes = insertUser.run(
      s.name,
      s.email,
      s.phone,
      s.domain,
      passwordHash,
      s.placement_status
    );
    const studentId = userRes.lastInsertRowid;

    insertInterview.run(
      studentId,
      s.company,
      s.role,
      s.date,
      s.time,
      s.mode,
      s.round,
      s.status,
      s.hrPhone,
      s.salary,
      'Hyderabad, Hi-Tech City'
    );
  }

  const sCount = db.prepare("SELECT count(*) as c FROM users WHERE role = 'student'").get();
  const iCount = db.prepare("SELECT count(*) as c FROM interviews").get();
  const selectedCount = db.prepare("SELECT count(*) as c FROM interviews WHERE status = 'Selected'").get();
  const attendedCount = db.prepare("SELECT count(*) as c FROM interviews WHERE status = 'Attended'").get();
  const pipelineCount = db.prepare("SELECT count(*) as c FROM interviews WHERE status IN ('Waiting for Admin Approval', 'Scheduled', 'Waiting for HR Response', 'On Hold')").get();

  console.log(`✅ Seeded ${sCount.c} students.`);
  console.log(`✅ Seeded ${iCount.c} interviews.`);
  console.log(`📊 Statistics breakdown:`);
  console.log(`   - Selected / Placed: ${selectedCount.c} (${Math.round((selectedCount.c / iCount.c) * 100)}%)`);
  console.log(`   - Attended: ${attendedCount.c} (${Math.round((attendedCount.c / iCount.c) * 100)}%)`);
  console.log(`   - In Pipeline: ${pipelineCount.c} (${Math.round((pipelineCount.c / iCount.c) * 100)}%)`);
}

seed10Students().catch(console.error);
