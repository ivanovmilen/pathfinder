// Self-contained feedback widget for Pathfinder.
//
// Mounts a row of "share feedback" buttons that open pre-filled GitHub
// Issues / Discussions in a new tab. No backend, no third-party services.
//
// Page hooks:
//   - index.html:    general feedback only (no selections in scope)
//   - results.html:  full kind list with selections JSON attached
//   - upgrade.html:  full kind list with selections JSON attached
//
// To remove the feature entirely:
//   1. delete this file
//   2. delete the matching <script type="module" src="feedback.js"></script>
//      lines from index.html / results.html / upgrade.html (search for
//      "feedback-form-trial" marker comments)
//   3. delete the /* feedback-form-trial */ CSS block from styles.css

const REPO = 'ivanovmilen/pathfinder';
const STORAGE_KEY = 'pathfinder_selections';

const KINDS = [
  {
    key: 'flow',
    label: '🧭 Upgrade flow feedback',
    description:
      'Sequencing, prerequisites, gotchas, "we do it differently because…"',
    target: 'discussion',
    category: 'upgrade-flow',
    labels: '',
    prompt: [
      '## Your thoughts on this upgrade flow',
      "<!-- What would you change? What's missing? What's a gotcha most users wouldn't think of?",
      '     Real-world experience is most useful: "in our environment we always do X before Y because…" -->',
      '',
      '## Which step or hop is this about?',
      '<!-- Optional. e.g., "the OS upgrade step on the 7.2 bridge" -->',
    ].join('\n'),
  },
  {
    key: 'correction',
    label: '✏️ Correction',
    description: 'Something the app says is wrong, outdated, or incomplete',
    target: 'issue',
    category: '',
    labels: 'feedback,correction',
    prompt: [
      '## What the app says',
      '<!-- Quote the wording or describe the recommendation -->',
      '',
      '## What it should say',
      '<!-- The correct guidance + a source if you have one (Redis docs link, KB, etc.) -->',
    ].join('\n'),
  },
  {
    key: 'idea',
    label: '💡 Idea / enhancement',
    description: 'Feature suggestions, missing cases, UX ideas',
    target: 'discussion',
    category: 'ideas',
    labels: '',
    prompt: [
      '## The idea',
      '<!-- What would you like to see? -->',
      '',
      '## Why',
      '<!-- What problem does it solve, or what would it improve? -->',
    ].join('\n'),
  },
  {
    key: 'bug',
    label: '🐞 App bug',
    description: 'Something in the UI is broken',
    target: 'issue',
    category: '',
    labels: 'feedback,bug',
    prompt: [
      '## What you did',
      '<!-- Steps to reproduce -->',
      '',
      '## What you expected vs. what happened',
      '',
    ].join('\n'),
  },
];

function readSelections() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function summaryLine(selections) {
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

function buildBody(kind, selections) {
  const sections = [kind.prompt];

  if (selections) {
    sections.push(
      '',
      '## Selections',
      '<!-- Auto-attached by the Pathfinder app — paste back into the form to reproduce. -->',
      '```json',
      JSON.stringify(selections, null, 2),
      '```',
    );
  }

  sections.push('', `**App page:** ${window.location.href}`);
  return sections.join('\n');
}

function buildUrl(kind, selections) {
  const params = new URLSearchParams();

  const titleSuffix = summaryLine(selections);
  const title = titleSuffix
    ? `[${kind.key}] ${titleSuffix}`
    : `[${kind.key}] Pathfinder feedback`;
  params.set('title', title);
  params.set('body', buildBody(kind, selections));

  if (kind.target === 'issue') {
    if (kind.labels) params.set('labels', kind.labels);
    return `https://github.com/${REPO}/issues/new?${params}`;
  }
  if (kind.category) params.set('category', kind.category);
  return `https://github.com/${REPO}/discussions/new?${params}`;
}

function buildWidget({ generalOnly = false } = {}) {
  const selections = generalOnly ? null : readSelections();
  const kinds = generalOnly
    ? KINDS.filter((k) => k.key === 'idea' || k.key === 'flow')
    : KINDS;

  const buttons = kinds
    .map((kind) => {
      const url = buildUrl(kind, selections);
      return `
        <a
          class="feedback-button"
          href="${url}"
          target="_blank"
          rel="noreferrer"
          title="${kind.description}"
        >
          <span class="feedback-button-label">${kind.label}</span>
          <span class="feedback-button-desc">${kind.description}</span>
        </a>
      `;
    })
    .join('');

  const widget = document.createElement('section');
  widget.className = 'feedback-block';
  widget.setAttribute('aria-labelledby', 'feedback-title');
  widget.innerHTML = `
    <div class="feedback-header">
      <h2 id="feedback-title">Share feedback</h2>
      <p class="feedback-intro">
        Helps us tune the recommendations. Opens a pre-filled GitHub
        ${generalOnly ? 'discussion' : 'issue or discussion'} in a new tab —
        edit before submitting.
      </p>
    </div>
    <div class="feedback-buttons">
      ${buttons}
    </div>
  `;
  return widget;
}

function mount() {
  // Choose a sensible host element per page.
  const pageShell = document.querySelector('main.page-shell');
  if (!pageShell) return;

  const path = window.location.pathname;
  const isIndex = path.endsWith('/') || path.endsWith('index.html') || path === '';
  const widget = buildWidget({ generalOnly: isIndex });
  pageShell.appendChild(widget);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
