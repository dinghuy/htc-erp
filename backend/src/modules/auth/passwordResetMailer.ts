type PasswordResetMailInput = {
  to: string;
  fullName?: string | null;
  resetUrl: string;
};

function isConfigured(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPasswordResetMailerConfigured() {
  return isConfigured(process.env.RESEND_API_KEY)
    && isConfigured(process.env.PASSWORD_RESET_EMAIL_FROM)
    && isConfigured(process.env.PASSWORD_RESET_BASE_URL);
}

export function buildPasswordResetUrl(token: string) {
  const baseUrl = process.env.PASSWORD_RESET_BASE_URL?.trim() || 'http://127.0.0.1:4173';
  return `${baseUrl.replace(/\/+$/, '')}/?resetToken=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(input: PasswordResetMailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_EMAIL_FROM?.trim();
  const replyTo = process.env.PASSWORD_RESET_EMAIL_REPLY_TO?.trim();

  if (!apiKey || !from) {
    throw new Error('Password reset mail delivery is not configured');
  }

  const greetingName = input.fullName?.trim() || input.to;
  const payload = {
    from,
    to: [input.to],
    subject: 'Password reset request',
    ...(replyTo ? { reply_to: replyTo } : {}),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <p>Xin chào ${greetingName},</p>
        <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản HTC ERP của bạn.</p>
        <p>
          <a href="${input.resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">
            Đặt lại mật khẩu
          </a>
        </p>
        <p>Link có hiệu lực trong 15 phút. Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.</p>
      </div>
    `,
    text: [
      `Xin chào ${greetingName},`,
      '',
      'Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản HTC ERP của bạn.',
      `Đặt lại mật khẩu: ${input.resetUrl}`,
      '',
      'Link có hiệu lực trong 15 phút. Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.',
    ].join('\n'),
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || body?.error || 'Password reset email delivery failed');
  }

  return body;
}
