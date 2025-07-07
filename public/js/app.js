// Initialize Quill editor
let quill;
let smtpDefaults = {};
let currentContacts = [];

document.addEventListener("DOMContentLoaded", function () {
  // Initialize Quill
  quill = new Quill("#editor", {
    theme: "snow",
    placeholder:
      "Write your email content here... Use {{FirstName}}, {{Company}} for personalization.",
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link", "image"],
        ["clean"],
      ],
    },
  });

  // Load SMTP configuration from server
  loadSMTPDefaults();

  // Load initial report
  refreshReport();

  // Add event listener for Excel file changes
  const excelFileInput = document.querySelector('input[name="excelFile"]');
  if (excelFileInput) {
    excelFileInput.addEventListener("change", handleExcelFileChange);
  }

  // Batch processing controls
  const useBatchCheckbox = document.getElementById("useBatch");
  if (useBatchCheckbox) {
    useBatchCheckbox.addEventListener("change", function () {
      const batchSettings = document.getElementById("batchSettings");
      if (this.checked) {
        batchSettings.classList.remove("d-none");
        updateBatchPreview();
      } else {
        batchSettings.classList.add("d-none");
      }
    });
  }

  // Update batch preview when settings change
  ["batchSize", "batchDelay", "emailDelay"].forEach((fieldName) => {
    const field = document.querySelector(`input[name="${fieldName}"]`);
    if (field) {
      field.addEventListener("input", updateBatchPreview);
    }
  });
});

function updateBatchPreview() {
  const batchSize =
    parseInt(document.querySelector('input[name="batchSize"]').value) || 20;
  const batchDelay =
    parseInt(document.querySelector('input[name="batchDelay"]').value) || 60;
  const emailDelay =
    parseInt(document.querySelector('input[name="emailDelay"]').value) || 45;

  // Calculate based on current contacts if available
  const totalContacts = currentContacts.length || 100; // Use 100 as example
  const totalBatches = Math.ceil(totalContacts / batchSize);
  const totalTime = (totalBatches * batchDelay) / 60; // Convert to hours

  const preview = `
    📊 <strong>${totalContacts} contacts</strong> → 
    <strong>${totalBatches} batches</strong> of ${batchSize} emails<br>
    ⏱️ Total time: ~${totalTime.toFixed(1)} hours 
    (${emailDelay}s between emails, ${batchDelay}min between batches)
  `;

  const previewElement = document.getElementById("batchPreview");
  if (previewElement) {
    previewElement.innerHTML = preview;
  }
}

// Batch monitoring
let batchStatusInterval;

function startBatchMonitoring() {
  batchStatusInterval = setInterval(checkBatchStatus, 5000); // Check every 5 seconds
}

function stopBatchMonitoring() {
  if (batchStatusInterval) {
    clearInterval(batchStatusInterval);
    batchStatusInterval = null;
  }
}

async function checkBatchStatus() {
  try {
    const response = await fetch("/batch-status");
    const result = await response.json();

    if (result.success && result.data.isRunning) {
      showBatchStatus(result.data);
    } else {
      hideBatchStatus();
      stopBatchMonitoring();
    }
  } catch (error) {
    console.error("Error checking batch status:", error);
  }
}

function showBatchStatus(batchData) {
  const container = document.getElementById("batchStatusContainer");
  const progress = document.getElementById("batchProgress");

  if (batchData.currentJob) {
    const job = batchData.currentJob;
    const progressPercent = (
      ((job.emailsSent + job.emailsFailed) / job.totalContacts) *
      100
    ).toFixed(1);

    progress.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <strong>Job Status:</strong> <span class="badge bg-primary">${
            job.status
          }</span><br>
          <strong>Progress:</strong> ${job.emailsSent + job.emailsFailed}/${
      job.totalContacts
    } (${progressPercent}%)<br>
          <strong>Batch:</strong> ${job.currentBatch}/${job.totalBatches}
        </div>
        <div class="col-md-6">
          <strong>Sent:</strong> <span class="text-success">${
            job.emailsSent
          }</span><br>
          <strong>Failed:</strong> <span class="text-danger">${
            job.emailsFailed
          }</span><br>
          <strong>Next Batch:</strong> ${
            job.nextBatchTime
              ? new Date(job.nextBatchTime).toLocaleTimeString()
              : "N/A"
          }
        </div>
      </div>
      <div class="progress mt-2">
        <div class="progress-bar" style="width: ${progressPercent}%">${progressPercent}%</div>
      </div>
    `;

    container.classList.remove("d-none");
  }
}

function hideBatchStatus() {
  const container = document.getElementById("batchStatusContainer");
  if (container) {
    container.classList.add("d-none");
  }
}

async function pauseBatch() {
  try {
    const response = await fetch("/batch-pause", { method: "POST" });
    const result = await response.json();
    if (result.success) {
      showAlert("warning", "⏸️ Batch job paused");
    }
  } catch (error) {
    showAlert("danger", `❌ Error pausing batch: ${error.message}`);
  }
}

async function resumeBatch() {
  try {
    const response = await fetch("/batch-resume", { method: "POST" });
    const result = await response.json();
    if (result.success) {
      showAlert("success", "▶️ Batch job resumed");
    }
  } catch (error) {
    showAlert("danger", `❌ Error resuming batch: ${error.message}`);
  }
}

async function cancelBatch() {
  if (!confirm("Are you sure you want to cancel the current batch job?"))
    return;

  try {
    const response = await fetch("/batch-cancel", { method: "DELETE" });
    const result = await response.json();
    if (result.success) {
      showAlert("info", "❌ Batch job cancelled");
      hideBatchStatus();
      stopBatchMonitoring();
    }
  } catch (error) {
    showAlert("danger", `❌ Error cancelling batch: ${error.message}`);
  }
}

async function handleExcelFileChange() {
  const fileInput = document.querySelector('input[name="excelFile"]');
  const file = fileInput.files[0];

  if (file) {
    console.log("Excel file selected:", file.name);
    showAlert("info", `📄 Excel file "${file.name}" selected. Processing...`);

    try {
      await parseExcelFile(file);
    } catch (error) {
      console.error("Error processing Excel file:", error);
      showAlert("danger", `❌ Error processing Excel file: ${error.message}`);
    }
  }
}

async function parseExcelFile(file) {
  const formData = new FormData();
  formData.append("excelFile", file);

  try {
    const response = await fetch("/parse-excel", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      currentContacts = result.contacts;

      // Show success status
      const statusDiv = document.getElementById("excelStatus");
      const detailsSpan = document.getElementById("excelDetails");
      if (statusDiv && detailsSpan) {
        statusDiv.classList.remove("d-none");
        detailsSpan.textContent = `Found ${result.totalCount} contacts. Preview will use real data.`;
      }

      showAlert(
        "success",
        `✅ Excel file processed successfully! Found ${result.totalCount} contacts. Preview updated.`
      );
      console.log("Parsed contacts:", currentContacts);

      // Update batch preview if batch mode is enabled
      const useBatch = document.getElementById("useBatch");
      if (useBatch && useBatch.checked) {
        updateBatchPreview();
      }
    } else {
      // Hide status on error
      const statusDiv = document.getElementById("excelStatus");
      if (statusDiv) {
        statusDiv.classList.add("d-none");
      }

      showAlert("danger", `❌ Failed to parse Excel file: ${result.message}`);
      currentContacts = [];
    }
  } catch (error) {
    console.error("Error parsing Excel file:", error);

    // Hide status on error
    const statusDiv = document.getElementById("excelStatus");
    if (statusDiv) {
      statusDiv.classList.add("d-none");
    }

    showAlert("danger", `❌ Error parsing Excel file: ${error.message}`);
    currentContacts = [];
  }
}

async function loadSMTPDefaults() {
  try {
    const response = await fetch("/config/smtp");
    const result = await response.json();

    if (result.success) {
      smtpDefaults = result.data;

      // Populate form fields with defaults if they exist
      if (result.hasConfig) {
        const hostField = document.querySelector('input[name="smtpHost"]');
        const portField = document.querySelector('input[name="smtpPort"]');
        const secureField = document.querySelector('input[name="smtpSecure"]');
        const userField = document.querySelector('input[name="smtpUser"]');
        const passField = document.querySelector('input[name="smtpPass"]');
        const fromEmailField = document.querySelector(
          'input[name="fromEmail"]'
        );
        const fromNameField = document.querySelector('input[name="fromName"]');

        if (smtpDefaults.host && hostField) {
          hostField.value = smtpDefaults.host;
          hostField.removeAttribute("required");
          hostField.classList.add("bg-light");
          hostField.readOnly = true;
        }

        if (smtpDefaults.port && portField) {
          portField.value = smtpDefaults.port;
        }

        if (smtpDefaults.secure !== undefined && secureField) {
          secureField.checked = smtpDefaults.secure;
        }

        if (smtpDefaults.user && userField) {
          userField.value = smtpDefaults.user;
          userField.removeAttribute("required");
          userField.classList.add("bg-light");
          userField.readOnly = true;
        }

        if (smtpDefaults.pass && passField) {
          // For app passwords, just show that it's configured
          passField.placeholder = "••••••••••••••••";
          passField.value = ""; // Don't show the actual password
          passField.removeAttribute("required");
          passField.classList.add("bg-light");

          // Add helpful text
          const helpText = document.createElement("small");
          helpText.className = "text-success";
          helpText.innerHTML = "✅ App password configured in .env file";
          passField.parentNode.appendChild(helpText);
        }

        if (smtpDefaults.fromEmail && fromEmailField) {
          fromEmailField.value = smtpDefaults.fromEmail;
          fromEmailField.removeAttribute("required");
          fromEmailField.classList.add("bg-light");
          fromEmailField.readOnly = true;
        }

        if (smtpDefaults.fromName && fromNameField) {
          fromNameField.value = smtpDefaults.fromName;
          fromNameField.classList.add("bg-light");
          fromNameField.readOnly = true;
        }

        // Show success message
        showAlert(
          "success",
          "✅ SMTP configuration loaded from environment variables. App password is configured - no need to enter it again!"
        );

        // Show environment config alert
        const envAlert = document.getElementById("envConfigAlert");
        if (envAlert) {
          envAlert.classList.remove("d-none");
        }
      } else {
        showAlert(
          "warning",
          "⚠️ No SMTP configuration found in .env file. Please configure manually."
        );
      }
    }
  } catch (error) {
    console.error("Error loading SMTP defaults:", error);
    showAlert("info", "ℹ️ Using manual SMTP configuration");
  }
}

function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.add("d-none");
  });

  // Show selected tab
  document.getElementById(tabName + "-tab").classList.remove("d-none");

  // Update navbar active state
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
  });
  event.target.classList.add("active");

  // Refresh report if switching to report tab
  if (tabName === "report") {
    refreshReport();
  }
}

async function sendEmails() {
  // Validate required fields first
  const subjectField = document.querySelector('input[name="subject"]');
  const excelFileField = document.querySelector('input[name="excelFile"]');

  if (!subjectField || !subjectField.value.trim()) {
    showAlert("danger", "❌ Subject is required");
    subjectField?.focus();
    return;
  }

  if (!excelFileField.files || excelFileField.files.length === 0) {
    showAlert("danger", "❌ Excel file is required");
    return;
  }

  // Check if content is provided
  const htmlContent = quill.root.innerHTML;
  if (
    !htmlContent ||
    htmlContent.trim() === "" ||
    htmlContent === "<p><br></p>"
  ) {
    showAlert("danger", "❌ Email content is required");
    return;
  }

  const form = document.getElementById("emailForm");
  const formData = new FormData(form);

  // Manually add the subject field to ensure it's included
  formData.set("subject", subjectField.value.trim());

  // Add Quill content to form data
  formData.set("htmlContent", htmlContent);

  // Add batch processing fields
  const useBatchElement = document.getElementById("useBatch");
  const useBatch = useBatchElement ? useBatchElement.checked : false;
  formData.set("useBatch", useBatch ? "on" : "off");

  if (useBatch) {
    const batchSizeElement = document.querySelector('input[name="batchSize"]');
    const batchDelayElement = document.querySelector(
      'input[name="batchDelay"]'
    );
    const emailDelayElement = document.querySelector(
      'input[name="emailDelay"]'
    );

    const batchSize = batchSizeElement ? batchSizeElement.value : "20";
    const batchDelay = batchDelayElement ? batchDelayElement.value : "60";
    const emailDelay = emailDelayElement ? emailDelayElement.value : "45";

    formData.set("batchSize", batchSize);
    formData.set("batchDelay", batchDelay);
    formData.set("emailDelay", emailDelay);
  }

  // Add file inputs to form data
  const excelFile = excelFileField.files[0];
  const htmlTemplate = document.querySelector('input[name="htmlTemplate"]')
    .files[0];

  if (excelFile) {
    formData.set("excelFile", excelFile);
  }

  if (htmlTemplate) {
    formData.set("htmlTemplate", htmlTemplate);
  }

  // Handle environment variable defaults more intelligently
  const fieldsToCheck = [
    "smtpHost",
    "smtpUser",
    "smtpPass",
    "fromEmail",
    "fromName",
  ];
  fieldsToCheck.forEach((fieldName) => {
    const field = document.querySelector(`input[name="${fieldName}"]`);
    const envKey = fieldName.replace("smtp", "").toLowerCase();

    // If field is empty but we have env default, use the env value
    if (
      field &&
      (!field.value || field.value.trim() === "") &&
      smtpDefaults[envKey]
    ) {
      console.log(`Using environment default for ${fieldName}`);
      formData.set(fieldName, smtpDefaults[envKey]);
    }

    // Special handling for password field when using app password
    if (
      fieldName === "smtpPass" &&
      field &&
      field.placeholder === "••••••••••••••••" &&
      smtpDefaults.pass
    ) {
      // If password field shows placeholder (meaning we have env password), use env value
      formData.set("smtpPass", smtpDefaults.pass);
      console.log("Using app password from environment");
    }
  });

  // Debug: Log what we're about to send
  console.log("Form data being sent:");
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      console.log(`${key}: File - ${value.name} (${value.size} bytes)`);
    } else if (key.includes("Pass")) {
      console.log(`${key}: [HIDDEN]`);
    } else {
      console.log(`${key}: ${value}`);
    }
  }

  // Update button state
  const sendButton = document.getElementById("sendButtonText");
  const spinner = document.getElementById("sendButtonSpinner");
  sendButton.textContent = "Sending...";
  spinner.classList.remove("d-none");

  try {
    console.log("Sending email request...");
    const response = await fetch("/send", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    console.log("Send response:", result);

    if (result.success) {
      let message = `✅ ${result.message}`;
      if (result.usingEnvConfig) {
        message += " (Using .env configuration)";
      }

      showAlert("success", message);

      // If batch mode, start monitoring
      if (result.batchMode) {
        startBatchMonitoring();
        setTimeout(() => {
          showTab("report");
        }, 2000);
      } else {
        // Switch to report tab to see progress
        setTimeout(() => {
          showTab("report");
        }, 2000);
      }
    } else {
      showAlert("danger", `❌ ${result.message}`);
    }
  } catch (error) {
    console.error("Send error:", error);
    showAlert("danger", `❌ Error: ${error.message}`);
  } finally {
    // Reset button state
    sendButton.textContent = "🚀 Send Emails";
    spinner.classList.add("d-none");
  }
}

function testSMTPConnection() {
  showAlert("info", "🔍 Testing SMTP connection...");
  // This would be implemented as a separate endpoint if needed
}

async function refreshReport() {
  try {
    const response = await fetch("/report");
    const result = await response.json();

    if (result.success) {
      displayStats(result.data.stats);
      displayLogs(result.data.logs);
    }
  } catch (error) {
    console.error("Error fetching report:", error);
    showAlert("danger", "Failed to load report data");
  }
}

function displayStats(stats) {
  const container = document.getElementById("statsContainer");
  container.innerHTML = `
        <div class="col-md-3">
            <div class="card stat-card">
                <div class="card-body text-center">
                    <h5 class="card-title">${stats.total}</h5>
                    <p class="card-text">Total Emails</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card stat-card success">
                <div class="card-body text-center">
                    <h5 class="card-title text-success">${stats.sent}</h5>
                    <p class="card-text">Sent Successfully</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card stat-card danger">
                <div class="card-body text-center">
                    <h5 class="card-title text-danger">${stats.failed}</h5>
                    <p class="card-text">Failed</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card stat-card warning">
                <div class="card-body text-center">
                    <h5 class="card-title text-warning">${stats.errors}</h5>
                    <p class="card-text">Errors</p>
                </div>
            </div>
        </div>
    `;
}

function displayLogs(logs) {
  const tbody = document.getElementById("reportTableBody");

  if (logs.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">No email logs found</td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = logs
    .map(
      (log) => `
        <tr>
            <td>${log.email}</td>
            <td><span class="status-${log.status.toLowerCase()}">${
        log.status
      }</span></td>
            <td>${log.firstName || "-"}</td>
            <td>${log.company || "-"}</td>
            <td>${log.subject || "-"}</td>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td>${log.messageId || "-"}</td>
            <td>${log.message || "-"}</td>
        </tr>
    `
    )
    .join("");
}

async function exportReport(format) {
  try {
    const response = await fetch(`/report/export/${format}`);

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `email-logs.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showAlert("success", `Report exported as ${format.toUpperCase()}`);
    } else {
      showAlert("danger", "Failed to export report");
    }
  } catch (error) {
    showAlert("danger", `Export error: ${error.message}`);
  }
}

async function clearLogs() {
  if (!confirm("Are you sure you want to clear all email logs?")) {
    return;
  }

  try {
    const response = await fetch("/report/clear", {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.success) {
      showAlert("success", "All logs cleared successfully");
      refreshReport();
    } else {
      showAlert("danger", "Failed to clear logs");
    }
  } catch (error) {
    showAlert("danger", `Error: ${error.message}`);
  }
}

function previewEmail() {
  const subject = document.querySelector('input[name="subject"]').value;
  const content = quill.root.innerHTML;

  // Use actual data from uploaded Excel file if available
  let sampleData = {
    FirstName: "John",
    LastName: "Doe",
    Company: "Example Corp",
    Email: "john.doe@example.com",
  };

  // If we have parsed contacts, use the first contact for preview
  if (currentContacts && currentContacts.length > 0) {
    sampleData = { ...currentContacts[0] };
    console.log("Using real contact data for preview:", sampleData);
  } else {
    console.log("Using sample data for preview (no Excel file parsed yet)");
  }

  // Replace placeholders for preview
  let previewSubject = subject;
  let previewContent = content;

  Object.keys(sampleData).forEach((key) => {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    previewSubject = previewSubject.replace(placeholder, sampleData[key] || "");
    previewContent = previewContent.replace(placeholder, sampleData[key] || "");
  });

  document.getElementById("previewSubject").textContent = previewSubject;
  document.getElementById("previewContent").innerHTML = previewContent;

  // Show which data source was used
  const previewInfo =
    currentContacts && currentContacts.length > 0
      ? `<div class="alert alert-info mb-3">📄 Preview using data from: <strong>${sampleData.Email}</strong> (from your Excel file)</div>`
      : `<div class="alert alert-warning mb-3">⚠️ Preview using sample data. Upload an Excel file to see real data preview.</div>`;

  document.getElementById("previewContent").innerHTML =
    previewInfo + previewContent;

  const modal = new bootstrap.Modal(document.getElementById("previewModal"));
  modal.show();
}

function showAlert(type, message) {
  // Remove existing alerts
  const existingAlerts = document.querySelectorAll(".alert");
  existingAlerts.forEach((alert) => alert.remove());

  // Create new alert
  const alert = document.createElement("div");
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  // Insert at the top of the container
  const container = document.querySelector(".container-fluid");
  container.insertBefore(alert, container.children[1]);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (alert.parentNode) {
      alert.remove();
    }
  }, 5000);
}
