// Student Inactivity Manager: 1-hour auto-logout strictly for students (Admin is exempt)
const StudentInactivityManager = {
  TIMEOUT_MS: 60 * 60 * 1000, // 1 hour = 3,600,000 ms
  STORAGE_KEY: 'student_last_activity',
  intervalId: null,
  activityListenersBound: false,
  boundActivityHandler: null,
  boundVisibilityHandler: null,
  lastThrottleTime: 0,

  start() {
    const user = API.getUser();
    // STRICTLY for students only - Admin is completely exempt!
    if (!user || user.role !== 'student') {
      this.stop();
      return;
    }

    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    const now = Date.now();
    if (!stored) {
      sessionStorage.setItem(this.STORAGE_KEY, now.toString());
    } else {
      const last = parseInt(stored, 10);
      if (now - last >= this.TIMEOUT_MS) {
        this.triggerTimeout();
        return;
      }
    }

    this.bindActivityListeners();

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.checkInactivity();
    }, 10000);
  },

  recordActivity() {
    const now = Date.now();
    if (now - this.lastThrottleTime < 2000) return;
    this.lastThrottleTime = now;

    const user = API.getUser();
    if (user && user.role === 'student') {
      sessionStorage.setItem(this.STORAGE_KEY, now.toString());
    }
  },

  checkInactivity() {
    const user = API.getUser();
    if (!user || user.role !== 'student') {
      this.stop();
      return;
    }

    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    const now = Date.now();
    const last = stored ? parseInt(stored, 10) : now;

    if (now - last >= this.TIMEOUT_MS) {
      this.triggerTimeout();
    }
  },

  triggerTimeout() {
    this.stop();
    App.logout();
    if (window.alert) {
      window.alert("Your session has expired due to 1 hour of inactivity. Please log in again.");
    }
  },

  bindActivityListeners() {
    if (this.activityListenersBound) return;

    this.boundActivityHandler = () => this.recordActivity();
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(ev => {
      window.addEventListener(ev, this.boundActivityHandler, { passive: true });
    });

    this.boundVisibilityHandler = () => {
      if (!document.hidden) {
        this.checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    window.addEventListener('focus', this.boundVisibilityHandler);

    this.activityListenersBound = true;
  },

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    sessionStorage.removeItem(this.STORAGE_KEY);
  }
};
window.StudentInactivityManager = StudentInactivityManager;

// Main Application Controller & Router - Future Sprint Technologies
const App = {
  currentView: 'auth',
  allCourses: [
    'Full Stack Java Development',
    'Python Full Stack & AI / Data Science',
    'MERN Full Stack Web Development',
    'Cloud Computing & DevOps Engineering',
    'QA Software Testing & Automation',
    'Data Analytics & Power BI',
    'Cybersecurity & Ethical Hacking',
    'SAP (FICO, ABAP, MM)',
    'Mobile App Development (Flutter)'
  ],

  init() {
    console.log('🚀 Initializing Future Sprint Technologies Interview Dashboard...');

    // Purge any legacy persistent localStorage so session is strictly per-tab (sessionStorage)
    try {
      localStorage.removeItem('inst_tracker_token');
      localStorage.removeItem('inst_tracker_user');
      localStorage.removeItem('fs_token');
      localStorage.removeItem('fs_user');
    } catch (e) {}

    this.initIntroSplash();
    this.initParticleNetwork();
    this.initScrollProgress();
    this.initWhatsAppWidget();

    Auth.init();
    StudentPortal.init();
    AdminPortal.init();

    this.bindGlobalEvents();
    this.setupHistoryRouting();
    this.checkInitialAuth();
  },

  // Interactive particle network background identical to futuresprintech.com
  initParticleNetwork() {
    const c = document.getElementById("net");
    if (!c) return;
    const x = c.getContext("2d");
    let w, h, pts;
    const COLORS = ["#d99a63", "#bf6088", "#8a6cc0"];

    function size() {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
      const n = Math.min(90, Math.floor((w * h) / 16000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        c: COLORS[Math.floor(Math.random() * 3)]
      }));
    }

    size();
    window.addEventListener("resize", size, { passive: true });

    let mx = -999, my = -999;
    window.addEventListener("mousemove", e => {
      mx = e.clientX;
      my = e.clientY;
    }, { passive: true });

    function draw() {
      x.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        x.beginPath();
        x.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        x.fillStyle = p.c;
        x.fill();

        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d = Math.hypot(dx, dy);
          if (d < 130) {
            x.globalAlpha = (1 - d / 130) * 0.4;
            x.strokeStyle = p.c;
            x.lineWidth = 0.7;
            x.beginPath();
            x.moveTo(p.x, p.y);
            x.lineTo(q.x, q.y);
            x.stroke();
            x.globalAlpha = 1;
          }
        }

        const dmx = p.x - mx;
        const dmy = p.y - my;
        const dm = Math.hypot(dmx, dmy);
        if (dm < 170) {
          x.globalAlpha = (1 - dm / 170) * 0.55;
          x.strokeStyle = "#8a6cc0";
          x.lineWidth = 0.8;
          x.beginPath();
          x.moveTo(p.x, p.y);
          x.lineTo(mx, my);
          x.stroke();
          x.globalAlpha = 1;
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  },

  initScrollProgress() {
    const prog = document.getElementById("top-progress");
    if (!prog) return;
    window.addEventListener("scroll", () => {
      const sc = document.documentElement.scrollTop;
      const mx = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (mx > 0 ? (sc / mx * 100) : 0) + "%";
    }, { passive: true });
  },

  // Intro Splash Animation: Small colorful balls falling slowly from top before revealing login page
  initIntroSplash() {
    const splash = document.getElementById('intro-splash-screen');
    const canvas = document.getElementById('splash-balls-canvas');
    if (!splash || !canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const colors = [
      { fill: '#d99a63', light: '#f7d2b2' },
      { fill: '#bf6088', light: '#f3b4cb' },
      { fill: '#8a6cc0', light: '#c8b6e6' },
      { fill: '#06b6d4', light: '#a5f3fc' },
      { fill: '#10b981', light: '#a7f3d0' },
      { fill: '#f59e0b', light: '#fde68a' },
      { fill: '#ec4899', light: '#fbcfe8' }
    ];

    // Generate small colorful balls
    const count = Math.min(45, Math.max(25, Math.floor(width / 35)));
    const balls = [];
    for (let i = 0; i < count; i++) {
      const radius = 8 + Math.random() * 14;
      balls.push({
        x: Math.random() * width,
        y: -20 - Math.random() * (height * 0.9), // Staggered start above the screen
        radius: radius,
        vy: 1.2 + Math.random() * 2.2, // Falling slowly
        vx: (Math.random() - 0.5) * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.85 + Math.random() * 0.15
      });
    }

    let isRunning = true;
    let animationId = null;

    function render() {
      if (!isRunning) return;
      ctx.clearRect(0, 0, width, height);

      balls.forEach(b => {
        b.y += b.vy;
        b.x += b.vx;

        // Gentle bounce on reaching bottom
        if (b.y + b.radius >= height) {
          b.y = height - b.radius;
          b.vy = -b.vy * 0.35;
          b.vx *= 0.8;
          if (Math.abs(b.vy) < 0.3) {
            b.vy = 0;
          }
        }

        const grad = ctx.createRadialGradient(
          b.x - b.radius * 0.3,
          b.y - b.radius * 0.3,
          b.radius * 0.1,
          b.x,
          b.y,
          b.radius
        );
        grad.addColorStop(0, b.color.light);
        grad.addColorStop(0.7, b.color.fill);
        grad.addColorStop(1, '#221334');

        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowColor = b.color.fill;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fill();
        ctx.restore();
      });

      animationId = requestAnimationFrame(render);
    }

    animationId = requestAnimationFrame(render);

    // After ~2.4 seconds, smoothly fade out splash screen and reveal login page
    setTimeout(() => {
      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';
      setTimeout(() => {
        isRunning = false;
        if (animationId) cancelAnimationFrame(animationId);
        window.removeEventListener('resize', onResize);
        splash.style.display = 'none';
      }, 700);
    }, 2400);
  },

  // WhatsApp Widget: Moving continuously across the bottom, bouncing every 20s & leaping to random bottom place
  waMotion: {
    currentX: 30,
    speed: 0.95, // smooth horizontal glide speed (~60px/sec)
    direction: 1, // +1 moving right, -1 moving left
    isBouncing: false,
    isHovered: false,
    rafId: null,
    intervalId: null
  },

  initWhatsAppWidget() {
    const btn = document.getElementById('floating-whatsapp-btn');
    if (!btn) return;

    const minX = 24;
    const btnWidth = 56;
    const maxX = Math.max(minX, window.innerWidth - btnWidth - minX);

    // Initial random position at bottom
    this.waMotion.currentX = Math.floor(Math.random() * (maxX - minX)) + minX;
    this.waMotion.direction = Math.random() > 0.5 ? 1 : -1;
    btn.style.left = `${this.waMotion.currentX}px`;
    btn.style.bottom = '24px';
    btn.style.transition = 'none';

    // Hover events: Pause motion and bounce while hovered, resume when cursor leaves
    btn.addEventListener('mouseenter', () => {
      this.waMotion.isHovered = true;
    });
    btn.addEventListener('mouseleave', () => {
      this.waMotion.isHovered = false;
    });

    window.addEventListener('resize', () => {
      const newMaxX = Math.max(minX, window.innerWidth - btnWidth - minX);
      if (this.waMotion.currentX > newMaxX) {
        this.waMotion.currentX = newMaxX;
        btn.style.left = `${this.waMotion.currentX}px`;
      }
    });

    // Continuous horizontal motion loop across bottom
    if (this.waMotion.rafId) cancelAnimationFrame(this.waMotion.rafId);
    const motionLoop = () => {
      if (
        !this.waMotion.isBouncing &&
        !this.waMotion.isHovered &&
        this.currentView !== 'admin' &&
        !btn.classList.contains('hidden')
      ) {
        const liveMaxX = Math.max(minX, window.innerWidth - btnWidth - minX);
        this.waMotion.currentX += this.waMotion.direction * this.waMotion.speed;

        if (this.waMotion.currentX >= liveMaxX) {
          this.waMotion.currentX = liveMaxX;
          this.waMotion.direction = -1; // bounce back left
        } else if (this.waMotion.currentX <= minX) {
          this.waMotion.currentX = minX;
          this.waMotion.direction = 1; // bounce back right
        }

        btn.style.left = `${this.waMotion.currentX}px`;
        btn.style.bottom = '24px';
      }
      this.waMotion.rafId = requestAnimationFrame(motionLoop);
    };
    this.waMotion.rafId = requestAnimationFrame(motionLoop);

    // In the middle for every 20 sec: bounce, go to random place at bottom itself, and resume moving
    if (this.waMotion.intervalId) clearInterval(this.waMotion.intervalId);
    this.waMotion.intervalId = setInterval(() => {
      this.triggerWhatsAppBounceAndRelocate();
    }, 20000); // 20 seconds
  },

  triggerWhatsAppBounceAndRelocate() {
    const btn = document.getElementById('floating-whatsapp-btn');
    if (!btn || btn.classList.contains('hidden') || this.currentView === 'admin') return;
    if (this.waMotion.isHovered) return; // Do not bounce while student cursor is over it

    this.waMotion.isBouncing = true;

    // Trigger bounce animation
    btn.classList.remove('jumping');
    void btn.offsetWidth; // Force reflow
    btn.classList.add('jumping');

    // Pick a new random place at bottom itself
    const minX = 24;
    const btnWidth = 56;
    const maxX = Math.max(minX, window.innerWidth - btnWidth - minX);
    const newRandomX = Math.floor(Math.random() * (maxX - minX)) + minX;

    // Glide smoothly to the new random bottom position during the bounce
    btn.style.transition = 'left 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)';
    btn.style.left = `${newRandomX}px`;
    btn.style.bottom = '24px';
    this.waMotion.currentX = newRandomX;
    this.waMotion.direction = Math.random() > 0.5 ? 1 : -1;

    // After 1.25s bounce finishes, reset transition and resume moving smoothly
    setTimeout(() => {
      btn.classList.remove('jumping');
      btn.style.transition = 'none';
      this.waMotion.isBouncing = false;
    }, 1250);
  },

  repositionWhatsAppBottom(instant = false) {
    const btn = document.getElementById('floating-whatsapp-btn');
    if (!btn) return;
    const minX = 24;
    const btnWidth = 56;
    const maxX = Math.max(minX, window.innerWidth - btnWidth - minX);
    const randomLeft = Math.floor(Math.random() * (maxX - minX)) + minX;
    this.waMotion.currentX = randomLeft;
    btn.style.left = `${randomLeft}px`;
    btn.style.bottom = '24px';
  },

  bindGlobalEvents() {
    // Session Revoked Modal Dismiss Button
    const btnDismissRevoked = document.getElementById('btn-dismiss-revoked');
    if (btnDismissRevoked) {
      btnDismissRevoked.addEventListener('click', () => {
        document.getElementById('session-revoked-modal').classList.add('hidden');
        this.showAuthView();
      });
    }

    // Top-Right Circle Profile Avatar: Dismiss when clicking outside
    const btnTopAvatar = document.getElementById('btn-top-profile-avatar');
    const profileCard = document.getElementById('profile-dropdown-card');

    if (btnTopAvatar && profileCard) {
      document.addEventListener('click', (e) => {
        // Never dismiss if clicking inside profileCard, avatar button, or password visibility toggle
        const path = e.composedPath ? e.composedPath() : [];
        if (path.includes(profileCard) || path.includes(btnTopAvatar)) return;
        if (e.target.closest && (
          e.target.closest('#profile-dropdown-card') ||
          e.target.closest('#btn-top-profile-avatar') ||
          e.target.closest('.btn-toggle-password') ||
          e.target.closest('.modal-overlay')
        )) {
          return;
        }
        if (!profileCard.contains(e.target) && !btnTopAvatar.contains(e.target)) {
          profileCard.classList.add('hidden');
        }
      });
    }
  },

  setupHistoryRouting() {
    // Initial replaceState to ensure Login page is at the base of this session
    try {
      if (!window.location.hash || window.location.hash === '#') {
        history.replaceState({ view: 'login' }, '', window.location.pathname);
      }
    } catch (e) {}

    // Handle Browser Back and Forward Navigation (Chrome tab back button)
    window.addEventListener('popstate', (e) => {
      const state = e.state;
      const user = API.getUser();

      // 1. Close any open modals first across ALL views (Portal and Auth) without navigating away
      const openDrilldown = document.getElementById('modal-student-drilldown');
      if (openDrilldown && !openDrilldown.classList.contains('hidden')) {
        AdminPortal.closeStudentDrilldown(true);
        return;
      }

      const openInterview = document.getElementById('modal-interview');
      if (openInterview && !openInterview.classList.contains('hidden')) {
        StudentPortal.closeInterviewModal(true);
        return;
      }

      const openReschedule = document.getElementById('modal-student-reschedule');
      if (openReschedule && !openReschedule.classList.contains('hidden')) {
        StudentPortal.closeRescheduleModal(true);
        return;
      }

      const openAdminPwd = document.getElementById('modal-admin-change-password');
      if (openAdminPwd && !openAdminPwd.classList.contains('hidden')) {
        openAdminPwd.classList.add('hidden');
        return;
      }

      const openAdminOtp = document.getElementById('modal-admin-password-otp');
      if (openAdminOtp && !openAdminOtp.classList.contains('hidden')) {
        openAdminOtp.classList.add('hidden');
        return;
      }

      const openStudentOtp = document.getElementById('modal-student-password-otp');
      if (openStudentOtp && !openStudentOtp.classList.contains('hidden')) {
        openStudentOtp.classList.add('hidden');
        return;
      }

      const openRegOtp = document.getElementById('modal-otp-verification');
      if (openRegOtp && !openRegOtp.classList.contains('hidden')) {
        openRegOtp.classList.add('hidden');
        return;
      }

      const openLoginOtp = document.getElementById('modal-student-login-otp');
      if (openLoginOtp && !openLoginOtp.classList.contains('hidden')) {
        openLoginOtp.classList.add('hidden');
        return;
      }

      const openForgotPwd = document.getElementById('modal-forgot-password');
      if (openForgotPwd && !openForgotPwd.classList.contains('hidden')) {
        openForgotPwd.classList.add('hidden');
        return;
      }

      const openPublicCheck = document.getElementById('modal-public-student-check');
      if (openPublicCheck && !openPublicCheck.classList.contains('hidden')) {
        openPublicCheck.classList.add('hidden');
        return;
      }

      const profileCard = document.getElementById('profile-dropdown-card');
      if (profileCard && !profileCard.classList.contains('hidden')) {
        profileCard.classList.add('hidden');
        return;
      }

      // 2. If student or admin is logged in:
      if (this.currentView === 'student' || this.currentView === 'admin') {
        // If moving between tabs or filters inside the portal:
        if (state && state.view === 'portal') {
          if (state.role === 'admin' && this.currentView === 'admin') {
            if (state.tab && state.tab !== AdminPortal.currentTab) {
              AdminPortal.switchTab(state.tab, false);
              return;
            }
          } else if (state.role === 'student' && this.currentView === 'student') {
            if (state.filter && state.filter !== StudentPortal.currentFilter) {
              StudentPortal.filterStatus(state.filter, false);
              return;
            }
          }
          return;
        }

        // Reached the root of the portal and attempting to navigate back to login:
        const confirmLogout = window.confirm("You are going to log out. Are you sure you want to log out?");
        if (confirmLogout) {
          this.logout();
        } else {
          // Re-push active portal state to stay on current view
          if (this.currentView === 'admin') {
            const currentTab = AdminPortal.currentTab || 'students';
            history.pushState({ view: 'portal', role: 'admin', tab: currentTab }, '', '#admin-' + currentTab);
          } else if (this.currentView === 'student') {
            const currentFilter = StudentPortal.currentFilter || 'all';
            const hash = currentFilter === 'all' ? '#student-portal' : `#student-filter-${currentFilter}`;
            history.pushState({ view: 'portal', role: 'student', filter: currentFilter }, '', hash);
          }
        }
        return;
      }

      // 3. If user is on auth / login view and presses Chrome back arrow:
      if (this.currentView === 'auth') {
        const regPanel = document.getElementById('panel-student-register');
        if (state && state.authTab === 'student-register') {
          Auth.switchAuthTab('student-register', false);
          return;
        } else if (regPanel && !regPanel.classList.contains('hidden')) {
          // When registration is open, back arrow returns cleanly to student login
          Auth.switchAuthTab('student-login', false);
          return;
        }

        // When user is on Student Login or Admin Login tab and clicks Chrome Back arrow:
        // Popping landed on an internal portal, login or auth state. Continue popping backward
        // so it exits out to Chrome's empty search bar / blank new tab page without trapping.
        if (state && (state.view === 'portal' || state.view === 'login' || state.view === 'auth' || state.view === 'modal')) {
          window.history.back();
          return;
        }
      }
    });
  },

  // Global Back Navigation
  navigateBack() {
    const drilldownModal = document.getElementById('modal-student-drilldown');
    if (drilldownModal && !drilldownModal.classList.contains('hidden')) {
      AdminPortal.closeStudentDrilldown();
      return;
    }

    const interviewModal = document.getElementById('modal-interview');
    if (interviewModal && !interviewModal.classList.contains('hidden')) {
      StudentPortal.closeInterviewModal();
      return;
    }

    const reschedModal = document.getElementById('modal-student-reschedule');
    if (reschedModal && !reschedModal.classList.contains('hidden')) {
      StudentPortal.closeRescheduleModal();
      return;
    }

    const adminPwdModal = document.getElementById('modal-admin-change-password');
    if (adminPwdModal && !adminPwdModal.classList.contains('hidden')) {
      adminPwdModal.classList.add('hidden');
      return;
    }

    const adminOtpModal = document.getElementById('modal-admin-password-otp');
    if (adminOtpModal && !adminOtpModal.classList.contains('hidden')) {
      adminOtpModal.classList.add('hidden');
      return;
    }

    const studentOtpModal = document.getElementById('modal-student-password-otp');
    if (studentOtpModal && !studentOtpModal.classList.contains('hidden')) {
      studentOtpModal.classList.add('hidden');
      return;
    }

    const regOtpModal = document.getElementById('modal-otp-verification');
    if (regOtpModal && !regOtpModal.classList.contains('hidden')) {
      regOtpModal.classList.add('hidden');
      return;
    }

    const loginOtpModal = document.getElementById('modal-student-login-otp');
    if (loginOtpModal && !loginOtpModal.classList.contains('hidden')) {
      loginOtpModal.classList.add('hidden');
      return;
    }

    const forgotModal = document.getElementById('modal-forgot-password');
    if (forgotModal && !forgotModal.classList.contains('hidden')) {
      forgotModal.classList.add('hidden');
      return;
    }

    const checkModal = document.getElementById('modal-public-student-check');
    if (checkModal && !checkModal.classList.contains('hidden')) {
      checkModal.classList.add('hidden');
      return;
    }

    const user = API.getUser();
    if (user && user.role === 'admin' && AdminPortal.currentTab !== 'students') {
      AdminPortal.switchTab('students');
      return;
    }

    const regPanel = document.getElementById('panel-student-register');
    if (regPanel && !regPanel.classList.contains('hidden')) {
      Auth.switchAuthTab('student-login');
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    }
  },

  logout() {
    StudentInactivityManager.stop();
    API.clearAuth();
    API.stopSessionHeartbeat();
    this.showAuthView();
  },

  navigateBackToLogin() {
    this.logout();
  },

  refreshProfileDropdownData() {
    const user = API.getUser();
    if (!user) return;

    const initials = this.getInitials(user.name || user.email);

    const navCircle = document.getElementById('nav-avatar-circle');
    if (navCircle) navCircle.textContent = initials;

    const ddAvatar = document.getElementById('profile-dd-avatar');
    if (ddAvatar) ddAvatar.textContent = initials;

    const ddName = document.getElementById('profile-dd-name');
    if (ddName) ddName.textContent = user.name;

    const ddRoleBadge = document.getElementById('profile-dd-badge');
    if (ddRoleBadge) {
      if (user.role === 'admin') {
        ddRoleBadge.textContent = 'Administrator';
        ddRoleBadge.className = 'inline-block mt-0.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800';
      } else {
        const isPlaced = user.placement_status === 'Placed';
        ddRoleBadge.textContent = isPlaced ? '🎉 Placed Student' : 'Verified Student';
        ddRoleBadge.className = isPlaced
          ? 'inline-block mt-0.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
          : 'inline-block mt-0.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-[#8a6cc0] border border-[rgba(138,108,192,0.2)]';
      }
    }

    const ddEmail = document.getElementById('profile-dd-email');
    if (ddEmail) ddEmail.textContent = user.email;

    // Mobile number: hidden for Admin, shown for Student
    const phoneRow = document.getElementById('profile-dd-phone-row');
    if (phoneRow) {
      if (user.role === 'admin') {
        phoneRow.classList.add('hidden');
      } else {
        phoneRow.classList.remove('hidden');
        const ddPhone = document.getElementById('profile-dd-phone');
        if (ddPhone) ddPhone.textContent = user.phone || 'Not Provided';
      }
    }

    const ddDomain = document.getElementById('profile-dd-domain');
    if (ddDomain) ddDomain.textContent = user.domain || 'Institute Stream';

    // Domain Row: hidden for Admin, shown for Student
    const domainRow = document.getElementById('profile-dd-domain-row');
    if (domainRow) {
      if (user.role === 'admin') {
        domainRow.classList.add('hidden');
      } else {
        domainRow.classList.remove('hidden');
      }
    }

    // Institute Row: hidden for Admin, shown for Student
    const instituteRow = document.getElementById('profile-dd-institute-row');
    if (instituteRow) {
      if (user.role === 'admin') {
        instituteRow.classList.add('hidden');
      } else {
        instituteRow.classList.remove('hidden');
      }
    }

    // Placement Status Row in Profile Drawer
    const placementRow = document.getElementById('profile-dd-placement-row');
    const ddPlacement = document.getElementById('profile-dd-placement');
    if (placementRow) {
      if (user.role === 'admin') {
        placementRow.classList.add('hidden');
      } else {
        placementRow.classList.remove('hidden');
        if (ddPlacement) {
          const isPlaced = user.placement_status === 'Placed';
          ddPlacement.textContent = isPlaced ? '🎉 Placed (Hired)' : '⚡ In Training';
          ddPlacement.className = isPlaced
            ? 'font-extrabold text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
            : 'font-extrabold text-[11px] px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs';
        }
      }
    }

    // Synchronize greeting name and domain on the student portal view
    const greetingName = document.getElementById('student-greeting-name');
    if (greetingName && user.name) greetingName.textContent = user.name;

    const greetingDomain = document.getElementById('student-greeting-domain');
    if (greetingDomain && user.domain) greetingDomain.textContent = user.domain;

    // Synchronize hero placement badge on student portal view
    const heroPlacementBadge = document.getElementById('student-hero-placement-badge');
    if (heroPlacementBadge) {
      if (user.role === 'student') {
        heroPlacementBadge.classList.remove('hidden');
        const isPlaced = user.placement_status === 'Placed';
        heroPlacementBadge.innerHTML = isPlaced
          ? `<span class="inline-flex items-center gap-1 font-extrabold text-emerald-300"><i data-lucide="award" class="w-3.5 h-3.5 text-amber-300"></i> 🎉 Placed (Hired)</span>`
          : `<span class="inline-flex items-center gap-1 font-bold text-white/90"><i data-lucide="compass" class="w-3.5 h-3.5 text-amber-300"></i> ⚡ In Training</span>`;
      } else {
        heroPlacementBadge.classList.add('hidden');
      }
    }

    // Toggle role-appropriate password change sections in profile dropdown
    const studentPwdSec = document.getElementById('student-pwd-change-section');
    const adminPwdSec = document.getElementById('admin-dd-pwd-change-section');
    if (user.role === 'admin') {
      if (studentPwdSec) studentPwdSec.classList.add('hidden');
      if (adminPwdSec) adminPwdSec.classList.remove('hidden');
    } else {
      if (studentPwdSec) studentPwdSec.classList.remove('hidden');
      if (adminPwdSec) adminPwdSec.classList.add('hidden');
    }

    // Show/hide student password OTP change section
    const pwdSection = document.getElementById('student-pwd-change-section');
    if (pwdSection) {
      if (user.role === 'admin') {
        pwdSection.classList.add('hidden');
      } else {
        pwdSection.classList.remove('hidden');
      }
    }
  },

  getInitials(name) {
    if (!name) return 'FS';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  },

  async checkInitialAuth() {
    if (!API.isAuthenticated()) {
      this.showAuthView();
      return;
    }

    try {
      const res = await API.get('/api/auth/me');
      if (res.success && res.user) {
        API.setUser(res.user);
        API.startSessionHeartbeat();
        this.navigateAfterAuth(res.user);
      } else {
        this.showAuthView();
      }
    } catch (err) {
      console.warn('Initial session check failed:', err.message);
      this.showAuthView();
    }
  },

  showAuthView() {
    this.currentView = 'auth';
    document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('view-student').classList.add('hidden');
    document.getElementById('view-admin').classList.add('hidden');
    document.getElementById('top-bar-auth-info').classList.add('hidden');
    document.getElementById('header-unauth-widgets')?.classList.remove('hidden');
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    document.getElementById('profile-dropdown-card')?.classList.add('hidden');

    // Show floating WhatsApp button on student/public auth screen
    const floatingWaBtn = document.getElementById('floating-whatsapp-btn');
    if (floatingWaBtn) {
      floatingWaBtn.classList.remove('hidden');
      this.repositionWhatsAppBottom(false);
    }

    try {
      history.replaceState({ view: 'auth', authTab: 'student-login' }, '', window.location.pathname);
    } catch (e) {}
    if (window.lucide) window.lucide.createIcons();
  },

  toggleProfileDropdown(e) {
    if (e) e.stopPropagation();
    const profileCard = document.getElementById('profile-dropdown-card');
    if (!profileCard) return;
    const isHidden = profileCard.classList.contains('hidden');
    if (isHidden) {
      this.refreshProfileDropdownData();
      profileCard.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons({ root: profileCard });
    } else {
      profileCard.classList.add('hidden');
    }
  },

  navigateAfterAuth(user) {
    const topBarInfo = document.getElementById('top-bar-auth-info');
    topBarInfo.classList.remove('hidden');
    document.getElementById('header-unauth-widgets')?.classList.add('hidden');

    const floatingWaBtn = document.getElementById('floating-whatsapp-btn');

    const initials = this.getInitials(user.name);
    const navCircle = document.getElementById('nav-avatar-circle');
    if (navCircle) navCircle.textContent = initials;

    document.getElementById('user-pill-name').textContent = user.name;
    document.getElementById('user-pill-role').textContent = user.role === 'admin' ? 'Administrator' : user.domain;

    const greetingName = document.getElementById('student-greeting-name');
    if (greetingName && user.name) greetingName.textContent = user.name;

    const greetingDomain = document.getElementById('student-greeting-domain');
    if (greetingDomain && user.domain) greetingDomain.textContent = user.domain;

    // Toggle role-appropriate password change sections in profile dropdown
    const studentPwdSec = document.getElementById('student-pwd-change-section');
    const adminPwdSec = document.getElementById('admin-dd-pwd-change-section');
    if (user.role === 'admin') {
      if (studentPwdSec) studentPwdSec.classList.add('hidden');
      if (adminPwdSec) adminPwdSec.classList.remove('hidden');
    } else {
      if (studentPwdSec) studentPwdSec.classList.remove('hidden');
      if (adminPwdSec) adminPwdSec.classList.add('hidden');
    }

    this.refreshProfileDropdownData();

    if (user.role === 'admin') {
      StudentInactivityManager.stop();
      this.currentView = 'admin';
      // WhatsApp floating button MUST be completely removed/hidden for admin!
      if (floatingWaBtn) floatingWaBtn.classList.add('hidden');
      document.getElementById('view-auth').classList.add('hidden');
      document.getElementById('view-student').classList.add('hidden');
      document.getElementById('view-admin').classList.remove('hidden');
      AdminPortal.loadDashboard();
    } else {
      this.currentView = 'student';
      // WhatsApp floating button positioned at random bottom position
      if (floatingWaBtn) {
        floatingWaBtn.classList.remove('hidden');
        this.repositionWhatsAppBottom(false);
      }
      document.getElementById('view-auth').classList.add('hidden');
      document.getElementById('view-student').classList.remove('hidden');
      document.getElementById('view-admin').classList.add('hidden');
      StudentPortal.loadDashboard();
      StudentInactivityManager.start();
    }

    try {
      history.replaceState({ view: 'login' }, '', window.location.pathname);
      if (user.role === 'admin') {
        AdminPortal.currentTab = 'students';
        history.pushState({ view: 'portal', role: 'admin', tab: 'students' }, '', window.location.pathname + '#admin-students');
      } else {
        StudentPortal.currentFilter = 'all';
        history.pushState({ view: 'portal', role: 'student', filter: 'all' }, '', window.location.pathname + '#student-portal');
      }
    } catch (e) {}

    if (window.lucide) window.lucide.createIcons();
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
