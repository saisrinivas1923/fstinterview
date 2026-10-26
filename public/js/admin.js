// Admin Portal UI, Drilldown & Status Control - Future Sprint Technologies
const AdminPortal = {
  currentTab: 'students',
  selectedDomainFilter: 'all',
  studentSearchQuery: '',
  masterSearchQuery: '',
  masterStatusFilter: 'all',
  currentDrilldownStudentId: null,
  studentCurrentPage: 1,
  studentsPerPage: 5,
  loadedStudents: [],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Admin Sub-Tab Switchers
    const tabStudents = document.getElementById('admin-tab-btn-students');
    const tabMaster = document.getElementById('admin-tab-btn-master');
    const tabCourses = document.getElementById('admin-tab-btn-courses');
    const tabOverview = document.getElementById('admin-tab-btn-overview');

    if (tabStudents) tabStudents.addEventListener('click', () => this.switchTab('students'));
    if (tabMaster) tabMaster.addEventListener('click', () => this.switchTab('master'));
    if (tabCourses) tabCourses.addEventListener('click', () => this.switchTab('courses'));
    if (tabOverview) tabOverview.addEventListener('click', () => this.switchTab('overview'));

    // Student Search Input
    const studentSearchInput = document.getElementById('admin-student-search');
    if (studentSearchInput) {
      let timer;
      studentSearchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.studentSearchQuery = e.target.value.trim();
          this.studentCurrentPage = 1;
          this.loadStudents();
        }, 250);
      });
    }

    // Domain Filter Select
    const domainSelect = document.getElementById('admin-domain-filter');
    if (domainSelect) {
      domainSelect.addEventListener('change', (e) => {
        this.selectedDomainFilter = e.target.value;
        this.studentCurrentPage = 1;
        this.loadStudents();
      });
    }

    // Master Register Search
    const masterSearch = document.getElementById('admin-master-search');
    if (masterSearch) {
      let timer;
      masterSearch.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.masterSearchQuery = e.target.value.trim();
          this.loadMasterBook();
        }, 250);
      });
    }

    // Master Status Filter
    const masterStatus = document.getElementById('admin-master-status-filter') || document.getElementById('admin-master-status');
    if (masterStatus) {
      masterStatus.addEventListener('change', (e) => {
        this.masterStatusFilter = e.target.value;
        this.loadMasterBook();
      });
    }

    // CSV Export Button
    const btnExport = document.getElementById('btn-admin-export-csv');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCSV());
    }

    // Student Drilldown Modal close
    const btnCloseDrilldown = document.getElementById('btn-close-drilldown-modal');
    if (btnCloseDrilldown) {
      btnCloseDrilldown.addEventListener('click', () => this.closeStudentDrilldown());
    }

    // Add Course Form Submit
    const formAddCourse = document.getElementById('form-add-course');
    if (formAddCourse) {
      formAddCourse.addEventListener('submit', (e) => this.handleAddCourse(e));
    }

    // Admin Change Password Form & Triggers
    const formChangePwd = document.getElementById('form-admin-change-password');
    if (formChangePwd) {
      formChangePwd.addEventListener('submit', (e) => {
        e.preventDefault();
        this.verifyAdminNewPasswordAndOpenOtpModal();
      });
    }

    const ddBtnChangePwd = document.getElementById('admin-dd-btn-change-pwd');
    if (ddBtnChangePwd) {
      ddBtnChangePwd.addEventListener('click', () => this.openChangePasswordModal());
    }
  },

  switchTab(tab, pushState = true) {
    if (pushState && this.currentTab !== tab) {
      try {
        history.pushState({ view: 'portal', role: 'admin', tab }, '', '#admin-' + tab);
      } catch (e) {}
    }
    this.currentTab = tab;
    const views = {
      students: document.getElementById('admin-view-students'),
      master: document.getElementById('admin-view-master'),
      courses: document.getElementById('admin-view-courses'),
      overview: document.getElementById('admin-view-overview')
    };

    const btns = {
      students: document.getElementById('admin-tab-btn-students'),
      master: document.getElementById('admin-tab-btn-master'),
      courses: document.getElementById('admin-tab-btn-courses'),
      overview: document.getElementById('admin-tab-btn-overview')
    };

    Object.keys(views).forEach(key => {
      if (views[key]) views[key].classList.toggle('hidden', key !== tab);
      if (btns[key]) {
        if (key === tab) {
          btns[key].className = 'px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-[#d99a63] via-[#bf6088] to-[#8a6cc0] text-white shadow-md transition flex items-center gap-2 cursor-pointer';
        } else {
          btns[key].className = 'px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-2 cursor-pointer';
        }
      }
    });

    try {
      if (tab === 'students') this.loadStudents();
      if (tab === 'master') this.loadMasterBook();
      if (tab === 'courses') this.loadCourses();
      if (tab === 'overview') this.loadOverview();
    } catch (err) {
      console.error('Error loading tab content for ' + tab, err);
    }

    try {
      if (window.lucide) lucide.createIcons();
    } catch (e) {}
  },

  async loadDashboard() {
    const waBtn = document.getElementById('floating-whatsapp-btn');
    if (waBtn) waBtn.classList.add('hidden');
    await this.loadOverviewMetrics();
    this.switchTab(this.currentTab, false);
  },

  async loadOverviewMetrics() {
    try {
      const res = await API.get('/api/admin/overview');
      if (res.success) {
        const elStudents = document.getElementById('admin-stat-students');
        if (elStudents) elStudents.textContent = res.stats.totalStudents || 0;
        const elInterviews = document.getElementById('admin-stat-interviews');
        if (elInterviews) elInterviews.textContent = res.stats.totalInterviews || 0;
        const elAttended = document.getElementById('admin-stat-attended');
        if (elAttended) elAttended.textContent = res.stats.attended || 0;
        const elSelected = document.getElementById('admin-stat-selected');
        if (elSelected) elSelected.textContent = res.stats.placed_students !== undefined ? res.stats.placed_students : (res.stats.selected || 0);
        if (window.lucide) lucide.createIcons();
      }
    } catch (err) {
      console.error('Failed to load admin overview metrics:', err);
    }
  },

  // View by Domain Filter Handler
  filterByDomain(domain) {
    this.selectedDomainFilter = domain || 'all';
    this.studentCurrentPage = 1;

    // Synchronize select dropdown
    const select = document.getElementById('admin-domain-select');
    if (select) select.value = this.selectedDomainFilter;

    this.loadStudents();
  },

  renderDomainFilterControls(domains, currentCount) {
    this.availableDomains = domains || [];

    // Populate standard dropdown
    const select = document.getElementById('admin-domain-select');
    if (select) {
      let html = `<option value="all">All Domains (All Candidates)</option>`;
      this.availableDomains.forEach(d => {
        const isSel = (d.domain === this.selectedDomainFilter) ? 'selected' : '';
        html += `<option value="${d.domain.replace(/"/g, '&quot;')}" ${isSel}>${d.domain} (${d.count} candidates)</option>`;
      });
      select.innerHTML = html;
      select.value = this.selectedDomainFilter;
    }
  },

  // 1. Load Students Roster
  async loadStudents() {
    const container = document.getElementById('admin-students-table-body');
    const paginationContainer = document.getElementById('admin-students-pagination');
    if (!container) return;

    container.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center text-slate-400">
          <svg class="animate-spin h-6 w-6 mx-auto mb-2 text-[#8a6cc0]" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          Loading enrolled students from Future Sprint database...
        </td>
      </tr>
    `;

    try {
      const params = {};
      if (this.selectedDomainFilter !== 'all') params.domain = this.selectedDomainFilter;
      if (this.studentSearchQuery) params.search = this.studentSearchQuery;

      const res = await API.get('/api/admin/students', params);
      const students = res.students || [];
      this.loadedStudents = students;

      this.renderDomainFilterControls(res.domains, students.length);

      if (students.length === 0) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        const isDomainFiltered = this.selectedDomainFilter !== 'all';
        container.innerHTML = `
          <tr>
            <td colspan="6" class="py-12 text-center text-slate-500 bg-white">
              <i data-lucide="user-x" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
              <p class="font-bold text-slate-800">
                ${isDomainFiltered ? `No candidates found in domain "${this.selectedDomainFilter}"` : 'No candidates registered in database'}
              </p>
              <p class="text-xs text-slate-400 mt-1">
                ${isDomainFiltered ? 'Click below to reset filter and view all students.' : 'New students will appear here once they register.'}
              </p>
              ${isDomainFiltered ? `
                <button type="button" onclick="AdminPortal.filterByDomain('all')" class="mt-3 px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#8a6cc0] font-bold text-xs border border-purple-200 transition cursor-pointer">
                  Show All Domains
                </button>
              ` : ''}
            </td>
          </tr>
        `;
        if (window.lucide) lucide.createIcons({ root: container });
        return;
      }

      this.renderCurrentStudentPage();
    } catch (err) {
      if (paginationContainer) paginationContainer.innerHTML = '';
      container.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-rose-500 bg-rose-50 font-medium text-sm">
            Failed to load student roster: ${err.message || 'Server error'}
          </td>
        </tr>
      `;
    }
  },

  // Paginated Rendering for Student Directory (5 candidates per page)
  renderCurrentStudentPage() {
    const container = document.getElementById('admin-students-table-body');
    if (!container) return;

    const totalCount = (this.loadedStudents || []).length;
    const totalPages = Math.ceil(totalCount / this.studentsPerPage) || 1;

    if (this.studentCurrentPage > totalPages) this.studentCurrentPage = totalPages;
    if (this.studentCurrentPage < 1) this.studentCurrentPage = 1;

    const startIndex = (this.studentCurrentPage - 1) * this.studentsPerPage;
    const endIndex = Math.min(startIndex + this.studentsPerPage, totalCount);
    const pagedStudents = this.loadedStudents.slice(startIndex, endIndex);

    container.innerHTML = pagedStudents.map(st => this.renderStudentTableRow(st)).join('');
    if (window.lucide) lucide.createIcons({ root: container });

    this.renderStudentPagination(totalCount);
  },

  renderStudentPagination(totalCount) {
    const paginationContainer = document.getElementById('admin-students-pagination');
    if (!paginationContainer) return;

    if (!totalCount || totalCount <= 0) {
      paginationContainer.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(totalCount / this.studentsPerPage) || 1;
    const currentPage = this.studentCurrentPage;
    const startIndex = (currentPage - 1) * this.studentsPerPage;
    const endIndex = Math.min(startIndex + this.studentsPerPage, totalCount);

    // Build page buttons array
    let pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    const pageButtonsHtml = pages.map(p => {
      if (p === '...') {
        return `<span class="px-2 py-1 text-slate-400 select-none font-bold">...</span>`;
      }
      const isActive = (p === currentPage);
      if (isActive) {
        return `
          <button type="button" class="w-8 h-8 rounded-lg bg-gradient-to-r from-[#d99a63] via-[#bf6088] to-[#8a6cc0] text-white font-black text-xs shadow-xs flex items-center justify-center cursor-default">
            ${p}
          </button>
        `;
      }
      return `
        <button type="button" onclick="AdminPortal.goToStudentPage(${p})" class="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-[#8a6cc0] border border-slate-200 font-bold text-xs flex items-center justify-center transition cursor-pointer">
          ${p}
        </button>
      `;
    }).join('');

    paginationContainer.innerHTML = `
      <div class="flex items-center justify-center gap-1.5 flex-wrap mx-auto">
        <button type="button" onclick="AdminPortal.goToStudentPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} class="px-3 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
          <span>Prev</span>
        </button>
        <div class="flex items-center gap-1">
          ${pageButtonsHtml}
        </div>
        <button type="button" onclick="AdminPortal.goToStudentPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} class="px-3 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <span>Next</span>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    if (window.lucide) lucide.createIcons({ root: paginationContainer });
  },

  goToStudentPage(page) {
    const totalCount = (this.loadedStudents || []).length;
    const totalPages = Math.ceil(totalCount / this.studentsPerPage) || 1;
    if (page < 1 || page > totalPages) return;
    this.studentCurrentPage = page;
    this.renderCurrentStudentPage();
  },

  // Dynamic Status Badge Renderer
  renderStatusBadge(status) {
    const s = status || 'Pending Review';
    let badgeClass = 'status-waiting';
    let icon = 'clock';
    let label = s;

    if (s === 'Attended') {
      badgeClass = 'status-attended';
      icon = 'check-circle-2';
    } else if (s === 'Rejected') {
      badgeClass = 'status-rejected';
      icon = 'x-circle';
    } else if (s === 'On Hold') {
      badgeClass = 'status-on-hold';
      icon = 'pause-circle';
    } else if (s === 'Waiting for HR Response') {
      badgeClass = 'status-waiting-hr';
      icon = 'message-square';
    } else if (s === 'Selected') {
      badgeClass = 'status-selected';
      icon = 'award';
    } else if (s === 'Scheduled') {
      badgeClass = 'status-attended';
      icon = 'calendar';
    } else {
      badgeClass = 'status-waiting';
      icon = 'clock';
      label = 'Pending Review';
    }

    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeClass}">
      <i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${label}
    </span>`;
  },

  renderStudentTableRow(st) {
    const hasOffer = st.selected_interviews > 0;
    const cleanPhone = st.phone.replace(/[^0-9+]/g, '');

    return `
      <tr class="table-row-hover border-b border-slate-100 transition text-sm">
        <!-- Student Name (Clickable Drilldown) -->
        <td class="py-4 px-4 font-semibold text-slate-900">
          <button type="button" onclick="AdminPortal.openStudentDrilldown(${st.id})" class="flex items-center gap-3 text-left group cursor-pointer">
            <div class="w-10 h-10 rounded-2xl bg-purple-50 text-[#8a6cc0] font-bold flex items-center justify-center flex-shrink-0 group-hover:bg-[#8a6cc0] group-hover:text-white transition shadow-xs">
              ${st.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span class="group-hover:text-[#8a6cc0] group-hover:underline flex items-center gap-1.5 font-bold text-slate-900">
                ${st.name}
              </span>
              <span class="text-[11px] font-medium text-slate-400">Joined ${new Date(st.created_at).toLocaleDateString()}</span>
            </div>
          </button>
        </td>

        <!-- Contact (Email & Phone) -->
        <td class="py-4 px-4">
          <div class="flex flex-col gap-0.5">
            <a href="mailto:${st.email}" class="text-xs text-[#8a6cc0] hover:underline flex items-center gap-1 font-semibold">
              <i data-lucide="mail" class="w-3 h-3 text-slate-400"></i> ${st.email}
            </a>
            <div class="flex items-center gap-2 mt-0.5">
              <a href="tel:${cleanPhone}" class="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium">
                <i data-lucide="phone" class="w-3 h-3 text-slate-400"></i> ${st.phone}
              </a>
              <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" rel="noopener noreferrer" class="text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5" title="WhatsApp Student">
                <i data-lucide="message-circle" class="w-2.5 h-2.5"></i> WA
              </a>
            </div>
          </div>
        </td>

        <!-- Course Domain -->
        <td class="py-4 px-4">
          <span class="inline-block px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            ${st.domain}
          </span>
        </td>

        <!-- Total Interviews Count -->
        <td class="py-4 px-4 text-center">
          <div class="inline-flex items-center gap-1.5">
            <span class="font-extrabold text-slate-800 text-sm">${st.total_interviews}</span>
            ${hasOffer ? `
              <span class="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full" title="Offer Received!">
                🎉 ${st.selected_interviews} Offer
              </span>
            ` : ''}
          </div>
        </td>

        <!-- Latest Interview Status & Prominent Time Display -->
        <td class="py-4 px-4">
          ${st.latest_interview ? `
            <div class="text-xs space-y-1">
              <span class="font-bold text-slate-900 block">${st.latest_interview.company_name}</span>
              <span class="text-slate-500 font-medium block">Domain: ${st.latest_interview.role_title}</span>
              <div class="flex items-center gap-1.5 font-bold text-slate-800 flex-wrap">
                <span class="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200 flex-wrap">
                  📅 ${st.latest_interview.interview_date} ${st.latest_interview.is_rescheduled ? `<span class="text-amber-800 font-extrabold ml-1">(Rescheduled) Original: ${st.latest_interview.original_interview_date || '-'}</span>` : ''}
                </span>
                <span class="inline-flex items-center gap-1 bg-purple-50 text-[#8a6cc0] px-2 py-0.5 rounded-md text-[11px] font-extrabold border border-purple-100">
                  ⏰ ${st.latest_interview.interview_time || 'Time Not Set'}
                </span>
              </div>
              <div class="mt-1">
                ${this.renderStatusBadge(st.latest_interview.status)}
              </div>
              ${st.latest_interview.hr_mobile_number ? `
                <a href="tel:${st.latest_interview.hr_mobile_number}" class="text-[#8a6cc0] block hover:underline font-semibold text-[11px]">HR: ${st.latest_interview.hr_mobile_number}</a>
              ` : ''}
            </div>
          ` : `
            <span class="text-xs text-slate-400 italic">No interview logged yet</span>
          `}
        </td>

        <!-- Action Buttons: View History & Delete Account -->
        <td class="py-4 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="AdminPortal.openStudentDrilldown(${st.id})" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-[#8a6cc0] text-[#8a6cc0] hover:text-white text-xs font-bold transition shadow-xs" title="View Full History">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> View
            </button>
            <button onclick="AdminPortal.confirmDeleteStudent(${st.id}, '${st.name.replace(/'/g, "\\'")}')" class="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Delete Student Account">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  // 2. Drilldown: Click student's name to view their full profile & all interview history!
  async openStudentDrilldown(studentId, pushState = true) {
    if (pushState) {
      try {
        history.pushState({ view: 'portal', role: 'admin', tab: this.currentTab, modal: 'drilldown', studentId }, '', '#student-drilldown');
      } catch (e) {}
    }
    this.currentDrilldownStudentId = studentId;
    const modal = document.getElementById('modal-student-drilldown');
    const content = document.getElementById('drilldown-content');

    content.innerHTML = `
      <div class="py-16 text-center text-slate-400">
        <svg class="animate-spin h-7 w-7 mx-auto mb-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <p class="text-sm font-medium">Fetching complete interview history...</p>
      </div>
    `;

    modal.classList.remove('hidden');

    try {
      const res = await API.get(`/api/admin/students/${studentId}`);
      const { student, stats, interviews } = res;

      const cleanPhone = student.phone.replace(/[^0-9+]/g, '');

      content.innerHTML = `
        <!-- Top Action Bar (Close & Delete Student) -->
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <button onclick="AdminPortal.closeStudentDrilldown()" class="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition flex items-center gap-1.5 text-xs font-bold" title="Close Profile">
            <i data-lucide="x" class="w-5 h-5"></i>
            <span>Close</span>
          </button>
          <button onclick="AdminPortal.confirmDeleteStudent(${student.id}, '${student.name.replace(/'/g, "\\'")}')" class="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition shadow-xs" title="Delete this student account">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Delete Student Account
          </button>
        </div>

        <!-- Student Identity Header Card (High-Contrast Premium Theme) -->
        <div class="rounded-3xl p-5 sm:p-7 shadow-xl text-white relative overflow-hidden" style="background: var(--grad);">
          <!-- Top Row: Student Profile (Left) and Action Buttons (Right) -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div class="flex items-center gap-3.5 min-w-0">
              <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white font-extrabold text-2xl flex items-center justify-center shadow-lg border border-white/30 flex-shrink-0">
                ${student.name.charAt(0).toUpperCase()}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-xl sm:text-2xl font-black text-white font-heading tracking-tight truncate">${student.name}</h3>
                  <span class="inline-flex items-center gap-1 font-extrabold text-xs text-white bg-white/20 px-2.5 py-0.5 rounded-full border border-white/25 flex-shrink-0">
                    <i data-lucide="layers" class="w-3.5 h-3.5 text-white"></i> ${student.domain}
                  </span>
                </div>
                
                <div class="flex items-center gap-3 mt-1.5 text-xs font-semibold text-white/90 flex-wrap">
                  <a href="mailto:${student.email}" class="hover:text-white flex items-center gap-1.5 transition truncate max-w-[220px] sm:max-w-none">
                    <i data-lucide="mail" class="w-3.5 h-3.5 text-white/80 flex-shrink-0"></i> ${student.email}
                  </a>
                  <span class="text-white/40">•</span>
                  <a href="tel:${cleanPhone}" class="hover:text-white flex items-center gap-1.5 transition whitespace-nowrap">
                    <i data-lucide="phone" class="w-3.5 h-3.5 text-white/80 flex-shrink-0"></i> ${student.phone}
                  </a>
                </div>
              </div>
            </div>

            <!-- Quick Action Buttons (Always fits, never overflows) -->
            <div class="flex items-center gap-2.5 flex-wrap sm:flex-nowrap flex-shrink-0 mt-2 md:mt-0">
              <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md transition whitespace-nowrap">
                <i data-lucide="message-circle" class="w-4 h-4"></i> WhatsApp Student
              </a>
              <button onclick="AdminPortal.openAdminAddInterviewModal(${student.id})" class="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#bf6088] text-xs font-extrabold flex items-center gap-1.5 shadow-md transition whitespace-nowrap">
                <i data-lucide="plus" class="w-4 h-4"></i> Schedule Interview
              </button>
            </div>
          </div>

          <!-- Interview Stats Counters (High Contrast, Bold, Beautiful) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/20 text-center">
            <div class="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span class="text-white/80 text-xs font-semibold block">Total Logged</span>
              <span class="text-2xl font-black text-white mt-0.5 block font-heading">${stats.total}</span>
            </div>
            <div class="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span class="text-white/80 text-xs font-semibold block">Attended</span>
              <span class="text-2xl font-black text-indigo-100 mt-0.5 block font-heading">${stats.attended}</span>
            </div>
            <div class="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span class="text-white/80 text-xs font-semibold block">Waiting for HR</span>
              <span class="text-2xl font-black text-amber-200 mt-0.5 block font-heading">${stats.waiting_hr || 0}</span>
            </div>
            <div class="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span class="text-white/80 text-xs font-semibold block">Selected / Hired</span>
              <span class="text-2xl font-black text-emerald-300 mt-0.5 block font-heading">${stats.selected}</span>
            </div>
          </div>
        </div>

        <!-- Chronological Interview History Section with Admin Status Controller -->
        <div class="mt-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h4 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i data-lucide="history" class="w-5 h-5 text-[#8a6cc0]"></i>
                Interview History Recorded by Student (${interviews.length})
              </h4>
              <p class="text-xs text-slate-500">As Admin, review schedules, HR contact numbers, and update candidate statuses below.</p>
            </div>
            <span class="text-xs text-slate-500 font-semibold">Domain: ${student.domain}</span>
          </div>

          ${interviews.length === 0 ? `
            <div class="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200">
              <i data-lucide="calendar-x" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
              <p class="text-sm font-bold text-slate-700">No interviews logged yet</p>
              <p class="text-xs text-slate-500 mt-1">This student has not yet entered any interview schedules in their login.</p>
              <button onclick="AdminPortal.openAdminAddInterviewModal(${student.id})" class="mt-3 px-4 py-2 bg-[#8a6cc0] hover:bg-[#7859b0] text-white rounded-xl text-xs font-bold shadow-sm transition">
                Schedule First Interview Now
              </button>
            </div>
          ` : `
            <div class="space-y-4">
              ${interviews.map((inv, idx) => this.renderDrilldownInterviewItem(inv, idx, student.id)).join('')}
            </div>
          `}
        </div>
      `;

      if (window.lucide) lucide.createIcons({ root: content });
    } catch (err) {
      content.innerHTML = `
        <div class="p-8 text-center text-rose-500 bg-rose-50 rounded-2xl">
          Failed to load student history: ${err.message || 'Server error'}
        </div>
      `;
    }
  },

  renderDrilldownInterviewItem(inv, idx, studentId) {
    const isSelected = inv.status === 'Selected';
    const cleanHrPhone = inv.hr_mobile_number ? inv.hr_mobile_number.replace(/[^0-9+]/g, '') : null;

    return `
      <div class="bg-white rounded-3xl border ${isSelected ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'} p-5 shadow-sm transition">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 font-bold flex items-center justify-center flex-shrink-0">
              ${inv.company_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h5 class="text-base font-extrabold text-slate-900">${inv.company_name}</h5>
                ${this.renderStatusBadge(inv.status)}
              </div>
              <p class="text-xs font-semibold text-slate-600 mt-0.5">${inv.role_title}</p>
            </div>
          </div>

          <!-- Tab 1 is View-Only for Status (Status updates managed exclusively in Tab 2: Master Register) -->
          <div class="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            ${(() => {
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const isPastDate = inv.interview_date < todayStr;
              const isTerminalStatus = ['Selected', 'Attended', 'Rejected', 'Completed'].includes(inv.status);
              const isCompleted = isPastDate || isTerminalStatus;

              if (inv.reminder_sent_2h) {
                return `
                  <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200" title="2-Hour Office Arrival Reminder was sent to student">
                    <i data-lucide="bell-ring" class="w-3.5 h-3.5 text-emerald-600"></i> 2h Reminder Sent
                  </span>
                `;
              }
              if (isCompleted) {
                return `
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200" title="Interview already completed">
                    <i data-lucide="check-circle" class="w-3.5 h-3.5 text-slate-400"></i> Completed
                  </span>
                `;
              }
              return `
                <button onclick="AdminPortal.sendManualReminder(${inv.id}, '${(inv.company_name || '').replace(/'/g, "\\'")}', 'Student', ${studentId})" class="inline-flex items-center gap-1 text-[11px] font-bold text-[#8a6cc0] hover:text-[#6944a6] bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-xl border border-[rgba(138,108,192,0.25)] transition shadow-2xs" title="Send 2-Hour Institute Office Arrival Reminder Email Now">
                  <i data-lucide="bell" class="w-3.5 h-3.5"></i> Send 2h Office Reminder
                </button>
              `;
            })()}
            <button onclick="AdminPortal.adminDeleteInterview(${inv.id}, '${(inv.company_name || '').replace(/'/g, "\\'")}', ${studentId})" class="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Delete Interview Record">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
          <!-- Prominent Date & Time Display -->
          <div>
            <span class="text-slate-400 block text-[11px] font-bold">Interview Date & Time</span>
            <div class="flex items-center gap-1.5 mt-0.5 font-bold text-slate-800 flex-wrap">
              <span class="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex-wrap">
                📅 ${inv.interview_date} ${inv.is_rescheduled ? `<span class="text-amber-800 font-extrabold ml-1">(Rescheduled) Original: ${inv.original_interview_date || '-'}</span>` : ''}
              </span>
              <span class="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-extrabold border border-indigo-100">
                ⏰ ${inv.interview_time || 'Time Not Set'}
              </span>
            </div>
          </div>
          <div>
            <span class="text-slate-400 block text-[11px] font-bold">Round / Stage</span>
            <span class="font-bold text-slate-800">${inv.round_name || 'Technical'}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[11px] font-bold">Mode & Location</span>
            <span class="font-bold text-slate-800">${inv.interview_mode} ${inv.job_location ? `(${inv.job_location})` : ''}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[11px] font-bold">HR Mobile Number</span>
            ${cleanHrPhone ? `
              <div class="flex items-center gap-1 font-bold text-indigo-600 mt-0.5">
                <a href="tel:${cleanHrPhone}" class="hover:underline">${inv.hr_mobile_number}</a>
                <a href="https://wa.me/${cleanHrPhone.replace('+', '')}" target="_blank" class="px-1 bg-emerald-50 text-emerald-700 rounded text-[10px]" title="WhatsApp HR">WA</a>
              </div>
            ` : `
              <span class="text-slate-400 italic">Not provided</span>
            `}
          </div>
        </div>

        ${inv.salary_package ? `
          <div class="mt-2 text-xs flex items-center justify-between text-slate-600 pt-2 border-t border-slate-50">
            <span>Package Offered:</span>
            <span class="font-extrabold text-emerald-700">${inv.salary_package}</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  // Confirm and Delete Student Account
  async confirmDeleteStudent(studentId, studentName) {
    const confirmed = confirm(`Are you sure you want to permanently delete student account "${studentName}" and all their interview records?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    try {
      const res = await API.delete(`/api/admin/students/${studentId}`);
      showToast(res.message || 'Student account deleted successfully.', 'success');
      this.closeStudentDrilldown();
      this.loadStudents();
      this.loadOverviewMetrics();
    } catch (err) {
      showToast(err.message || 'Failed to delete student account.', 'error');
    }
  },

  // Admin Changes Interview Status
  async changeInterviewStatus(interviewId, newStatus, studentId = null) {
    try {
      const res = await API.put(`/api/admin/interviews/${interviewId}/status`, { status: newStatus });
      showToast(res.message || 'Status updated across website!', 'success');

      if (studentId || this.currentDrilldownStudentId) {
        this.openStudentDrilldown(studentId || this.currentDrilldownStudentId);
      }
      this.loadStudents();
      this.loadMasterBook();
      this.loadOverviewMetrics();
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
    }
  },

  // Update Student Profile Placement Status (Reflects to all students)
  async updatePlacementStatus(studentId, newStatus) {
    try {
      showToast(`Updating candidate status to "${newStatus}"...`, 'info');
      const res = await API.put(`/api/admin/students/${studentId}/placement-status`, {
        placement_status: newStatus
      });
      showToast(res.message || `Student marked as ${newStatus}!`, 'success', 4000);
      if (this.currentDrilldownStudentId === studentId) {
        this.openStudentDrilldown(studentId);
      }
      this.loadStudents();
      this.loadMasterBook();
      this.loadOverviewMetrics();
    } catch (err) {
      showToast(err.message || 'Failed to update placement status.', 'error');
    }
  },

  closeStudentDrilldown(fromPopstate = false) {
    const modal = document.getElementById('modal-student-drilldown');
    if (modal) modal.classList.add('hidden');
    this.currentDrilldownStudentId = null;
    if (!fromPopstate && window.location.hash === '#student-drilldown') {
      try {
        history.back();
      } catch (e) {}
    }
  },

  // 3. Digital Master Book
  async loadMasterBook() {
    const container = document.getElementById('admin-master-table-body');
    if (!container) return;

    container.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-400">
          <svg class="animate-spin h-6 w-6 mx-auto mb-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          Loading digital interview book...
        </td>
      </tr>
    `;

    try {
      const params = {};
      if (this.masterSearchQuery) params.search = this.masterSearchQuery;
      if (this.masterStatusFilter !== 'all') params.status = this.masterStatusFilter;

      const res = await API.get('/api/admin/interviews', params);
      const interviews = res.interviews || [];

      if (interviews.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="7" class="py-12 text-center text-slate-500 bg-white">
              <i data-lucide="book-open" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
              <p class="font-bold text-slate-700">No interview records found</p>
            </td>
          </tr>
        `;
        if (window.lucide) lucide.createIcons({ root: container });
        return;
      }

      // Group interviews based on system date
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayDateStr = `${year}-${month}-${day}`;

      const todayInterviews = interviews.filter(inv => inv.interview_date === todayDateStr);
      const previousInterviews = interviews.filter(inv => inv.interview_date !== todayDateStr);

      // Sort previous interviews by date descending (most recent first)
      previousInterviews.sort((a, b) => (b.interview_date || '').localeCompare(a.interview_date || '') || (b.id - a.id));

      const renderRow = (inv, isToday = false) => {
        const cleanHrPhone = inv.hr_mobile_number ? inv.hr_mobile_number.replace(/[^0-9+]/g, '') : null;

        return `
          <tr class="table-row-hover border-b border-slate-100 text-sm ${isToday ? 'bg-amber-50/35 hover:bg-amber-50/65' : ''}">
            <td class="py-3 px-4 font-semibold text-slate-900">
              <button onclick="AdminPortal.openStudentDrilldown(${inv.student_id})" class="text-[#8a6cc0] hover:underline flex items-center gap-1 font-bold">
                ${inv.student_name}
              </button>
              <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span class="text-xs text-slate-400">${inv.student_domain}</span>
                ${(inv.student_placement_status === 'Placed' || inv.status === 'Selected') ? `
                  <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    🎉 Placed
                  </span>
                ` : `
                  <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    ⚡ In Training
                  </span>
                `}
              </div>
            </td>
            <td class="py-3 px-4">
              <span class="font-bold text-slate-900 block">${inv.company_name}</span>
              <span class="text-xs text-slate-500">${inv.role_title}</span>
            </td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-800">
              <div class="inline-flex items-center gap-1 ${isToday ? 'bg-amber-100 text-amber-900 font-extrabold border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'} px-2 py-0.5 rounded border shadow-2xs flex-wrap">
                📅 ${inv.interview_date} ${inv.is_rescheduled ? `<span class="text-amber-800 font-extrabold ml-1">(Rescheduled) Original: ${inv.original_interview_date || '-'}</span>` : ''} ${isToday ? '• TODAY' : ''}
              </div>
              <div class="inline-flex items-center gap-1 bg-purple-50 text-[#8a6cc0] px-2 py-0.5 rounded font-bold border border-purple-100 mt-1">
                ⏰ ${inv.interview_time || 'Time Not Set'}
              </div>
              <div class="mt-1.5">
                ${(() => {
                  const now = new Date();
                  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  const isPastDate = inv.interview_date < todayStr;
                  const isTerminalStatus = ['Selected', 'Attended', 'Rejected', 'Completed'].includes(inv.status);
                  const isCompleted = isPastDate || isTerminalStatus;

                  if (inv.reminder_sent_2h) {
                    return `
                      <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200" title="2-Hour Institute Office Arrival Reminder was sent to student">
                        <i data-lucide="bell-ring" class="w-3 h-3 text-emerald-600"></i> 2h Reminder Sent
                      </span>
                    `;
                  }
                  if (isCompleted) {
                    return `
                      <span class="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200" title="Interview completed">
                        <i data-lucide="check" class="w-3 h-3 text-slate-400"></i> Completed
                      </span>
                    `;
                  }
                  return `
                    <button onclick="AdminPortal.sendManualReminder(${inv.id}, '${(inv.company_name || '').replace(/'/g, "\\'")}', '${(inv.student_name || '').replace(/'/g, "\\'")}')" class="inline-flex items-center gap-1 text-[10px] font-bold text-[#8a6cc0] hover:text-[#6944a6] bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md border border-[rgba(138,108,192,0.25)] transition shadow-2xs" title="Send 2-Hour Institute Office Arrival Reminder Email Now">
                      <i data-lucide="bell" class="w-3 h-3"></i> Send 2h Reminder
                    </button>
                  `;
                })()}
              </div>
            </td>
            <td class="py-3 px-4 text-xs text-slate-600">
              <span class="font-bold text-slate-800 block">${inv.round_name || 'Interview'}</span>
              <span class="text-slate-400">${inv.interview_mode}</span>
            </td>
            <td class="py-3 px-4 text-xs font-semibold">
              ${cleanHrPhone ? `
                <a href="tel:${cleanHrPhone}" class="text-[#8a6cc0] hover:underline font-bold">${inv.hr_mobile_number}</a>
              ` : '<span class="text-slate-400 italic">-</span>'}
            </td>
            <td class="py-3 px-4">
              <!-- Single Status Updater Tab for Admin -->
              <select onchange="AdminPortal.changeInterviewStatus(${inv.id}, this.value, ${inv.student_id})" class="text-xs font-bold px-2 py-1.5 rounded-lg border border-[rgba(138,108,192,0.25)] bg-white text-slate-800 shadow-xs focus:ring-2 focus:ring-[#8a6cc0]">
                ${inv.status === 'Waiting for Admin Approval' ? '<option value="" disabled selected>Select Status...</option>' : ''}
                <option value="Attended" ${inv.status === 'Attended' ? 'selected' : ''}>✅ Attended</option>
                <option value="Selected" ${inv.status === 'Selected' ? 'selected' : ''}>🎉 Selected / Placed</option>
                <option value="Waiting for HR Response" ${inv.status === 'Waiting for HR Response' ? 'selected' : ''}>💬 Waiting for HR</option>
                <option value="On Hold" ${inv.status === 'On Hold' ? 'selected' : ''}>⏸️ On Hold</option>
                <option value="Rejected" ${inv.status === 'Rejected' ? 'selected' : ''}>❌ Rejected</option>
              </select>
            </td>
            <td class="py-3 px-4 text-right">
              <button onclick="AdminPortal.openStudentDrilldown(${inv.student_id})" class="px-2.5 py-1 text-xs font-bold text-[#8a6cc0] hover:bg-purple-50 rounded-lg">
                Details
              </button>
            </td>
          </tr>
        `;
      };

      let html = '';

      // 1. Line: Today's Interviews at top
      html += `
        <tr class="bg-gradient-to-r from-amber-500/15 via-[#bf6088]/15 to-purple-500/15 border-y-2 border-[#bf6088]">
          <td colspan="7" class="py-2.5 px-4 font-heading">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="flex h-2.5 w-2.5 relative">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span class="font-extrabold text-xs sm:text-sm text-slate-900 tracking-wide uppercase">
                  Today's Interviews
                </span>
                <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#bf6088] text-white shadow-xs">
                  ${todayInterviews.length} Scheduled Today
                </span>
              </div>
              <div class="text-[11px] font-bold text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-[rgba(138,108,192,0.2)]">
                Date: <strong class="text-[#8a6cc0]">${todayDateStr}</strong>
              </div>
            </div>
          </td>
        </tr>
      `;

      if (todayInterviews.length > 0) {
        html += todayInterviews.map(inv => renderRow(inv, true)).join('');
      } else {
        html += `
          <tr class="border-b border-slate-100 bg-amber-50/20">
            <td colspan="7" class="py-4 px-4 text-center text-xs font-medium text-slate-500">
              <span class="italic">No candidate interviews scheduled for today (${todayDateStr}). All records shown below under Previous Interviews.</span>
            </td>
          </tr>
        `;
      }

      // 2. Line: Previous Interviews under Today's Interviews
      html += `
        <tr class="bg-slate-100/95 border-y border-slate-300">
          <td colspan="7" class="py-2.5 px-4 font-heading">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i data-lucide="history" class="w-4 h-4 text-slate-600"></i>
                <span class="font-bold text-xs sm:text-sm text-slate-800 tracking-wide uppercase">
                  Previous Interviews
                </span>
                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                  ${previousInterviews.length} Records
                </span>
              </div>
              <span class="text-[11px] text-slate-500 font-semibold hidden sm:inline">Date: ${todayDateStr}</span>
            </div>
          </td>
        </tr>
      `;

      if (previousInterviews.length > 0) {
        html += previousInterviews.map(inv => renderRow(inv, false)).join('');
      } else {
        html += `
          <tr>
            <td colspan="7" class="py-6 px-4 text-center text-xs text-slate-400">
              No previous interviews recorded in database.
            </td>
          </tr>
        `;
      }

      container.innerHTML = html;

      if (window.lucide) lucide.createIcons({ root: container });
    } catch (err) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-rose-500 bg-rose-50">
            Failed to load master book: ${err.message || 'Server error'}
          </td>
        </tr>
      `;
    }
  },

  // 4. Courses Management
  async loadCourses() {
    const container = document.getElementById('admin-courses-grid');
    if (!container) return;

    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <svg class="animate-spin h-6 w-6 mx-auto mb-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        Loading Future Sprint Technologies course catalog...
      </div>
    `;

    try {
      const res = await API.get('/api/courses');
      const courses = res.courses || [];

      if (courses.length === 0) {
        container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-500">No courses defined yet.</div>`;
        return;
      }

      container.innerHTML = courses.map(c => `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm card-hover course-card">
          <div class="flex items-start justify-between gap-3 mb-2">
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700">
              ${c.category}
            </span>
            <span class="text-xs font-bold text-slate-500 flex items-center gap-1">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-indigo-500"></i> ${c.duration}
            </span>
          </div>

          <h4 class="text-lg font-extrabold text-slate-900 mb-2">${c.title}</h4>
          <p class="text-xs text-slate-600 mb-4 leading-relaxed">${c.description || ''}</p>

          <div class="p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-100 text-xs">
            <span class="font-bold text-slate-700 block mb-1">Tech Stack Covered:</span>
            <span class="text-slate-600">${c.technologies}</span>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <span class="text-slate-500 font-semibold">Enrolled Students:</span>
            <span class="font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg text-sm">
              ${c.student_count || 0}
            </span>
          </div>
        </div>
      `).join('');

      if (window.lucide) lucide.createIcons({ root: container });
    } catch (err) {
      container.innerHTML = `<div class="col-span-full p-6 text-center text-rose-500">Failed to load courses.</div>`;
    }
  },

  async handleAddCourse(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    const title = form.querySelector('[name="course_title"]').value.trim();
    const category = form.querySelector('[name="course_category"]').value.trim();
    const duration = form.querySelector('[name="course_duration"]').value.trim();
    const technologies = form.querySelector('[name="course_technologies"]').value.trim();
    const description = form.querySelector('[name="course_description"]').value.trim();

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Adding Course...';

      await API.post('/api/courses', { title, category, duration, technologies, description });
      showToast('New course added to Future Sprint catalog!', 'success');
      form.reset();
      document.getElementById('modal-add-course').classList.add('hidden');
      this.loadCourses();
    } catch (err) {
      showToast(err.message || 'Failed to add course.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create Course';
    }
  },

  // 5. Load Detailed Analytics (Circular Dashboard Hub)
  async loadOverview() {
    try {
      const res = await API.get('/api/admin/overview');
      if (!res.success) return;
      this.renderCircularDashboard(res);
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    }
  },

  renderCircularDashboard(res) {
    const root = document.getElementById('circular-dashboard-root');
    if (!root) return;

    const stats = res.stats || {};
    const totalStudents = stats.totalStudents || 0;
    const totalInterviews = stats.totalInterviews || 0;
    const selected = stats.placed_students !== undefined ? stats.placed_students : (stats.selected || 0);
    const attended = stats.attended || 0;
    const onHold = stats.on_hold || 0;
    const waitingHr = stats.waiting_hr || 0;
    const waitingApproval = stats.waiting_approval || 0;
    const scheduled = stats.scheduled || 0;
    const rejected = stats.rejected || 0;
    const inPipeline = waitingHr + onHold + waitingApproval + scheduled;

    // Rates calculation
    const placementRate = totalStudents > 0 ? Math.round((selected / totalStudents) * 100) : (totalInterviews > 0 ? Math.round((selected / totalInterviews) * 100) : 0);
    const attendedRate = totalInterviews > 0 ? Math.round((attended / totalInterviews) * 100) : 0;
    const pipelineRate = totalInterviews > 0 ? Math.round((inPipeline / totalInterviews) * 100) : 0;
    const clearanceRate = totalInterviews > 0 ? Math.round(((selected + attended) / totalInterviews) * 100) : 0;

    // 3D Holographic Donut/Pie Chart Geometry & Slices
    const pieRadius = 80;
    const cPie = 2 * Math.PI * pieRadius; // ~502.65
    const pieSum = (selected > 0 || attended > 0 || inPipeline > 0) ? (selected + attended + inPipeline) : 0;

    let pieSlicesSvg = '';
    if (pieSum > 0) {
      const fPlacement = selected / pieSum;
      const fAttended = attended / pieSum;
      const fPipeline = inPipeline / pieSum;

      // Small gap between segments if multiple slices exist
      const activeCount = (selected > 0 ? 1 : 0) + (attended > 0 ? 1 : 0) + (inPipeline > 0 ? 1 : 0);
      const gap = activeCount > 1 ? 7 : 0;

      const dashPlacement = Math.max(0, fPlacement * cPie - gap);
      const dashAttended = Math.max(0, fAttended * cPie - gap);
      const dashPipeline = Math.max(0, fPipeline * cPie - gap);

      const rotPlacement = -90;
      const rotAttended = -90 + (fPlacement * 360);
      const rotPipeline = -90 + ((fPlacement + fAttended) * 360);

      pieSlicesSvg = `
        <!-- Base Track -->
        <circle cx="120" cy="120" r="${pieRadius}" fill="none" stroke="#f1f5f9" stroke-width="20"/>

        ${selected > 0 ? `
          <!-- Placement Slice (Emerald Gradient) -->
          <circle cx="120" cy="120" r="${pieRadius}" fill="none" stroke="url(#pieGradPlacement)" stroke-width="20"
            stroke-linecap="round" stroke-dasharray="${dashPlacement} ${cPie}" stroke-dashoffset="0"
            transform="rotate(${rotPlacement} 120 120)"
            class="donut-slice-glow-emerald transition-all duration-1000 ease-out"/>
        ` : ''}

        ${attended > 0 ? `
          <!-- Attended Slice (Tech Violet / Rose Gradient) -->
          <circle cx="120" cy="120" r="${pieRadius}" fill="none" stroke="url(#pieGradAttended)" stroke-width="20"
            stroke-linecap="round" stroke-dasharray="${dashAttended} ${cPie}" stroke-dashoffset="0"
            transform="rotate(${rotAttended} 120 120)"
            class="donut-slice-glow-purple transition-all duration-1000 ease-out"/>
        ` : ''}

        ${inPipeline > 0 ? `
          <!-- Pipeline Slice (Radiant Sunburst Amber Gradient) -->
          <circle cx="120" cy="120" r="${pieRadius}" fill="none" stroke="url(#pieGradPipeline)" stroke-width="20"
            stroke-linecap="round" stroke-dasharray="${dashPipeline} ${cPie}" stroke-dashoffset="0"
            transform="rotate(${rotPipeline} 120 120)"
            class="donut-slice-glow-amber transition-all duration-1000 ease-out"/>
        ` : ''}
      `;
    } else {
      // 0 Records / Standby: High-Tech Multi-Color Holographic Ambient Radar Ring
      pieSlicesSvg = `
        <!-- Background Track -->
        <circle cx="120" cy="120" r="${pieRadius}" fill="none" stroke="#f1f5f9" stroke-width="20"/>
        <!-- Ambient Glowing Standby Arc with Multi-Color Pulse -->
        <circle cx="120" cy="120" r="${pieRadius}" fill="none" stroke="url(#hologramStandbyGrad)" stroke-width="20"
          stroke-linecap="round" stroke-dasharray="${cPie * 0.72} ${cPie}" stroke-dashoffset="0"
          transform="rotate(-90 120 120)"
          class="donut-standby-glow transition-all duration-1000 ease-out"/>
      `;
    }

    // Domain Distribution Donut Calculation with Interactive Dragging Leader Lines
    const domains = res.domainStats || [];
    const domainTotal = domains.reduce((sum, d) => sum + d.count, 0) || 1;
    const domainColors = ['#bf6088', '#8a6cc0', '#d99a63', '#10b981', '#3b82f6', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16'];

    // Donut geometry: enlarged circle (radius 85, stroke 26, outer radius 98, viewBox 540x320)
    const cx = 240;
    const cy = 160;
    const r = 85;
    const rOuter = 98;
    const cDonut = 534.07;
    let accumulatedAngle = 0;

    const slicesData = domains.map((d, i) => {
      const pct = (d.count / domainTotal);
      const pctInt = Math.round(pct * 100);
      const dash = pct * cDonut;
      const color = domainColors[i % domainColors.length];
      const rotation = accumulatedAngle * 360 - 90;

      // Mid-angle for leader line
      const midAngleDeg = (accumulatedAngle + pct / 2) * 360 - 90;
      const midAngleRad = midAngleDeg * (Math.PI / 180);
      accumulatedAngle += pct;

      // Point 1 on outer arc of slice
      const x1 = Math.round(cx + (rOuter + 4) * Math.cos(midAngleRad));
      const y1 = Math.round(cy + (rOuter + 4) * Math.sin(midAngleRad));

      // Point 2: Knee elbow extending outward
      const x2 = Math.round(cx + (rOuter + 30) * Math.cos(midAngleRad));
      const y2 = Math.round(cy + (rOuter + 30) * Math.sin(midAngleRad));

      // Point 3: Horizontal leader line dragging beside the circle
      const isRight = Math.cos(midAngleRad) >= 0;
      const x3 = isRight ? Math.min(515, Math.max(x2 + 35, 395)) : Math.max(25, Math.min(x2 - 35, 85));
      const anchor = isRight ? 'start' : 'end';
      const textX = isRight ? x3 + 8 : x3 - 8;
      const textY1 = y2 - 5;
      const textY2 = y2 + 13;

      return {
        domain: d.domain,
        count: d.count,
        pctInt,
        dash,
        color,
        rotation,
        x1, y1, x2, y2, x3,
        anchor,
        textX, textY1, textY2,
        index: i
      };
    });

    const donutSlicesSvg = slicesData.map(s => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="26"
        stroke-dasharray="${s.dash} ${cDonut}" stroke-dashoffset="0"
        transform="rotate(${s.rotation} ${cx} ${cy})"
        stroke-linecap="${slicesData.length === 1 ? 'round' : 'butt'}"
        class="domain-donut-slice transition-all duration-300 cursor-pointer"
        data-domain="${s.domain.replace(/"/g, '&quot;')}"
        data-count="${s.count}"
        data-pct="${s.pctInt}"
        data-color="${s.color}"
        data-x1="${s.x1}" data-y1="${s.y1}"
        data-x2="${s.x2}" data-y2="${s.y2}"
        data-x3="${s.x3}" data-y3="${s.y2}"
        data-anchor="${s.anchor}"
        data-textx="${s.textX}" data-texty1="${s.textY1}" data-texty2="${s.textY2}"
        data-idx="${s.index}"
      />
    `).join('');

    root.innerHTML = `
      <!-- Circular Dashboard Hero Command Hub -->
      <div class="glass-panel p-6 sm:p-8 relative overflow-hidden">
        
        <div class="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[rgba(138,108,192,0.15)]">
          <div>
            <h3 class="text-xl sm:text-2xl font-black text-slate-900 font-heading tracking-tight">
              Institutional Placement & Interview Analytics across Technical Streams
            </h3>
          </div>
        </div>

        <!-- Master Circular Hub & Radial Breakdown -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-6">
          
          <!-- 3D Holographic Placement Donut Core Hub (Left/Center) -->
          <div class="lg:col-span-5 bg-gradient-to-b from-white/95 to-purple-50/25 backdrop-blur-xl rounded-3xl border border-[rgba(138,108,192,0.22)] p-6 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
            
            <div class="w-full flex items-center justify-between mb-2">
              <h4 class="text-sm font-extrabold text-slate-800 font-heading flex items-center gap-1.5">
                <i data-lucide="pie-chart" class="w-4 h-4 text-[#bf6088]"></i> Placement Analytics Hub
              </h4>
            </div>

            <!-- 3D Holographic Donut Chart Canvas -->
            <div class="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center my-1">
              <svg class="w-full h-full transform" viewBox="0 0 240 240">
                <defs>
                  <!-- Placement Emerald Gradient -->
                  <linearGradient id="pieGradPlacement" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#34d399"/>
                    <stop offset="50%" stop-color="#10b981"/>
                    <stop offset="100%" stop-color="#059669"/>
                  </linearGradient>

                  <!-- Attended Violet/Rose Gradient -->
                  <linearGradient id="pieGradAttended" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f472b6"/>
                    <stop offset="50%" stop-color="#bf6088"/>
                    <stop offset="100%" stop-color="#8a6cc0"/>
                  </linearGradient>

                  <!-- Pipeline Sunburst Amber Gradient -->
                  <linearGradient id="pieGradPipeline" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fde047"/>
                    <stop offset="50%" stop-color="#fbbf24"/>
                    <stop offset="100%" stop-color="#d97706"/>
                  </linearGradient>

                  <!-- Holographic Standby Ambient Multi-Color Gradient -->
                  <linearGradient id="hologramStandbyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#10b981"/>
                    <stop offset="35%" stop-color="#8a6cc0"/>
                    <stop offset="70%" stop-color="#bf6088"/>
                    <stop offset="100%" stop-color="#f59e0b"/>
                  </linearGradient>

                  <!-- Center Hub Drop Shadow -->
                  <filter id="coreHubShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#8a6cc0" flood-opacity="0.15"/>
                  </filter>
                </defs>

                <!-- Outer Tech Radar Dotted Ring -->
                <circle cx="120" cy="120" r="105" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="3 7" class="donut-hud-ring opacity-60"/>

                <!-- Cardinal Crosshair Notches -->
                <line x1="120" y1="8" x2="120" y2="15" stroke="#8a6cc0" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
                <line x1="120" y1="225" x2="120" y2="232" stroke="#8a6cc0" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
                <line x1="8" y1="120" x2="15" y2="120" stroke="#8a6cc0" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
                <line x1="225" y1="120" x2="232" y2="120" stroke="#8a6cc0" stroke-width="2" stroke-linecap="round" opacity="0.6"/>

                <!-- Donut Slices (or Standby Ambient Arc) -->
                ${pieSlicesSvg}

                <!-- Central Floating Frosted Core Disc -->
                <circle cx="120" cy="120" r="56" fill="#ffffff" filter="url(#coreHubShadow)"/>
                <circle cx="120" cy="120" r="56" fill="none" stroke="rgba(138, 108, 192, 0.18)" stroke-width="1.5"/>
              </svg>

              <!-- Central Metric Overlay -->
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                <span class="text-4xl font-black bg-gradient-to-r from-slate-900 via-[#8a6cc0] to-slate-900 bg-clip-text text-transparent font-heading tracking-tight leading-none">
                  ${placementRate}%
                </span>
                <span class="text-[10px] font-extrabold uppercase tracking-widest text-[#8a6cc0] mt-1.5 px-2.5 py-0.5 rounded-full bg-purple-50/90 border border-purple-200/80 shadow-2xs font-heading">
                  Placement Rate
                </span>
              </div>
            </div>

            <!-- 3D Interactive Segment Metric Cards -->
            <div class="grid grid-cols-3 gap-2.5 w-full mt-3">
              
              <!-- Placement Metric Chip -->
              <div class="bg-white/90 hover:bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-2.5 text-center transition-all duration-300 hover:scale-105 shadow-2xs group cursor-default">
                <div class="flex items-center justify-center gap-1 text-[11px] font-extrabold text-emerald-700 uppercase tracking-wide">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Placement
                </div>
                <div class="text-base font-black text-slate-900 font-heading mt-0.5">
                  ${placementRate}%
                </div>
                <div class="text-[10px] font-bold text-emerald-600 font-mono">
                  ${selected} Offers
                </div>
              </div>

              <!-- Attended Metric Chip -->
              <div class="bg-white/90 hover:bg-purple-50/80 border border-purple-200/80 rounded-2xl p-2.5 text-center transition-all duration-300 hover:scale-105 shadow-2xs group cursor-default">
                <div class="flex items-center justify-center gap-1 text-[11px] font-extrabold text-[#8a6cc0] uppercase tracking-wide">
                  <span class="w-2 h-2 rounded-full bg-[#8a6cc0]"></span>
                  Attended
                </div>
                <div class="text-base font-black text-slate-900 font-heading mt-0.5">
                  ${attendedRate}%
                </div>
                <div class="text-[10px] font-bold text-[#8a6cc0] font-mono">
                  ${attended} Cleared
                </div>
              </div>

              <!-- Pipeline Metric Chip -->
              <div class="bg-white/90 hover:bg-amber-50/80 border border-amber-200/80 rounded-2xl p-2.5 text-center transition-all duration-300 hover:scale-105 shadow-2xs group cursor-default">
                <div class="flex items-center justify-center gap-1 text-[11px] font-extrabold text-amber-700 uppercase tracking-wide">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  In Pipeline
                </div>
                <div class="text-base font-black text-slate-900 font-heading mt-0.5">
                  ${pipelineRate}%
                </div>
                <div class="text-[10px] font-bold text-amber-600 font-mono">
                  ${inPipeline} Active
                </div>
              </div>

            </div>

          </div>

          <!-- Radial KPI Cards Matrix (Right) -->
          <div class="lg:col-span-7 grid grid-cols-2 sm:grid-cols-2 gap-4">
            
            <!-- Circular Card 1: Students Enrolled -->
            <div class="bg-white/80 p-5 rounded-3xl border border-[rgba(138,108,192,0.18)] shadow-sm hover:shadow-md transition relative overflow-hidden group">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Registered Students</span>
                  <span class="text-3xl font-extrabold text-slate-900 font-heading block mt-1">${totalStudents}</span>
                  <span class="text-[11px] font-semibold text-purple-600 mt-0.5 block">Active Talent Pool</span>
                </div>
                <div class="w-14 h-14 rounded-2xl bg-purple-50 text-[#8a6cc0] flex items-center justify-center font-bold shadow-xs flex-shrink-0 group-hover:scale-110 transition-transform">
                  <i data-lucide="users" class="w-7 h-7"></i>
                </div>
              </div>
            </div>

            <!-- Circular Card 2: Interviews Conducted -->
            <div class="bg-white/80 p-5 rounded-3xl border border-[rgba(138,108,192,0.18)] shadow-sm hover:shadow-md transition relative overflow-hidden group">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Interviews</span>
                  <span class="text-3xl font-extrabold text-slate-900 font-heading block mt-1">${totalInterviews}</span>
                  <span class="text-[11px] font-semibold text-indigo-600 mt-0.5 block">${attended} Attended</span>
                </div>
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs flex-shrink-0 group-hover:scale-110 transition-transform">
                  <i data-lucide="calendar-check-2" class="w-7 h-7"></i>
                </div>
              </div>
            </div>

            <!-- Circular Card 3: Selected / Placed -->
            <div class="bg-white/80 p-5 rounded-3xl border border-emerald-200/80 shadow-sm hover:shadow-md transition relative overflow-hidden group">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Offers & Placed</span>
                  <span class="text-3xl font-extrabold text-emerald-700 font-heading block mt-1">${selected}</span>
                  <span class="text-[11px] font-semibold text-emerald-600 mt-0.5 block">Success Stories</span>
                </div>
                <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs flex-shrink-0 group-hover:scale-110 transition-transform">
                  <i data-lucide="award" class="w-7 h-7"></i>
                </div>
              </div>
            </div>

            <!-- Circular Card 4: Attended Interviews -->
            <div class="bg-white/80 p-5 rounded-3xl border border-[rgba(138,108,192,0.18)] shadow-sm hover:shadow-md transition relative overflow-hidden group">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-bold text-[#8a6cc0] uppercase tracking-wider block">Attended Interviews</span>
                  <span class="text-3xl font-extrabold text-slate-900 font-heading block mt-1">${attended}</span>
                  <span class="text-[11px] font-semibold text-[#bf6088] mt-0.5 block">Completed Rounds</span>
                </div>
                <div class="w-14 h-14 rounded-2xl bg-purple-50 text-[#8a6cc0] flex items-center justify-center font-bold shadow-xs flex-shrink-0 group-hover:scale-110 transition-transform">
                  <i data-lucide="check-circle-2" class="w-7 h-7"></i>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Placements in Each Domain -->
      <div class="bg-white rounded-3xl border border-[rgba(138,108,192,0.2)] p-6 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-base font-extrabold text-slate-900 flex items-center gap-2 font-heading">
            <i data-lucide="layers" class="w-5 h-5 text-[#bf6088]"></i> Placements in Each Domain
          </h4>
          <span class="text-xs text-slate-400 font-bold">${domains.length} Active Streams</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${domains.length === 0 ? `
            <div class="col-span-full py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p class="text-xs">No domain placement records registered yet.</p>
            </div>
          ` : domains.map((d, idx) => {
            const placed = d.placed_count || 0;
            const total = d.count || 0;
            const percent = total > 0 ? Math.round((placed / total) * 100) : 0;
            const gradId = `admin-gauge-grad-${idx}`;
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
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#f1ecfa" stroke-width="7"/>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="url(#${gradId})" stroke-width="7"
                      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
                      class="transition-all duration-1000 ease-out"/>
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span class="text-xs font-black text-slate-900 font-heading leading-none">${percent}%</span>
                    <span class="text-[9px] font-bold text-slate-400 mt-0.5">${placed}/${total}</span>
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-1">
                    <span class="w-2 h-2 rounded-full ${placed > 0 ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-heading">
                      ${placed > 0 ? 'Verified Placed' : 'In Training'}
                    </span>
                  </div>
                  <h5 class="text-xs font-black text-slate-900 font-heading truncate mb-1" title="${d.domain}">
                    ${d.domain}
                  </h5>
                  <div class="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                    <span class="bg-purple-50 text-[#8a6cc0] px-2 py-0.5 rounded-md font-bold">
                      ${placed} Placed
                    </span>
                    <span>${total} Enrolled</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Bottom Grid: Circular Domain Donut Wheel & Top Recruiters Radar -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Interactive Domain Distribution Wheel with Dragging Leader Line (7 Cols) -->
        <div class="lg:col-span-7 bg-white rounded-3xl border border-[rgba(138,108,192,0.2)] p-6 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between mb-2">
            <div>
              <h4 class="text-base font-extrabold text-slate-900 flex items-center gap-2 font-heading">
                <i data-lucide="pie-chart" class="w-5 h-5 text-[#bf6088]"></i> Domain Distribution Diagram
              </h4>
              <p class="text-xs text-slate-500 mt-0.5">Place cursor on any color arc to drag leader line showing domain name</p>
            </div>
            <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 text-[#8a6cc0] border border-purple-100">
              ${domains.length} Technical Streams
            </span>
          </div>

          <!-- Enlarged Interactive SVG Container -->
          <div class="relative py-2 overflow-visible flex items-center justify-center">
            ${domains.length === 0 ? `
              <div class="py-16 text-center text-slate-400">
                <i data-lucide="pie-chart" class="w-10 h-10 mx-auto mb-2 text-slate-300"></i>
                <p class="text-xs font-semibold">No student domain records registered yet.</p>
              </div>
            ` : `
              <svg id="domain-distribution-svg" class="w-full max-w-xl mx-auto h-72 sm:h-80 select-none overflow-visible" viewBox="0 0 540 320">
                <defs>
                  <filter id="donut-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#8a6cc0" flood-opacity="0.3"/>
                  </filter>
                </defs>

                <!-- Background Track Circle -->
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="26"/>

                <!-- Colored Domain Slices -->
                ${donutSlicesSvg}

                <!-- Dynamic Leader Line & Callout Dragging Arm (shown on hover) -->
                <g id="donut-leader-callout-group" class="opacity-0 transition-opacity duration-300 pointer-events-none select-none">
                  <polyline id="donut-leader-polyline" points="0,0 0,0 0,0" fill="none" stroke="#8a6cc0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle id="donut-leader-start-dot" cx="0" cy="0" r="4.5" fill="#8a6cc0" stroke="#ffffff" stroke-width="2"/>
                  <circle id="donut-leader-end-dot" cx="0" cy="0" r="3.5" fill="#8a6cc0"/>
                  <text id="donut-callout-name" x="0" y="0" font-weight="900" font-size="13" fill="#0f172a" class="font-heading"></text>
                  <text id="donut-callout-stats" x="0" y="0" font-weight="700" font-size="11" fill="#8a6cc0"></text>
                </g>

                <!-- Central Circular Metric Core -->
                <g id="donut-center-core" class="pointer-events-none select-none">
                  <circle cx="${cx}" cy="${cy}" r="64" fill="#ffffff" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.06))"/>
                  <text id="donut-center-count" x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="28" font-weight="900" fill="#0f172a" class="font-heading leading-none">${totalStudents}</text>
                  <text id="donut-center-label" x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" font-weight="800" fill="#64748b" letter-spacing="0.05em" text-transform="uppercase">TOTAL STUDENTS</text>
                  <text id="donut-center-hint" x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="9" font-weight="600" fill="#94a3b8">Hover any slice</text>
                </g>
              </svg>
            `}
          </div>

          <!-- Interactive Legend Below Donut -->
          <div class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2 text-xs">
            ${slicesData.map(s => `
              <div class="domain-legend-item flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-purple-50 transition cursor-pointer select-none" data-idx="${s.index}">
                <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${s.color}"></span>
                <span class="font-bold text-slate-800">${s.domain}</span>
                <span class="text-slate-500 font-extrabold text-[11px] ml-0.5">(${s.count} • ${s.pctInt}%)</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Top Recruiters & Interview Feed (5 Cols) -->
        <div class="lg:col-span-5 bg-white rounded-3xl border border-[rgba(138,108,192,0.2)] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 class="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2 font-heading">
              <i data-lucide="building-2" class="w-5 h-5 text-[#8a6cc0]"></i> Active Hiring Partners & Recruiters
            </h4>

            ${res.topCompanies.length === 0 ? `
              <div class="text-slate-400 italic py-6 text-center text-xs">
                No interview activity recorded yet.
              </div>
            ` : `
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                ${res.topCompanies.map((c, i) => `
                  <div class="p-3 bg-purple-50/50 hover:bg-purple-50 rounded-2xl border border-[rgba(138,108,192,0.15)] transition flex flex-col items-center text-center group">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#d99a63] via-[#bf6088] to-[#8a6cc0] text-white font-extrabold text-xs flex items-center justify-center shadow-xs mb-1.5 group-hover:scale-105 transition-transform">
                      ${c.company_name.charAt(0).toUpperCase()}
                    </div>
                    <span class="font-extrabold text-slate-900 text-xs truncate w-full" title="${c.company_name}">${c.company_name}</span>
                    <span class="text-[11px] font-bold text-[#8a6cc0] mt-0.5">${c.count} ${c.count === 1 ? 'Interview' : 'Interviews'}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Live Activity Feed Bottom Bar -->
          <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span class="font-bold flex items-center gap-1.5">
              <i data-lucide="activity" class="w-4 h-4 text-emerald-500"></i> Overall Pipeline Clearance:
            </span>
            <span class="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl">
              ${clearanceRate}% Cleared / Attended
            </span>
          </div>
        </div>

      </div>
    `;

    // Attach interactive hover listeners for leader line dragging and center metric updates
    this.attachDonutHoverInteractions(totalStudents);
    if (window.lucide) lucide.createIcons();
  },

  // Attach dynamic leader line & callout hover interactions
  attachDonutHoverInteractions(totalStudents) {
    const svg = document.getElementById('domain-distribution-svg');
    const group = document.getElementById('donut-leader-callout-group');
    const polyline = document.getElementById('donut-leader-polyline');
    const startDot = document.getElementById('donut-leader-start-dot');
    const endDot = document.getElementById('donut-leader-end-dot');
    const calloutName = document.getElementById('donut-callout-name');
    const calloutStats = document.getElementById('donut-callout-stats');
    const centerCount = document.getElementById('donut-center-count');
    const centerLabel = document.getElementById('donut-center-label');
    const centerHint = document.getElementById('donut-center-hint');

    if (!svg || !group) return;

    const slices = svg.querySelectorAll('.domain-donut-slice');
    const legendItems = document.querySelectorAll('.domain-legend-item');

    const activateSlice = (slice) => {
      const x1 = slice.getAttribute('data-x1');
      const y1 = slice.getAttribute('data-y1');
      const x2 = slice.getAttribute('data-x2');
      const y2 = slice.getAttribute('data-y2');
      const x3 = slice.getAttribute('data-x3');
      const y3 = slice.getAttribute('data-y3');
      const anchor = slice.getAttribute('data-anchor');
      const textX = slice.getAttribute('data-textx');
      const textY1 = slice.getAttribute('data-texty1');
      const textY2 = slice.getAttribute('data-texty2');
      const domain = slice.getAttribute('data-domain');
      const count = slice.getAttribute('data-count');
      const pct = slice.getAttribute('data-pct');
      const color = slice.getAttribute('data-color');
      const idx = slice.getAttribute('data-idx');

      // Update polyline points and dots
      polyline.setAttribute('points', `${x1},${y1} ${x2},${y2} ${x3},${y3}`);
      polyline.setAttribute('stroke', color);
      startDot.setAttribute('cx', x1);
      startDot.setAttribute('cy', y1);
      startDot.setAttribute('fill', color);
      endDot.setAttribute('cx', x3);
      endDot.setAttribute('cy', y3);
      endDot.setAttribute('fill', color);

      // Update callout text
      calloutName.setAttribute('x', textX);
      calloutName.setAttribute('y', textY1);
      calloutName.setAttribute('text-anchor', anchor);
      calloutName.textContent = domain;

      calloutStats.setAttribute('x', textX);
      calloutStats.setAttribute('y', textY2);
      calloutStats.setAttribute('text-anchor', anchor);
      calloutStats.setAttribute('fill', color);
      calloutStats.textContent = `${count} ${count === '1' ? 'Candidate' : 'Candidates'} (${pct}%)`;

      // Show callout group
      group.classList.remove('opacity-0');
      group.classList.add('opacity-100');

      // Highlight hovered slice & dim others
      slices.forEach(s => {
        if (s === slice) {
          s.setAttribute('stroke-width', '32');
          s.style.opacity = '1';
        } else {
          s.setAttribute('stroke-width', '26');
          s.style.opacity = '0.45';
        }
      });

      // Highlight corresponding legend item
      legendItems.forEach(item => {
        if (item.getAttribute('data-idx') === idx) {
          item.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50');
        } else {
          item.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50');
        }
      });

      // Update central circular metric core
      if (centerCount) centerCount.textContent = count;
      if (centerLabel) {
        centerLabel.textContent = domain.length > 16 ? domain.substring(0, 15) + '…' : domain;
        centerLabel.setAttribute('title', domain);
      }
      if (centerHint) centerHint.textContent = `${pct}% of Institute`;
    };

    const resetHover = () => {
      group.classList.remove('opacity-100');
      group.classList.add('opacity-0');

      slices.forEach(s => {
        s.setAttribute('stroke-width', '26');
        s.style.opacity = '1';
      });

      legendItems.forEach(item => {
        item.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50');
      });

      if (centerCount) centerCount.textContent = totalStudents;
      if (centerLabel) centerLabel.textContent = 'TOTAL STUDENTS';
      if (centerHint) centerHint.textContent = 'Hover any slice';
    };

    // Attach listeners to slices
    slices.forEach(slice => {
      slice.addEventListener('mouseenter', () => activateSlice(slice));
      slice.addEventListener('click', () => {
        const domain = slice.getAttribute('data-domain');
        if (domain) {
          AdminPortal.switchTab('students');
          AdminPortal.filterByDomain(domain);
        }
      });
    });

    // Attach listeners to legend items
    legendItems.forEach(item => {
      const idx = item.getAttribute('data-idx');
      const matchingSlice = Array.from(slices).find(s => s.getAttribute('data-idx') === idx);
      if (matchingSlice) {
        item.addEventListener('mouseenter', () => activateSlice(matchingSlice));
        item.addEventListener('mouseleave', resetHover);
        item.addEventListener('click', () => {
          const domain = matchingSlice.getAttribute('data-domain');
          if (domain) {
            AdminPortal.switchTab('students');
            AdminPortal.filterByDomain(domain);
          }
        });
      }
    });

    svg.addEventListener('mouseleave', resetHover);
  },

  // 6. Admin Add Interview for a Student
  openAdminAddInterviewModal(studentId) {
    const modal = document.getElementById('modal-interview');
    const titleElem = document.getElementById('modal-interview-title');
    const form = document.getElementById('form-interview');

    form.reset();
    titleElem.textContent = 'Schedule Interview for Student';
    const defaultDate = StudentPortal.getDeviceLocalDate();
    const dateInput = form.querySelector('[name="interview_date"]');
    if (dateInput) {
      dateInput.min = defaultDate;
      dateInput.value = defaultDate;
    }
    
    const timeObj = StudentPortal.getDeviceLocalTime12();
    StudentPortal.setSelectSafe('interview-time-hour', timeObj.hour);
    StudentPortal.setSelectSafe('interview-time-min', timeObj.minute);
    const ampmEl = document.getElementById('interview-time-ampm');
    if (ampmEl) ampmEl.value = timeObj.ampm;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      const hour = document.getElementById('interview-time-hour').value;
      const minute = document.getElementById('interview-time-min').value;
      const ampm = document.getElementById('interview-time-ampm').value;
      const formattedTime = `${hour}:${minute} ${ampm}`;

      const data = {
        interview_date: form.querySelector('[name="interview_date"]').value,
        interview_time: formattedTime,
        company_name: form.querySelector('[name="company_name"]').value.trim(),
        role_title: form.querySelector('[name="role_title"]').value.trim(),
        interview_mode: form.querySelector('[name="interview_mode"]').value,
        round_name: form.querySelector('[name="round_name"]').value.trim(),
        status: 'Scheduled',
        hr_mobile_number: form.querySelector('[name="hr_mobile_number"]').value.trim(),
        salary_package: form.querySelector('[name="salary_package"]').value.trim(),
        job_location: form.querySelector('[name="job_location"]').value.trim()
      };

      if (!data.company_name || !data.interview_date) {
        showToast('Please enter both Company Name and Interview Date.', 'warning');
        return;
      }

      const todayDate = StudentPortal.getDeviceLocalDate();
      if (data.interview_date < todayDate) {
        showToast('Previous dates are blocked. Please choose today or a future date.', 'warning');
        return;
      }

      if (data.hr_mobile_number) {
        const cleanHr = data.hr_mobile_number.replace(/[^0-9]/g, '');
        if (!/^[6-9]\d{9}$/.test(cleanHr)) {
          showToast('HR Mobile Number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.', 'warning');
          return;
        }
        data.hr_mobile_number = cleanHr;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Scheduling...';

        await API.post(`/api/admin/students/${studentId}/interviews`, data);
        showToast('Interview scheduled successfully for student!', 'success');
        modal.classList.add('hidden');

        this.openStudentDrilldown(studentId);
        this.loadStudents();
      } catch (err) {
        showToast(err.message || 'Failed to schedule interview.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    };

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  async adminDeleteInterview(interviewId, companyName, studentId) {
    if (!confirm(`Delete interview record for ${companyName}?`)) return;

    try {
      await API.delete(`/api/admin/interviews/${interviewId}`);
      showToast('Interview deleted.', 'info');
      this.openStudentDrilldown(studentId);
      this.loadStudents();
    } catch (err) {
      showToast(err.message || 'Failed to delete interview.', 'error');
    }
  },

  // 7. Dispatch 2-Hour Office Arrival Reminder Email
  async sendManualReminder(interviewId, companyName, studentName, studentId = null) {
    if (!confirm(`Dispatch 2-Hour Institute Office Arrival Reminder email to ${studentName} for their interview with ${companyName}?`)) return;

    try {
      showToast('Dispatching 2-hour institute office reminder email...', 'info');
      const res = await API.post(`/api/admin/interviews/${interviewId}/send-reminder`, {});
      showToast(res.message || `2-Hour Office Reminder email sent to ${studentName}!`, 'success', 5000);
      
      if (studentId) {
        this.openStudentDrilldown(studentId);
      }
      this.loadMasterBook();
    } catch (err) {
      showToast(err.message || 'Failed to dispatch reminder.', 'error');
    }
  },

  // 8. CSV Export
  exportCSV() {
    const token = API.getToken();
    if (!token) return;

    fetch(`/api/admin/export/csv`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Download failed');
      return res.blob();
    })
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Future_Sprint_Technologies_Interview_Register_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showToast('Future Sprint Interview Register CSV downloaded!', 'success');
    })
    .catch(err => {
      showToast('Failed to export CSV: ' + err.message, 'error');
    });
  },

  // 9. Admin Password Change Modal & Handlers (OTP-Verified in Dedicated Box)
  // Toggle Admin Password Change Form Container in Profile Avatar Dropdown
  togglePwdChangeForm() {
    const container = document.getElementById('admin-pwd-form-container');
    const toggleBtn = document.getElementById('btn-toggle-admin-pwd');
    if (!container) return;

    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
      container.classList.remove('hidden');
      if (toggleBtn) toggleBtn.textContent = 'Cancel';
      document.getElementById('admin-dd-pwd-new')?.focus();
    } else {
      container.classList.add('hidden');
      if (toggleBtn) toggleBtn.textContent = 'Update';
    }
    if (window.lucide) lucide.createIcons();
  },

  // Step 1 (Avatar Dropdown): Validate Admin New Passwords, request OTP, close dropdown, open dedicated OTP modal ("new box")
  async verifyDropdownPasswordAndOpenOtpModal() {
    const newPassInput = document.getElementById('admin-dd-pwd-new');
    const confirmPassInput = document.getElementById('admin-dd-pwd-confirm');
    const btn = document.getElementById('btn-admin-verify-otp');

    const newPass = newPassInput ? newPassInput.value : '';
    const confirmPass = confirmPassInput ? confirmPassInput.value : '';

    if (!newPass || newPass.length < 8) {
      showToast('New password must be at least 8 characters long.', 'warning');
      if (newPassInput) newPassInput.focus();
      return;
    }

    if (!/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/[0-9]/.test(newPass)) {
      showToast('New password must contain uppercase, lowercase, and numeric characters.', 'warning');
      if (newPassInput) newPassInput.focus();
      return;
    }

    if (newPass !== confirmPass) {
      showToast('The re-entered password does not match.', 'error');
      if (confirmPassInput) confirmPassInput.focus();
      return;
    }

    // Save pending passwords in memory
    this.pendingAdminPassword = {
      new_password: newPass,
      confirm_password: confirmPass
    };

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Requesting OTP...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/admin/request-password-otp', {});
      showToast(res.message || 'Verification OTP dispatched to admin email!', 'success');

      // Close profile dropdown
      document.getElementById('profile-dropdown-card')?.classList.add('hidden');

      // Open the dedicated new OTP modal box
      const otpModal = document.getElementById('modal-admin-password-otp');
      const msgBox = document.getElementById('admin-modal-otp-msg');
      if (msgBox) {
        msgBox.innerHTML = `
          <div class="flex items-center gap-2 font-bold text-slate-800">
            <i data-lucide="mail-check" class="w-4 h-4 text-[#bf6088]"></i> OTP dispatched to <strong>admin@futuresprintech.com</strong>
          </div>
          <p class="text-[11px] text-slate-600 mt-1">${res.message || 'Enter the 6-digit OTP code below to verify and complete password update.'}</p>
        `;
      }

      // Initialize / reset the OTP deck inside the new modal
      const deck = OTPDeckController.get('otp-deck-admin-modal') || new OTPDeckController({
        containerId: 'otp-deck-admin-modal'
      });
      OTPDeckController.instances['otp-deck-admin-modal'] = deck;
      deck.reset();
      deck.onComplete = (code) => {
        const hiddenInput = document.getElementById('admin-modal-otp-code');
        if (hiddenInput) hiddenInput.value = code;
        this.confirmAndUpdateAdminPassword();
      };
      deck.onDigitChange = (code) => {
        const hiddenInput = document.getElementById('admin-modal-otp-code');
        if (hiddenInput) hiddenInput.value = code;
      };
      this.adminModalOtpDeck = deck;

      if (otpModal) otpModal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
      setTimeout(() => deck.focus(), 150);

    } catch (err) {
      showToast(err.message || 'Failed to dispatch verification OTP.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4"></i> Verify with OTP';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  openChangePasswordModal(pushState = true) {
    const modal = document.getElementById('modal-admin-change-password');
    if (!modal) return;
    if (pushState) {
      try {
        history.pushState({ view: 'portal', role: 'admin', tab: this.currentTab, modal: 'admin-password' }, '', '#admin-password');
      } catch (e) {}
    }
    const form = document.getElementById('form-admin-change-password');
    if (form) form.reset();

    const verifyBtn = document.getElementById('btn-admin-verify-pwd-otp');
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4"></i> Verify with OTP';
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    setTimeout(() => document.getElementById('admin-new-pass')?.focus(), 100);
  },

  // Step 1: Validate Admin New Passwords, request OTP, close password form, open dedicated OTP modal ("new box")
  async verifyAdminNewPasswordAndOpenOtpModal() {
    const newPass = document.getElementById('admin-new-pass')?.value;
    const confirmPass = document.getElementById('admin-confirm-pass')?.value;
    const btn = document.getElementById('btn-admin-verify-pwd-otp');

    if (!newPass || newPass.length < 8) {
      showToast('New password must be at least 8 characters long.', 'warning');
      document.getElementById('admin-new-pass')?.focus();
      return;
    }

    if (!/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/[0-9]/.test(newPass)) {
      showToast('New password must contain uppercase, lowercase, and numeric characters.', 'warning');
      document.getElementById('admin-new-pass')?.focus();
      return;
    }

    if (newPass !== confirmPass) {
      showToast('The re-entered password does not match.', 'error');
      document.getElementById('admin-confirm-pass')?.focus();
      return;
    }

    // Save pending passwords in memory
    this.pendingAdminPassword = {
      new_password: newPass,
      confirm_password: confirmPass
    };

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Requesting OTP...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/admin/request-password-otp', {});
      showToast(res.message || 'Verification OTP dispatched to admin email!', 'success');

      // Hide the password entry modal
      document.getElementById('modal-admin-change-password')?.classList.add('hidden');

      try {
        history.pushState({ view: 'portal', role: 'admin', tab: this.currentTab, modal: 'admin-password-otp' }, '', '#admin-password-otp');
      } catch (e) {}

      // Open the dedicated new OTP modal box
      const otpModal = document.getElementById('modal-admin-password-otp');
      const msgBox = document.getElementById('admin-modal-otp-msg');
      if (msgBox) {
        msgBox.innerHTML = `
          <div class="flex items-center gap-2 font-bold text-slate-800">
            <i data-lucide="mail-check" class="w-4 h-4 text-[#bf6088]"></i> OTP dispatched to <strong>admin@futuresprintech.com</strong>
          </div>
          <p class="text-[11px] text-slate-600 mt-1">${res.message || 'Enter the 6-digit OTP code below to verify and complete password update.'}</p>
        `;
      }

      // Initialize / reset the OTP deck inside the new modal
      const deck = OTPDeckController.get('otp-deck-admin-modal') || new OTPDeckController({
        containerId: 'otp-deck-admin-modal'
      });
      OTPDeckController.instances['otp-deck-admin-modal'] = deck;
      deck.reset();
      deck.onComplete = (code) => {
        const hiddenInput = document.getElementById('admin-modal-otp-code');
        if (hiddenInput) hiddenInput.value = code;
        this.confirmAndUpdateAdminPassword();
      };
      deck.onDigitChange = (code) => {
        const hiddenInput = document.getElementById('admin-modal-otp-code');
        if (hiddenInput) hiddenInput.value = code;
      };
      this.adminModalOtpDeck = deck;

      if (otpModal) otpModal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
      setTimeout(() => deck.focus(), 150);

    } catch (err) {
      showToast(err.message || 'Failed to dispatch verification OTP.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4"></i> Verify with OTP';
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  // Step 2: Triggered when admin clicks [ Verify and Update Password ] in the new OTP box
  async confirmAndUpdateAdminPassword() {
    const deck = this.adminModalOtpDeck || OTPDeckController.get('otp-deck-admin-modal');
    const otpCode = deck ? deck.getCode() : (document.getElementById('admin-modal-otp-code')?.value.trim() || '');

    if (!otpCode || otpCode.length !== 6) {
      showToast('Please enter all 6 digits of the verification code.', 'warning');
      if (deck) deck.focus();
      return;
    }

    const passwords = this.pendingAdminPassword || {
      new_password: document.getElementById('admin-dd-pwd-new')?.value || document.getElementById('admin-new-pass')?.value,
      confirm_password: document.getElementById('admin-dd-pwd-confirm')?.value || document.getElementById('admin-confirm-pass')?.value
    };

    if (!passwords.new_password || passwords.new_password.length < 8) {
      showToast('Password session expired. Please re-enter your password.', 'error');
      document.getElementById('modal-admin-password-otp')?.classList.add('hidden');
      this.openChangePasswordModal();
      return;
    }

    const btn = document.getElementById('btn-admin-confirm-pwd-update');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Verifying Code & Updating...';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await API.post('/api/admin/change-password-with-otp', {
        otp_code: otpCode,
        new_password: passwords.new_password,
        confirm_password: passwords.confirm_password
      });

      if (res.token) {
        API.setToken(res.token);
      }

      showToast(res.message || 'Admin password updated securely!', 'success', 6000);

      // Close modal and reset fields
      document.getElementById('modal-admin-password-otp')?.classList.add('hidden');
      document.getElementById('modal-admin-change-password')?.classList.add('hidden');
      document.getElementById('profile-dropdown-card')?.classList.add('hidden');
      document.getElementById('form-admin-change-password')?.reset();
      
      const ddNew = document.getElementById('admin-dd-pwd-new');
      if (ddNew) ddNew.value = '';
      const ddConf = document.getElementById('admin-dd-pwd-confirm');
      if (ddConf) ddConf.value = '';

      const formContainer = document.getElementById('admin-pwd-form-container');
      if (formContainer) formContainer.classList.add('hidden');
      const toggleBtn = document.getElementById('btn-toggle-admin-pwd');
      if (toggleBtn) toggleBtn.textContent = 'Update';

      this.pendingAdminPassword = null;
      if (deck) deck.reset();

      // Refresh / redirect back to admin view
      if (window.App && typeof App.showAdminView === 'function') {
        App.showAdminView();
      }
      this.loadDashboard();

    } catch (err) {
      showToast(err.message || 'Verification failed. Please check OTP code.', 'error');
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
  async resendAdminPasswordOtp() {
    try {
      const res = await API.post('/api/admin/request-password-otp', {});
      showToast(res.message || 'Fresh OTP dispatched to admin email!', 'success');
      const msgBox = document.getElementById('admin-modal-otp-msg');
      if (msgBox) {
        msgBox.innerHTML = `
          <div class="flex items-center gap-2 font-bold text-slate-800">
            <i data-lucide="mail-check" class="w-4 h-4 text-[#bf6088]"></i> OTP dispatched to <strong>admin@futuresprintech.com</strong>
          </div>
          <p class="text-[11px] text-slate-600 mt-1">${res.message || 'Enter the 6-digit OTP code below to verify and complete password update.'}</p>
        `;
      }
      if (this.adminModalOtpDeck) {
        this.adminModalOtpDeck.reset();
        this.adminModalOtpDeck.focus();
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      showToast(err.message || 'Failed to resend verification OTP.', 'error');
    }
  }
};

window.AdminPortal = AdminPortal;
