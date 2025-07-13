# Bulk Email Sender

A web-based email campaign tool built with **Bun**, **Hono**, and **TypeScript**. It supports importing contacts from Excel, personalized templates, scheduling, and detailed delivery reports. User accounts with individual SMTP profiles allow multiple people to use the system securely.

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Bootstrap](https://img.shields.io/badge/bootstrap-%23563D7C.svg?style=for-the-badge&logo=bootstrap&logoColor=white)

## Features

- **User authentication** with session management
- **SMTP configuration per user** with optional global defaults
- **Excel (.xlsx/.xls) contact import** with dynamic placeholder support
- **Rich email editor** powered by Quill
- **Batch sending** and **scheduled jobs** with email notifications on completion
- **Real‑time dashboard** for monitoring progress and logs
- Built using **Bootstrap 5** for the UI

## Getting Started

### Installation

```bash
bun install
```

### Environment setup

Create a `.env` file based on the template below. Values can be left empty to configure SMTP settings through the web interface.

```env
# Bulk Email Sender configuration

NODE_ENV=production
PORT=3000

# Security Keys
SESSION_SECRET=(REPLACE WITH YOUR GENERATED KEYS!)

# Cookie Settings
USE_SECURE_COOKIES=false (TRUE IF HTTPS)

# HTTPS Settings
# FORCE_HTTPS=true
# TRUST_PROXY=true

# Default SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=you@example.com
SMTP_PASS=app_password
FROM_EMAIL=you@example.com
FROM_NAME=Your Name

# Optional notification SMTP (for job completion emails)
NOTIFICATION_SMTP_HOST=smtp.gmail.com
NOTIFICATION_SMTP_PORT=587
NOTIFICATION_SMTP_SECURE=true
NOTIFICATION_SMTP_USER=notify@example.com
NOTIFICATION_SMTP_PASS=notify_password
NOTIFICATION_FROM_NAME=Campaign Notifier
```

### Running the server

```bash
bun run dev  # development with reload
bun start    # production
```

The dashboard will be available at `http://localhost:3000`.

### Gmail Setup (Recommended)

> **⚠️ Important**: Gmail requires App Passwords for third-party applications.

1. **Enable 2FA** on your Google account
2. **Generate an App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Navigate to **Security** → **2-Step Verification** → **App Passwords**
   - Generate password for "Mail"
   - Use this **16-character password**

**Example Excel format**:

| Email                | FirstName | LastName | Company      | Subject       |
| -------------------- | --------- | -------- | ------------ | ------------- |
| john.doe@example.com | John      | Doe      | Example Corp | Welcome John! |
| jane.smith@test.com  | Jane      | Smith    | Test Inc     | Hello Jane    |

### Compose Email

1. **Use the WYSIWYG editor** to create your email content
2. **Add placeholders** like `{{FirstName}}`, `{{Company}}` for personalization
3. **Preview your email** before sending to verify placeholder replacement

## 🏷️ Placeholder System

Use these placeholders in your email content and subject line:

| Placeholder        | Description            | Example                           |
| ------------------ | ---------------------- | --------------------------------- |
| `{{FirstName}}`    | Recipient's first name | `Hello {{FirstName}}!`            |
| `{{LastName}}`     | Recipient's last name  | `Dear {{FirstName}} {{LastName}}` |
| `{{Company}}`      | Company name           | `Welcome to {{Company}}`          |
| `{{Email}}`        | Recipient's email      | `Your account: {{Email}}`         |
| `{{CustomColumn}}` | Any other Excel column | `Your ID: {{CustomColumn}}`       |

**Example usage**:

```html
Subject: Welcome to our service, {{FirstName}}! Hello {{FirstName}}, Thank you
for your interest in our services at {{Company}}. We're excited to work with
you! Best regards, The Team
```

## 🔌 API Endpoints

| Method   | Endpoint              | Description                    |
| -------- | --------------------- | ------------------------------ |
| `GET`    | `/`                   | Main application interface     |
| `GET`    | `/config/smtp`        | Get current SMTP configuration |
| `POST`   | `/send`               | Send bulk emails               |
| `GET`    | `/report`             | Get email logs and statistics  |
| `GET`    | `/report/export/csv`  | Export logs as CSV             |
| `GET`    | `/report/export/json` | Export logs as JSON            |
| `DELETE` | `/report/clear`       | Clear all logs                 |

## Contributing

Contributions are welcome! The frontend currently uses plain HTML, but you can introduce [Svelte](https://svelte.dev/) with TypeScript to build more modular components. Feel free to open issues or pull requests with improvements.

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**Happy Email Sending! 📧✨**
