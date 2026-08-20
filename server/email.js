// Email sending module — uses brajanek@qa.pl SMTP (Zenbox) via Nodemailer
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Read SMTP password from file
let cachedPass = null;
function getSmtpPass() {
  if (cachedPass) return cachedPass;
  try {
    cachedPass = fs.readFileSync('/tmp/email_pass_brajanek', 'utf8').trim();
  } catch {
    console.warn('[Email] No password file at /tmp/email_pass_brajanek');
    cachedPass = '';
  }
  return cachedPass;
}

// Create reusable transporter
function createTransport() {
  const pass = getSmtpPass();
  if (!pass) {
    console.error('[Email] Cannot create transport — no SMTP password');
    return null;
  }
  return nodemailer.createTransport({
    host: 'smtp.zenbox.pl',
    port: 587,
    secure: false,
    auth: {
      user: 'brajanek@qa.pl',
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Send an email via Brajanek's SMTP
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @param {string} [text] - Plain text fallback
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransport();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: '"Catnip Tycoon" <brajanek@qa.pl>',
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''),
      html,
      headers: {
        'X-Catnip-Tycoon': 'true',
      },
    });

    console.log(`[Email] Sent "${subject}" to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail };