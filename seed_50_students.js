const bcrypt = require('bcryptjs');
const db = require('./database');

async function seed50Students() {
  console.log('🌱 Seeding 50 diverse students across 10 technical domains...');
  const hash = await bcrypt.hash('Student@123', 10);

  const mockStudents = [
    // 1. AI Engineer (5)
    { name: 'Aarav Sharma', email: 'aarav.sharma@futuresprint.in', phone: '9848011223', domain: 'AI Engineer', placement_status: 'Placed', company: 'Microsoft', salary: '14.5 LPA', roleTitle: 'Associate AI Engineer' },
    { name: 'Priya Nambiar', email: 'priya.nambiar@futuresprint.in', phone: '9949422334', domain: 'AI Engineer', placement_status: 'Placed', company: 'Google', salary: '16.0 LPA', roleTitle: 'AI Research Assistant' },
    { name: 'Rohan Varma', email: 'rohan.varma@futuresprint.in', phone: '8978533445', domain: 'AI Engineer', placement_status: 'In Training', company: 'TCS', salary: '7.5 LPA', roleTitle: 'Junior AI Programmer' },
    { name: 'Kavya Joshi', email: 'kavya.joshi@futuresprint.in', phone: '7893044556', domain: 'AI Engineer', placement_status: 'In Training', company: 'Cognizant', salary: '6.8 LPA', roleTitle: 'AI Solutions Trainee' },
    { name: 'Siddharth Bose', email: 'siddharth.bose@futuresprint.in', phone: '9123455667', domain: 'AI Engineer', placement_status: 'Placed', company: 'Oracle', salary: '13.2 LPA', roleTitle: 'Computer Vision Engineer' },

    // 2. GenAI Engineer (5)
    { name: 'Ananya Verma', email: 'ananya.verma@futuresprint.in', phone: '9848066778', domain: 'GenAI Engineer', placement_status: 'Placed', company: 'Amazon', salary: '15.0 LPA', roleTitle: 'LLM Systems Engineer' },
    { name: 'Gautam Pillai', email: 'gautam.pillai@futuresprint.in', phone: '9949477889', domain: 'GenAI Engineer', placement_status: 'In Training', company: 'Accenture', salary: '8.0 LPA', roleTitle: 'Prompt & Workflow Engineer' },
    { name: 'Meera Menon', email: 'meera.menon@futuresprint.in', phone: '8978588990', domain: 'GenAI Engineer', placement_status: 'Placed', company: 'Deloitte', salary: '11.5 LPA', roleTitle: 'GenAI Solutions Consultant' },
    { name: 'Naveen Chandra', email: 'naveen.chandra@futuresprint.in', phone: '7893099001', domain: 'GenAI Engineer', placement_status: 'In Training', company: 'Wipro', salary: '6.5 LPA', roleTitle: 'AI Application Trainee' },
    { name: 'Neha Kulkarni', email: 'neha.kulkarni@futuresprint.in', phone: '9123400112', domain: 'GenAI Engineer', placement_status: 'In Training', company: 'Infosys', salary: '7.2 LPA', roleTitle: 'GenAI Developer' },

    // 3. Agentic AI Engineer (5)
    { name: 'Arjun Patel', email: 'arjun.patel@futuresprint.in', phone: '9848012345', domain: 'Agentic AI Engineer', placement_status: 'Placed', company: 'Future Sprint Partner Hub', salary: '13.8 LPA', roleTitle: 'Autonomous Agent Architect' },
    { name: 'Divya Iyer', email: 'divya.iyer@futuresprint.in', phone: '9949423456', domain: 'Agentic AI Engineer', placement_status: 'In Training', company: 'Capgemini', salary: '8.4 LPA', roleTitle: 'Multi-Agent Systems Trainee' },
    { name: 'Chirag Gupta', email: 'chirag.gupta@futuresprint.in', phone: '8978534567', domain: 'Agentic AI Engineer', placement_status: 'Placed', company: 'Microsoft', salary: '17.0 LPA', roleTitle: 'Agentic Workflow Engineer' },
    { name: 'Bhavya Nair', email: 'bhavya.nair@futuresprint.in', phone: '7893045678', domain: 'Agentic AI Engineer', placement_status: 'In Training', company: 'TCS', salary: '7.0 LPA', roleTitle: 'AI Automation Engineer' },
    { name: 'Deepak Reddy', email: 'deepak.reddy@futuresprint.in', phone: '9123456789', domain: 'Agentic AI Engineer', placement_status: 'In Training', company: 'Cognizant', salary: '7.8 LPA', roleTitle: 'Agent Platform Associate' },

    // 4. Full Stack Java Development (5)
    { name: 'Harshini Rao', email: 'harshini.rao@futuresprint.in', phone: '9949487654', domain: 'Full Stack Java Development', placement_status: 'Placed', company: 'Infosys', salary: '8.5 LPA', roleTitle: 'Spring Boot Microservices Dev' },
    { name: 'Ishaan Sen', email: 'ishaan.sen@futuresprint.in', phone: '8978576543', domain: 'Full Stack Java Development', placement_status: 'In Training', company: 'Wipro', salary: '5.5 LPA', roleTitle: 'Java Trainee' },
    { name: 'Kiran Kumar', email: 'kiran.kumar@futuresprint.in', phone: '7893065432', domain: 'Full Stack Java Development', placement_status: 'In Training', company: 'TCS', salary: '6.0 LPA', roleTitle: 'Backend Java Developer' },
    { name: 'Manish Tiwari', email: 'manish.tiwari@futuresprint.in', phone: '9123454321', domain: 'Full Stack Java Development', placement_status: 'Placed', company: 'Oracle', salary: '12.0 LPA', roleTitle: 'Enterprise Java Architect' },
    { name: 'Pooja Reddy', email: 'pooja.reddy@futuresprint.in', phone: '9848098765', domain: 'Full Stack Java Development', placement_status: 'In Training', company: 'Tech Mahindra', salary: '6.5 LPA', roleTitle: 'Junior Java Developer' },

    // 5. Python Full Stack Developer (5)
    { name: 'Nikhil Deshmukh', email: 'nikhil.deshmukh@futuresprint.in', phone: '9848033221', domain: 'Python Full Stack Developer', placement_status: 'Placed', company: 'Amazon', salary: '12.5 LPA', roleTitle: 'Python Backend Engineer' },
    { name: 'Pooja Hegde', email: 'pooja.hegde@futuresprint.in', phone: '9949444332', domain: 'Python Full Stack Developer', placement_status: 'In Training', company: 'Capgemini', salary: '6.2 LPA', roleTitle: 'Django/FastAPI Trainee' },
    { name: 'Pranav Mukherjee', email: 'pranav.mukherjee@futuresprint.in', phone: '8978555443', domain: 'Python Full Stack Developer', placement_status: 'Placed', company: 'Cognizant', salary: '8.8 LPA', roleTitle: 'Full Stack Python Developer' },
    { name: 'Rahul Choudhury', email: 'rahul.choudhury@futuresprint.in', phone: '7893066554', domain: 'Python Full Stack Developer', placement_status: 'In Training', company: 'TCS', salary: '5.8 LPA', roleTitle: 'Associate Software Engineer' },
    { name: 'Rhea Bhatia', email: 'rhea.bhatia@futuresprint.in', phone: '9123477665', domain: 'Python Full Stack Developer', placement_status: 'In Training', company: 'Infosys', salary: '6.5 LPA', roleTitle: 'Python Developer' },

    // 6. Data Scientist (5)
    { name: 'Sanjay Ranganathan', email: 'sanjay.ranganathan@futuresprint.in', phone: '9848077112', domain: 'Data Scientist', placement_status: 'Placed', company: 'Deloitte', salary: '13.0 LPA', roleTitle: 'Data Science Specialist' },
    { name: 'Shruti Saxena', email: 'shruti.saxena@futuresprint.in', phone: '9949488223', domain: 'Data Scientist', placement_status: 'Placed', company: 'Microsoft', salary: '15.5 LPA', roleTitle: 'Statistical Modeler' },
    { name: 'Sneha Kapoor', email: 'sneha.kapoor@futuresprint.in', phone: '8978599334', domain: 'Data Scientist', placement_status: 'In Training', company: 'Accenture', salary: '7.5 LPA', roleTitle: 'Data Analyst' },
    { name: 'Suresh Menon', email: 'suresh.menon@futuresprint.in', phone: '7893000445', domain: 'Data Scientist', placement_status: 'In Training', company: 'Wipro', salary: '6.8 LPA', roleTitle: 'Machine Learning Trainee' },
    { name: 'Swati Mishra', email: 'swati.mishra@futuresprint.in', phone: '9123411556', domain: 'Data Scientist', placement_status: 'In Training', company: 'TCS', salary: '7.0 LPA', roleTitle: 'Junior Data Scientist' },

    // 7. Cloud & DevOps Engineer (5)
    { name: 'Tarun Aggarwal', email: 'tarun.aggarwal@futuresprint.in', phone: '9848022998', domain: 'Cloud & DevOps Engineer', placement_status: 'Placed', company: 'Google', salary: '16.5 LPA', roleTitle: 'Cloud Infrastructure Engineer' },
    { name: 'Trisha Roy', email: 'trisha.roy@futuresprint.in', phone: '9949433887', domain: 'Cloud & DevOps Engineer', placement_status: 'Placed', company: 'Amazon', salary: '14.0 LPA', roleTitle: 'DevOps & SRE Specialist' },
    { name: 'Uday Kiran', email: 'uday.kiran@futuresprint.in', phone: '8978544776', domain: 'Cloud & DevOps Engineer', placement_status: 'In Training', company: 'Tech Mahindra', salary: '6.5 LPA', roleTitle: 'Kubernetes Admin Trainee' },
    { name: 'Varun Malhotra', email: 'varun.malhotra@futuresprint.in', phone: '7893055665', domain: 'Cloud & DevOps Engineer', placement_status: 'In Training', company: 'Cognizant', salary: '7.2 LPA', roleTitle: 'CI/CD Pipeline Engineer' },
    { name: 'Vidya Balan', email: 'vidya.balan@futuresprint.in', phone: '9123466554', domain: 'Cloud & DevOps Engineer', placement_status: 'Placed', company: 'Oracle', salary: '11.8 LPA', roleTitle: 'Cloud Support Engineer' },

    // 8. React & Node.js Developer (5)
    { name: 'Vikram Rathore', email: 'vikram.rathore@futuresprint.in', phone: '9848055110', domain: 'React & Node.js Developer', placement_status: 'Placed', company: 'Cognizant', salary: '8.5 LPA', roleTitle: 'Frontend React Engineer' },
    { name: 'Yash Singhania', email: 'yash.singhania@futuresprint.in', phone: '9949466221', domain: 'React & Node.js Developer', placement_status: 'In Training', company: 'TCS', salary: '5.5 LPA', roleTitle: 'MERN Stack Trainee' },
    { name: 'Zoya Khan', email: 'zoya.khan@futuresprint.in', phone: '8978577332', domain: 'React & Node.js Developer', placement_status: 'Placed', company: 'Infosys', salary: '9.2 LPA', roleTitle: 'Full Stack JavaScript Dev' },
    { name: 'Abhinav Kashyap', email: 'abhinav.kashyap@futuresprint.in', phone: '7893088443', domain: 'React & Node.js Developer', placement_status: 'In Training', company: 'Wipro', salary: '6.0 LPA', roleTitle: 'Node.js Backend Dev' },
    { name: 'Karthik Sundaram', email: 'karthik.sundaram@futuresprint.in', phone: '9123499554', domain: 'React & Node.js Developer', placement_status: 'In Training', company: 'Capgemini', salary: '6.8 LPA', roleTitle: 'UI/UX Developer' },

    // 9. Cybersecurity Analyst (5)
    { name: 'Lavanya Krishnan', email: 'lavanya.krishnan@futuresprint.in', phone: '9848019283', domain: 'Cybersecurity Analyst', placement_status: 'Placed', company: 'Deloitte', salary: '12.0 LPA', roleTitle: 'Information Security Analyst' },
    { name: 'Madhavan Pillai', email: 'madhavan.pillai@futuresprint.in', phone: '9949428394', domain: 'Cybersecurity Analyst', placement_status: 'In Training', company: 'Accenture', salary: '7.8 LPA', roleTitle: 'SOC Analyst Trainee' },
    { name: 'Preeti Acharya', email: 'preeti.acharya@futuresprint.in', phone: '8978537485', domain: 'Cybersecurity Analyst', placement_status: 'Placed', company: 'TCS', salary: '10.5 LPA', roleTitle: 'Vulnerability Assessment Eng' },
    { name: 'Rajeshwari Iyer', email: 'rajeshwari.iyer@futuresprint.in', phone: '7893046576', domain: 'Cybersecurity Analyst', placement_status: 'In Training', company: 'Cognizant', salary: '6.5 LPA', roleTitle: 'Security Compliance Trainee' },
    { name: 'Surya Teja', email: 'surya.teja@futuresprint.in', phone: '9123455687', domain: 'Cybersecurity Analyst', placement_status: 'In Training', company: 'Tech Mahindra', salary: '7.0 LPA', roleTitle: 'Network Security Analyst' },

    // 10. Mobile App Developer (Flutter) (5)
    { name: 'Tanvi Bhatnagar', email: 'tanvi.bhatnagar@futuresprint.in', phone: '9848088117', domain: 'Mobile App Developer (Flutter)', placement_status: 'Placed', company: 'Infosys', salary: '9.8 LPA', roleTitle: 'Flutter App Engineer' },
    { name: 'Vamsi Krishna', email: 'vamsi.krishna@futuresprint.in', phone: '9949477226', domain: 'Mobile App Developer (Flutter)', placement_status: 'In Training', company: 'Wipro', salary: '6.2 LPA', roleTitle: 'Cross-Platform App Dev' },
    { name: 'Vandana Shenoy', email: 'vandana.shenoy@futuresprint.in', phone: '8978566335', domain: 'Mobile App Developer (Flutter)', placement_status: 'Placed', company: 'Tech Mahindra', salary: '10.2 LPA', roleTitle: 'Mobile Software Engineer' },
    { name: 'Vinay Prasad', email: 'vinay.prasad@futuresprint.in', phone: '7893055444', domain: 'Mobile App Developer (Flutter)', placement_status: 'In Training', company: 'Capgemini', salary: '6.5 LPA', roleTitle: 'Android/iOS Flutter Trainee' },
    { name: 'Aditi Rao', email: 'aditi.rao@futuresprint.in', phone: '9123444333', domain: 'Mobile App Developer (Flutter)', placement_status: 'In Training', company: 'TCS', salary: '7.0 LPA', roleTitle: 'Junior Mobile Developer' }
  ];

  const modes = ['Online (Google Meet)', 'Online (Zoom)', 'In-Person (Office Campus)', 'Hybrid Drive'];
  const rounds = ['Technical Round 1', 'Technical Round 2', 'System Design Round', 'HR Discussion', 'Managerial Round'];

  const checkUser = db.prepare('SELECT id FROM users WHERE email = ?');
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, phone, domain, password_hash, role, is_verified, placement_status)
    VALUES (?, ?, ?, ?, ?, 'student', 1, ?)
  `);
  const updateUser = db.prepare(`
    UPDATE users SET name = ?, phone = ?, domain = ?, placement_status = ? WHERE email = ?
  `);

  const insertInterview = db.prepare(`
    INSERT INTO interviews (student_id, company_name, role_title, interview_date, interview_time, interview_mode, round_name, status, hr_mobile_number, salary_package, job_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let added = 0;
  for (let i = 0; i < mockStudents.length; i++) {
    const s = mockStudents[i];
    const existing = checkUser.get(s.email);
    let studentId;

    if (!existing) {
      const res = insertUser.run(s.name, s.email, s.phone, s.domain, hash, s.placement_status);
      studentId = res.lastInsertRowid;
      added++;
    } else {
      studentId = existing.id;
      updateUser.run(s.name, s.phone, s.domain, s.placement_status, s.email);
    }

    // Add interviews for this student if none exist
    const invCount = db.prepare('SELECT COUNT(*) as c FROM interviews WHERE student_id = ?').get(studentId).c;
    if (invCount === 0) {
      const isPlaced = s.placement_status === 'Placed';
      const status = isPlaced ? 'Selected' : (i % 3 === 0 ? 'Attended' : (i % 3 === 1 ? 'Waiting for HR Response' : 'On Hold'));
      const mode = modes[i % modes.length];
      const round = isPlaced ? 'HR Discussion' : rounds[i % rounds.length];
      const interviewDate = '2026-10-' + String(10 + (i % 12)).padStart(2, '0');
      const interviewTime = '11:00 AM';
      const hrPhone = '98765' + String(10000 + i).slice(-5);
      const location = 'Hyderabad, Hi-Tech City';

      insertInterview.run(studentId, s.company, s.roleTitle, interviewDate, interviewTime, mode, round, status, hrPhone, s.salary, location);

      if (isPlaced) {
        insertInterview.run(studentId, s.company, s.roleTitle, '2026-10-05', '02:30 PM', 'Online (Google Meet)', 'Technical Round 1', 'Attended', hrPhone, s.salary, location);
      }
    }
  }

  const totalStudents = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count;
  const totalInterviews = db.prepare('SELECT COUNT(*) as count FROM interviews').get().count;
  console.log(`✅ Seeding complete! Database now has ${totalStudents} students and ${totalInterviews} interviews across all domains.`);
}

module.exports = seed50Students;

if (require.main === module) {
  seed50Students().catch(console.error);
}
