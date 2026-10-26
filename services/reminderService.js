const db = require('../database');
const { sendInterviewReminderEmail } = require('./mailer');

function parseInterviewDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const parts = dateStr.trim().split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;

  let hours = 0;
  let minutes = 0;

  const match12 = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    hours = parseInt(match12[1], 10);
    minutes = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  } else {
    const match24 = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      hours = parseInt(match24[1], 10);
      minutes = parseInt(match24[2], 10);
    }
  }

  // Uses local system timezone (IST)
  return new Date(year, month - 1, day, hours, minutes, 0);
}

// Check all upcoming interviews and send 2-hour prior office reminders
async function checkAndSendReminders() {
  try {
    const now = new Date();
    // Query active interviews that haven't had their 2h reminder sent yet
    const candidateInterviews = db.prepare(`
      SELECT 
        i.id,
        i.student_id,
        i.company_name,
        i.role_title,
        i.interview_date,
        i.interview_time,
        i.round_name,
        i.status,
        i.hr_mobile_number,
        i.reminder_sent_2h,
        u.name as student_name,
        u.email as student_email,
        u.phone as student_phone
      FROM interviews i
      JOIN users u ON i.student_id = u.id
      WHERE i.reminder_sent_2h = 0
        AND i.status != 'Rejected'
        AND i.interview_date >= date('now', '-1 day')
    `).all();

    for (const inv of candidateInterviews) {
      const interviewDate = parseInterviewDateTime(inv.interview_date, inv.interview_time);
      if (!interviewDate || isNaN(interviewDate.getTime())) continue;

      const diffMs = interviewDate.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / (1000 * 60));

      // Trigger condition: within 2 hours (120 minutes) prior, and not passed more than 15 minutes ago
      if (diffMinutes <= 120 && diffMinutes >= -15) {
        console.log(`⏰ [Reminder Engine] Interview #${inv.id} (${inv.company_name} for ${inv.student_name}) is ${diffMinutes} mins away. Triggering 2-hour institute office reminder...`);

        // Mark as sent first to prevent race conditions or duplicate sends
        db.prepare(`
          UPDATE interviews
          SET reminder_sent_2h = 1, reminder_sent_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(inv.id);

        await sendInterviewReminderEmail({
          toEmail: inv.student_email,
          toName: inv.student_name,
          companyName: inv.company_name,
          roleTitle: inv.role_title,
          roundName: inv.round_name,
          interviewDate: inv.interview_date,
          interviewTime: inv.interview_time,
          hrMobileNumber: inv.hr_mobile_number
        });
      }
    }
  } catch (err) {
    console.error('Error in checkAndSendReminders:', err);
  }
}

// Admin manual one-click reminder trigger
async function dispatchManualReminder(interviewId) {
  const inv = db.prepare(`
    SELECT 
      i.id,
      i.student_id,
      i.company_name,
      i.role_title,
      i.interview_date,
      i.interview_time,
      i.round_name,
      i.status,
      i.hr_mobile_number,
      i.reminder_sent_2h,
      u.name as student_name,
      u.email as student_email,
      u.phone as student_phone
    FROM interviews i
    JOIN users u ON i.student_id = u.id
    WHERE i.id = ?
  `).get(interviewId);

  if (!inv) {
    throw new Error('Interview record not found.');
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (inv.interview_date < todayStr || ['Selected', 'Attended', 'Rejected', 'Completed'].includes(inv.status)) {
    throw new Error('Cannot dispatch 2-hour arrival reminder for an interview that has already been attended or completed.');
  }

  // Mark in DB
  db.prepare(`
    UPDATE interviews
    SET reminder_sent_2h = 1, reminder_sent_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(inv.id);

  const result = await sendInterviewReminderEmail({
    toEmail: inv.student_email,
    toName: inv.student_name,
    companyName: inv.company_name,
    roleTitle: inv.role_title,
    roundName: inv.round_name,
    interviewDate: inv.interview_date,
    interviewTime: inv.interview_time,
    hrMobileNumber: inv.hr_mobile_number
  });

  return {
    success: true,
    message: `2-Hour Office Reminder email dispatched to ${inv.student_name} (${inv.student_email})!`,
    result
  };
}

let schedulerTimer = null;

function startReminderScheduler(intervalMs = 60000) {
  if (schedulerTimer) clearInterval(schedulerTimer);

  console.log('⏰ [Future Sprint Engine] Automated 2-Hour Prior Interview Reminder Scheduler active (checks every 60s)');
  
  // Initial check on server launch
  checkAndSendReminders();

  // Recurring check
  schedulerTimer = setInterval(checkAndSendReminders, intervalMs);
}

module.exports = {
  parseInterviewDateTime,
  checkAndSendReminders,
  dispatchManualReminder,
  startReminderScheduler
};
