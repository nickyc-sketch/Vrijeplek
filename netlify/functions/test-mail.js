// netlify/functions/test-mail.js
import nodemailer from 'nodemailer';

export async function handler(event) {
  try {
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_FROM,
    } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          error: 'SMTP env vars ontbreken (SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM)',
        }),
      };
    }

    // Ontvanger (default: jouw Easygyps-mail)
    const urlParams = new URLSearchParams(event.queryStringParameters || {});
    const to = urlParams.get('to') || 'info@easygyps.be';

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: 'Testfactuur — Vrijeplek.be',
      text: [
        'Hey,',
        '',
        'Dit is een TEST-mail vanuit Vrijeplek.',
        'Als je dit ziet, werkt je factuuremail.',
        '',
        'Groeten,',
        'Vrijeplek.be',
      ].join('\n'),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        to,
        messageId: info.messageId || null,
      }),
    };
  } catch (err) {
    console.error('test-mail error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message || 'onbekende fout',
      }),
    };
  }
}
