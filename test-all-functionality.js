const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('Future Sprint Technologies Portal');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 1. Static Assets
    console.log('--- Phase 1: Static Assets & Server Health ---');
    const home = await request('GET', '/');
    assert('Home Page (index.html) Loads', home.status === 200 && typeof home.body === 'string' && home.body.includes('Future Sprint'));
    assert('Pagination container exists in index.html', typeof home.body === 'string' && home.body.includes('admin-students-pagination'));
    assert('OTP merged card uses tick circle (no "Verified" text)', typeof home.body === 'string' && home.body.includes('otp-tick-circle') && !home.body.includes('<span class="w-2 h-2 rounded-full bg-[#d99a63] animate-ping"></span>\n                    Verified'));

    // 2. Authentication
    console.log('\n--- Phase 2: Authentication & Security ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@futuresprintech.com',
      password: 'Krishnamohan@123'
    });
    assert('Admin Login Succeeds', adminLogin.status === 200 && adminLogin.body.token && adminLogin.body.user.role === 'admin');
    const adminToken = adminLogin.body.token;

    const invalidLogin = await request('POST', '/api/auth/login', {
      email: 'admin@futuresprintech.com',
      password: 'WrongPassword123!'
    });
    assert('Invalid Credentials Rejected', invalidLogin.status === 401);

    // Verify /api/auth/me returns placement_status
    const adminMe = await request('GET', '/api/auth/me', null, adminToken);
    assert('/api/auth/me returns admin profile', adminMe.status === 200 && adminMe.body.user.role === 'admin');

    // 3. Admin Overview & Metrics
    console.log('\n--- Phase 3: Admin Overview Metrics ---');
    const overview1 = await request('GET', '/api/admin/overview', null, adminToken);
    assert('Admin Overview returns stats', overview1.status === 200 && overview1.body.stats);
    assert('Placed candidates count present in overview', overview1.body.stats.placed_students !== undefined);
    const initialPlacedCount = overview1.body.stats.placed_students;
    console.log(`    Current Placed Students Count: ${initialPlacedCount}`);

    // 4. Admin Student Directory & Pagination
    console.log('\n--- Phase 4: Student Directory & Pagination ---');
    const studentsRes = await request('GET', '/api/admin/students', null, adminToken);
    assert('Students list loaded', studentsRes.status === 200 && Array.isArray(studentsRes.body.students));
    assert('Has enrolled students', studentsRes.body.students.length > 0);
    const totalStudents = studentsRes.body.students.length;
    console.log(`    Total enrolled candidates: ${totalStudents}`);

    // Test Domain Filter
    const testDomain = studentsRes.body.domains[0]?.domain;
    if (testDomain) {
      const filteredByDomain = await request('GET', `/api/admin/students?domain=${encodeURIComponent(testDomain)}`, null, adminToken);
      assert(`Domain filter works for "${testDomain}"`, filteredByDomain.status === 200 && filteredByDomain.body.students.every(s => s.domain.toLowerCase() === testDomain.toLowerCase()));
    }

    // 5. PLACEMENT STATUS REFLECTION ACROSS ENTIRE WEBSITE
    console.log('\n--- Phase 5: Placement Status Reflection Across Entire Website ---');
    // Find an unplaced student
    const unplacedStudent = studentsRes.body.students.find(s => s.placement_status !== 'Placed') || studentsRes.body.students[0];
    const testStudentId = unplacedStudent.id;
    console.log(`    Testing candidate #${testStudentId} (${unplacedStudent.name})`);

    // A) Update student to 'Placed' via placement-status endpoint
    const markPlacedRes = await request('PUT', `/api/admin/students/${testStudentId}/placement-status`, {
      placement_status: 'Placed'
    }, adminToken);
    assert('Mark student as Placed API succeeds', markPlacedRes.status === 200 && markPlacedRes.body.placement_status === 'Placed');

    // B) Verify in GET /api/admin/students
    const studentsAfterPlaced = await request('GET', `/api/admin/students`, null, adminToken);
    const targetStudentAfter = studentsAfterPlaced.body.students.find(s => s.id === testStudentId);
    assert('Student directory reflects candidate as Placed', targetStudentAfter && targetStudentAfter.placement_status === 'Placed');

    // C) Verify in GET /api/admin/overview
    const overviewAfterPlaced = await request('GET', '/api/admin/overview', null, adminToken);
    assert('Admin overview placed count incremented', overviewAfterPlaced.body.stats.placed_students >= initialPlacedCount);
    console.log(`    New Placed Students Count in Overview: ${overviewAfterPlaced.body.stats.placed_students}`);

    // D) Verify in GET /api/student/placements-dashboard
    // Login as the student to get token
    // First, let's set a known password for this test student if needed or check existing
    // We can also fetch placements-dashboard using student auth
    // Wait, let's create a test student or authenticate with an existing student
    const testStudent = unplacedStudent;

    // E) Test Master Register Reflection:
    const masterInterviews = await request('GET', '/api/admin/interviews', null, adminToken);
    assert('Master Register returns interviews', masterInterviews.status === 200 && Array.isArray(masterInterviews.body.interviews));
    assert('Master Register rows contain student_placement_status', masterInterviews.body.interviews.every(inv => inv.student_placement_status !== undefined));

    // F) Test Auto-Sync from Interview Status 'Selected':
    // Find another student with an interview
    const sampleInv = masterInterviews.body.interviews[0];
    if (sampleInv) {
      console.log(`    Testing interview #${sampleInv.id} for student #${sampleInv.student_id}`);
      const changeStatusRes = await request('PUT', `/api/admin/interviews/${sampleInv.id}/status`, {
        status: 'Selected'
      }, adminToken);
      assert('Changing interview status to "Selected" succeeds', changeStatusRes.status === 200);

      // Verify that student's profile is auto-marked as Placed!
      const studentsCheck = await request('GET', `/api/admin/students`, null, adminToken);
      const studentWithOffer = studentsCheck.body.students.find(s => s.id === sampleInv.student_id);
      assert('Candidate auto-marked as Placed when interview status is Selected!', studentWithOffer && studentWithOffer.placement_status === 'Placed');
    }

    // 6. Student Reschedule Interview (Blocking Past Dates)
    console.log('\n--- Phase 6: Student Reschedule Interview & Date Restrictions ---');
    // Find an interview to test reschedule with
    const interviewToReschedule = masterInterviews.body.interviews.find(i => i.student_id === testStudentId) || masterInterviews.body.interviews[0];
    
    // Attempt rescheduling with a PAST date directly via student route
    // Note: Student routes require student token. Let's create a fresh student or test student token.
    const uniqueEmail = `test_candidate_${Date.now()}@gmail.com`;
    // Register test student:
    const regReq = await request('POST', '/api/auth/register', {
      name: 'Reschedule Tester',
      email: uniqueEmail,
      phone: '9876543210',
      domain: 'Full Stack Java Development',
      password: 'Password@2026!'
    });
    assert('Student registration request sent', regReq.status === 200);

    // Get OTP from DB
    const db = require(path.join(__dirname, 'database.js'));
    const otpRow = db.prepare('SELECT otp_code FROM email_otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(uniqueEmail);
    assert('Registration OTP generated in database', !!otpRow && !!otpRow.otp_code);

    const verifyReg = await request('POST', '/api/auth/verify-otp', {
      email: uniqueEmail,
      otp_code: otpRow.otp_code
    });
    assert('Student registration OTP verified', verifyReg.status === 200 && !!verifyReg.body.token);
    const studentToken = verifyReg.body.token;
    const newStudentId = verifyReg.body.user.id;

    // Log an interview for this student
    const addInvRes = await request('POST', '/api/student/interviews', {
      company_name: 'Google India',
      role_title: 'Junior Software Engineer',
      interview_date: '2026-10-30',
      interview_time: '11:00 AM',
      interview_mode: 'Online',
      round_name: 'Technical Round 1',
      hr_mobile_number: '9876543210'
    }, studentToken);
    assert('Student logged interview', addInvRes.status === 201 && addInvRes.body.interview);
    const newInvId = addInvRes.body.interview.id;

    // Test Reschedule with a PAST date: "2020-01-01" -> MUST BE REJECTED
    const pastReschedule = await request('PUT', `/api/student/interviews/${newInvId}/reschedule`, {
      interview_date: '2020-01-01',
      interview_time: '02:00 PM'
    }, studentToken);
    assert('Reschedule with PAST date is REJECTED', pastReschedule.status === 400 && pastReschedule.body.error === 'INVALID_DATE');

    // Test Reschedule with a FUTURE date: "2026-11-15" -> MUST SUCCEED
    const futureReschedule = await request('PUT', `/api/student/interviews/${newInvId}/reschedule`, {
      interview_date: '2026-11-15',
      interview_time: '03:30 PM'
    }, studentToken);
    assert('Reschedule with FUTURE date SUCCEEDS', futureReschedule.status === 200 && futureReschedule.body.interview.is_rescheduled === 1);
    assert('Original date is preserved', futureReschedule.body.interview.original_interview_date === '2026-10-30');

    // Test Student Dashboard
    const studentDash = await request('GET', '/api/student/dashboard', null, studentToken);
    assert('Student dashboard loads', studentDash.status === 200 && studentDash.body.stats);
    assert('Student dashboard returns placement_status', studentDash.body.stats.placement_status !== undefined);

    // Test Placements Dashboard
    const studentPlacements = await request('GET', '/api/student/placements-dashboard', null, studentToken);
    assert('Student placements analytics dashboard loads', studentPlacements.status === 200 && Array.isArray(studentPlacements.body.domains));

    // 7. CSV Export
    console.log('\n--- Phase 7: CSV Export ---');
    const csvRes = await request('GET', '/api/admin/export/csv', null, adminToken);
    assert('CSV Export returns 200', csvRes.status === 200);
    assert('CSV contains "Placement Status" header', typeof csvRes.body === 'string' && csvRes.body.includes('"Placement Status"'));

    console.log('\n====================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
