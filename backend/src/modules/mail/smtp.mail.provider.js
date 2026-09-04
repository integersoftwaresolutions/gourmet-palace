const nodemailer = require('nodemailer');
const env = require('../../config/env');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (!env.smtp.host) {
    // Dev fallback: log mail instead of failing when SMTP is not configured.
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

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} message
 */
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
