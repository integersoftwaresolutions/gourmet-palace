const nodemailer = require('nodemailer');
const env = require('../../config/env');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (!env.smtp.host) {
    if (env.nodeEnv === 'production') {
      throw new Error('Email provider is not configured. Set RESEND_API_KEY or SMTP_HOST.');
    }

    // Local-development fallback: make verification/reset links visible in logs.
    transporter = {
      sendMail: async (options) => {
        console.log('[mail:dev] SMTP not configured — message logged only');
        console.log(JSON.stringify({
          to: options.to,
          subject: options.subject,
          text: options.text,
        }, null, 2));
        return { messageId: `dev-${Date.now()}` };
      },
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user
      ? { user: env.smtp.user, pass: env.smtp.pass }
      : undefined,
  });

  return transporter;
}

async function sendMail(message) {
  const transport = getTransporter();
  await transport.sendMail({
    from: env.smtp.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html || message.text,
  });
}

module.exports = {
  sendMail,
};
