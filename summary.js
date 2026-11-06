import {
  escapeHtml,
  getClusterVersionLabel,
  getDatabaseVersionFamily,
  getDatabaseVersionFamilyLabel,
} from './upgrade-data.js';

const summaryContent = document.querySelector('#summary-content');
const backToGuideButton = document.querySelector('#back-to-guide');

// Written by the upgrade wizard when "Done" is clicked (see finish() in upgrade.js).
const SUMMARY_STORAGE_KEY = 'pathfinder_summary';

function loadSummary() {
  try {
    const summary = JSON.parse(sessionStorage.getItem(SUMMARY_STORAGE_KEY));
    return summary && Array.isArray(summary.steps) && summary.steps.length ? summary : null;
  } catch {
    return null;
  }
}

function renderSummary(summary) {
  const clusterPath = summary.selectedPath
    .map((version) => escapeHtml(getClusterVersionLabel(version)))
    .join(' → ');

  const dbFrom = summary.databaseVersion ? getDatabaseVersionFamily(summary.databaseVersion) : '';
  const dbTo = summary.targetDatabaseVersion ? getDatabaseVersionFamily(summary.targetDatabaseVersion) : '';
  const databaseLine = dbFrom && dbTo && dbFrom !== dbTo
    ? `Redis ${escapeHtml(getDatabaseVersionFamilyLabel(dbFrom))} → ${escapeHtml(getDatabaseVersionFamilyLabel(dbTo))}`
    : 'No database version change selected';

  const reviewed = summary.steps.filter((step) => step.reviewed).length;
  const stepsHtml = summary.steps
    .map((step) => {
      // A step that was never opened shows its name, not an outcome nobody saw.
      const text = escapeHtml(step.reviewed && step.result ? step.result : step.title);
      return `<li class="wizard-summary-item${step.reviewed ? '' : ' wizard-summary-item-skipped'}">
        <span class="wizard-summary-mark" aria-hidden="true">${step.reviewed ? '✓' : '○'}</span>
        <span>${text}${step.reviewed ? '' : ' <em>(not opened)</em>'}</span>
      </li>`;
    })
    .join('');

  summaryContent.innerHTML = `
    <dl class="wizard-summary-result">
      <div><dt>Redis Software</dt><dd>${clusterPath}</dd></div>
      <div><dt>Database</dt><dd>${databaseLine}</dd></div>
    </dl>
    <ul class="wizard-summary-list">${stepsHtml}</ul>
    <p class="status-copy">${reviewed} of ${summary.steps.length} steps reviewed.</p>
  `;
}

// Go back to where the user came from when that was the guide (keeps the browser
// history tidy); otherwise open the guide fresh.
function goBackToGuide() {
  let cameFromGuide = false;
  try {
    cameFromGuide = new URL(document.referrer).pathname.endsWith('/upgrade.html');
  } catch {
    // No referrer (page opened directly) — fall through to the link below.
  }
  if (cameFromGuide && window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'upgrade.html';
  }
}

const summary = loadSummary();
if (summary) {
  renderSummary(summary);
  backToGuideButton.addEventListener('click', goBackToGuide);
} else {
  // Nothing to summarise (page opened directly or the session expired).
  window.location.href = 'index.html';
}
