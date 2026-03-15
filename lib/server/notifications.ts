type SignupNotice = {
  email: string
  name: string
  role: string
}

type ResetNotice = {
  email: string
  name: string
  link: string
}

type ReceiptNotice = {
  email: string
  name: string
  amount: number
  currency: string
  reference: string
}

export async function notifyPartnerSignup({ email, name, role }: SignupNotice) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM || !process.env.ADMIN_NOTIFY_EMAIL) {
    return
  }

  try {
    const { default: nodemailer } = await import("nodemailer")
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.ADMIN_NOTIFY_EMAIL,
      subject: "Bal Nova: Partner signup pending approval",
      text: `New partner signup awaiting approval.\n\nName: ${name}\nEmail: ${email}\nRole: ${role}\n\nReview in System Config.`,
    })
  } catch {
    // Ignore email failures to avoid blocking signup flow.
  }
}

export async function notifyPasswordReset({ email, name, link }: ResetNotice) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) {
    return
  }

  try {
    const { default: nodemailer } = await import("nodemailer")
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Bal Nova: Reset your password",
      text: `Hello ${name || "there"},\n\nUse the link below to reset your password:\n${link}\n\nIf you did not request this, you can ignore this email.`,
    })
  } catch {
    // Ignore email failures to avoid blocking reset flow.
  }
}

export async function notifyPaymentReceipt({ email, name, amount, currency, reference }: ReceiptNotice) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) {
    return
  }

  try {
    const { default: nodemailer } = await import("nodemailer")
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Bal Nova: Payment receipt",
      text: `Hello ${name || "there"},\n\nPayment received.\n\nAmount: ${currency} ${amount.toFixed(2)}\nReference: ${reference}\n\nThank you for your order.`
    })
  } catch {
    // Ignore email failures to avoid blocking payment flow.
  }
}
