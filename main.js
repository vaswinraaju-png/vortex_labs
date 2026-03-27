// ── Hamburger ──
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  const isOpen = hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

document.querySelectorAll('.mob-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// ── Scroll reveal ──
const obs = new IntersectionObserver(entries => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 70);
    }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ── Modal ──
const modal = document.getElementById('leadModal');
const modalClose = document.getElementById('modalClose');
const modalSubmit = document.getElementById('modalSubmit');
const modalForm = document.getElementById('modalForm');
const modalSuccess = document.getElementById('modalSuccess');

export function openModal() {
  hamburger.classList.remove('open');
  mobileMenu.classList.remove('open');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('.open-modal').forEach(el => el.addEventListener('click', openModal));
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

export const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScQTywgo0TiLyYXCgdbdkKYJhdCaUTgwvoCfV6tBr_fG8i4Gg/formResponse';

export function buildFormData({ name, mobile, email, brand, spend, goal }) {
  const formData = new FormData();
  formData.append('entry.659319553', name);
  formData.append('entry.84612590', mobile);
  formData.append('entry.575777860', email);
  formData.append('entry.1998357470', brand);
  formData.append('entry.630119346', spend);
  formData.append('entry.544290577', goal);
  return formData;
}

modalSubmit.addEventListener('click', async () => {
  const name = document.getElementById('f-name').value.trim();
  const mobile = document.getElementById('f-mobile').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const brand = document.getElementById('f-brand').value.trim();
  const spend = document.getElementById('f-spend').value;
  const goal = document.getElementById('f-goal').value;

  if (!name || !mobile || !email || !brand || !spend || !goal) {
    modalSubmit.textContent = '⚠ Please fill all required fields';
    modalSubmit.style.background = '#1A1A24';
    modalSubmit.style.color = '#fff';
    setTimeout(() => {
      modalSubmit.textContent = 'Send My Audit Request →';
      modalSubmit.style.background = '';
      modalSubmit.style.color = '';
    }, 2200);
    return;
  }

  modalSubmit.textContent = 'Sending...';
  modalSubmit.disabled = true;

  try {
    await fetch(FORM_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: buildFormData({ name, mobile, email, brand, spend, goal }),
    });
  } catch (e) {
    // no-cors will always "fail" silently — data still submits
  }

  modalForm.classList.add('hide');
  modalSuccess.classList.add('show');
  modalSubmit.disabled = false;
  modalSubmit.textContent = 'Send My Audit Request →';
});
