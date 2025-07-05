# Bulk Email Sender

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Bootstrap](https://img.shields.io/badge/bootstrap-%23563D7C.svg?style=for-the-badge&logo=bootstrap&logoColor=white)

A complete web-based bulk email sending application built with **Bun**, **Hono**, and **TypeScript** featuring environment-based SMTP configuration and real-time monitoring.

## ✨ Features

| Feature                     | Description                                           |
| --------------------------- | ----------------------------------------------------- |
| 📧 **SMTP Configuration**   | Environment variables + manual override support       |
| 📊 **Excel Contact Import** | Upload and parse contact lists (.xlsx/.xls)           |
| ✏️ **WYSIWYG Editor**       | Rich email composition with Quill.js                  |
| 🎯 **Dynamic Placeholders** | Support for {{FirstName}}, {{Company}}, etc.          |
| ⏱️ **Configurable Delays**  | 15-30 seconds between emails to prevent rate limiting |
| 📈 **Real-time Reporting**  | Live statistics and comprehensive logging             |
| 📤 **Export Options**       | CSV and JSON report exports                           |
| 🎨 **Bootstrap 5 UI**       | Modern responsive interface                           |
| 🔒 **Secure Configuration** | Environment variable support with validation          |

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **[Bun](https://bun.sh/)** - JavaScript runtime and package manager
- **SMTP Server Credentials** - Gmail, Outlook, Yahoo, or custom SMTP server

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or create project directory
mkdir bulk-email-sender && cd bulk-email-sender

# Install dependencies
bun add hono nodemailer xlsx multer csv-stringify dotenv
bun add -d @types/nodemailer @types/multer typescript
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your SMTP settings:

```bash
# Gmail Example Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Your Name

# Server Configuration
PORT=3000
```

### 3. Gmail Setup (Recommended)

> **⚠️ Important**: Gmail requires App Passwords for third-party applications.

1. **Enable 2FA** on your Google account
2. **Generate an App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Navigate to **Security** → **2-Step Verification** → **App Passwords**
   - Generate password for "Mail"
   - Use this **16-character password** in `SMTP_PASS`

### 4. Run the Application

```bash
# Development mode (with auto-reload)
bun run dev

# Production mode
bun start
```

🌐 **Access the application**: [http://localhost:3000](http://localhost:3000)

## ⚙️ Configuration Options

### Environment Variables

The application supports the following environment variables in your `.env` file:

| Variable      | Description          | Example             | Required |
| ------------- | -------------------- | ------------------- | -------- |
| `PORT`        | Server port          | `3000`              | No       |
| `SMTP_HOST`   | SMTP server hostname | `smtp.gmail.com`    | Yes\*    |
| `SMTP_PORT`   | SMTP server port     | `465`               | Yes\*    |
| `SMTP_SECURE` | Use TLS/SSL          | `true`              | Yes\*    |
| `SMTP_USER`   | SMTP username/email  | `your@email.com`    | Yes\*    |
| `SMTP_PASS`   | SMTP password        | `your-app-password` | Yes\*    |
| `FROM_EMAIL`  | Default sender email | `your@email.com`    | Yes\*    |
| `FROM_NAME`   | Default sender name  | `Your Name`         | No       |

> **\*Note**: Required unless configured manually through the web interface.

### Manual Configuration

If no `.env` file is provided, you can configure SMTP settings manually through the web interface. This is useful for:

- Testing different SMTP providers
- One-time usage scenarios
- Dynamic configuration changes

## 📧 SMTP Provider Examples

### Gmail

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # 16-character app password
```

### Outlook/Hotmail

```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Yahoo Mail

```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

## 📖 Usage Guide

### Step 1: Configure SMTP

Choose one of the following options:

- **Option A**: Use `.env` file for automatic configuration (recommended)
- **Option B**: Enter settings manually in the web interface

### Step 2: Prepare Contact List

Create an Excel file (`.xlsx` or `.xls`) with the following structure:

| Column      | Required | Description                    |
| ----------- | -------- | ------------------------------ |
| `Email`     | ✅       | Recipient email address        |
| `FirstName` | ❌       | First name for personalization |
| `LastName`  | ❌       | Last name                      |
| `Company`   | ❌       | Company name                   |
| `Subject`   | ❌       | Custom subject per contact     |

**Example Excel format**:

| Email                | FirstName | LastName | Company      | Subject       |
| -------------------- | --------- | -------- | ------------ | ------------- |
| john.doe@example.com | John      | Doe      | Example Corp | Welcome John! |
| jane.smith@test.com  | Jane      | Smith    | Test Inc     | Hello Jane    |

### Step 3: Compose Email

1. **Use the WYSIWYG editor** to create your email content
2. **Add placeholders** like `{{FirstName}}`, `{{Company}}` for personalization
3. **Preview your email** before sending to verify placeholder replacement

### Step 4: Send & Monitor

1. **Configure delay** between emails (15-30 seconds recommended)
2. **Monitor real-time** sending progress in the dashboard
3. **View detailed reports** and export logs for analysis

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

## 📁 Project Structure

```
bulk-email-sender/
├── src/
│   ├── app.ts                 # Main application entry point
│   ├── types.ts              # TypeScript type definitions
│   ├── routes/               # API route handlers
│   │   ├── index.ts          # Static file serving
│   │   ├── send.ts           # Email sending logic
│   │   ├── report.ts         # Reporting endpoints
│   │   └── config.ts         # Configuration endpoints
│   └── services/             # Business logic services
│       ├── emailService.ts   # Email sending service
│       ├── fileService.ts    # File handling utilities
│       └── logService.ts     # Logging service
├── public/                   # Static frontend files
│   ├── index.html           # Main user interface
│   ├── css/style.css        # Custom styles
│   ├── js/app.js            # Frontend JavaScript
│   └── samples/             # Sample Excel files
├── uploads/                 # Temporary file storage
├── logs/                    # Email sending logs
├── .env                     # Environment configuration
├── .env.example            # Environment template
├── package.json            # Project dependencies
└── README.md               # This documentation
```

## 🔐 Security Best Practices

> **🚨 Security Checklist**

- ✅ **Never commit `.env` files** to version control
- ✅ **Use App Passwords** for Gmail (not regular passwords)
- ✅ **Secure SMTP credentials** - store in environment variables only
- ✅ **Respect sending limits** - follow provider guidelines
- ✅ **Anti-spam compliance** - ensure proper email practices
- ✅ **Input validation** - sanitize all user inputs
- ✅ **Rate limiting** - implement delays between emails

## 🐛 Troubleshooting

### Common Issues and Solutions

#### 1. POST /send Returns 400 Errors

**Problem**: The send request fails with 400 status

**Solutions**:

- Check console logs for specific error messages
- Ensure all required fields are filled:
  - SMTP Host, User, Password
  - From Email
  - Subject
  - Email Content (not empty)
  - Excel file is uploaded

**Debug Steps**:

```bash
# Check server logs for detailed error messages
bun run dev
# Look for lines like: "Validation failed:" or "Extracted data:"
```

#### 2. Excel File Not Processing

**Problem**: Excel file uploads but no contacts found

**Solutions**:

- Ensure Excel file has correct format:
  - First row must be headers
  - Must have "Email" column (case insensitive)
  - Use `.xlsx` or `.xls` format
  - Valid email addresses in Email column

**Debug Steps**:

- Check browser console for parsing errors
- Verify file has valid email addresses
- Try the sample Excel file first

#### 3. SMTP Connection Issues

**Problem**: "SMTP connection failed" error

**For Gmail**:

```bash
# Correct .env configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password  # NOT your regular password
```

**Steps**:

1. Enable 2FA on Google account
2. Generate App Password: Google Account → Security → 2-Step Verification → App Passwords
3. Use the 16-character app password in `SMTP_PASS`

**For Outlook/Hotmail**:

```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-regular-password
```

#### 4. Environment Variables Not Loading

**Problem**: Manual configuration required even with `.env` file

**Solutions**:

- Ensure `.env` file is in project root (same level as `package.json`)
- Check `.env` syntax - no spaces around `=`:

  ```bash
  # ✅ Correct
  SMTP_HOST=smtp.gmail.com

  # ❌ Incorrect
  SMTP_HOST = smtp.gmail.com
  ```

- Restart application after changing `.env`
- Check console for "✅ SMTP configuration found" message

#### 5. Placeholder Not Replacing

**Problem**: `{{FirstName}}` shows as literal text instead of actual names

**Solutions**:

- Ensure Excel column headers match placeholder names exactly
- Case matters: `FirstName` not `firstname`
- Check Excel file has data in those columns
- Use preview to test placeholder replacement

### Debug Commands

**View detailed logs**:

```bash
# Run in development mode to see all logs
bun run dev
```

**Test SMTP settings**:

```javascript
// In browser console
fetch("/config/smtp")
  .then((r) => r.json())
  .then(console.log);
```

**Check Excel parsing**:

```javascript
// Upload file and check browser Network tab
// Look for /parse-excel request and response
```

## ⚡ Performance Tips

| Scenario                | Recommendation                             |
| ----------------------- | ------------------------------------------ |
| **Large contact lists** | Process in batches of 100-200 contacts     |
| **Memory usage**        | Monitor for large Excel files (1000+ rows) |
| **SMTP limits**         | Respect provider daily/hourly limits       |
| **Delay settings**      | Keep 15-30 seconds to avoid rate limiting  |

### Provider Limits

| Provider          | Daily Limit  | Hourly Limit | Notes                   |
| ----------------- | ------------ | ------------ | ----------------------- |
| Gmail (Free)      | 100 emails   | 20 emails    | Use app passwords       |
| Gmail (Workspace) | 2,000 emails | 100 emails   | Higher limits available |
| Outlook           | Varies       | Varies       | Depends on account type |
| Yahoo             | 100 emails   | 20 emails    | Similar to Gmail free   |

## 🛠️ Development

### Adding New Features

**Routes**: Add new endpoints in `src/routes/`

```typescript
// Example: src/routes/newFeature.ts
import { Hono } from "hono";

const newFeature = new Hono();
newFeature.get("/endpoint", async (c) => {
  // Implementation
});

export default newFeature;
```

**Services**: Add business logic in `src/services/`

```typescript
// Example: src/services/newService.ts
export class NewService {
  async processData(data: any) {
    // Service logic
  }
}
```

**Frontend**: Update `public/` files

- HTML: `public/index.html`
- CSS: `public/css/style.css`
- JavaScript: `public/js/app.js`

**Types**: Update `src/types.ts` for TypeScript support

```typescript
export interface NewInterface {
  property: string;
  // Additional properties
}
```

### Environment Variables

**Adding new variables**:

1. Add to `.env.example`
2. Update configuration loading in `src/routes/config.ts`
3. Document in README

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:

1. **Check the troubleshooting section** above
2. **Verify your SMTP provider settings**
3. **Check console logs** for error messages
4. **Ensure all dependencies** are installed correctly

### Getting Help

If issues persist:

- ✅ Check browser console for JavaScript errors
- ✅ Check server console for backend errors
- ✅ Verify `.env` file format and values
- ✅ Test with sample Excel file first
- ✅ Try minimal configuration (manual SMTP) to isolate issues

---

## 🎉 Quick Fix Highlights

### Recently Fixed Issues

#### ✅ Subject Field Missing

- **Problem**: Subject field wasn't being captured from the form
- **Solution**: Manual extraction and validation of subject field
- **Result**: No more "Missing required fields: Subject" errors

#### ✅ Gmail App Password Handling

- **Problem**: Had to re-enter app password even with `.env` configuration
- **Solution**: Smart detection of environment variables with read-only fields
- **Result**: When using `.env`, password field shows "✅ App password configured"

### What You'll See Now

**On page load**:

- Fields auto-populate with `.env` values
- Password field shows "✅ App password configured in .env file"
- Fields become read-only (grayed out) since they're from `.env`

**When sending**:

- No more password prompts
- Subject field properly captured
- Success message: "Using .env configuration"

**Better debugging**:

- Console shows: `Subject: "Your actual subject"`
- Clear validation messages

---

**Happy Email Sending! 📧✨**
