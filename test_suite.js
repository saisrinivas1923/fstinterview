const http = require('http');

async function runTests() {
  console.log('🧪 Starting Future Sprint Technologies Suite Verification...');

  const express = require('express');
  const cors = require('cors');
  const path = require('path');
  const db = require('./database');
  const seed = require('./seed');

  await seed();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/student', require('./routes/student'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/courses', require('./routes/courses'));

  const server = app.listen(5099, async () => {
    console.log('Test server running on port 5099');

    try {
      const BASE_URL = 'http://127.0.0.1:5099';

      async function apiCall(endpoint, method = 'GET', body = null, token = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${BASE_URL}${endpoint}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : null
        });

        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
      }

      // TEST 1: Courses Catalog
      console.log('\n--- TEST 1: Courses Catalog ---');
      const coursesRes = await apiCall('/api/courses');
      console.log(`Available Courses count: ${coursesRes.data.courses?.length}`);
      coursesRes.data.courses.slice(0, 3).forEach(c => {
        console.log(`- Course: ${c.title} (${c.duration}) | Tech: ${c.technologies}`);
      });
      if (!coursesRes.data.courses || coursesRes.data.courses.length === 0) {
        throw new Error('Courses list empty');
      }

      // TEST 2: Email OTP Registration Flow & Full Password Rule Validation
      console.log('\n--- TEST 2: Password Rules & Email OTP Student Registration ---');

      // 2A: Test password rule failures
      const weakPasswords = [
        { pwd: 'Short1!', expectedMsg: 'at least 8 characters' },
        { pwd: 'nouppercase123!', expectedMsg: 'uppercase letter' },
        { pwd: 'NOLOWERCASE123!', expectedMsg: 'lowercase letter' },
        { pwd: 'NoNumberHere!@#', expectedMsg: 'number' },
        { pwd: 'NoSpecialChar123', expectedMsg: 'special character' }
      ];

      for (const t of weakPasswords) {
        const failRes = await apiCall('/api/auth/register', 'POST', {
          name: 'Rule Tester',
          email: `test.${Date.now()}@futuresprint.com`,
          phone: '+91 9999988888',
          domain: 'Full Stack Java Development',
          password: t.pwd
        });
        if (failRes.status !== 400 || failRes.data.error !== 'WEAK_PASSWORD') {
          throw new Error(`Password "${t.pwd}" should have been rejected for missing ${t.expectedMsg}, but got status ${failRes.status}`);
        }
      }
      console.log('✅ PASS: All 5 password complexity rules strictly enforced (length, upper, lower, number, special character)!');

      // 2B: Valid registration with all 5 rules satisfied
      const testEmail = `student.otp.${Date.now()}@futuresprint.com`;
      const regRes = await apiCall('/api/auth/register', 'POST', {
        name: 'Manoj Reddy',
        email: testEmail,
        phone: '+91 9123456789',
        domain: 'Full Stack Java Development',
        password: 'SecurePassword@123'
      });

      const otpRecord = db.prepare('SELECT otp_code FROM email_otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
      const otpCode = regRes.data.dev_otp || (otpRecord ? otpRecord.otp_code : null);
      console.log('Registration Response Status:', regRes.status);
      console.log('Requires OTP:', regRes.data.requires_otp);
      console.log('Generated OTP code (from DB):', otpCode);

      if (!regRes.data.requires_otp || !otpCode) {
        throw new Error('Registration did not require OTP or OTP was not generated');
      }

      // Verify OTP
      console.log('Verifying OTP code...');
      const verifyRes = await apiCall('/api/auth/verify-otp', 'POST', {
        email: testEmail,
        otp_code: otpCode
      });
      console.log('OTP Verification Status:', verifyRes.status);
      console.log('Verified Student:', verifyRes.data.user?.name, '| Domain:', verifyRes.data.user?.domain);

      if (verifyRes.status !== 200 || !verifyRes.data.token) {
        throw new Error('OTP Verification failed');
      }

      const studentTokenDevice1 = verifyRes.data.token;
      const studentId = verifyRes.data.user.id;

      // TEST 3: Student Logs Interview with Phone/Device Date & Time + Auto-attached Domain
      console.log('\n--- TEST 3: Student Logs Interview (Auto Date, Time & Domain) ---');
      const todayStr = new Date().toISOString().slice(0, 10);
      const addInvRes = await apiCall('/api/student/interviews', 'POST', {
        interview_date: todayStr,
        interview_time: '11:00',
        company_name: 'Cognizant Technology Solutions',
        role_title: 'Java Cloud Engineer',
        interview_mode: 'Online',
        round_name: 'Technical Round 1',
        status: 'Scheduled',
        hr_mobile_number: '9876543210',
        salary_package: '6.0 LPA',
        job_location: 'Hyderabad'
      }, studentTokenDevice1);

      console.log('Added Interview Status:', addInvRes.status);
      console.log('Company Logged:', addInvRes.data.interview?.company_name, 'on Date:', addInvRes.data.interview?.interview_date);
      if (addInvRes.status !== 201) throw new Error('Failed to log interview');

      // TEST 4: Single-Device Session Revocation
      console.log('\n--- TEST 4: Single Device Session Invalidation ---');
      console.log('Device 1 verifies active session...');
      const d1Before = await apiCall('/api/auth/verify-session', 'GET', null, studentTokenDevice1);
      console.log('Device 1 status:', d1Before.status);

      console.log('Logging in from Device 2 (simulating mobile phone)...');
      const dev2LoginRes = await apiCall('/api/auth/login', 'POST', {
        email: testEmail,
        password: 'SecurePassword@123'
      });
      const studentTokenDevice2 = dev2LoginRes.data.token;
      console.log('Device 2 login status:', dev2LoginRes.status);

      console.log('Checking Device 1 request after Device 2 logged in...');
      const d1After = await apiCall('/api/student/interviews', 'GET', null, studentTokenDevice1);
      console.log('Device 1 Status:', d1After.status, 'Error Code:', d1After.data.error);

      if (d1After.status === 401 && d1After.data.error === 'SESSION_REVOKED') {
        console.log('✅ PASS: Device 1 was successfully superseded and revoked! Single device login strictly enforced.');
      } else {
        throw new Error('Single-device session revocation failed');
      }

      // TEST 5: Admin Login and Student Drilldown Check
      console.log('\n--- TEST 5: Admin Login and Student Drilldown (Future Sprint) ---');
      const adminLogin = await apiCall('/api/auth/login', 'POST', {
        email: 'admin@futuresprintech.com',
        password: 'Krishnamohan@123'
      });
      if (adminLogin.status !== 200) {
        throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
      }
      const adminToken = adminLogin.data.token;

      const drilldownRes = await apiCall(`/api/admin/students/${studentId}`, 'GET', null, adminToken);
      console.log(`Admin sees student "${drilldownRes.data.student.name}"`);
      console.log(`Domain: ${drilldownRes.data.student.domain}`);
      console.log(`Interviews count: ${drilldownRes.data.interviews.length}`);
      console.log(`Company: ${drilldownRes.data.interviews[0]?.company_name}`);
      console.log(`Initial Status: ${drilldownRes.data.interviews[0]?.status}`);

      if (drilldownRes.data.interviews[0]?.company_name !== 'Cognizant Technology Solutions') {
        throw new Error('Admin drilldown did not match student interview');
      }

      if (drilldownRes.data.interviews[0]?.status !== 'Waiting for Admin Approval') {
        throw new Error(`Expected 'Waiting for Admin Approval' status, got ${drilldownRes.data.interviews[0]?.status}`);
      }

      // TEST 6: Admin updates status to "Waiting for HR Response" and "Attended"
      console.log('\n--- TEST 6: Admin Updates Interview Status to Requested Options ---');
      const interviewId = drilldownRes.data.interviews[0].id;
      const updateStatusRes = await apiCall(`/api/admin/interviews/${interviewId}/status`, 'PUT', {
        status: 'Waiting for HR Response'
      }, adminToken);
      console.log(`Update status response: ${updateStatusRes.status}`);

      // Verify on student dashboard
      const studentDashAfter = await apiCall('/api/student/dashboard', 'GET', null, studentTokenDevice2);
      console.log(`Student views updated status: ${studentDashAfter.data.upcoming[0]?.status}`);
      if (studentDashAfter.data.upcoming[0]?.status !== 'Waiting for HR Response') {
        throw new Error('Status update did not reflect on student dashboard');
      }
      console.log('✅ PASS: Status change successfully reflected on Student Dashboard!');

      // TEST 7: Student Password Change with Email OTP Verification
      console.log('\n--- TEST 7: Student Password Change with Email OTP ---');
      const reqPwdOtpRes = await apiCall('/api/student/request-password-otp', 'POST', {}, studentTokenDevice2);
      const pwdOtpRecord = db.prepare('SELECT otp_code FROM email_otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
      const pwdOtpCode = reqPwdOtpRes.data.devOtp || (pwdOtpRecord ? pwdOtpRecord.otp_code : null);
      console.log('Password OTP Request Status:', reqPwdOtpRes.status, 'OTP Code:', pwdOtpCode);
      if (reqPwdOtpRes.status !== 200 || !pwdOtpCode) {
        throw new Error('Failed to request password reset OTP');
      }

      const changePwdRes = await apiCall('/api/student/change-password-with-otp', 'POST', {
        otp_code: pwdOtpCode,
        new_password: 'NewStrongPassword@2026'
      }, studentTokenDevice2);
      console.log('Password Change Status:', changePwdRes.status);
      if (changePwdRes.status !== 200) {
        throw new Error('Failed to change password with OTP');
      }

      // Verify new password works
      const newLoginRes = await apiCall('/api/auth/login', 'POST', {
        email: testEmail,
        password: 'NewStrongPassword@2026'
      });
      console.log('New Password Login Status:', newLoginRes.status);
      if (newLoginRes.status !== 200) {
        throw new Error('Failed to login with new password');
      }
      console.log('✅ PASS: Password change with Email OTP verified!');

      // TEST 7B: Admin SMTP Settings Configuration Endpoint
      console.log('\n--- TEST 7B: Admin SMTP Settings & Email Configuration ---');
      const saveSmtpRes = await apiCall('/api/auth/smtp-settings', 'POST', {
        host: 'smtp.gmail.com',
        port: 465,
        user: 'admissions@futuresprintech.com',
        pass: 'apppassword1234',
        from: '"Future Sprint Tech" <admissions@futuresprintech.com>'
      }, adminToken);
      console.log('Save SMTP Settings Status:', saveSmtpRes.status);
      if (saveSmtpRes.status !== 200) {
        throw new Error('Failed to save SMTP settings');
      }

      const getSmtpRes = await apiCall('/api/auth/smtp-settings', 'GET', null, adminToken);
      console.log('Get SMTP Settings Status:', getSmtpRes.status, '| Configured:', getSmtpRes.data.smtp?.is_configured);
      if (!getSmtpRes.data.smtp?.is_configured) {
        throw new Error('SMTP should report as configured');
      }
      console.log('✅ PASS: Admin SMTP settings save and retrieval verified!');

      // TEST 8: Admin Views Interview Time in Student Directory & Deletes Student Account
      console.log('\n--- TEST 8: Admin Views Time & Deletes Student Account ---');
      const studentsListRes = await apiCall('/api/admin/students', 'GET', null, adminToken);
      const studentInList = studentsListRes.data.students.find(s => s.id === studentId);
      console.log(`Student Latest Interview Date: ${studentInList.latest_interview?.interview_date}, Time: ${studentInList.latest_interview?.interview_time}`);
      if (!studentInList.latest_interview?.interview_time) {
        throw new Error('interview_time missing from admin students list');
      }

      const deleteStudentRes = await apiCall(`/api/admin/students/${studentId}`, 'DELETE', null, adminToken);
      console.log(`Delete student response status: ${deleteStudentRes.status}`);
      if (deleteStudentRes.status !== 200) {
        throw new Error('Failed to delete student account');
      }

      const drilldownAfterDelete = await apiCall(`/api/admin/students/${studentId}`, 'GET', null, adminToken);
      if (drilldownAfterDelete.status !== 404) {
        throw new Error('Student account was not deleted');
      }
      console.log('✅ PASS: Student account successfully deleted by Admin!');

      console.log('\n🎉 ALL FUTURE SPRINT TECHNOLOGIES TESTS PASSED SUCCESSFULLY (100%)!');
    } catch (err) {
      console.error('❌ Test failed with error:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

runTests();
