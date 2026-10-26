# ⚡ Future Sprint Technologies Interview Dashboard

> **Institute Address:** Allwyn X Roads, Hema Durga Plaza, Flat No: 207, Miyapur, Hyderabad  
> **Purpose:** Real-time digital interview management, student tracking, course enrollment, and single-device session protection.

---

## 🌟 What's New & Upgraded

1. **Branding & Institute Details**:
   - Official Name: **Future Sprint Technologies**
   - Address: **Allwyn X Roads, Hema Durga Plaza, Flat No: 207, Miyapur**
   - Portal Title: **Future Sprint Technologies interview dashboard**
2. **Email OTP Verification for New Users**:
   - When new students register, a **6-digit numeric OTP** is generated and delivered to their email.
   - Student enters the OTP on screen to verify and activate their account.
   - Built with `nodemailer` (supports live SMTP via `.env` and automated local console logging for testing).
3. **Automatic Date & Time Detection from Student's Device**:
   - When the student logs an interview, the **Date** automatically defaults to their phone/device's current local date (`YYYY-MM-DD`). The student can also change or pick any dynamic date.
   - The **Time** automatically defaults to their device's local time (`HH:MM`).
   - The next field is **Company Name**!
4. **Automatic Domain Association**:
   - The student's enrolled domain (e.g. *Full Stack Java Development*, *Python Full Stack & AI*, etc.) is **automatically fetched from the backend profile** and locked to their interview entries.
   - The student never needs to re-enter their domain; it automatically attaches and reflects in the Admin dashboard.
5. **No Hardcoded Credentials in UI**:
   - All login and registration inputs start completely blank for testing fresh student and admin accounts.
6. **Courses & Tracks Catalog**:
   - 8 official technical training courses offered at Future Sprint Technologies:
     1. *Full Stack Java Development*
     2. *Python Full Stack & AI / Data Science*
     3. *MERN Full Stack Web Development*
     4. *Cloud Computing & DevOps Engineering*
     5. *QA Software Testing & Automation*
     6. *Data Analytics & Power BI*
     7. *Cybersecurity & Ethical Hacking*
     8. *Mobile App Development (Flutter)*
   - Students can explore course modules and tech stacks.
   - Admin can view student enrollments and add new courses.
7. **Single-Device Session Enforcement**:
   - Only **one device** can be active per account at any time.
   - Logging in on a second device automatically revokes the previous session.

---

## 🚀 How to Run

1. Open your terminal in the project directory:
   ```bash
   cd "C:\Users\saisr\.gemini\antigravity\scratch\institute-interview-tracker"
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open your browser:
   👉 **`http://localhost:5000`**

---

## 🧪 Testing as Student & Admin

### A. Testing as a New Student (with Email OTP)
1. Go to **`http://localhost:5000`**.
2. Click **"New Student Register"**.
3. Enter your Name, Email, Phone number, pick your Course Domain, and Password.
4. Click **"Send Verification OTP to Email"**.
5. An email with a 6-digit OTP is sent (and logged to the server console). Enter the 6 digits on screen and click **"Verify OTP & Activate Account"**.
6. You are immediately logged in to your **Future Sprint Student Dashboard**!
7. Click **"Log New Interview"**:
   - Notice the **Date** is pre-detected from your phone/computer.
   - The **Time** is pre-detected.
   - The very next field is **Company Name**.
   - Your **Domain** is automatically fetched and locked.
   - Save your interview.

### B. Testing as Admin (Institute Head)
1. Click **"Admin Login"**.
2. Enter your Admin Email (`admin@institute.com`) and Password (`AdminPassword@123`).
3. View the **Students Directory**: You will see your newly registered student with their Name, Email, Phone Number, WhatsApp button, and Domain.
4. **Click on the Student's Name**: Instantly opens their full **Future Sprint Student Dossier**, showing their complete chronological interview history!
5. View the **Digital Master Book** and click **Export Register (CSV/Excel)** to download a spreadsheet.
