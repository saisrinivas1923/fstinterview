/**
 * Future Sprint Technologies - Interactive 6-Digit OTP Lightning Controller
 * Provides lightning corner accents on individual digit blocks,
 * auto-focus jump, backspace handling, clipboard paste, and when the
 * 6th digit is filled, smoothly collapses/merges into a single consolidated
 * card with an electric green lightning verified aura.
 */
class OTPDeckController {
  constructor({ containerId, onComplete, onDigitChange }) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    this.containerId = typeof containerId === 'string' ? containerId : (this.container ? this.container.id : null);
    this.onComplete = onComplete;
    this.onDigitChange = onDigitChange;
    this.digits = ['', '', '', '', '', ''];
    this.isMerged = false;
    this.isSubmitting = false;

    if (this.container) {
      this.init();
      if (this.containerId) {
        OTPDeckController.instances[this.containerId] = this;
      }
    }
  }

  static getTemplateHTML() {
    return `
      <div class="otp-lightning-deck-wrapper relative py-2 select-none">
        <!-- 6 Individual Digit Slots -->
        <div class="otp-cards-row flex items-center justify-center gap-2 relative">
          ${[0, 1, 2, 3, 4, 5].map(i => `
            <div class="otp-digit-card-slot" data-index="${i}">
              <span class="corner-lightning corner-tl"></span>
              <span class="corner-lightning corner-tr"></span>
              <span class="corner-lightning corner-bl"></span>
              <span class="corner-lightning corner-br"></span>
              <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" 
                class="otp-digit-input" data-index="${i}" autocomplete="off" />
            </div>
          `).join('')}
        </div>

        <!-- Merged Single Block (Website Theme Transition with Tick Mark - NO GREEN, NO VERIFIED TEXT) -->
        <div class="otp-merged-card">
          <div class="flex items-center justify-center gap-4 w-full px-5 py-2">
            <div class="otp-merged-code font-mono font-black text-white text-xl sm:text-2xl tracking-[0.3em]"></div>
            <div class="otp-tick-circle flex items-center justify-center flex-shrink-0" title="OTP Complete">
              <svg class="w-5 h-5 otp-tick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" class="otp-tick-polyline"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  init() {
    if (!this.container) return;

    // If pre-rendered HTML does not exist in container, inject template
    if (!this.container.querySelector('.otp-cards-row')) {
      this.container.innerHTML = OTPDeckController.getTemplateHTML();
    }

    this.wrapper = this.container.querySelector('.otp-lightning-deck-wrapper');
    this.inputs = Array.from(this.container.querySelectorAll('.otp-digit-input'));
    this.slots = Array.from(this.container.querySelectorAll('.otp-digit-card-slot'));
    this.mergedCard = this.container.querySelector('.otp-merged-card');
    this.mergedCodeElem = this.container.querySelector('.otp-merged-code');

    this.bindEvents();
    if (window.lucide) lucide.createIcons();
  }

  bindEvents() {
    if (!this.inputs || this.inputs.length === 0) return;

    this.inputs.forEach((input, idx) => {
      if (input._otpBound) return;
      input._otpBound = true;

      // Keydown: handle Backspace, Delete, and Arrow navigation
      input.addEventListener('keydown', (e) => {
        if (this.isMerged) return;

        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          if (input.value) {
            input.value = '';
            this.digits[idx] = '';
            this.slots[idx].classList.remove('filled');
          } else if (idx > 0) {
            this.inputs[idx - 1].value = '';
            this.digits[idx - 1] = '';
            this.slots[idx - 1].classList.remove('filled');
            this.inputs[idx - 1].focus();
          }
          if (this.onDigitChange) this.onDigitChange(this.getCode());
          return;
        }

        if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault();
          this.inputs[idx - 1].focus();
        } else if (e.key === 'ArrowRight' && idx < 5) {
          e.preventDefault();
          this.inputs[idx + 1].focus();
        }
      });

      // Input: accept single digit, handle multi-char paste/fill, jump to next slot
      input.addEventListener('input', (e) => {
        if (this.isMerged) return;

        const val = input.value.replace(/[^0-9]/g, '');
        if (!val) {
          input.value = '';
          this.digits[idx] = '';
          this.slots[idx].classList.remove('filled');
          if (this.onDigitChange) this.onDigitChange(this.getCode());
          return;
        }

        if (val.length > 1) {
          // Spread across multiple slots
          for (let i = 0; i < val.length && (idx + i) < 6; i++) {
            const digit = val[i];
            this.digits[idx + i] = digit;
            this.inputs[idx + i].value = digit;
            this.slots[idx + i].classList.add('filled');
          }
          if (this.onDigitChange) this.onDigitChange(this.getCode());
          if (this.digits.every(d => d !== '')) {
            this.triggerMerge();
          } else {
            const nextIdx = Math.min(idx + val.length, 5);
            this.inputs[nextIdx].focus();
          }
          return;
        }

        // Single digit input
        const digit = val.slice(-1);
        input.value = digit;
        this.digits[idx] = digit;
        this.slots[idx].classList.add('filled');

        if (this.onDigitChange) this.onDigitChange(this.getCode());

        // Check if all 6 digits are filled
        if (this.digits.every(d => d !== '')) {
          this.triggerMerge();
        } else if (idx < 5) {
          this.inputs[idx + 1].focus();
        }
      });

      // Paste: distribute all 6 digits across slots
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const clipboardData = (e.clipboardData || window.clipboardData)?.getData('text') || '';
        const digits = clipboardData.replace(/[^0-9]/g, '').slice(0, 6);
        if (!digits) return;

        digits.split('').forEach((d, i) => {
          if (i < 6) {
            this.digits[i] = d;
            this.inputs[i].value = d;
            this.slots[i].classList.add('filled');
          }
        });

        if (this.onDigitChange) this.onDigitChange(this.getCode());

        if (this.digits.every(d => d !== '')) {
          this.triggerMerge();
        } else {
          const nextIdx = Math.min(digits.length, 5);
          this.inputs[nextIdx].focus();
        }
      });

      // Focus styling
      input.addEventListener('focus', () => {
        this.slots[idx].classList.add('focused');
      });
      input.addEventListener('blur', () => {
        this.slots[idx].classList.remove('focused');
      });
    });
  }

  triggerMerge() {
    if (this.isMerged) return;
    this.isMerged = true;

    const fullCode = this.getCode();
    if (this.mergedCodeElem) {
      this.mergedCodeElem.textContent = fullCode.split('').join(' ');
    }

    // Disable all inputs to prevent accidental modifications
    this.inputs.forEach(inp => inp.disabled = true);

    // Brief pause so user sees the 6th digit settled in place
    setTimeout(() => {
      // Step 1: Animate all 6 cards slowly collapsing/gliding toward the center (deck stacking)
      if (this.wrapper) {
        this.wrapper.classList.add('is-merging');
      }

      // Step 2: Smoothly expand the consolidated website-themed card with animated tick mark
      setTimeout(() => {
        if (this.wrapper) {
          this.wrapper.classList.remove('is-merging');
          this.wrapper.classList.add('is-merged');
        }
        if (window.lucide) lucide.createIcons();

        // Step 3: Trigger completion callback after full settled transition
        setTimeout(() => {
          if (typeof this.onComplete === 'function') {
            this.onComplete(fullCode);
          }
        }, 1200);
      }, 1100);
    }, 350);
  }

  reset() {
    this.isMerged = false;
    this.isSubmitting = false;
    this.digits = ['', '', '', '', '', ''];
    if (this.wrapper) {
      this.wrapper.classList.remove('is-merging', 'is-merged', 'is-error');
    }
    if (this.inputs) {
      this.inputs.forEach(inp => {
        inp.value = '';
        inp.disabled = false;
      });
    }
    if (this.slots) {
      this.slots.forEach(slot => {
        slot.classList.remove('filled', 'focused');
      });
    }
    if (this.mergedCodeElem) {
      this.mergedCodeElem.textContent = '';
    }
  }

  showError(message) {
    if (this.wrapper) {
      this.wrapper.classList.add('is-error');
      setTimeout(() => {
        this.reset();
        this.focus();
      }, 750);
    }
  }

  getCode() {
    return this.digits.join('');
  }

  setValue(code) {
    this.reset();
    const str = String(code || '').replace(/[^0-9]/g, '').slice(0, 6);
    str.split('').forEach((d, i) => {
      this.digits[i] = d;
      if (this.inputs[i]) this.inputs[i].value = d;
      if (this.slots[i]) this.slots[i].classList.add('filled');
    });
    if (this.onDigitChange) this.onDigitChange(this.getCode());
    if (str.length === 6) {
      this.triggerMerge();
    }
  }

  focus() {
    if (!this.inputs || this.inputs.length === 0) return;
    const firstEmpty = this.digits.findIndex(d => d === '');
    const targetIdx = firstEmpty >= 0 ? firstEmpty : 0;
    setTimeout(() => {
      if (this.inputs[targetIdx]) {
        this.inputs[targetIdx].focus();
      }
    }, 60);
  }
}

// Global Registry and Auto-Initializer
OTPDeckController.instances = {};

OTPDeckController.get = function(containerId) {
  return OTPDeckController.instances[containerId] || null;
};

OTPDeckController.initAll = function() {
  const containerIds = [
    'otp-deck-student-login',
    'otp-deck-student-modal',
    'otp-deck-admin-modal',
    'otp-deck-register',
    'otp-deck-forgot-pwd',
    'otp-deck-student-pwd',
    'otp-deck-admin-pwd',
    'otp-deck-register-inline'
  ];

  containerIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !OTPDeckController.instances[id]) {
      OTPDeckController.instances[id] = new OTPDeckController({ containerId: id });
    }
  });
};

// Auto initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => OTPDeckController.initAll());
} else {
  OTPDeckController.initAll();
}

// Make globally available
window.OTPDeckController = OTPDeckController;
