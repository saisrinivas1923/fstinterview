// Student Portal UI & Functionality - Future Sprint Technologies
const StudentPortal = {
  currentFilter: 'all',
  searchQuery: '',
  editingInterviewId: null,

  // Top 160+ Software, IT, Cloud & Tech Hiring Companies for dynamic suggestions
  topCompanies: [
    'Accenture', 'Adobe', 'Agilent Technologies', 'Airbus India', 'Akamai Technologies',
    'Altimetrik', 'Amazon', 'Amdocs', 'American Express', 'Analog Devices',
    'ANSYS', 'Apollo Tyres Digital', 'AppDynamics', 'Apple', 'Applied Materials',
    'Arista Networks', 'Atlassian', 'Autodesk', 'Bain & Company', 'Bank of America',
    'Barclays', 'Bharat Electronics', 'Birlasoft', 'BlackRock', 'Bosch Global Software',
    'Broadcom', 'Cadence Design Systems', 'Capgemini', 'Caterpillar India', 'Cerner',
    'Cisco Systems', 'Citigroup', 'Cloudera', 'Cognizant', 'Commvault',
    'Credit Suisse', 'CrowdStrike', 'Cummins India', 'Cyient', 'Dell Technologies',
    'Deloitte', 'Deutsche Bank', 'Dun & Bradstreet', 'DXC Technology', 'EPAM Systems',
    'Ericsson', 'Ernst & Young (EY)', 'Excellence Technologies', 'EXL Service', 'FactSet',
    'FICO', 'Fidelity Investments', 'Flipkart', 'Ford Global Technology', 'Fortinet',
    'Fractal Analytics', 'Freshworks', 'Gartner', 'GE Healthcare', 'Genpact',
    'GlobalLogic', 'Goldman Sachs', 'Google', 'HashedIn by Deloitte', 'HCL Technologies',
    'Hexaware Technologies', 'Honeywell', 'HP Enterprise (HPE)', 'HSBC Technology', 'IBM',
    'Informatica', 'Infosys', 'Intel', 'Intuit', 'ITC Infotech',
    'JPMorgan Chase', 'Juniper Networks', 'KLA-Tencor', 'KPMG', 'KPIT Technologies',
    'L&T Technology Services', 'LatentView Analytics', 'Lenovo India', 'LTI Mindtree', 'MathWorks',
    'McAfee', 'MediaTek', 'Mercedes-Benz R&D', 'Micro Focus', 'Micron Technology',
    'Microsoft', 'Morgan Stanley', 'Motorola Solutions', 'Mphasis', 'Mu Sigma',
    'National Instruments', 'NCR Corporation', 'NetApp', 'NICE Systems', 'Nokia',
    'Nomura', 'Nutanix', 'NVIDIA', 'Ola Cabs', 'OpenText',
    'Oracle', 'Optum (UnitedHealth)', 'Palo Alto Networks', 'PayPal', 'Paytm',
    'Pegasystems', 'Persistent Systems', 'Philips Innovation', 'PhonePe', 'PricewaterhouseCoopers (PwC)',
    'Publicis Sapient', 'Qualcomm', 'Quest Global', 'Rackspace', 'Rakuten',
    'Razorpay', 'Red Hat', 'Robert Bosch', 'Salesforce', 'Samsung R&D',
    'SAP Labs', 'SAS Institute', 'Schneider Electric', 'ServiceNow', 'Siemens Technology',
    'Societe Generale', 'Sony India Software', 'Standard Chartered Bank', 'Swiggy', 'Synopsys',
    'Target Corporation', 'Tata Communications', 'Tata Consultancy Services (TCS)', 'Tata Elxsi', 'Tech Mahindra',
    'Teradata', 'Texas Instruments', 'Thoughtworks', 'Tiger Analytics', 'Tredence',
    'Tricentis', 'Uber', 'UBS', 'Uniphore', 'Unisys',
    'UST Global', 'Verizon India', 'Virtusa', 'VMware', 'Vodafone Intelligent Solutions',
    'Walmart Global Tech', 'Wells Fargo', 'Wipro', 'Workday', 'Yahoo',
    'Zensar Technologies', 'Zoho Corporation', 'Zomato', 'Zycus'
  ],

  init() {
    this.bindEvents();
    this.setupCompanyAutocomplete();
  },

  bindEvents() {
    // Open Add Interview Modal
    const btnAdd = document.getElementById('btn-student-add-interview');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openInterviewModal());
    }

    // Modal Close Buttons
    const btnCloseModal = document.getElementById('btn-close-interview-modal');
    const btnCancelModal = document.getElementById('btn-cancel-interview-modal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => this.closeInterviewModal());
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => this.closeInterviewModal());

    // Interview Form Submit
    const interviewForm = document.getElementById('form-interview');
    if (interviewForm) {
      interviewForm.addEventListener('submit', (e) => this.handleSaveInterview(e));

      // Indian 10-digit mobile number real-time restriction
      const hrPhoneInput = document.getElementById('interview-hr-phone');
      if (hrPhoneInput) {
        hrPhoneInput.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
      }

      // Real-time block for previous dates from calendar
      const interviewDateInput = interviewForm.querySelector('[name="interview_date"]');
      if (interviewDateInput) {
        interviewDateInput.addEventListener('change', (e) => {
          const today = this.getDeviceLocalDate();
          if (e.target.value && e.target.value < today) {
            showToast('Previous dates are blocked. Please select today or a future date.', 'warning');
            e.target.value = today;
          }
        });
      }
    }

    const reschedDateInput = document.getElementById('reschedule-new-date');
    if (reschedDateInput) {
      reschedDateInput.addEventListener('change', (e) => {
        const today = this.getDeviceLocalDate();
        if (e.target.value && e.target.value < today) {
          showToast('Previous dates are blocked. Please select today or a future date.', 'warning');
          e.target.value = today;
        }
      });
    }

    // Search filter
    const searchInput = document.getElementById('student-interview-search');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          this.loadInterviews();
        }, 250);
      });
    }

    // Status Filter buttons
    const filterContainer = document.getElementById('student-status-filters');
    if (filterContainer) {
      filterContainer.querySelectorAll('button[data-status]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.filterStatus(btn.getAttribute('data-status'));
        });
      });
    }

    // Student Profile Form
    const profileForm = document.getElementById('form-student-profile');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => this.handleUpdateProfile(e));
    }
  },

  filterStatus(status, pushState = true) {
    if (pushState && this.currentFilter !== status) {
      const hash = status === 'all' ? '#student-portal' : `#student-filter-${status}`;
      try {
        history.pushState({ view: 'portal', role: 'student', filter: status }, '', hash);
      } catch (e) {}
    }
    this.currentFilter = status || 'all';
    const filterContainer = document.getElementById('student-status-filters');
    if (filterContainer) {
      filterContainer.querySelectorAll('button[data-status]').forEach(b => {
        if (b.getAttribute('data-status') === this.currentFilter) {
          b.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-[#d99a63] via-[#bf6088] to-[#8a6cc0] text-white shadow-sm transition cursor-pointer';
        } else {
          b.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-[rgba(138,108,192,0.2)] transition cursor-pointer';
        }
      });
    }
    this.loadInterviews();
  },

  // Company Name Live Autocomplete Suggestion as User Enters Letters
  setupCompanyAutocomplete() {
    const input = document.getElementById('interview-company-input');
    const dropdown = document.getElementById('interview-company-suggestions');
    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const query = input.value.trim();

      if (!query) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
      }

      const matches = window.getCompanySuggestions
        ? window.getCompanySuggestions(query, 12)
        : (this.topCompanies || []).filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 12);

      if (matches.length === 0) {
        dropdown.classList.add('hidden');
        return;
      }

      dropdown.innerHTML = matches.map(c => `
        <button type="button" class="autocomplete-item w-full text-left flex items-center justify-between px-3.5 py-2 hover:bg-purple-50 transition border-b border-slate-100 last:border-0">
          <span class="text-xs font-semibold text-slate-800">${c}</span>
          <i data-lucide="arrow-up-right" class="w-3.5 h-3.5 text-slate-400"></i>
        </button>
      `).join('');

      dropdown.querySelectorAll('button').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          input.value = matches[idx];
          dropdown.classList.add('hidden');
        });
      });

      dropdown.classList.remove('hidden');
      if (window.lucide) lucide.createIcons({ root: dropdown });
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  },

  // Phone/device local date (YYYY-MM-DD)
  getDeviceLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Phone/device 12-hour local time parts (Hour, Minute, AM/PM)
  getDeviceLocalTime12() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 hour is 12 AM
    const hourStr = String(hours).padStart(2, '0');
    return { hour: hourStr, minute: minutes, ampm };
  },

  // Safe helper to set select value without ever ending up empty or selectedIndex = -1
  setSelectSafe(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const sVal = String(val).padStart(2, '0');
    const exists = Array.from(el.options).some(o => o.value === sVal);
    if (!exists && sVal) {
      const opt = document.createElement('option');
      opt.value = sVal;
      opt.textContent = sVal;
      el.appendChild(opt);
    }
    el.value = sVal;
    if (el.selectedIndex === -1 && el.options.length > 0) {
      el.selectedIndex = 0;
    }
  },

  async loadDashboard() {
    const waBtn = document.getElementById('floating-whatsapp-btn');
    if (waBtn) {
      waBtn.classList.remove('hidden');
      if (window.App && typeof App.repositionWhatsAppBottom === 'function') {
        App.repositionWhatsAppBottom(false);
      }
    }
    const user = API.getUser();
    if (!user) return;

    const nameElem = document.getElementById('student-greeting-name');
    const domainElem = document.getElementById('student-greeting-domain');
    if (nameElem) nameElem.textContent = user.name;
    if (domainElem) domainElem.textContent = user.domain;

    try {
      const data = await API.get('/api/student/dashboard');
      if (data.success) {
        if (data.user) {
          API.setUser(data.user);
          if (window.App && typeof App.refreshProfileDropdownData === 'function') {
            App.refreshProfileDropdownData();
          }
        }
        document.getElementById('student-stat-total').textContent = data.stats.total;
        document.getElementById('student-stat-waiting').textContent = data.stats.waiting_approval;
        document.getElementById('student-stat-scheduled').textContent = data.stats.scheduled;
        document.getElementById('student-stat-selected').textContent = data.stats.selected;
      }
    } catch (err) {
      console.error('Failed to load student dashboard stats:', err);
    }

    await this.loadPlacementsDashboard();
    await this.loadInterviews();
  },

  // Load Anonymous Institute Placements & Domain Analytics for Students (3D Circular Gauges)
  async loadPlacementsDashboard() {
    const totalBadge = document.getElementById('student-placed-total-badge');
    const grid = document.getElementById('student-domain-placements-grid');
    if (!grid && !totalBadge) return;

    try {
      const res = await API.get('/api/student/placements-dashboard');
      if (!res.success) return;

      if (totalBadge) {
        totalBadge.textContent = res.totalPlaced || 0;
      }

      if (grid) {
        if (!res.domains || res.domains.length === 0) {
          grid.innerHTML = `
            <div class="py-8 text-center text-slate-400 col-span-full bg-white/60 rounded-2xl border border-dashed border-slate-200">
              <i data-lucide="info" class="w-5 h-5 mx-auto mb-1 text-slate-400"></i>
              <p class="text-xs font-medium">Domain placement statistics will appear here as candidates are placed.</p>
            </div>
          `;
        } else {
          grid.innerHTML = res.domains.map((d, idx) => {
            const placed = d.placed_candidates || 0;
            const total = d.total_candidates || 0;
            const percent = total > 0 ? Math.round((placed / total) * 100) : 0;
            const gradId = `student-gauge-grad-${idx}`;
            // Circumference of radius 32 is 201.06
            const c = 201.06;
            const offset = c - (c * Math.min(100, Math.max(0, percent))) / 100;

            return `
              <div class="circular-gauge-3d-card group">
                <div class="gauge-svg-wrap">
                  <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 80 80">
                    <defs>
                      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#d99a63"/>
                        <stop offset="50%" stop-color="#bf6088"/>
                        <stop offset="100%" stop-color="#8a6cc0"/>
                      </linearGradient>
                    </defs>
                    <!-- Track -->
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#f1ecfa" stroke-width="7"/>
                    <!-- 3D Progress Ring -->
                    <circle cx="40" cy="40" r="32" fill="none" stroke="url(#${gradId})" stroke-width="7"
                      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
                      class="transition-all duration-1000 ease-out"/>
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span class="text-sm font-black text-slate-900 font-heading leading-none">${percent}%</span>
                    <span class="text-[9px] font-bold text-slate-400 mt-0.5">Placement</span>
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-1">
                    <span class="w-2 h-2 rounded-full ${placed > 0 ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-heading">
                      ${placed > 0 ? 'Placement Verified' : 'In Training'}
                    </span>
                  </div>
                  <h5 class="text-xs font-black text-slate-900 font-heading truncate mb-1" title="${d.domain}">
                    ${d.domain}
                  </h5>
                  <div class="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                    <span class="bg-purple-50 text-[#8a6cc0] px-2 py-0.5 rounded-md font-bold">
                      ${percent}% Placement Rate
                    </span>
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Failed to load placements dashboard:', err.message);
    }
  },

  async loadInterviews() {
    const container = document.getElementById('student-interviews-list');
    if (!container) return;

    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <svg class="animate-spin h-6 w-6 mx-auto mb-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <p class="text-sm">Loading interview records...</p>
      </div>
    `;

    try {
      const params = {};
      if (this.currentFilter !== 'all') params.status = this.currentFilter;
      if (this.searchQuery) params.search = this.searchQuery;

      const res = await API.get('/api/student/interviews', params);
      const interviews = res.interviews || [];

      if (interviews.length === 0) {
        container.innerHTML = `
          <div class="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <i data-lucide="calendar-plus" class="w-8 h-8"></i>
            </div>
            <h3 class="text-base font-extrabold text-slate-900 mb-1">No Interviews Found</h3>
            <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
              ${this.searchQuery || this.currentFilter !== 'all' 
                ? 'No interview records match your filter criteria.' 
                : 'Whenever an interview is scheduled or attended, log the company details here. The admin will verify and update your status!'}
            </p>
            <button onclick="StudentPortal.openInterviewModal()" class="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#d99a63] via-[#bf6088] to-[#8a6cc0] text-white rounded-xl text-sm font-bold shadow-md transition">
              <i data-lucide="calendar-plus" class="w-4 h-4"></i> Book slot for interview
            </button>
          </div>
        `;
        if (window.lucide) lucide.createIcons({ root: container });
        return;
      }

      container.innerHTML = interviews.map(inv => this.renderInterviewCard(inv)).join('');
      if (window.lucide) lucide.createIcons({ root: container });
    } catch (err) {
      container.innerHTML = `
        <div class="p-6 text-center text-rose-500 bg-rose-50 rounded-2xl border border-rose-200">
          <p class="text-sm font-medium">Failed to load interviews. ${err.message || ''}</p>
        </div>
      `;
    }
  },

  renderInterviewCard(inv) {
    const user = API.getUser();
    
    // Status badges & colors according to institute status requirements
    const isWaiting = inv.status === 'Waiting for Admin Approval' || !inv.status;
    const isAttended = inv.status === 'Attended';
    const isRejected = inv.status === 'Rejected';
    const isOnHold = inv.status === 'On Hold';
    const isWaitingHR = inv.status === 'Waiting for HR Response';
    const isSelected = inv.status === 'Selected';

    let badgeClass = 'status-waiting';
    let iconName = 'hourglass';
    let displayStatus = inv.status || 'Waiting for Admin Approval';

    if (isWaiting) {
      badgeClass = 'status-waiting';
      iconName = 'hourglass';
      displayStatus = '⏳ Waiting for Admin Approval';
    } else if (isAttended) {
      badgeClass = 'status-attended';
      iconName = 'check-circle-2';
      displayStatus = '✅ Attended';
    } else if (isRejected) {
      badgeClass = 'status-rejected';
      iconName = 'x-circle';
      displayStatus = '❌ Rejected';
    } else if (isOnHold) {
      badgeClass = 'status-on-hold';
      iconName = 'pause-circle';
      displayStatus = '⏸️ On Hold';
    } else if (isWaitingHR) {
      badgeClass = 'status-waiting-hr';
      iconName = 'message-square';
      displayStatus = '💬 Waiting for HR Response';
    } else if (isSelected) {
      badgeClass = 'status-selected';
      iconName = 'award';
      displayStatus = '🎉 Selected / Placed';
    }

    const formattedDate = new Date(inv.interview_date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const cleanHrPhone = inv.hr_mobile_number ? inv.hr_mobile_number.replace(/[^0-9+]/g, '') : null;

    return `
      <div class="bg-white rounded-3xl border ${isSelected ? 'border-emerald-300 ring-2 ring-emerald-100' : isWaiting ? 'border-amber-300' : 'border-slate-200'} p-5 sm:p-6 shadow-sm relative transition">
        ${isSelected ? `
          <div class="absolute -top-3 right-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
            <i data-lucide="sparkles" class="w-3 h-3"></i> Hired / Offer Confirmed
          </div>
        ` : ''}

        ${isWaiting ? `
          <div class="absolute -top-3 right-6 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
            <i data-lucide="clock" class="w-3 h-3"></i> Under Admin Approval
          </div>
        ` : ''}

        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div class="flex items-start gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-extrabold text-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              ${inv.company_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-lg font-extrabold text-slate-900">${inv.company_name}</h4>
                <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${badgeClass}">
                  <i data-lucide="${iconName}" class="w-3.5 h-3.5"></i>
                  ${displayStatus}
                </span>
              </div>
              <p class="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5">Role / Domain: <span class="text-indigo-700 font-bold">${inv.role_title}</span></p>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <button onclick="StudentPortal.openRescheduleModal(${inv.id})" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition shadow-xs" title="Reschedule Interview Date & Time">
              <i data-lucide="calendar-clock" class="w-3.5 h-3.5 text-amber-600"></i> Reschedule
            </button>
            <button onclick="StudentPortal.openInterviewModal(${inv.id})" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#8a6cc0] hover:text-[#7859b0] border border-[rgba(138,108,192,0.25)] text-xs font-bold transition shadow-xs" title="Edit Interview Details">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit
            </button>
          </div>
        </div>

        <!-- Key Details Grid with Prominent Date & Time -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span class="text-slate-400 block mb-0.5 font-bold">Interview Date & Time</span>
            <div class="flex items-center gap-1.5 font-bold text-slate-800 flex-wrap">
              <span class="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex-wrap">
                📅 ${inv.interview_date} ${inv.is_rescheduled ? `<span class="text-amber-800 font-extrabold ml-1">(Rescheduled) Original: ${inv.original_interview_date || '-'}</span>` : ''}
              </span>
              <span class="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                ⏰ ${inv.interview_time}
              </span>
            </div>
          </div>

          <div>
            <span class="text-slate-400 block mb-0.5 font-bold">Round / Stage</span>
            <span class="font-bold text-slate-800 flex items-center gap-1">
              <i data-lucide="git-commit" class="w-3.5 h-3.5 text-indigo-500"></i> ${inv.round_name || 'Technical Round'}
            </span>
          </div>

          <div>
            <span class="text-slate-400 block mb-0.5 font-bold">Mode / Location</span>
            <span class="font-bold text-slate-800 flex items-center gap-1">
              <i data-lucide="${inv.interview_mode === 'Online' ? 'video' : 'map-pin'}" class="w-3.5 h-3.5 text-indigo-500"></i>
              ${inv.interview_mode} ${inv.job_location ? `(${inv.job_location})` : ''}
            </span>
          </div>

          <div>
            <span class="text-slate-400 block mb-0.5 font-bold">HR Mobile Number</span>
            ${cleanHrPhone ? `
              <div class="flex items-center gap-1.5 mt-0.5">
                <a href="tel:${cleanHrPhone}" class="font-bold text-indigo-600 hover:underline flex items-center gap-1">
                  <i data-lucide="phone" class="w-3.5 h-3.5 text-slate-400"></i> ${inv.hr_mobile_number}
                </a>
                <a href="https://wa.me/${cleanHrPhone.replace('+', '')}" target="_blank" class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold" title="WhatsApp HR">
                  WA
                </a>
              </div>
            ` : `
              <span class="text-slate-400 italic">Not provided</span>
            `}
          </div>
        </div>

        ${inv.salary_package ? `
          <div class="mt-3 pt-3 border-t border-slate-100 text-xs flex items-center justify-between text-slate-600">
            <span>Package Offered:</span>
            <span class="font-extrabold text-emerald-700">${inv.salary_package}</span>
          </div>
        ` : ''}

        <!-- Institute Office Attendance & 2-Hour Reminder Notification Banner -->
        <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div class="flex items-center gap-1.5 text-[#6944a6] font-semibold text-[11px]">
            <i data-lucide="building-2" class="w-3.5 h-3.5 text-[#bf6088] flex-shrink-0"></i>
            <span>Attend at Future Sprint Office (Flat 207, Miyapur)</span>
          </div>
          <div>
            ${(() => {
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const isPastDate = inv.interview_date < todayStr;
              const isTerminalStatus = ['Selected', 'Attended', 'Rejected', 'Completed'].includes(inv.status);
              const isCompleted = isPastDate || isTerminalStatus;

              if (inv.reminder_sent_2h) {
                return `
                  <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <i data-lucide="bell-ring" class="w-3 h-3 text-emerald-600"></i> 2-Hour Reminder Emailed
                  </span>
                `;
              }
              if (isCompleted) {
                return `
                  <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    <i data-lucide="check-circle" class="w-3 h-3 text-slate-400"></i> Completed
                  </span>
                `;
              }
              return `
                <span class="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  <i data-lucide="bell" class="w-3 h-3 text-slate-400"></i> Arrival Reminder sent 2h prior
                </span>
              `;
            })()}
          </div>
        </div>
      </div>
    `;
  },

  // Open Interview Modal: Detects phone default date & 12-hour AM/PM time automatically
  async openInterviewModal(id = null, pushState = true) {
    if (pushState) {
      try {
        history.pushState({ view: 'portal', role: 'student', filter: this.currentFilter, modal: 'interview', interviewId: id }, '', '#interview-booking');
      } catch (e) {}
    }
    this.editingInterviewId = id;
    const modal = document.getElementById('modal-interview');
    const titleElem = document.getElementById('modal-interview-title');
    const form = document.getElementById('form-interview');
    const user = API.getUser();

    form.reset();

    // Set phone default current date automatically and block previous dates
    const defaultDate = this.getDeviceLocalDate();
    const dateInput = form.querySelector('[name="interview_date"]');
    if (dateInput) {
      dateInput.min = defaultDate;
      dateInput.value = defaultDate;
    }

    // Set phone default 12-hour time with AM / PM
    const defaultTime = this.getDeviceLocalTime12();
    this.setSelectSafe('interview-time-hour', defaultTime.hour);
    this.setSelectSafe('interview-time-min', defaultTime.minute);
    const ampmEl = document.getElementById('interview-time-ampm');
    if (ampmEl) ampmEl.value = defaultTime.ampm;

    // Role is permanently fixed and blocked to student's Domain
    const roleField = form.querySelector('[name="role_title"]');
    if (roleField && user && user.domain) {
      roleField.value = user.domain;
      roleField.setAttribute('readonly', 'readonly');
      roleField.setAttribute('disabled', 'disabled');
    }

    if (id) {
      titleElem.textContent = 'Edit Interview Details';
      try {
        const res = await API.get(`/api/student/interviews/${id}`);
        const inv = res.interview;

        if (dateInput) {
          dateInput.min = defaultDate;
          dateInput.value = (inv.interview_date && inv.interview_date >= defaultDate) ? inv.interview_date : defaultDate;
        }
        form.querySelector('[name="company_name"]').value = inv.company_name || '';
        if (roleField) roleField.value = inv.role_title || user.domain;
        form.querySelector('[name="interview_mode"]').value = inv.interview_mode || 'Online';
        form.querySelector('[name="round_name"]').value = inv.round_name || 'Technical Round 1';
        form.querySelector('[name="hr_mobile_number"]').value = inv.hr_mobile_number || '';
        form.querySelector('[name="salary_package"]').value = inv.salary_package || '';
        form.querySelector('[name="job_location"]').value = inv.job_location || '';

        // Parse existing time string e.g. "10:30 AM" or "14:30"
        if (inv.interview_time) {
          const match = inv.interview_time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            let h = match[1].padStart(2, '0');
            const m = match[2];
            let ap = match[3] ? match[3].toUpperCase() : 'AM';
            if (!match[3] && Number(h) >= 12) {
              ap = 'PM';
              if (Number(h) > 12) h = String(Number(h) - 12).padStart(2, '0');
            }
            this.setSelectSafe('interview-time-hour', h);
            this.setSelectSafe('interview-time-min', m);
            const ampmEl = document.getElementById('interview-time-ampm');
            if (ampmEl) ampmEl.value = ap;
          }
        }
      } catch (err) {
        showToast('Failed to load interview record details.', 'error');
        return;
      }
    } else {
      titleElem.textContent = 'Book slot for interview';
      if (roleField && user && user.domain) {
        roleField.value = user.domain;
      }
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  closeInterviewModal(fromPopstate = false) {
    const modal = document.getElementById('modal-interview');
    if (modal) modal.classList.add('hidden');
    this.editingInterviewId = null;
    if (!fromPopstate && window.location.hash === '#interview-booking') {
      try {
        history.back();
      } catch (e) {}
    }
  },

  // Open Reschedule Modal for Student
  async openRescheduleModal(id, pushState = true) {
    if (pushState) {
      try {
        history.pushState({ view: 'portal', role: 'student', filter: this.currentFilter, modal: 'reschedule', interviewId: id }, '', '#reschedule-booking');
      } catch (e) {}
    }
    let inv = (this.interviews || []).find(i => i.id === Number(id));
    if (!inv) {
      try {
        const res = await API.get(`/api/student/interviews/${id}`);
        inv = res.interview;
      } catch (err) {
        showToast('Failed to load interview details for rescheduling.', 'error');
        return;
      }
    }

    if (!inv) return;

    document.getElementById('reschedule-interview-id').value = inv.id;
    document.getElementById('reschedule-company-name').textContent = inv.company_name;
    document.getElementById('reschedule-role-title').textContent = inv.role_title;
    document.getElementById('reschedule-current-date').textContent = inv.interview_date;
    document.getElementById('reschedule-current-time').textContent = inv.interview_time || 'Not specified';

    // Block previous dates: minimum allowed date is today
    const defaultDate = this.getDeviceLocalDate();
    const dateInput = document.getElementById('reschedule-new-date');
    if (dateInput) {
      dateInput.min = defaultDate;
      dateInput.value = (inv.interview_date && inv.interview_date >= defaultDate) ? inv.interview_date : defaultDate;
    }

    // Parse existing time string e.g. "10:30 AM" or default
    if (inv.interview_time) {
      const match = inv.interview_time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let h = match[1].padStart(2, '0');
        const m = match[2];
        let ap = match[3] ? match[3].toUpperCase() : 'AM';
        if (!match[3] && Number(h) >= 12) {
          ap = 'PM';
          if (Number(h) > 12) h = String(Number(h) - 12).padStart(2, '0');
        }
        this.setSelectSafe('reschedule-time-hour', h);
        this.setSelectSafe('reschedule-time-min', m);
        const ampmEl = document.getElementById('reschedule-time-ampm');
        if (ampmEl) ampmEl.value = ap;
      }
    }

    const modal = document.getElementById('modal-student-reschedule');
    if (modal) {
      modal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }
  },

  closeRescheduleModal(fromPopstate = false) {
    const modal = document.getElementById('modal-student-reschedule');
    if (modal) modal.classList.add('hidden');
    if (!fromPopstate && window.location.hash === '#reschedule-booking') {
      try {
        history.back();
      } catch (e) {}
    }
  },

  async handleRescheduleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('reschedule-interview-id').value;
    const newDate = document.getElementById('reschedule-new-date').value;
    const hour = document.getElementById('reschedule-time-hour').value;
    const min = document.getElementById('reschedule-time-min').value;
    const ampm = document.getElementById('reschedule-time-ampm').value;
    const newTime = `${hour}:${min} ${ampm}`;

    if (!newDate) {
      showToast('Please select a valid new interview date.', 'warning');
      return;
    }

    const todayStr = this.getDeviceLocalDate();
    if (newDate < todayStr) {
      showToast('Rescheduled date cannot be in the past. Please choose today or a future date.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-reschedule');
    const origText = submitBtn ? submitBtn.innerHTML : '';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Updating...';
      }

      const res = await API.put(`/api/student/interviews/${id}/reschedule`, {
        interview_date: newDate,
        interview_time: newTime
      });

      showToast(res.message || 'Interview rescheduled successfully!', 'success');
      this.closeRescheduleModal();
      await this.loadInterviews();
      await this.loadDashboard();
    } catch (err) {
      showToast(err.message || 'Failed to reschedule interview.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    }
  },

  async handleSaveInterview(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const user = API.getUser();

    // Build 12-hour AM / PM time string
    const hour = document.getElementById('interview-time-hour').value;
    const minute = document.getElementById('interview-time-min').value;
    const ampm = document.getElementById('interview-time-ampm').value;
    const formattedTime = `${hour}:${minute} ${ampm}`;

    const data = {
      interview_date: form.querySelector('[name="interview_date"]').value,
      interview_time: formattedTime,
      company_name: form.querySelector('[name="company_name"]').value.trim(),
      role_title: user ? user.domain : (form.querySelector('[name="role_title"]')?.value || 'Domain Track'),
      interview_mode: form.querySelector('[name="interview_mode"]').value,
      round_name: form.querySelector('[name="round_name"]').value.trim(),
      hr_mobile_number: form.querySelector('[name="hr_mobile_number"]').value.trim(),
      salary_package: form.querySelector('[name="salary_package"]').value.trim(),
      job_location: form.querySelector('[name="job_location"]').value.trim()
    };

    if (!data.company_name || !data.interview_date) {
      showToast('Please enter both Company Name and Interview Date.', 'warning');
      return;
    }

    const todayDate = this.getDeviceLocalDate();
    if (data.interview_date < todayDate) {
      showToast('Previous dates are blocked. Please choose today or a future date.', 'warning');
      return;
    }

    // Indian 10-digit mobile number validation: must start with 6, 7, 8, or 9
    const cleanHrPhone = (data.hr_mobile_number || '').replace(/[^0-9]/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanHrPhone)) {
      showToast('HR Mobile Number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.', 'warning');
      return;
    }
    data.hr_mobile_number = cleanHrPhone;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting Details...';

      if (this.editingInterviewId) {
        await API.put(`/api/student/interviews/${this.editingInterviewId}`, data);
        showToast('Interview record updated successfully!', 'success');
      } else {
        await API.post('/api/student/interviews', data);
        showToast('Interview submitted! Status is Waiting for Admin Approval.', 'success', 4500);
      }

      this.closeInterviewModal();
      await this.loadDashboard();
    } catch (err) {
      showToast(err.message || 'Failed to save interview record.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  },

  async handleUpdateProfile(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    const name = form.querySelector('[name="profile_name"]').value.trim();
    const phone = form.querySelector('[name="profile_phone"]').value.trim();
    const current_password = form.querySelector('[name="current_password"]').value;
    const new_password = form.querySelector('[name="new_password"]').value;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Saving...';

      const payload = { name, phone };
      if (new_password) {
        if (current_password && new_password === current_password) {
          alert("The password you entered is same as last password. Create new password");
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          return;
        }
        payload.current_password = current_password;
        payload.new_password = new_password;
      }

      const res = await API.put('/api/student/profile', payload);
      API.setUser(res.user);

      showToast('Profile updated successfully!', 'success');
      document.getElementById('student-greeting-name').textContent = res.user.name;

      form.querySelector('[name="current_password"]').value = '';
      form.querySelector('[name="new_password"]').value = '';
    } catch (err) {
      if (err.data?.error === 'PASSWORD_SAME_AS_LAST' || err.message?.includes('same as last password')) {
        alert("The password you entered is same as last password. Create new password");
        return;
      }
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  },

  // Toggle Password Change Form Container in Profile Drawer
  togglePwdChangeForm() {
    const container = document.getElementById('student-pwd-form-container');
    const toggleBtn = document.getElementById('btn-toggle-student-pwd');
    if (!container) return;

    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
      container.classList.remove('hidden');
      if (toggleBtn) toggleBtn.textContent = 'Cancel';
      document.getElementById('pwd-change-new')?.focus();
    } else {
      container.classList.add('hidden');
      if (toggleBtn) toggleBtn.textContent = 'Update';
    }
    if (window.lucide) lucide.createIcons();
  },

  // Step 1: Validate New Password & Confirm, Request OTP, Close Drawer, Open Dedicated OTP Box
  async verifyNewPasswordAndOpenOtpModal() {
    const newPassInput = document.getElementById('pwd-change-new');
    const confirmPassInput = document.getElementById('pwd-change-confirm');
    const btn = document.getElementById('btn-student-verify-otp');

    const newPassword = newPassInput ? newPassInput.value : '';
    const confirmPassword = confirmPassInput ? confirmPassInput.value : '';

    if (!newPassword || newPassword.length < 8) {
      showToast('New password must be at least 8 characters long.', 'warning');
      if (newPassInput) newPassInput.focus();
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      showToast('New password must contain at least one uppercase letter (A-Z).', 'warning');
      if (newPassInput) newPassInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('The re-typed password does not match. Please re-check.', 'warning');
      if (confirmPassInput) confirmPassInput.focus();
      return;
    }

    // Save pending passwords in memory
    this.pendingStudentPassword = {
      new_password: newPassword,
      confirm_password: confirmPassword
    };

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Dispatching OTP...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/student/request-password-otp', { new_password: newPassword });
      showToast(res.message || '6-digit OTP code dispatched to your email!', 'success');

      // Close profile drawer
      const profileDrawer = document.getElementById('profile-drawer');
      if (profileDrawer) profileDrawer.classList.add('hidden');

      // Open dedicated OTP modal ("new box")
      try {
        history.pushState({ view: 'portal', role: 'student', filter: this.currentFilter, modal: 'student-password-otp' }, '', '#student-password-otp');
      } catch (e) {}
      const modal = document.getElementById('modal-student-password-otp');
      const msgBox = document.getElementById('student-modal-otp-msg');

      if (msgBox) {
        const studentEmail = res.email || 'your registered email';
        msgBox.innerHTML = `
          <div class="flex items-center gap-2 font-bold text-slate-800">
            <i data-lucide="mail-check" class="w-4 h-4 text-[#bf6088]"></i> OTP dispatched to <strong>${studentEmail}</strong>
          </div>
          <p class="text-[11px] text-slate-600 mt-1">${res.message || 'Enter the 6-digit OTP code below to verify and complete password update.'}</p>
        `;
      }

      // Initialize OTP deck inside the new modal
      const deck = OTPDeckController.get('otp-deck-student-modal') || new OTPDeckController({
        containerId: 'otp-deck-student-modal'
      });
      OTPDeckController.instances['otp-deck-student-modal'] = deck;
      deck.reset();
      deck.onComplete = (code) => {
        const hiddenInput = document.getElementById('student-modal-otp-code');
        if (hiddenInput) hiddenInput.value = code;
        this.confirmAndUpdatePassword();
      };
      deck.onDigitChange = (code) => {
        const hiddenInput = document.getElementById('student-modal-otp-code');
        if (hiddenInput) hiddenInput.value = code;
      };
      this.studentModalOtpDeck = deck;

      if (modal) modal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
      setTimeout(() => deck.focus(), 150);

    } catch (err) {
      if (err.data?.error === 'PASSWORD_SAME_AS_LAST' || err.message?.includes('same as last password')) {
        alert("The password you entered is same as last password. Create new password");
        if (newPassInput) newPassInput.focus();
        return;
      }
      showToast(err.message || 'Failed to dispatch verification OTP.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4"></i> Verify with OTP';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  // Step 2: Triggered when student clicks [ Verify and Update Password ] in the dedicated OTP box
  async confirmAndUpdatePassword() {
    const deck = this.studentModalOtpDeck || OTPDeckController.get('otp-deck-student-modal');
    const otpCode = deck ? deck.getCode() : (document.getElementById('student-modal-otp-code')?.value.trim() || '');

    if (!otpCode || otpCode.length !== 6) {
      showToast('Please enter all 6 digits of the verification code.', 'warning');
      if (deck) deck.focus();
      return;
    }

    const passwords = this.pendingStudentPassword || {
      new_password: document.getElementById('pwd-change-new')?.value,
      confirm_password: document.getElementById('pwd-change-confirm')?.value
    };

    if (!passwords.new_password || passwords.new_password.length < 8) {
      showToast('Session expired. Please re-enter your password.', 'error');
      document.getElementById('modal-student-password-otp')?.classList.add('hidden');
      return;
    }

    const btn = document.getElementById('btn-student-confirm-pwd-update');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Verifying Code & Updating...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/student/change-password-with-otp', {
        otp_code: otpCode,
        new_password: passwords.new_password,
        confirm_password: passwords.confirm_password
      });

      showToast(res.message || 'Password successfully updated!', 'success', 6000);

      if (res.token) {
        API.setToken(res.token);
      }

      // Hide modal & cleanup
      document.getElementById('modal-student-password-otp')?.classList.add('hidden');
      document.getElementById('profile-dropdown-card')?.classList.add('hidden');
      const newPassInput = document.getElementById('pwd-change-new');
      const confirmPassInput = document.getElementById('pwd-change-confirm');
      if (newPassInput) newPassInput.value = '';
      if (confirmPassInput) confirmPassInput.value = '';
      this.pendingStudentPassword = null;
      if (deck) deck.reset();

      const formContainer = document.getElementById('student-pwd-form-container');
      if (formContainer) formContainer.classList.add('hidden');
      const toggleBtn = document.getElementById('btn-toggle-student-pwd');
      if (toggleBtn) toggleBtn.textContent = 'Update';

      // Redirect / refresh back to student dashboard
      if (window.App && typeof App.showStudentView === 'function') {
        App.showStudentView();
      }
      this.loadDashboard();

    } catch (err) {
      if (err.data?.error === 'PASSWORD_SAME_AS_LAST' || err.message?.includes('same as last password')) {
        alert("The password you entered is same as last password. Create new password");
        if (deck) deck.showError();
        return;
      }
      showToast(err.message || 'Failed to update password. Invalid or expired OTP.', 'error');
      if (deck) deck.showError();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText || '<i data-lucide="check" class="w-4 h-4"></i> Verify and Update Password';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  // Resend OTP in the new box
  async resendPasswordOtp() {
    try {
      const res = await API.post('/api/student/request-password-otp', {});
      showToast(res.message || 'Fresh OTP dispatched to your email!', 'success');
      const msgBox = document.getElementById('student-modal-otp-msg');
      if (msgBox) {
        const studentEmail = res.email || 'your registered email';
        msgBox.innerHTML = `
          <div class="flex items-center gap-2 font-bold text-slate-800">
            <i data-lucide="mail-check" class="w-4 h-4 text-[#bf6088]"></i> OTP dispatched to <strong>${studentEmail}</strong>
          </div>
          <p class="text-[11px] text-slate-600 mt-1">${res.message || 'Enter the 6-digit OTP code below to verify and complete password update.'}</p>
        `;
      }
      if (this.studentModalOtpDeck) {
        this.studentModalOtpDeck.reset();
        this.studentModalOtpDeck.focus();
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      showToast(err.message || 'Failed to resend verification OTP.', 'error');
    }
  }
};

window.StudentPortal = StudentPortal;
