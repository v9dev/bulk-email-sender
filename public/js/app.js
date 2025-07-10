// Initialize Quill editor
let quill;
let smtpDefaults = {};
let currentContacts = [];
let reportRefreshInterval;
let countdownInterval;
let jobDashboardInterval;

// NEW: Add toggle variables
let currentMode = "env"; // Track current mode
let envConfig = {};
let customConfig = {};

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

  // Start real-time report updates
  startRealtimeReportUpdates();

  // Add event listener for Excel file changes
  const excelFileInput = document.querySelector('input[name="excelFile"]');
  if (excelFileInput) {
    excelFileInput.addEventListener("change", handleExcelFileChange);
  }

  // Add event listener for HTML template changes
  const htmlTemplateInput = document.querySelector(
    'input[name="htmlTemplate"]'
  );
  if (htmlTemplateInput) {
    htmlTemplateInput.addEventListener("change", handleHtmlTemplateChange);
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

  // Add scheduling controls
  const scheduleEmailCheckbox = document.getElementById("scheduleEmail");
  if (scheduleEmailCheckbox) {
    scheduleEmailCheckbox.addEventListener("change", function () {
      const scheduleSettings = document.getElementById("scheduleSettings");
      const sendButton = document.getElementById("sendButtonText");
      const scheduleIndicator = document.getElementById("scheduleIndicator");

      if (this.checked) {
        scheduleSettings.classList.remove("d-none");
        sendButton.textContent = "📅 Schedule Campaign";
        scheduleIndicator.classList.remove("d-none");

        // Set minimum datetime to now + 5 minutes
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        document.getElementById("scheduledTime").min = now
          .toISOString()
          .slice(0, 16);
        document.getElementById("scheduledTime").value = now
          .toISOString()
          .slice(0, 16);

        refreshScheduledJobs();
      } else {
        scheduleSettings.classList.add("d-none");
        sendButton.textContent = "🚀 Send Emails";
        scheduleIndicator.classList.add("d-none");
      }
    });
  }

  // Provider detection on SMTP host change
  const smtpHostField = document.querySelector('input[name="smtpHost"]');
  if (smtpHostField) {
    smtpHostField.addEventListener("blur", checkProviderLimits);
  }

  // Notification email change
  const notifyEmailField = document.querySelector('input[name="notifyEmail"]');
  if (notifyEmailField) {
    notifyEmailField.addEventListener("input", checkProviderLimits);
  }

  // Request browser notification permission
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Start monitoring scheduled jobs
  startScheduledJobMonitoring();
  refreshScheduledJobs();

  // Load job dashboard on page load
  loadJobDashboard();

  // Poll dashboard every 3 seconds
  jobDashboardInterval = setInterval(loadJobDashboard, 3000);
});

// NEW: SMTP Mode Toggle Functions
async function toggleSMTPMode() {
  const newMode = currentMode === "env" ? "custom" : "env";

  try {
    const response = await fetch("/config/smtp/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });

    const result = await response.json();

    if (result.success) {
      currentMode = result.currentMode;
      showAlert("success", result.message);

      // Reload configuration to reflect the change
      await loadSMTPDefaults();
    } else {
      showAlert("danger", result.message);
    }
  } catch (error) {
    showAlert("danger", `❌ Failed to switch mode: ${error.message}`);
  }
}

function updateModeDisplay() {
  const modeButton = document.getElementById("modeToggleButton");
  const modeIndicator = document.getElementById("modeIndicator");
  const configStatus = document.getElementById("configStatus");

  if (currentMode === "env") {
    // .env mode
    modeButton.innerHTML = "⚙️ Use Custom Settings";
    modeButton.className = "btn btn-outline-warning btn-sm";
    modeIndicator.innerHTML = "🔒 Using .env Configuration";
    modeIndicator.className = "config-status-locked";
    configStatus.innerHTML =
      '<span class="config-status-locked">🔒 .env Mode</span>';

    // Lock all fields
    lockSMTPFields(true);
  } else {
    // Custom mode
    modeButton.innerHTML = "🔒 Use .env Settings";
    modeButton.className = "btn btn-outline-success btn-sm";
    modeIndicator.innerHTML = "⚙️ Using Custom Configuration";
    modeIndicator.className = "config-status-editable";
    configStatus.innerHTML =
      '<span class="config-status-editable">⚙️ Custom Mode</span>';

    // Unlock all fields
    lockSMTPFields(false);
    setupSMTPConfigSaving();
  }
}

function lockSMTPFields(locked) {
  const fieldNames = [
    "smtpHost",
    "smtpPort",
    "smtpSecure",
    "smtpUser",
    "smtpPass",
    "fromEmail",
    "fromName",
  ];

  fieldNames.forEach((name) => {
    const field = document.querySelector(
      `input[name="${name}"], input[id="${name}"]`
    );
    if (field) {
      field.disabled = locked;

      if (locked) {
        field.classList.add("field-locked");
        field.style.cursor = "not-allowed";
      } else {
        field.classList.remove("field-locked");
        field.style.cursor = "text";
      }
    }
  });

  // Handle labels
  document.querySelectorAll(".form-label").forEach((label) => {
    const existingLock = label.querySelector(".lock-indicator");
    if (locked && !existingLock) {
      const lockIcon = document.createElement("span");
      lockIcon.innerHTML = " 🔒";
      lockIcon.className = "lock-indicator";
      lockIcon.title = "Locked - using .env configuration";
      label.appendChild(lockIcon);
    } else if (!locked && existingLock) {
      existingLock.remove();
    }
  });
}

function setupSMTPConfigSaving() {
  if (currentMode === "env") {
    return; // Don't setup saving in env mode
  }

  const smtpFields = [
    "smtpHost",
    "smtpPort",
    "smtpSecure",
    "smtpUser",
    "smtpPass",
    "fromEmail",
    "fromName",
  ];

  smtpFields.forEach((name) => {
    const input = document.querySelector(`[name="${name}"], [id="${name}"]`);
    if (input && !input.disabled) {
      // Remove existing listeners to prevent duplicates
      input.removeEventListener("change", debouncedSave);
      input.addEventListener("change", debouncedSave);
    }
  });
}

const debouncedSave = debounce(saveSMTPConfig, 500);

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

async function saveSMTPConfig() {
  if (currentMode === "env") {
    showAlert("warning", "🔒 Cannot modify settings in .env mode");
    return;
  }

  const data = {
    host: document.querySelector('[name="smtpHost"]').value,
    port: parseInt(document.querySelector('[name="smtpPort"]').value),
    secure: document.querySelector('[name="smtpSecure"]').checked,
    user: document.querySelector('[name="smtpUser"]').value,
    pass: document.querySelector('[name="smtpPass"]').value,
    fromEmail: document.querySelector('[name="fromEmail"]').value,
    fromName: document.querySelector('[name="fromName"]').value,
  };

  try {
    const response = await fetch("/config/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.success) {
      customConfig = result.data;
      console.log("✅ Custom SMTP config saved");
    } else {
      showAlert("danger", result.message);
    }
  } catch (err) {
    console.error("Error saving custom SMTP config:", err);
    showAlert("danger", "❌ Failed to save custom configuration");
  }
}

// Handle HTML template upload
async function handleHtmlTemplateChange() {
  const fileInput = document.querySelector('input[name="htmlTemplate"]');
  const file = fileInput.files[0];

  if (file) {
    document.getElementById("htmlTemplateStatus").classList.remove("d-none");
    document.getElementById("contentOptional").classList.remove("d-none");

    // Update editor placeholder
    const editorElement = document.querySelector(".ql-editor");
    if (editorElement) {
      editorElement.setAttribute(
        "data-placeholder",
        "Content will be loaded from HTML template (optional override)"
      );
    }

    showAlert(
      "info",
      `📄 HTML template "${file.name}" selected. Content editor is now optional.`
    );
  } else {
    document.getElementById("htmlTemplateStatus").classList.add("d-none");
    document.getElementById("contentOptional").classList.add("d-none");
  }
}

// Start real-time report updates
function startRealtimeReportUpdates() {
  // Update reports every 2 seconds when on report tab
  reportRefreshInterval = setInterval(() => {
    const reportTab = document.getElementById("report-tab");
    if (reportTab && !reportTab.classList.contains("d-none")) {
      refreshReport(true); // silent refresh
    }
  }, 2000);
}

// Show success modal instead of just alert
function showSuccessModal(title, message, details) {
  const modalHtml = `
    <div class="modal fade" id="successModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="text-center mb-3">
              <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
            </div>
            <p class="text-center fs-5">${message}</p>
            ${details ? `<div class="alert alert-info">${details}</div>` : ""}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" onclick="showTab('report')" data-bs-dismiss="modal">View Reports</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if any
  const existingModal = document.getElementById("successModal");
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to body
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById("successModal"));
  modal.show();

  // Auto redirect to reports after 3 seconds
  setTimeout(() => {
    const modalElement = document.getElementById("successModal");
    if (modalElement) {
      modal.hide();
      showTab("report");
    }
  }, 3000);
}

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
  checkBatchStatus(); // Check immediately
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

// Enhanced batch monitoring with countdown
function showBatchStatus(batchData) {
  const container = document.getElementById("batchStatusContainer");
  const progress = document.getElementById("batchProgress");

  if (batchData.currentJob) {
    const job = batchData.currentJob;
    const progressPercent = (
      ((job.emailsSent + job.emailsFailed) / job.totalContacts) *
      100
    ).toFixed(1);

    // Calculate time until next batch
    let nextBatchCountdown = "";
    if (job.nextBatchTime && job.status !== "Paused") {
      const now = new Date();
      const nextBatch = new Date(job.nextBatchTime);
      const diff = nextBatch - now;

      if (diff > 0) {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        nextBatchCountdown = `
          <div class="alert alert-warning mt-3">
            <strong>⏱️ Next Batch In:</strong> 
            <span class="countdown fs-4">${minutes}m ${seconds}s</span>
          </div>
        `;
      }
    }

    // Status badge color
    const statusColor = job.status === "Paused" ? "warning" : "primary";

    progress.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <strong>Job Status:</strong> <span class="badge bg-${statusColor}">${
      job.status
    }</span><br>
          <strong>Progress:</strong> ${job.emailsSent + job.emailsFailed}/${
      job.totalContacts
    } (${progressPercent}%)<br>
          <strong>Batch:</strong> ${job.currentBatch}/${job.totalBatches}<br>
          <strong>Job ID:</strong> <code>${job.id}</code>
        </div>
        <div class="col-md-6">
          <strong>✅ Sent:</strong> <span class="text-success fs-5">${
            job.emailsSent
          }</span><br>
          <strong>❌ Failed:</strong> <span class="text-danger fs-5">${
            job.emailsFailed
          }</span><br>
          <strong>⏰ Started:</strong> ${new Date(
            job.startTime
          ).toLocaleTimeString()}
        </div>
      </div>
      <div class="progress mt-3" style="height: 25px;">
        <div class="progress-bar progress-bar-striped progress-bar-animated" 
             style="width: ${progressPercent}%">
          ${progressPercent}%
        </div>
      </div>
      ${nextBatchCountdown}
      <div class="alert alert-info mt-3">
        <strong>📋 Current Activity:</strong><br>
        <small>Sending ${job.config.batchSize} emails with ${
      job.config.emailDelay
    }s delay between each email.<br>
        After this batch completes, will wait ${
          job.config.batchDelay
        } minutes before next batch.</small>
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
      checkBatchStatus(); // Update status immediately
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
      checkBatchStatus(); // Update status immediately
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

// Check provider limits
async function checkProviderLimits() {
  const smtpHost = document.querySelector('input[name="smtpHost"]').value;
  const notifyEmail = document.querySelector('input[name="notifyEmail"]').value;

  if (!smtpHost) return;

  const formData = new FormData();
  formData.set("smtpHost", smtpHost);
  formData.set("hasNotification", notifyEmail ? "true" : "false");

  try {
    const response = await fetch("/provider-info", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      const data = result.data;
      const limitInfo = document.getElementById("providerLimitInfo");
      const limitText = document.getElementById("providerLimitText");

      limitText.innerHTML = `
        <strong>${data.provider}:</strong> ${
        data.maxContacts
      } emails/day allowed
        ${
          notifyEmail
            ? "<br><small>⚠️ 1 email reserved for notification</small>"
            : ""
        }
        <br><small>💡 Recommended: ${
          data.recommendedBatchSize
        } emails per batch, ${data.recommendedDelay}s delay</small>
      `;

      limitInfo.style.display = "block";

      // Update batch settings defaults
      if (data.provider !== "Custom SMTP") {
        document.querySelector('input[name="batchSize"]').value =
          data.recommendedBatchSize;
        document.querySelector('input[name="emailDelay"]').value =
          data.recommendedDelay;
        updateBatchPreview();
      }
    }
  } catch (error) {
    console.error("Error checking provider limits:", error);
  }
}

// Refresh scheduled jobs
async function refreshScheduledJobs() {
  try {
    const response = await fetch("/scheduled-jobs");
    const result = await response.json();

    if (result.success) {
      displayScheduledJobs(result.data);
    }
  } catch (error) {
    console.error("Error fetching scheduled jobs:", error);
  }
}

// Display scheduled jobs
function displayScheduledJobs(jobs) {
  const container = document.getElementById("scheduledJobsList");

  if (!jobs || jobs.length === 0) {
    container.innerHTML = '<small class="text-muted">No scheduled jobs</small>';
    return;
  }

  container.innerHTML = jobs
    .map((job) => {
      const scheduledDate = new Date(job.scheduled_time);
      const statusBadge =
        job.status === "running"
          ? '<span class="badge bg-primary">Running</span>'
          : '<span class="badge bg-warning">Scheduled</span>';

      return `
      <div class="d-flex justify-content-between align-items-center border-bottom py-2">
        <div>
          <strong>${job.subject || "Bulk Email"}</strong> ${statusBadge}<br>
          <small>
            📊 ${job.contact_count} contacts 
            ${job.use_batch ? "(Batch mode)" : "(Normal mode)"}<br>
            📅 ${scheduledDate.toLocaleString()}
            ${job.notify_email ? `<br>📧 Notify: ${job.notify_email}` : ""}
          </small>
        </div>
        <button class="btn btn-sm btn-danger" onclick="cancelScheduledJob('${
          job.id
        }')" 
          ${job.status === "running" ? "disabled" : ""}>
          ❌
        </button>
      </div>
    `;
    })
    .join("");
}

// Cancel scheduled job
async function cancelScheduledJob(jobId) {
  if (!confirm("Cancel this scheduled job?")) return;

  try {
    const response = await fetch(`/scheduled-jobs/${jobId}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (result.success) {
      showAlert("success", "✅ Scheduled job cancelled");
      refreshScheduledJobs();
      loadJobDashboard();
    } else {
      showAlert("danger", result.message || "Failed to cancel job");
    }
  } catch (error) {
    showAlert("danger", `❌ Error: ${error.message}`);
  }
}

// Browser notification for completed scheduled jobs
let scheduledJobCheckInterval;

function startScheduledJobMonitoring() {
  // Check every minute for completed scheduled jobs
  scheduledJobCheckInterval = setInterval(async () => {
    try {
      const response = await fetch("/scheduled-jobs");
      const result = await response.json();

      if (result.success) {
        // Check if any jobs just completed
        const completedJobs = result.data.filter(
          (job) =>
            job.status === "completed" &&
            new Date(job.completed_at) > new Date(Date.now() - 60000)
        );

        completedJobs.forEach((job) => {
          if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("✅ Email Campaign Complete!", {
              body: `Your scheduled campaign "${job.subject}" has been completed.`,
              icon: "/favicon.ico",
            });
          }
        });
      }
    } catch (error) {
      console.error("Error checking scheduled jobs:", error);
    }
  }, 60000); // Check every minute
}

// Load job dashboard
async function loadJobDashboard() {
  try {
    // Fetch both batch and scheduled jobs
    const [batchResponse, scheduledResponse] = await Promise.all([
      fetch("/batch-status"),
      fetch("/scheduled-jobs"),
    ]);

    const batchResult = await batchResponse.json();
    const scheduledResult = await scheduledResponse.json();

    updateJobDashboard(batchResult.data, scheduledResult.data);
  } catch (error) {
    console.error("Error loading job dashboard:", error);
  }
}

// Update job dashboard with real-time data
function updateJobDashboard(batchData, scheduledJobs) {
  const dashboard = document.getElementById("job-dashboard");

  // Show dashboard if there are any jobs
  if (
    (batchData && batchData.isRunning) ||
    (scheduledJobs && scheduledJobs.length > 0)
  ) {
    dashboard.style.display = "block";
  } else {
    dashboard.style.display = "none";
    return;
  }

  // Update active batch jobs
  const batchContainer = document.getElementById("activeBatchJobs");
  if (batchData && batchData.isRunning && batchData.currentJob) {
    const job = batchData.currentJob;
    const progressPercent = (
      (job.emailsSent / job.totalContacts) *
      100
    ).toFixed(1);

    batchContainer.innerHTML = `
      <div class="list-group-item list-group-item-action">
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">Batch Job: ${job.id}</h6>
          <small class="badge bg-${
            job.status === "Paused" ? "warning" : "primary"
          }">${job.status}</small>
        </div>
        <p class="mb-1">
          Progress: ${job.emailsSent}/${job.totalContacts} 
          (Batch ${job.currentBatch}/${job.totalBatches})
        </p>
        <div class="progress" style="height: 20px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated" 
               style="width: ${progressPercent}%">
            ${progressPercent}%
          </div>
        </div>
        ${
          job.nextBatchTime && job.status !== "Paused"
            ? `
          <small class="text-warning">
            Next batch at: ${new Date(job.nextBatchTime).toLocaleTimeString()}
          </small>
        `
            : ""
        }
      </div>
    `;
  } else {
    batchContainer.innerHTML =
      '<div class="list-group-item text-muted">No active batch jobs</div>';
  }

  // Update scheduled jobs
  const scheduledContainer = document.getElementById("scheduledJobsPreview");
  if (scheduledJobs && scheduledJobs.length > 0) {
    const upcomingJobs = scheduledJobs.filter(
      (job) => job.status === "scheduled"
    );

    if (upcomingJobs.length > 0) {
      scheduledContainer.innerHTML = upcomingJobs
        .slice(0, 3)
        .map(
          (job) => `
        <div class="list-group-item list-group-item-action">
          <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${job.subject || "Bulk Email"}</h6>
            <small class="badge bg-warning">Scheduled</small>
          </div>
          <p class="mb-1">
            ${job.contact_count} contacts • ${
            job.use_batch ? "Batch mode" : "Normal"
          }
          </p>
          <small class="text-primary">
            📅 ${new Date(job.scheduled_time).toLocaleString()}
          </small>
        </div>
      `
        )
        .join("");
    } else {
      scheduledContainer.innerHTML =
        '<div class="list-group-item text-muted">No upcoming scheduled jobs</div>';
    }
  } else {
    scheduledContainer.innerHTML =
      '<div class="list-group-item text-muted">No scheduled jobs</div>';
  }

  // Update timeline with recent activity
  updateJobTimeline();
}

// Update job timeline
function updateJobTimeline() {
  const timeline = document.getElementById("jobTimeline");

  // Get recent activity from localStorage or session
  const recentActivity = getRecentActivity();

  if (recentActivity.length > 0) {
    timeline.innerHTML = recentActivity
      .map(
        (event) => `
      <div class="timeline-item">
        <small class="text-muted">${new Date(
          event.timestamp
        ).toLocaleTimeString()}</small>
        <br>
        <span class="badge bg-${
          event.type === "started"
            ? "primary"
            : event.type === "completed"
            ? "success"
            : "info"
        }">
          ${event.type}
        </span>
        ${event.message}
      </div>
    `
      )
      .join("");
  } else {
    timeline.innerHTML = '<div class="text-muted">No recent activity</div>';
  }
}

// Get recent activity
function getRecentActivity() {
  // This could be enhanced to fetch from backend
  const activities = JSON.parse(
    sessionStorage.getItem("recentActivity") || "[]"
  );
  return activities.slice(0, 10); // Last 10 activities
}

// Add activity to timeline
function addActivity(type, message) {
  const activities = getRecentActivity();
  activities.unshift({
    timestamp: new Date().toISOString(),
    type,
    message,
  });
  sessionStorage.setItem(
    "recentActivity",
    JSON.stringify(activities.slice(0, 20))
  );
  updateJobTimeline();
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

// UPDATED: loadSMTPDefaults with toggle support
async function loadSMTPDefaults() {
  try {
    const response = await fetch("/config/smtp");
    const result = await response.json();

    if (result.success) {
      smtpDefaults = result.data;
      currentMode = result.currentMode || "env";
      envConfig = result.envConfig || {};
      customConfig = result.customConfig || {};

      // Populate form fields
      if (result.hasConfig) {
        const fields = {
          smtpHost: result.data.host,
          smtpPort: result.data.port,
          smtpSecure: result.data.secure,
          smtpUser: result.data.user,
          smtpPass: result.data.pass,
          fromEmail: result.data.fromEmail,
          fromName: result.data.fromName,
        };

        Object.entries(fields).forEach(([name, value]) => {
          const field = document.querySelector(
            `[name="${name}"], [id="${name}"]`
          );
          if (field) {
            if (field.type === "checkbox") {
              field.checked = value;
            } else if (name === "smtpPass" && value) {
              field.placeholder = "••••••••••••••••";
              field.value = "";
            } else {
              field.value = value || "";
            }
          }
        });

        // Update mode display and field states
        updateModeDisplay();

        if (result.hasEnvConfig) {
          showAlert(
            "success",
            `✅ SMTP configuration loaded in ${
              currentMode === "env" ? ".env" : "custom"
            } mode`
          );
        } else {
          showAlert(
            "warning",
            "⚠️ No .env configuration found. Using custom mode."
          );
          currentMode = "custom";
          updateModeDisplay();
        }
      } else {
        showAlert("warning", "⚠️ No SMTP configuration found");
        currentMode = "custom";
        updateModeDisplay();
      }
    }
  } catch (error) {
    console.error("Error loading SMTP defaults:", error);
    showAlert("info", "ℹ️ Using manual SMTP configuration");
    currentMode = "custom";
    updateModeDisplay();
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

  // Find and activate the clicked link
  const clickedLink = document.querySelector(
    `.nav-link[onclick="showTab('${tabName}')"]`
  );
  if (clickedLink) {
    clickedLink.classList.add("active");
  }

  // Refresh report if switching to report tab
  if (tabName === "report") {
    refreshReport();
  }
}

// UPDATED: sendEmails function with toggle support
async function sendEmails() {
  // Validate required fields first
  const subjectField = document.querySelector('input[name="subject"]');
  const excelFileField = document.querySelector('input[name="excelFile"]');
  const htmlTemplateField = document.querySelector(
    'input[name="htmlTemplate"]'
  );

  if (!subjectField || !subjectField.value.trim()) {
    showAlert("danger", "❌ Subject is required");
    subjectField?.focus();
    return;
  }

  if (!excelFileField.files || excelFileField.files.length === 0) {
    showAlert("danger", "❌ Excel file is required");
    return;
  }

  // Check if content is provided (either editor or HTML template)
  const htmlContent = quill.root.innerHTML;
  const hasHtmlTemplate =
    htmlTemplateField.files && htmlTemplateField.files.length > 0;

  if (
    !hasHtmlTemplate &&
    (!htmlContent || htmlContent.trim() === "" || htmlContent === "<p><br></p>")
  ) {
    showAlert(
      "danger",
      "❌ Email content is required (either in editor or HTML template)"
    );
    return;
  }

  const form = document.getElementById("emailForm");
  const formData = new FormData(form);

  // Manually add the subject field to ensure it's included
  formData.set("subject", subjectField.value.trim());

  // Add Quill content to form data (even if empty, backend will handle)
  formData.set("htmlContent", htmlContent);

  // Add batch processing fields
  const useBatchElement = document.getElementById("useBatch");
  const useBatch = useBatchElement ? useBatchElement.checked : false;
  formData.set("useBatch", useBatch ? "on" : "off");

  let batchSize = "20",
    batchDelay = "60",
    emailDelay = "45";

  if (useBatch) {
    const batchSizeElement = document.querySelector('input[name="batchSize"]');
    const batchDelayElement = document.querySelector(
      'input[name="batchDelay"]'
    );
    const emailDelayElement = document.querySelector(
      'input[name="emailDelay"]'
    );

    batchSize = batchSizeElement ? batchSizeElement.value : "20";
    batchDelay = batchDelayElement ? batchDelayElement.value : "60";
    emailDelay = emailDelayElement ? emailDelayElement.value : "45";

    formData.set("batchSize", batchSize);
    formData.set("batchDelay", batchDelay);
    formData.set("emailDelay", emailDelay);
  }

  // ADD: Scheduling fields
  const scheduleEmail = document.getElementById("scheduleEmail").checked;
  const scheduledTime = document.getElementById("scheduledTime").value;
  const notifyEmail = document.querySelector('input[name="notifyEmail"]').value;
  const notifyBrowser = document.getElementById("notifyBrowser").checked;

  if (scheduleEmail) {
    if (!scheduledTime) {
      showAlert("danger", "❌ Please select a schedule date and time");
      return;
    }

    formData.set("scheduleEmail", "on");
    formData.set("scheduledTime", scheduledTime);
    if (notifyEmail) formData.set("notifyEmail", notifyEmail);
    if (notifyBrowser) formData.set("notifyBrowser", "on");
  }

  // Add file inputs to form data
  const excelFile = excelFileField.files[0];
  const htmlTemplate = htmlTemplateField.files[0];

  if (excelFile) {
    formData.set("excelFile", excelFile);
  }

  if (htmlTemplate) {
    formData.set("htmlTemplate", htmlTemplate);
  }

  // UPDATED: Handle environment variable defaults with toggle support
  const activeConfig = currentMode === "env" ? envConfig : customConfig;
  const fieldsToCheck = [
    "smtpHost",
    "smtpUser",
    "smtpPass",
    "fromEmail",
    "fromName",
  ];

  fieldsToCheck.forEach((fieldName) => {
    const field = document.querySelector(`input[name="${fieldName}"]`);
    const configKey = fieldName.replace("smtp", "").toLowerCase();

    if (
      field &&
      (!field.value || field.value.trim() === "") &&
      activeConfig[configKey]
    ) {
      console.log(`Using ${currentMode} config for ${fieldName}`);
      formData.set(fieldName, activeConfig[configKey]);
    }

    if (
      fieldName === "smtpPass" &&
      field &&
      field.placeholder === "••••••••••••••••" &&
      activeConfig.pass
    ) {
      formData.set("smtpPass", activeConfig.pass);
    }
  });

  // Update button state
  const sendButton = document.getElementById("sendButtonText");
  const spinner = document.getElementById("sendButtonSpinner");
  sendButton.textContent = "Processing...";
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
      let title, message, details;

      if (result.scheduledMode) {
        title = "📅 Campaign Scheduled!";
        message = `Your campaign for ${result.contactCount} contacts has been scheduled`;
        details = `Scheduled Time: ${new Date(
          result.scheduledTime
        ).toLocaleString()}<br>
                  Mode: ${
                    result.batchMode ? "Batch Processing" : "Normal Send"
                  }<br>
                  Job ID: ${result.jobId}`;

        showSuccessModal(title, message, details);
        refreshScheduledJobs();
        loadJobDashboard();

        // Add to activity timeline
        addActivity(
          "scheduled",
          `Scheduled ${result.contactCount} emails for ${new Date(
            result.scheduledTime
          ).toLocaleString()}`
        );

        // Show browser notification if enabled
        if (notifyBrowser && "Notification" in window) {
          new Notification("📅 Email Campaign Scheduled", {
            body: message,
            icon: "/favicon.ico",
          });
        }
      } else if (result.batchMode) {
        title = "⚡ Batch Processing Started!";
        message = `Sending ${result.contactCount} emails in batches`;
        details = `Batch Size: ${batchSize} emails<br>
                  Delay Between Batches: ${batchDelay} minutes<br>
                  Email Delay: ${emailDelay} seconds<br>
                  Job ID: ${result.jobId}`;

        showSuccessModal(title, message, details);
        startBatchMonitoring();

        // Add to activity timeline
        addActivity(
          "started",
          `Started batch job for ${result.contactCount} emails`
        );
      } else {
        title = "🚀 Email Sending Started!";
        message = `Sending emails to ${result.contactCount} contacts`;
        details = result.usingEnvConfig
          ? `Using ${currentMode} configuration`
          : null;

        showSuccessModal(title, message, details);

        // Add to activity timeline
        addActivity(
          "started",
          `Started sending to ${result.contactCount} contacts`
        );
      }
    } else {
      showAlert("danger", `❌ ${result.message}`);
    }
  } catch (error) {
    console.error("Send error:", error);
    showAlert("danger", `❌ Error: ${error.message}`);
  } finally {
    // Reset button state
    sendButton.textContent = scheduleEmail
      ? "📅 Schedule Campaign"
      : "🚀 Send Emails";
    spinner.classList.add("d-none");
  }
}

function testSMTPConnection() {
  showAlert("info", "🔍 Testing SMTP connection...");
  // This would be implemented as a separate endpoint if needed
}

// Modified refreshReport to accept silent parameter
async function refreshReport(silent = false) {
  try {
    const response = await fetch("/report");
    const result = await response.json();

    if (result.success) {
      displayStats(result.data.stats);
      displayLogs(result.data.logs);

      // Also update batch status if visible
      const batchContainer = document.getElementById("batchStatusContainer");
      if (batchContainer && !batchContainer.classList.contains("d-none")) {
        checkBatchStatus();
      }
    }
  } catch (error) {
    console.error("Error fetching report:", error);
    if (!silent) {
      showAlert("danger", "Failed to load report data");
    }
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
  const existingAlerts = document.querySelectorAll(".alert.auto-dismiss");
  existingAlerts.forEach((alert) => alert.remove());

  // Create new alert
  const alert = document.createElement("div");
  alert.className = `alert alert-${type} alert-dismissible fade show auto-dismiss`;
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
