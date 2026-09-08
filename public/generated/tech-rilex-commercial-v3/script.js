import './base-script.js';

const form = document.getElementById('phone-request-form');
const submit = document.getElementById('request-submit');
const status = document.getElementById('copy-status');
const modelInput = document.getElementById('request-model');
const storageInput = document.getElementById('request-storage');
const colourInput = document.getElementById('request-colour');
const budgetInput = document.getElementById('request-budget');
const notesInput = document.getElementById('request-notes');
const generated = document.getElementById('generated-message');

function whatsappNumber() {
  return (document.body?.dataset.whatsappNumber || '').replace(/\D/g, '');
}

function buildMessage() {
  const model = modelInput?.value.trim();
  const storage = storageInput?.value.trim();
  const colour = colourInput?.value.trim();
  const budget = budgetInput?.value.trim();
  const notes = notesInput?.value.trim();
  if (!model) return 'Tell us the phone model above and we will prepare your enquiry message.';
  let message = `Hi Tech Rilex, I'm looking for ${model}`;
  const preferences = [];
  if (storage) preferences.push(storage);
  if (colour) preferences.push(colour);
  if (budget) preferences.push(`budget ${budget}`);
  if (preferences.length) message += `, preferably ${preferences.join(' / ')}`;
  message += '. Can you check the current options and confirmed unit details for me?';
  if (notes) message += `\n\nAdditional note: ${notes}`;
  return message;
}

function refreshMessage() {
  if (generated) generated.textContent = buildMessage();
  if (status) status.textContent = '';
}
[modelInput, storageInput, colourInput, budgetInput, notesInput].forEach((input) => input?.addEventListener('input', refreshMessage));

function syncSubmit() {
  if (!submit) return;
  submit.textContent = whatsappNumber() ? 'Continue on WhatsApp ↗' : 'Copy enquiry message';
}
syncSubmit();
window.addEventListener('techrilex:settings', syncSubmit);

document.querySelectorAll('[data-enquire]').forEach((button) => button.addEventListener('click', () => setTimeout(syncSubmit, 0), true));

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!modelInput?.value.trim()) {
    modelInput?.focus();
    if (status) status.textContent = 'Please enter the phone model first.';
    return;
  }
  const message = buildMessage();
  if (generated) generated.textContent = message;
  const number = whatsappNumber();
  if (number) {
    if (status) status.textContent = 'Opening WhatsApp with your message…';
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    await navigator.clipboard.writeText(message);
    if (status) status.textContent = 'Enquiry message copied. Paste it into WhatsApp.';
  } catch {
    if (status) status.textContent = 'Copy is not available in this browser. Select the message above and copy it manually.';
  }
}, true);

const enquiryBackdrop = document.getElementById('enquiry-backdrop');
const enquirySheet = enquiryBackdrop?.querySelector('.enquiry-sheet');
let previousFocus = null;
document.querySelectorAll('[data-enquire]').forEach((button) => button.addEventListener('click', () => { previousFocus = button; }, true));
document.getElementById('sheet-close')?.addEventListener('click', () => setTimeout(() => previousFocus?.focus?.(), 0));
enquiryBackdrop?.addEventListener('click', (event) => { if (event.target === enquiryBackdrop) setTimeout(() => previousFocus?.focus?.(), 0); });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || !enquiryBackdrop || enquiryBackdrop.hidden || !enquirySheet) return;
  const focusable = [...enquirySheet.querySelectorAll('button,input,textarea,a[href]')].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
