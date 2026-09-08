import './base-script.js';

const body = document.body;
const rawNumber = (body?.dataset.whatsappNumber || '').replace(/\D/g, '');
const hasWhatsApp = rawNumber.length >= 8;
const form = document.getElementById('phone-request-form');
const submit = document.getElementById('request-submit');
const status = document.getElementById('copy-status');
const modelInput = document.getElementById('request-model');
const storageInput = document.getElementById('request-storage');
const colourInput = document.getElementById('request-colour');
const budgetInput = document.getElementById('request-budget');
const notesInput = document.getElementById('request-notes');
const generated = document.getElementById('generated-message');

function buildCommercialMessage() {
  const model = modelInput?.value.trim();
  const storage = storageInput?.value.trim();
  const colour = colourInput?.value.trim();
  const budget = budgetInput?.value.trim();
  const notes = notesInput?.value.trim();
  if (!model) return 'Tell us the phone model above and we will prepare your enquiry message.';

  let message = `Hi Tech Rilex, I’m looking for ${model}`;
  const preferences = [];
  if (storage) preferences.push(storage);
  if (colour) preferences.push(colour);
  if (budget) preferences.push(`budget ${budget}`);
  if (preferences.length) message += `, preferably ${preferences.join(' / ')}`;
  message += '. Can you check the current options and confirmed unit details for me?';
  if (notes) message += `\n\nAdditional note: ${notes}`;
  return message;
}

function syncSubmitLabel() {
  if (!submit) return;
  submit.textContent = hasWhatsApp ? 'Continue on WhatsApp ↗' : 'Copy enquiry message';
}
syncSubmitLabel();

if (form && hasWhatsApp) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!modelInput?.value.trim()) {
      modelInput?.focus();
      if (status) status.textContent = 'Please enter the phone model first.';
      return;
    }
    const message = buildCommercialMessage();
    if (generated) generated.textContent = message;
    if (status) status.textContent = 'Opening WhatsApp with your message…';
    const url = `https://wa.me/${rawNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, true);
}

const enquiryBackdrop = document.getElementById('enquiry-backdrop');
const enquirySheet = enquiryBackdrop?.querySelector('.enquiry-sheet');
let previousFocus = null;

document.querySelectorAll('[data-enquire]').forEach((button) => {
  button.addEventListener('click', () => { previousFocus = button; }, true);
});

document.getElementById('sheet-close')?.addEventListener('click', () => {
  window.setTimeout(() => previousFocus?.focus?.(), 0);
});

enquiryBackdrop?.addEventListener('click', (event) => {
  if (event.target === enquiryBackdrop) window.setTimeout(() => previousFocus?.focus?.(), 0);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || !enquiryBackdrop || enquiryBackdrop.hidden || !enquirySheet) return;
  const focusable = [...enquirySheet.querySelectorAll('button,input,textarea,a[href]')].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
