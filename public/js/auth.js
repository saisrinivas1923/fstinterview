// Authentication UI, Email OTP Verification & Strong Password Validation
const Auth = {
  pendingEmailForOtp: '',
  resendCountdownTimer: null,

  init() {
    this.bindEvents();
    this.setupPasswordToggles();
    this.setupDomainAutocomplete();
    this.setupPasswordValidationListeners();
    this.setupForgotPasswordHandlers();
    this.setupSessionRevocationListener();
  },

  bindEvents() {
    // Auth Tab Switchers: Student Login and Admin Login
    const tabStudentLogin = document.getElementById('tab-btn-student-login');
    const tabAdminLogin = document.getElementById('tab-btn-admin-login');

    if (tabStudentLogin) {
      tabStudentLogin.addEventListener('click', () => this.switchAuthTab('student-login'));
    }
    if (tabAdminLogin) {
      tabAdminLogin.addEventListener('click', () => this.switchAuthTab('admin-login'));
    }

    // Student Login Form
    const studentLoginForm = document.getElementById('form-student-login');
    if (studentLoginForm) {
      studentLoginForm.addEventListener('submit', (e) => this.handleLogin(e, 'student'));
    }

    // Admin Login Form
    const adminLoginForm = document.getElementById('form-admin-login');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', (e) => this.handleLogin(e, 'admin'));
    }

    // Student Registration Form
    const studentRegisterForm = document.getElementById('form-student-register');
    if (studentRegisterForm) {
      studentRegisterForm.addEventListener('submit', (e) => this.handleRegister(e));

      // Indian 10-digit mobile number real-time restriction
      const regPhoneInput = document.getElementById('reg-phone-input');
      if (regPhoneInput) {
        regPhoneInput.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
      }

      this.setupInlineRegisterOtp();
    }

    // OTP Verification Form
    const otpForm = document.getElementById('form-verify-otp');
    if (otpForm) {
      otpForm.addEventListener('submit', (e) => this.handleVerifyOtp(e));
    }

    // Resend OTP Button
    const btnResendOtp = document.getElementById('btn-resend-otp');
    if (btnResendOtp) {
      btnResendOtp.addEventListener('click', () => this.handleResendOtp());
    }

    // Close OTP Modal / Back to Register
    const btnBackFromOtp = document.getElementById('btn-back-from-otp');
    if (btnBackFromOtp) {
      btnBackFromOtp.addEventListener('click', () => {
        document.getElementById('modal-otp-verification').classList.add('hidden');
        if (window.location.hash === '#otp-verification') {
          try { history.back(); } catch (e) {}
        }
      });
    }

    // All Logout Buttons (Header, Admin Hero, Admin Subtabs, Profile Drawer)
    document.querySelectorAll('.btn-logout').forEach(btn => {
      btn.addEventListener('click', () => this.handleLogout());
    });

    // Public Student Record Checker Form
    const formCheck = document.getElementById('form-public-student-check');
    if (formCheck) {
      formCheck.addEventListener('submit', (e) => this.handlePublicStudentCheck(e));
    }
  },

  // Password Visibility Eye Toggle (Shows / Hides password)
  setupPasswordToggles() {
    // Global delegated click listener ensures single-binding and works for all present and dynamic modals
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-toggle-password');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const inputId = btn.getAttribute('data-target');
      const input = document.getElementById(inputId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      // Instantly swap SVG icon with zero lag
      if (isPassword) {
        // Now visible: show Eye-Off icon (colored accent)
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-[#bf6088] hover:text-[#a84d74] transition pointer-events-none"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`;
        btn.setAttribute('title', 'Hide Password');
      } else {
        // Now hidden: show standard Eye icon
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-slate-400 hover:text-slate-600 transition pointer-events-none"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;
        btn.setAttribute('title', 'Show Password');
      }
    });
  },

  // Real-time strong password checklist validating ALL 5 security rules + match
  setupPasswordValidationListeners() {
    const passInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-confirm-password');

    const checkLength = document.getElementById('pw-rule-length');
    const checkUpper = document.getElementById('pw-rule-upper');
    const checkLower = document.getElementById('pw-rule-lower');
    const checkNumber = document.getElementById('pw-rule-number');
    const checkSpecial = document.getElementById('pw-rule-special');
    const checkMatch = document.getElementById('pw-rule-match');

    const setRuleUI = (el, ok, label) => {
      if (!el) return;
      el.className = `flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${ok ? 'text-emerald-600 font-bold' : 'text-slate-400'}`;
      el.innerHTML = `<i data-lucide="${ok ? 'check-circle-2' : 'circle'}" class="w-3.5 h-3.5 flex-shrink-0"></i> ${label}`;
      if (window.lucide) lucide.createIcons({ root: el });
    };

    const updateRules = () => {
      if (!passInput) return;
      const val = passInput.value;
      const confirmVal = confirmInput ? confirmInput.value : '';

      // Rule 1: Min 8 chars
      setRuleUI(checkLength, val.length >= 8, 'At least 8 characters');

      // Rule 2: Upper case (A-Z)
      setRuleUI(checkUpper, /[A-Z]/.test(val), 'At least 1 uppercase letter (A-Z)');

      // Rule 3: Lower case (a-z)
      setRuleUI(checkLower, /[a-z]/.test(val), 'At least 1 lowercase letter (a-z)');

      // Rule 4: Number (0-9)
      setRuleUI(checkNumber, /[0-9]/.test(val), 'At least 1 number (0-9)');

      // Rule 5: Special character
      setRuleUI(checkSpecial, /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val), 'At least 1 special character (!@#$%^&*...)');

      // Rule 6: Passwords match
      setRuleUI(checkMatch, confirmVal.length > 0 && confirmVal === val, 'Passwords match');
    };

    if (passInput) passInput.addEventListener('input', updateRules);
    if (confirmInput) confirmInput.addEventListener('input', updateRules);
  },

  formatDomainTitleCase(str) {
    if (!str) return '';
    const acronyms = new Set(['AI', 'ML', 'QA', 'SAP', 'IT', 'UI', 'UX', 'HR', 'API', 'AWS', 'GCP', 'SQL', 'DBA']);
    return str.trim().split(/\s+/).map(word => {
      const upper = word.toUpperCase();
      if (acronyms.has(upper)) return upper;
      if (upper === 'GENAI') return 'GenAI';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  },

  // Dynamic Course/Domain Autocomplete Suggestion as User Types Each Letter
  async setupDomainAutocomplete() {
    const input = document.getElementById('reg-domain-input');
    const dropdown = document.getElementById('reg-domain-suggestions');
    if (!input || !dropdown) return;

    let cachedDomains = [];
    try {
      const res = await API.get('/api/auth/domains');
      if (res && res.domains) cachedDomains = res.domains;
    } catch (e) {}

    const defaultCourses = [
      'Full Stack Java Development',
      'Python Full Stack & AI / Data Science',
      'MERN Full Stack Web Development',
      'Cloud Computing & DevOps Engineering',
      'QA Software Testing & Automation',
      'Data Analytics & Power BI',
      'Cybersecurity & Ethical Hacking',
      'Mobile App Development (Flutter)',
      'AI Engineer',
      'GenAI Engineer',
      'Agentic AI Engineer',
      'Software Developer'
    ];

    const allOptions = Array.from(new Set([...defaultCourses, ...cachedDomains]));

    input.addEventListener('input', () => {
      const raw = input.value.trim();
      const query = raw.toLowerCase();

      // Suggestions appear as you type each letter
      if (!query) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
      }

      const formattedCustom = this.formatDomainTitleCase(raw);
      const matches = allOptions.filter(c => c.toLowerCase().includes(query));

      let itemsHtml = '';

      // Always show option to use the exact entered domain with first letter capitalized
      const exactMatch = allOptions.some(c => c.toLowerCase() === query);
      if (!exactMatch && formattedCustom) {
        itemsHtml += `
          <button type="button" data-val="${formattedCustom}" class="w-full text-left px-3.5 py-2.5 text-xs font-bold text-[#8a6cc0] bg-purple-50/80 hover:bg-purple-100 transition flex items-center justify-between border-b border-purple-100">
            <span class="flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-[#bf6088]"></i>
              Use Custom Domain: <strong>${formattedCustom}</strong>
            </span>
            <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white text-[#8a6cc0] border border-purple-200">Custom</span>
          </button>
        `;
      }

      matches.forEach(c => {
        itemsHtml += `
          <button type="button" data-val="${c}" class="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-purple-50 hover:text-[#8a6cc0] transition flex items-center justify-between border-b border-slate-100 last:border-0">
            <span>${c}</span>
            <i data-lucide="arrow-up-right" class="w-3.5 h-3.5 text-slate-400"></i>
          </button>
        `;
      });

      if (!itemsHtml) {
        itemsHtml = `
          <button type="button" data-val="${formattedCustom}" class="w-full text-left px-3.5 py-2.5 text-xs font-bold text-[#8a6cc0] bg-purple-50 hover:bg-purple-100 transition flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5 text-[#bf6088]"></i>
              Set Custom Domain: <strong>${formattedCustom}</strong>
            </span>
            <span class="text-[10px] font-bold text-slate-400">Save</span>
          </button>
        `;
      }

      dropdown.innerHTML = itemsHtml;

      dropdown.querySelectorAll('button[data-val]').forEach(btn => {
        btn.addEventListener('click', () => {
          input.value = btn.getAttribute('data-val');
          dropdown.classList.add('hidden');
        });
      });

      dropdown.classList.remove('hidden');
      if (window.lucide) lucide.createIcons({ root: dropdown });
    });

    // Auto-capitalize first letters on blur if student just typed without clicking suggestion
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (input.value.trim()) {
          input.value = this.formatDomainTitleCase(input.value);
        }
      }, 200);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  },

  switchAuthTab(tab, pushState = true) {
    const panels = {
      'student-login': document.getElementById('panel-student-login'),
      'student-register': document.getElementById('panel-student-register'),
      'admin-login': document.getElementById('panel-admin-login')
    };

    const tabStudent = document.getElementById('tab-btn-student-login');
    const tabAdmin = document.getElementById('tab-btn-admin-login');
    const authTabButtons = document.getElementById('auth-tab-buttons');

    Object.keys(panels).forEach(key => {
      if (panels[key]) panels[key].classList.toggle('hidden', key !== tab);
    });

    if (authTabButtons) {
      if (tab === 'student-register') {
        authTabButtons.classList.add('hidden');
      } else {
        authTabButtons.classList.remove('hidden');
      }
    }

    if (tabStudent && tabAdmin) {
      if (tab === 'student-login') {
        tabStudent.className = 'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-[#d99a63] via-[#bf6088] to-[#8a6cc0] text-white shadow-sm transition';
        tabAdmin.className = 'flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition';
      } else if (tab === 'admin-login') {
        tabAdmin.className = 'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-[#d99a63] via-[#bf6088] to-[#8a6cc0] text-white shadow-sm transition';
        tabStudent.className = 'flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition';
      } else if (tab === 'student-register') {
        tabStudent.className = 'flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition';
        tabAdmin.className = 'flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition';
        this.setupInlineRegisterOtp();
      }
    }

    if (pushState) {
      try {
        if (tab === 'student-register') {
          history.pushState({ view: 'auth', authTab: 'student-register' }, '', '#student-register');
        } else {
          // Switching between Student Login and Admin Login replaces current entry without creating extra history.
          // Clicking Chrome Back on either tab naturally navigates out to Chrome's previous page / empty search bar.
          history.replaceState({ view: 'auth', authTab: tab }, '', window.location.pathname);
        }
      } catch (e) {}
    }

    if (window.lucide) window.lucide.createIcons();
  },

  async handleLogin(e, expectedRole) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    const email = form.querySelector('[name="email"]').value.trim();
    const password = form.querySelector('[name="password"]').value;

    if (!email || !password) {
      showToast('Please enter both email and password.', 'warning');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg> Signing in...
      `;

      const res = await API.post('/api/auth/login', { email, password });

      // If student login requires real-time OTP verification
      if (res.requires_otp) {
        showToast(res.message || 'Real-time 6-digit OTP dispatched to your registered email.', 'info', 5000);
        this.openStudentLoginOtpModal(res.email);
        return;
      }

      API.setToken(res.token);
      API.setUser(res.user);
      API.startSessionHeartbeat();

      showToast(`Welcome back, ${res.user.name}!`, 'success');
      form.reset();

      App.navigateAfterAuth(res.user);
    } catch (err) {
      if (err.data && err.data.requires_otp) {
        showToast(err.message || 'Real-time 6-digit OTP dispatched to your registered email.', 'info', 5000);
        this.openStudentLoginOtpModal(err.data.email);
        return;
      }
      showToast(err.message || 'Login failed. Please verify your credentials.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  },

  // Dedicated Real-Time OTP Modal for Student Login
  openStudentLoginOtpModal(email, pushState = true) {
    this.pendingStudentLoginEmail = email;
    if (pushState) {
      try {
        history.pushState({ view: 'auth', authTab: 'student-login', modal: 'student-login-otp' }, '', '#student-login-otp');
      } catch (e) {}
    }
    const modal = document.getElementById('modal-student-login-otp');
    const emailDisplay = document.getElementById('student-login-otp-recipient');
    const hiddenOtpInput = document.getElementById('student-login-otp-code');

    if (emailDisplay) emailDisplay.textContent = email;
    if (hiddenOtpInput) hiddenOtpInput.value = '';

    modal.classList.remove('hidden');

    let deck = OTPDeckController.get('otp-deck-student-login');
    if (!deck) {
      deck = new OTPDeckController({
        containerId: 'otp-deck-student-login'
      });
      OTPDeckController.instances['otp-deck-student-login'] = deck;
    }
    deck.reset();
    deck.onComplete = (code) => {
      if (hiddenOtpInput) hiddenOtpInput.value = code;
      showToast('OTP verified! Click "Verify and Sign In" to complete.', 'info');
    };
    deck.onDigitChange = (code) => {
      if (hiddenOtpInput) hiddenOtpInput.value = code;
    };
    this.studentLoginOtpDeck = deck;

    setTimeout(() => {
      if (this.studentLoginOtpDeck) this.studentLoginOtpDeck.focus();
    }, 150);
    if (window.lucide) lucide.createIcons();
  },

  async confirmStudentLoginOtp() {
    const email = this.pendingStudentLoginEmail;
    const deck = this.studentLoginOtpDeck || OTPDeckController.get('otp-deck-student-login');
    const otpInput = document.getElementById('student-login-otp-code');
    const otpCode = deck ? deck.getCode() : (otpInput ? otpInput.value.trim() : '');

    if (!email) {
      showToast('Session expired. Please sign in again.', 'warning');
      document.getElementById('modal-student-login-otp')?.classList.add('hidden');
      return;
    }

    if (!otpCode || otpCode.length !== 6) {
      showToast('Please enter all 6 digits of the verification code.', 'warning');
      if (deck) deck.focus();
      return;
    }

    const submitBtn = document.getElementById('btn-student-verify-login-otp');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Verifying Code & Signing In...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/auth/verify-login-otp', {
        email,
        otp_code: otpCode
      });

      API.setToken(res.token);
      API.setUser(res.user);
      API.startSessionHeartbeat();

      showToast(res.message || `Welcome back, ${res.user.name}!`, 'success', 5000);
      document.getElementById('modal-student-login-otp')?.classList.add('hidden');

      const loginForm = document.getElementById('form-student-login');
      if (loginForm) loginForm.reset();
      if (deck) deck.reset();

      App.navigateAfterAuth(res.user);
    } catch (err) {
      showToast(err.message || 'Invalid or expired OTP. Please check your email.', 'error');
      if (deck) deck.showError();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText || '<i data-lucide="log-in" class="w-4 h-4"></i> Verify and Sign In';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  async resendStudentLoginOtp() {
    if (!this.pendingStudentLoginEmail) return;
    const btn = document.getElementById('btn-resend-student-login-otp');

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Sending...';
      }

      const res = await API.post('/api/auth/resend-login-otp', { email: this.pendingStudentLoginEmail });
      showToast(res.message || 'A fresh 6-digit verification code has been dispatched to your email.', 'info');

      if (this.studentLoginOtpDeck) {
        this.studentLoginOtpDeck.reset();
        this.studentLoginOtpDeck.focus();
      }
    } catch (err) {
      showToast(err.message || 'Failed to resend OTP.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Resend OTP';
      }
    }
  },

  setupInlineRegisterOtp() {
    const inlineEl = document.getElementById('otp-deck-register-inline');
    if (!inlineEl) return;

    const inlineDeck = OTPDeckController.get('otp-deck-register-inline') || new OTPDeckController({
      containerId: 'otp-deck-register-inline'
    });
    OTPDeckController.instances['otp-deck-register-inline'] = inlineDeck;
    inlineDeck.onComplete = (code) => {
      const hiddenInput = document.getElementById('reg-inline-otp-code');
      if (hiddenInput) hiddenInput.value = code;
      this.handleVerifyOtpInline(code);
    };
    inlineDeck.onDigitChange = (code) => {
      const hiddenInput = document.getElementById('reg-inline-otp-code');
      if (hiddenInput) hiddenInput.value = code;
    };
    this.inlineRegisterOtpDeck = inlineDeck;
  },

  async requestRegistrationOtpInline() {
    const form = document.getElementById('form-student-register');
    if (!form) return;
    const btn = document.getElementById('btn-reg-request-otp');
    const msgBox = document.getElementById('reg-inline-otp-msg');

    const name = form.querySelector('[name="name"]')?.value.trim();
    const email = form.querySelector('[name="email"]')?.value.trim();
    const phone = form.querySelector('[name="phone"]')?.value.trim();
    const domain = this.formatDomainTitleCase(document.getElementById('reg-domain-input')?.value.trim() || '');
    const password = document.getElementById('reg-password')?.value || '';
    const confirmPassword = document.getElementById('reg-confirm-password')?.value || '';

    if (!name || !email || !phone || !domain || !password) {
      showToast('Please fill out all registration fields before requesting OTP.', 'warning');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      showToast('Student mobile number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.', 'warning');
      return;
    }

    if (password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'warning');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      showToast('Please satisfy all password security rules before requesting OTP.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match. Please re-enter identical password.', 'error');
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Sending OTP...';
        if (window.lucide) lucide.createIcons();
      }

      const res = await API.post('/api/auth/register', {
        name,
        email,
        phone,
        domain,
        password
      });

      this.pendingEmailForOtp = res.email || email;

      showToast(`Verification OTP dispatched to ${this.pendingEmailForOtp}!`, 'success', 5000);

      if (msgBox) {
        msgBox.innerHTML = `✅ 6-digit OTP code dispatched to <strong>${this.pendingEmailForOtp}</strong>.<br/><span class="text-[10px] text-slate-500 font-semibold">Please enter the 6-digit code in the boxes below.</span>`;
        msgBox.classList.remove('hidden');
      }

      if (this.inlineRegisterOtpDeck) {
        this.inlineRegisterOtpDeck.reset();
        this.inlineRegisterOtpDeck.focus();
      }
    } catch (err) {
      showToast(err.message || 'Failed to dispatch registration OTP.', 'error', 6000);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="w-3 h-3"></i> Resend OTP';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  async handleVerifyOtpInline(code) {
    const form = document.getElementById('form-student-register');
    const email = this.pendingEmailForOtp || form?.querySelector('[name="email"]')?.value.trim();
    const otpCode = code || document.getElementById('reg-inline-otp-code')?.value.trim() || this.inlineRegisterOtpDeck?.getCode();

    if (!email) {
      showToast('Please enter your details and click "Send OTP to Email" first.', 'warning');
      return;
    }

    if (!otpCode || otpCode.length !== 6) {
      showToast('Please enter the 6-digit verification code.', 'warning');
      if (this.inlineRegisterOtpDeck) this.inlineRegisterOtpDeck.focus();
      return;
    }

    const submitBtn = document.getElementById('btn-reg-submit');
    const origText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Verifying & Creating Account...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/auth/verify-otp', {
        email,
        otp_code: otpCode
      });

      API.setToken(res.token);
      API.setUser(res.user);
      API.startSessionHeartbeat();

      showToast('Account created and verified successfully! Welcome to Future Sprint Technologies.', 'success');

      if (form) form.reset();
      if (this.inlineRegisterOtpDeck) this.inlineRegisterOtpDeck.reset();

      App.navigateAfterAuth(res.user);
    } catch (err) {
      showToast(err.message || 'OTP verification failed. Please try again.', 'error');
      if (this.inlineRegisterOtpDeck) this.inlineRegisterOtpDeck.showError();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i> Verify and Create Account';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  async handleRegister(e) {
    if (e && e.preventDefault) e.preventDefault();
    const form = document.getElementById('form-student-register');
    if (!form) return;

    const btn = document.getElementById('btn-reg-submit');
    const name = form.querySelector('[name="name"]')?.value.trim();
    const email = form.querySelector('[name="email"]')?.value.trim();
    const phone = form.querySelector('[name="phone"]')?.value.trim();
    const domain = this.formatDomainTitleCase(document.getElementById('reg-domain-input')?.value.trim() || '');
    const password = document.getElementById('reg-password')?.value || '';
    const confirmPassword = document.getElementById('reg-confirm-password')?.value || '';

    if (!name) {
      showToast('Please enter your full name.', 'warning');
      form.querySelector('[name="name"]')?.focus();
      return;
    }

    if (!email) {
      showToast('Please enter your email address.', 'warning');
      form.querySelector('[name="email"]')?.focus();
      return;
    }

    if (!phone) {
      showToast('Please enter your 10-digit mobile number.', 'warning');
      document.getElementById('reg-phone-input')?.focus();
      return;
    }

    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.slice(1);
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      showToast('Student mobile number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.', 'warning');
      document.getElementById('reg-phone-input')?.focus();
      return;
    }

    if (!domain) {
      showToast('Please enter or select your technical domain.', 'warning');
      document.getElementById('reg-domain-input')?.focus();
      return;
    }

    if (!password || password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'warning');
      document.getElementById('reg-password')?.focus();
      return;
    }

    if (!/[A-Z]/.test(password)) {
      showToast('Password must contain at least 1 uppercase letter (A-Z).', 'warning');
      document.getElementById('reg-password')?.focus();
      return;
    }

    if (!/[a-z]/.test(password)) {
      showToast('Password must contain at least 1 lowercase letter (a-z).', 'warning');
      document.getElementById('reg-password')?.focus();
      return;
    }

    if (!/[0-9]/.test(password)) {
      showToast('Password must contain at least 1 number (0-9).', 'warning');
      document.getElementById('reg-password')?.focus();
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      showToast('Password must contain at least 1 special character (!@#$%^&*...).', 'warning');
      document.getElementById('reg-password')?.focus();
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match. Please re-enter identical password.', 'error');
      document.getElementById('reg-confirm-password')?.focus();
      return;
    }

    const originalBtnText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Dispatching OTP...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/auth/register', {
        name,
        email,
        phone: cleanPhone,
        domain,
        password
      });

      this.pendingEmailForOtp = res.email || email;
      showToast(res.message || `Verification OTP dispatched to ${this.pendingEmailForOtp}!`, 'success', 5000);

      this.openOtpModal(this.pendingEmailForOtp);
    } catch (err) {
      showToast(err.message || 'Failed to register account.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText || '<i data-lucide="shield-check" class="w-4 h-4"></i> Create Account & Verify with OTP';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  openOtpModal(email, pushState = true) {
    this.pendingEmailForOtp = email;
    if (pushState) {
      try {
        history.pushState({ view: 'auth', authTab: 'student-register', modal: 'otp-verification' }, '', '#otp-verification');
      } catch (e) {}
    }
    const modal = document.getElementById('modal-otp-verification');
    const emailDisplay = document.getElementById('otp-recipient-email');
    const hiddenOtpInput = document.getElementById('input-otp-code');

    if (emailDisplay) emailDisplay.textContent = email;
    if (hiddenOtpInput) hiddenOtpInput.value = '';

    modal.classList.remove('hidden');

    let deck = OTPDeckController.get('otp-deck-register');
    if (!deck) {
      deck = new OTPDeckController({
        containerId: 'otp-deck-register'
      });
      OTPDeckController.instances['otp-deck-register'] = deck;
    }
    deck.reset();
    deck.onComplete = (code) => {
      if (hiddenOtpInput) hiddenOtpInput.value = code;
      showToast('OTP verified! Click "Verify and create account" to complete.', 'info');
    };
    deck.onDigitChange = (code) => {
      if (hiddenOtpInput) hiddenOtpInput.value = code;
    };
    this.registerOtpDeck = deck;

    this.startResendCooldown();
    setTimeout(() => {
      if (this.registerOtpDeck) this.registerOtpDeck.focus();
    }, 150);
    if (window.lucide) lucide.createIcons();
  },

  async handleVerifyOtp(e) {
    if (e && e.preventDefault) e.preventDefault();
    const form = document.getElementById('form-verify-otp');
    const submitBtn = document.getElementById('btn-reg-modal-verify') || form?.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

    const otpInput = document.getElementById('input-otp-code');
    const otpCode = this.registerOtpDeck ? this.registerOtpDeck.getCode() : (otpInput ? otpInput.value.trim() : '');

    if (!otpCode || otpCode.length !== 6) {
      showToast('Please enter the 6-digit verification code sent to your email.', 'warning');
      if (this.registerOtpDeck) this.registerOtpDeck.focus();
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Verifying Code...';
        if (window.lucide) lucide.createIcons();
      }

      const res = await API.post('/api/auth/verify-otp', {
        email: this.pendingEmailForOtp,
        otp_code: otpCode
      });

      API.setToken(res.token);
      API.setUser(res.user);
      API.startSessionHeartbeat();

      showToast('Account created and verified successfully! Welcome to Future Sprint.', 'success', 5000);
      document.getElementById('modal-otp-verification').classList.add('hidden');

      const regForm = document.getElementById('form-student-register');
      if (regForm) regForm.reset();
      if (this.registerOtpDeck) this.registerOtpDeck.reset();

      App.navigateAfterAuth(res.user);
    } catch (err) {
      showToast(err.message || 'OTP verification failed.', 'error');
      if (this.registerOtpDeck) {
        this.registerOtpDeck.showError();
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText || '<i data-lucide="shield-check" class="w-4 h-4"></i> Verify and create account';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  async handleResendOtp() {
    if (!this.pendingEmailForOtp) return;
    const btn = document.getElementById('btn-resend-otp');

    try {
      btn.disabled = true;
      btn.innerHTML = 'Sending...';

      const res = await API.post('/api/auth/resend-otp', { email: this.pendingEmailForOtp });
      showToast(res.message || 'A fresh 6-digit code has been sent to your email.', 'info');

      this.startResendCooldown();
      if (this.registerOtpDeck) {
        this.registerOtpDeck.reset();
        this.registerOtpDeck.focus();
      }
    } catch (err) {
      showToast(err.message || 'Failed to resend OTP.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Resend OTP';
    }
  },

  startResendCooldown() {
    const btn = document.getElementById('btn-resend-otp');
    if (!btn) return;

    let seconds = 60;
    btn.disabled = true;
    btn.innerHTML = `Resend in ${seconds}s`;

    if (this.resendCountdownTimer) clearInterval(this.resendCountdownTimer);

    this.resendCountdownTimer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(this.resendCountdownTimer);
        btn.disabled = false;
        btn.innerHTML = 'Resend Code';
      } else {
        btn.innerHTML = `Resend in ${seconds}s`;
      }
    }, 1000);
  },

  async handleLogout() {
    try {
      await API.post('/api/auth/logout', {});
    } catch (e) {
      // Ignore
    } finally {
      showToast('You have been logged out securely.', 'info');
      App.logout();
    }
  },

  // Password Reset with Email OTP Flow
  setupForgotPasswordHandlers() {
    const modal = document.getElementById('modal-forgot-password');
    const btnOpen = document.getElementById('btn-open-forgot-modal');
    const btnClose = document.getElementById('btn-close-forgot-modal');
    const step1 = document.getElementById('forgot-step-1');
    const step2 = document.getElementById('forgot-step-2');
    const emailInput = document.getElementById('forgot-email-input');
    const btnSendOtp = document.getElementById('btn-send-forgot-otp');
    const confirmedEmail = document.getElementById('forgot-confirmed-email');
    const otpInput = document.getElementById('forgot-otp-code');
    const newPassInput = document.getElementById('forgot-new-pass');
    const confirmPassInput = document.getElementById('forgot-confirm-pass');

    if (btnOpen && modal) {
      btnOpen.addEventListener('click', () => {
        try {
          history.pushState({ view: 'modal', modal: 'forgot-password' }, '', '#forgot-password');
        } catch (e) {}
        if (step1) step1.classList.remove('hidden');
        if (step2) step2.classList.add('hidden');
        if (emailInput) emailInput.value = '';
        if (otpInput) otpInput.value = '';
        if (newPassInput) newPassInput.value = '';
        if (confirmPassInput) confirmPassInput.value = '';
        modal.classList.remove('hidden');
        if (window.lucide) lucide.createIcons({ root: modal });
      });
    }

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (window.location.hash === '#forgot-password') {
          try { history.back(); } catch (e) {}
        }
      });
    }

    if (btnSendOtp) {
      btnSendOtp.addEventListener('click', async () => {
        const email = emailInput ? emailInput.value.trim() : '';
        if (!email) {
          showToast('Please enter your registered email address.', 'warning');
          return;
        }

        const originalText = btnSendOtp.innerHTML;
        try {
          btnSendOtp.disabled = true;
          btnSendOtp.innerHTML = 'Sending OTP...';

          const res = await API.post('/api/auth/forgot-password-otp', { email });
          showToast(res.message || 'OTP dispatched! Please check your email inbox.', 'success');

          this.pendingEmailForOtp = email;
          if (confirmedEmail) confirmedEmail.textContent = email;
          if (step1) step1.classList.add('hidden');
          if (step2) step2.classList.remove('hidden');

          if (!this.forgotOtpDeck) {
            this.forgotOtpDeck = new OTPDeckController({
              containerId: 'otp-deck-forgot-pwd',
              onComplete: (code) => {
                if (otpInput) otpInput.value = code;
                if (newPassInput) newPassInput.focus();
              },
              onDigitChange: (code) => {
                if (otpInput) otpInput.value = code;
              }
            });
          } else {
            this.forgotOtpDeck.reset();
          }
          if (this.forgotOtpDeck) this.forgotOtpDeck.focus();
          if (window.lucide) lucide.createIcons({ root: modal });
        } catch (err) {
          showToast(err.message || 'Failed to dispatch password OTP.', 'error');
        } finally {
          btnSendOtp.disabled = false;
          btnSendOtp.innerHTML = originalText;
        }
      });
    }

    // Password validation listeners for forgot password form
    const checkLength = document.getElementById('forgot-pw-rule-length');
    const checkUpper = document.getElementById('forgot-pw-rule-upper');
    const checkLower = document.getElementById('forgot-pw-rule-lower');
    const checkNumber = document.getElementById('forgot-pw-rule-number');
    const checkSpecial = document.getElementById('forgot-pw-rule-special');
    const checkMatch = document.getElementById('forgot-pw-rule-match');

    const setRuleUI = (el, ok, label) => {
      if (!el) return;
      el.className = `flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${ok ? 'text-emerald-600 font-bold' : 'text-slate-400'}`;
      el.innerHTML = `<i data-lucide="${ok ? 'check-circle-2' : 'circle'}" class="w-3.5 h-3.5 flex-shrink-0"></i> ${label}`;
      if (window.lucide) lucide.createIcons({ root: el });
    };

    const updateForgotRules = () => {
      if (!newPassInput) return;
      const val = newPassInput.value;
      const confirmVal = confirmPassInput ? confirmPassInput.value : '';

      setRuleUI(checkLength, val.length >= 8, 'At least 8 characters');
      setRuleUI(checkUpper, /[A-Z]/.test(val), 'At least 1 uppercase letter (A-Z)');
      setRuleUI(checkLower, /[a-z]/.test(val), 'At least 1 lowercase letter (a-z)');
      setRuleUI(checkNumber, /[0-9]/.test(val), 'At least 1 number (0-9)');
      setRuleUI(checkSpecial, /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val), 'At least 1 special character (!@#$...)');
      setRuleUI(checkMatch, confirmVal.length > 0 && confirmVal === val, 'Passwords match');
    };

    if (newPassInput) newPassInput.addEventListener('input', updateForgotRules);
    if (confirmPassInput) confirmPassInput.addEventListener('input', updateForgotRules);

    // Form submission for step 2
    if (step2) {
      step2.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = this.pendingEmailForOtp;
        const otp_code = this.forgotOtpDeck ? this.forgotOtpDeck.getCode() : (otpInput ? otpInput.value.trim() : '');
        const new_password = newPassInput ? newPassInput.value : '';
        const confirm_password = confirmPassInput ? confirmPassInput.value : '';

        if (!otp_code || otp_code.length !== 6) {
          showToast('Please enter the 6-digit verification code.', 'warning');
          if (this.forgotOtpDeck) this.forgotOtpDeck.focus();
          return;
        }

        if (new_password.length < 8 || !/[A-Z]/.test(new_password)) {
          showToast('New password must be at least 8 characters with 1 uppercase letter.', 'warning');
          return;
        }

        if (new_password !== confirm_password) {
          showToast('Passwords do not match.', 'error');
          return;
        }

        const submitBtn = step2.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Verifying & Updating...';

          const res = await API.post('/api/auth/reset-password-with-otp', {
            email,
            otp_code,
            new_password
          });

          showToast(res.message || 'Password reset successfully! Please sign in.', 'success');
          modal.classList.add('hidden');
          this.switchAuthTab('student-login');
        } catch (err) {
          showToast(err.message || 'Failed to reset password.', 'error');
          if (this.forgotOtpDeck) this.forgotOtpDeck.showError();
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }
  },

  openPublicStudentCheckModal(pushState = true) {
    const modal = document.getElementById('modal-public-student-check');
    if (!modal) return;
    if (pushState) {
      try {
        history.pushState({ view: 'modal', modal: 'public-check' }, '', '#student-check');
      } catch (e) {}
    }
    const resultBox = document.getElementById('public-check-result');
    if (resultBox) {
      resultBox.innerHTML = '';
      resultBox.classList.add('hidden');
    }
    const form = document.getElementById('form-public-student-check');
    if (form) form.reset();
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  closePublicStudentCheckModal(fromPopstate = false) {
    const modal = document.getElementById('modal-public-student-check');
    if (modal) modal.classList.add('hidden');
    if (!fromPopstate && window.location.hash === '#student-check') {
      try { history.back(); } catch (e) {}
    }
  },

  async handlePublicStudentCheck(e) {
    if (e && e.preventDefault) e.preventDefault();
    const queryInput = document.getElementById('public-check-query');
    const query = queryInput ? queryInput.value.trim() : '';
    if (!query) {
      showToast('Please enter an Email ID, Phone Number, or Name.', 'error');
      return;
    }

    const resultBox = document.getElementById('public-check-result');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Checking Database...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/auth/check-student', { query });
      if (!resultBox) return;
      resultBox.classList.remove('hidden');

      if (res.found) {
        resultBox.innerHTML = `
          <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
            <div class="flex items-center gap-2 font-bold text-emerald-800 text-sm">
              <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600"></i>
              <span>Candidate Record Found in Database!</span>
            </div>
            <div class="text-xs space-y-1.5 text-slate-700 pt-1">
              <div><strong>Candidate Name:</strong> ${res.name}</div>
              <div><strong>Domain:</strong> <span class="badge-domain">${res.domain || 'Not specified'}</span></div>
              <div><strong>Email:</strong> <span class="font-mono text-slate-800">${res.masked_email}</span></div>
              <div><strong>Mobile:</strong> <span class="font-mono text-slate-800">${res.masked_phone}</span></div>
              <div><strong>Registered On:</strong> ${res.joined_date}</div>
              <div class="pt-1">
                <strong>Status:</strong> ${res.is_verified ? '<span class="text-emerald-700 font-bold">Verified & Active Account</span>' : '<span class="text-amber-700 font-bold">Email Verification Pending (OTP Required)</span>'}
              </div>
            </div>
            <div class="pt-2 text-center">
              <button type="button" onclick="document.getElementById('modal-public-student-check').classList.add('hidden'); Auth.switchAuthTab('student-login');" class="btn-grad text-xs py-2 px-4 font-bold inline-flex items-center gap-1.5">
                <i data-lucide="log-in" class="w-3.5 h-3.5"></i> Sign In to Portal
              </button>
            </div>
          </div>
        `;
      } else if (res.pending_verification) {
        resultBox.innerHTML = `
          <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
            <div class="flex items-center gap-2 font-bold text-amber-800 text-sm">
              <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-600"></i>
              <span>Registration Incomplete (OTP Pending)</span>
            </div>
            <p class="text-xs text-amber-900 leading-relaxed">${res.message}</p>
          </div>
        `;
      } else {
        resultBox.innerHTML = `
          <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-2">
            <div class="flex items-center gap-2 font-bold text-rose-800 text-sm">
              <i data-lucide="x-circle" class="w-5 h-5 text-rose-600"></i>
              <span>No Record Found in Database</span>
            </div>
            <p class="text-xs text-rose-900 leading-relaxed">${res.message || 'No candidate found with these details.'}</p>
            <div class="pt-2">
              <button type="button" onclick="document.getElementById('modal-public-student-check').classList.add('hidden'); Auth.switchAuthTab('student-register');" class="btn-grad text-xs py-2 px-4 font-bold inline-flex items-center gap-1.5">
                <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Register as New Student
              </button>
            </div>
          </div>
        `;
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      showToast(err.message || 'Failed to check student record.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  setupSessionRevocationListener() {
    window.addEventListener('session-terminated', (e) => {
      const { message } = e.detail || {};

      API.stopSessionHeartbeat();

      const modal = document.getElementById('session-revoked-modal');
      const messageElem = document.getElementById('session-revoked-message');

      if (messageElem && message) {
        messageElem.textContent = message;
      }

      if (modal) {
        modal.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      } else {
        alert(message || 'Your session has ended.');
      }

      App.showAuthView();
    });
  }
};

window.Auth = Auth;
