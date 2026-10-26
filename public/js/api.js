// Centralized API Client & Single Device Session Management
const API = {
  TOKEN_KEY: 'inst_tracker_token',
  USER_KEY: 'inst_tracker_user',

  getToken() {
    return sessionStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      sessionStorage.setItem(this.TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(this.TOKEN_KEY);
    }
    // Clean any legacy persistent storage
    try { localStorage.removeItem(this.TOKEN_KEY); } catch (e) {}
  },

  getUser() {
    try {
      const data = sessionStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(this.USER_KEY);
    }
    // Clean any legacy persistent storage
    try { localStorage.removeItem(this.USER_KEY); } catch (e) {}
  },

  clearAuth() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch (e) {}
  },

  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const res = await fetch(endpoint, config);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Enforce single-device session revocation!
        if (res.status === 401 && (data.error === 'SESSION_REVOKED' || data.error === 'INVALID_TOKEN' || data.error === 'TOKEN_EXPIRED')) {
          this.handleSessionTerminated(data);
          const err = new Error(data.message || 'Session expired or invalidated.');
          err.code = data.error;
          throw err;
        }

        const error = new Error(data.message || `Request failed with status ${res.status}`);
        error.data = data;
        error.status = res.status;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  get(endpoint, params = null) {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.append(k, v);
        }
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  handleSessionTerminated(data) {
    this.clearAuth();

    const isRevoked = data.error === 'SESSION_REVOKED';
    const message = isRevoked
      ? 'Your account was just logged in from another device or browser. For security, this session has been automatically logged out.'
      : (data.message || 'Your session has expired. Please log in again.');

    window.dispatchEvent(new CustomEvent('session-terminated', {
      detail: { reason: data.error, message, isRevoked }
    }));
  },

  // Periodic heartbeat to verify single active session
  startSessionHeartbeat() {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);

    const checkSession = async () => {
      if (!this.isAuthenticated()) return;
      try {
        await this.get('/api/auth/verify-session');
      } catch (err) {
        // Handled automatically by handleSessionTerminated
      }
    };

    // Check every 15 seconds
    this._heartbeatInterval = setInterval(checkSession, 15000);

    // Also check immediately when user switches back to this tab
    window.addEventListener('focus', () => {
      if (this.isAuthenticated()) checkSession();
    });
  },

  stopSessionHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }
};
window.API = API;

// UI Toast Notification helper
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-600 text-white',
    info: 'bg-indigo-600 text-white'
  };

  const icons = {
    success: '<i data-lucide="check-circle" class="w-5 h-5 flex-shrink-0"></i>',
    error: '<i data-lucide="alert-triangle" class="w-5 h-5 flex-shrink-0"></i>',
    warning: '<i data-lucide="alert-circle" class="w-5 h-5 flex-shrink-0"></i>',
    info: '<i data-lucide="info" class="w-5 h-5 flex-shrink-0"></i>'
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${bgColors[type] || bgColors.info} transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `
    ${icons[type] || icons.info}
    <div class="flex-1">${message}</div>
    <button class="opacity-70 hover:opacity-100 ml-2" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons({ root: toast });

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
