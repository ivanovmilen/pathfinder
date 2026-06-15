// Self-contained feedback widget for Pathfinder.
//
// Renders a single "Share feedback" button that opens the GitHub issue form
// template at .github/ISSUE_TEMPLATE/feedback.yml with the title, selections,
// and current page URL pre-filled. The actual category (flow / correction /
// idea / bug) is picked by the user via the form's dropdown — keeping the
// widget itself one click.
//
// To remove the feature entirely:
//   1. delete this file
//   2. delete the <script type="module" src="feedback.js"></script> line
//      from index.html / results.html / upgrade.html (search for
//      "feedback-form-trial" marker comments)
//   3. delete the /* feedback-form-trial */ CSS block from styles.css
//   4. (optional) delete .github/ISSUE_TEMPLATE/feedback.yml

const REPO = 'ivanovmilen/pathfinder';
const ISSUE_TEMPLATE = 'feedback.yml';
const STORAGE_KEY = 'pathfinder_selections';

function readSelections() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function titleSummary(selections) {
  if (!selections) return '';
  const parts = [];
  if (selections.sourceVersion && selections.targetVersion) {
    parts.push(`${selections.sourceVersion} → ${selections.targetVersion}`);
  }
  if (selections.platform) parts.push(selections.platform);
  if (selections.operatingSystem) parts.push(selections.operatingSystem);
  if (selections.activeActive) parts.push('Active-Active');
  return parts.join(' | ');
}

function buildUrl(selections) {
  const params = new URLSearchParams();
  params.set('template', ISSUE_TEMPLATE);

  const summary = titleSummary(selections);
  // Title is prefixed by the template itself ("[feedback] "), so we just
  // supply the tail. If no selections context, leave the tail empty so the
  // user fills it in.
  if (summary) params.set('title', `[feedback] ${summary}`);

  if (selections) {
    // The `selections` form field renders as a JSON code block — keep it
    // pretty so it's readable in the rendered issue.
    params.set('selections', JSON.stringify(selections, null, 2));
  }
  params.set('page_url', window.location.href);

  return `https://github.com/${REPO}/issues/new?${params}`;
}

function buildWidget() {
  const selections = readSelections();
  const url = buildUrl(selections);

  const widget = document.createElement('section');
  widget.className = 'feedback-block';
  widget.setAttribute('aria-labelledby', 'feedback-title');
  widget.innerHTML = `
    <div class="feedback-header">
      <h2 id="feedback-title">Tell us what's wrong or missing</h2>
      <p class="feedback-intro">
        Worth reporting: a step in the wrong order, a missing prerequisite,
        outdated guidance, a UI bug, or anything you'd handle differently in
        your environment. Your current selections come along automatically so
        we can reproduce what you saw.
      </p>
    </div>
    <a
      class="feedback-button"
      href="${url}"
      target="_blank"
      rel="noreferrer"
    >
      <span class="feedback-button-label">💬 Share feedback</span>
      <span class="feedback-button-desc">
        Flow gotcha, correction, idea, or bug — pick a type when the editor opens.
      </span>
    </a>
  `;
  return widget;
}

function mount() {
  const pageShell = document.querySelector('main.page-shell');
  if (!pageShell) return;
  pageShell.appendChild(buildWidget());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
