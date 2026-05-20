import {
  OPTIONS,
  escapeHtml,
  findUpgradePaths,
  getClusterVersionFamily,
  getDatabaseCompatibility,
  getDatabaseUpgradeRequirement,
  getDatabaseVersionFamily,
  getDatabaseVersionFamilyLabel,
  getClusterVersionLabel,
  getDirectUpgradeSupport,
  getModuleEntries,
  getModuleLabel,
  getModuleSelectionSummary,
  getModulesForDatabaseFamily,
  getPlatformSupport,
  getPreClusterUpgradeDatabaseFamily,
  getSupportedOperatingSystemOptions,
  isK8sPlatform,
} from './upgrade-data.js';

const guideOutput = document.querySelector('#guide-output');
const resultsSummary = document.querySelector('#results-summary');
const processSummary = document.querySelector('#process-summary');
const editSelectionsButton = document.querySelector('#edit-selections');
const startUpgradeGuideWrapper = document.querySelector('#start-upgrade-guide-wrapper');
const startUpgradeGuideButton = document.querySelector('#start-upgrade-guide');
const migrationReferenceSection = document.querySelector('#migration-reference');
const osUpgradeNote = document.querySelector('#os-upgrade-note');

const STORAGE_KEY = 'pathfinder_selections';
const VERSION_FAMILY_ORDER = ['6.0', '6.2', '6.4', '7.2', '7.4', '7.8', '7.22', '8.0'];

function labelForPlatform(value) {
  if (value === 'vms' || value === 'bare-metal') return 'VMs and Bare Metal';
  if (value === 'kubernetes-community') return 'Kubernetes';
  if (value === 'kubernetes-openshift') return 'OpenShift';
  return OPTIONS.platforms.find((option) => option.value === value)?.label
    ?? OPTIONS.k8sDistributions.find((option) => option.value === value)?.label
    ?? value;
}

function labelForOperatingSystem(value) {
  return OPTIONS.operatingSystems.find((option) => option.value === value)?.label ?? value;
}

function getModuleSelectionCopy(moduleValues) {
  return moduleValues.length ? getModuleSelectionSummary(moduleValues) : 'No modules installed';
}

function isLargeVersionJump(sourceVersion, targetVersion) {
  const sourceIndex = VERSION_FAMILY_ORDER.indexOf(getClusterVersionFamily(sourceVersion));
  const targetIndex = VERSION_FAMILY_ORDER.indexOf(getClusterVersionFamily(targetVersion));
  return sourceIndex >= 0 && targetIndex >= 0 && targetIndex - sourceIndex >= 4;
}

function renderList(items) {
  if (!items || !items.length) {
    return '';
  }

  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`;
}

function renderResultsSummary(selections) {
  const selectedModules = Array.isArray(selections.modules) ? selections.modules : [];

  resultsSummary.innerHTML = `
    <dl class="results-summary-list">
      <div>
        <dt>Current version</dt>
        <dd>${escapeHtml(getClusterVersionLabel(selections.sourceVersion))}</dd>
      </div>
      <div>
        <dt>Target version</dt>
        <dd>${escapeHtml(getClusterVersionLabel(selections.targetVersion))}</dd>
      </div>
      <div>
        <dt>Current database version</dt>
        <dd>${escapeHtml(getDatabaseVersionFamilyLabel(selections.databaseVersion))}</dd>
      </div>
      <div>
        <dt>Deployment platform</dt>
        <dd>${escapeHtml(labelForPlatform(selections.platform))}</dd>
      </div>
      ${isK8sPlatform(selections.platform) && selections.k8sVersion ? `
      <div>
        <dt>${selections.platform === 'kubernetes-openshift' ? 'OpenShift version' : 'Kubernetes version'}</dt>
        <dd>${escapeHtml(selections.k8sVersion)}</dd>
      </div>
      ` : ''}
      ${isK8sPlatform(selections.platform) ? '' : `
      <div>
        <dt>Operating system</dt>
        <dd>${escapeHtml(labelForOperatingSystem(selections.operatingSystem))}</dd>
      </div>
      `}
      <div>
        <dt>Installed modules</dt>
        <dd>${escapeHtml(getModuleSelectionCopy(selectedModules))}</dd>
      </div>
      <div>
        <dt>Active-Active (CRDB)</dt>
        <dd>${selections.activeActive ? 'Yes' : 'No'}</dd>
      </div>
    </dl>
  `;
}

function formatModuleSuffix(dbFamily, moduleNames, hasModules) {
  if (!hasModules || !dbFamily) return '';
  const modules = getModulesForDatabaseFamily(dbFamily, moduleNames);
  if (!modules.length) return '';
  const list = modules
    .map((m) => `${escapeHtml(getModuleLabel(m))} <strong>${escapeHtml(m.version)}</strong>`)
    .join(', ');
  return ` (with modules: ${list})`;
}

// Build the ordered list of summary steps for a single concrete upgrade path.
// Returned as an array of HTML strings (one per <li>). The caller is
// responsible for picking how to render multiple paths (one list vs. a labeled
// option per path).
function buildPathSummarySteps(selections, path, osUpgradeRequired, isK8s, moduleNames, hasModules) {
  const finalIdx = path.length - 1;
  const isMultiStep = path.length > 2;
  const steps = [];

  // DB family threaded across this path's hops.
  let runningDbFamily = getDatabaseVersionFamily(selections.databaseVersion);

  // Per-path OS upgrade pre-scan: find the first hop whose target doesn't
  // support the current OS. The OS upgrade has to happen BEFORE that hop, on
  // the previous version in the path.
  let osUpgradeBeforeHopIdx = -1;
  let osUpgradeOnVersion = null;
  if (!isK8s && osUpgradeRequired && selections.operatingSystem) {
    for (let j = 1; j < path.length; j++) {
      const supports = getPlatformSupport(
        path[j],
        selections.platform,
        selections.operatingSystem,
      ).supported;
      if (!supports) {
        osUpgradeBeforeHopIdx = j;
        osUpgradeOnVersion = path[j - 1];
        break;
      }
    }
  }

  for (let i = 1; i < path.length; i++) {
    const stepSource = path[i - 1];
    const stepTarget = path[i];
    const isBridgeHop = isMultiStep && i < finalIdx;
    const targetVersionLabel = escapeHtml(getClusterVersionLabel(stepTarget));

    // OS upgrade — placed BEFORE the hop that loses support for the current OS.
    if (osUpgradeBeforeHopIdx === i) {
      const supportedTargetOs = getSupportedOperatingSystemOptions(selections.targetVersion, selections.platform);
      const targetOsLabel = supportedTargetOs[0]?.label ?? 'a supported version';
      const onVersionLabel = escapeHtml(getClusterVersionLabel(osUpgradeOnVersion));
      steps.push(`Upgrade OS to <strong>${escapeHtml(targetOsLabel)}</strong> (on <strong>${onVersionLabel}</strong>)`);
    }

    // Pre-cluster DB upgrade: when the current DB family isn't bundled with
    // the target cluster, the user MUST upgrade the DB before the cluster step.
    // That upgrade happens on the *source* cluster, so the new DB family has
    // to be supported by both source and target — pick the highest family
    // satisfying both. Falls back to the target's latest if no intersection
    // exists (shouldn't happen with current data, but keeps the summary
    // populated rather than silently dropping the step).
    const dbReq = getDatabaseUpgradeRequirement(runningDbFamily, stepTarget);
    if (dbReq.status === 'required') {
      const preClusterFamily = getPreClusterUpgradeDatabaseFamily(stepSource, stepTarget, runningDbFamily)
        || dbReq.recommended;
      const requiredLabel = escapeHtml(getDatabaseVersionFamilyLabel(preClusterFamily));
      const moduleSuffix = formatModuleSuffix(preClusterFamily, moduleNames, hasModules);
      steps.push(`Database upgrade required (to <strong>${requiredLabel}</strong>)${moduleSuffix}`);
      runningDbFamily = preClusterFamily;
    }

    // Kubernetes platforms upgrade the operator before each cluster upgrade.
    if (isK8s) {
      steps.push('Upgrade Redis Enterprise Operator');
    }

    // Cluster upgrade — primary milestone. Versions are bolded; the action label is not.
    if (isMultiStep) {
      const sourceVersionLabel = escapeHtml(getClusterVersionLabel(stepSource));
      const bridgeTag = isBridgeHop ? ' [Bridge]' : '';
      steps.push(`Upgrade Cluster (<strong>${sourceVersionLabel}</strong> &rarr; <strong>${targetVersionLabel}</strong>${bridgeTag})`);
    } else {
      steps.push(`Upgrade Cluster to <strong>${targetVersionLabel}</strong>`);
    }

    // Post-cluster DB recommendation: recompute against the current running
    // family. If a required pre-cluster step bumped the family to (say) 7.2
    // but the target cluster bundles 8.2, this surfaces the optional follow-up
    // upgrade the user can do once the cluster reaches the target.
    const postDbReq = getDatabaseUpgradeRequirement(runningDbFamily, stepTarget);
    if (postDbReq.status === 'recommended') {
      const recommendedLabel = escapeHtml(getDatabaseVersionFamilyLabel(postDbReq.recommended));
      const moduleSuffix = formatModuleSuffix(postDbReq.recommended, moduleNames, hasModules);
      steps.push(`Database upgrade recommended (to <strong>${recommendedLabel}</strong>)${moduleSuffix}`);
      // runningDbFamily intentionally NOT bumped — the user may defer.
    }
  }

  // Active-Active deployments need a final synchronization check.
  if (selections.activeActive) {
    steps.push('Verify CRDB Synchronization');
  }

  return steps;
}

// Short, human-readable label for an upgrade path, used as the option header
// when multiple bridge routes are available (e.g. "via 6.4.x" or "via 7.2.x → 7.22.x").
function describePathOption(path) {
  if (path.length <= 2) return 'direct';
  const bridges = path.slice(1, -1).map((v) => getClusterVersionLabel(v));
  return `via ${bridges.join(' → ')}`;
}

function renderProcessSummary(selections, upgradePaths, osUpgradeRequired, isDirect) {
  if (!processSummary || !upgradePaths.length) return;

  const isK8s = isK8sPlatform(selections.platform);
  const selectedModules = Array.isArray(selections.modules) ? selections.modules : [];
  const moduleNames = selectedModules.length
    ? [...new Set(getModuleEntries(selectedModules).map((m) => m.name))]
    : [];
  const hasModules = moduleNames.length > 0;

  const renderStepsList = (steps) =>
    `<ol class="process-summary-steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;

  // Sort paths shortest first so the simplest option appears at the top.
  const sortedPaths = upgradePaths.slice().sort((a, b) => a.length - b.length);
  const hasMultiplePaths = sortedPaths.length > 1;
  const shortestPath = sortedPaths[0];

  let bodyHtml;
  if (!hasMultiplePaths) {
    const steps = buildPathSummarySteps(selections, shortestPath, osUpgradeRequired, isK8s, moduleNames, hasModules);
    bodyHtml = renderStepsList(steps);
  } else {
    bodyHtml = sortedPaths
      .map((path, idx) => {
        const label = escapeHtml(describePathOption(path));
        const steps = buildPathSummarySteps(selections, path, osUpgradeRequired, isK8s, moduleNames, hasModules);
        return `
          <section class="process-summary-option">
            <h3 class="process-summary-option-title">Option ${idx + 1}: ${label}</h3>
            ${renderStepsList(steps)}
          </section>
        `;
      })
      .join('');
  }

  const intro = isDirect
    ? 'Your upgrade will proceed directly through these steps in the wizard:'
    : hasMultiplePaths
      ? `Your upgrade can take any of ${sortedPaths.length} bridge paths. Each path is documented below; you'll pick one in the upgrade wizard.`
      : `Your upgrade requires ${shortestPath.length - 1} cluster upgrade steps via documented bridge versions:`;

  processSummary.innerHTML = `
    <div class="guide-title-row">
      <h2 id="process-summary-title">Upgrade process summary</h2>
    </div>
    <p class="status-copy">${intro}</p>
    ${bodyHtml}
  `;
  processSummary.hidden = false;
}

function renderUpgradePathResult(selections) {
  const operatingSystemLabel = labelForOperatingSystem(selections.operatingSystem);
  const platformLabel = labelForPlatform(selections.platform);
  const selectedModules = Array.isArray(selections.modules) ? selections.modules : [];
  const selectedModuleEntries = getModuleEntries(selectedModules);
  const hasSelectedModules = selectedModuleEntries.length > 0;
  const selectedModuleFamilies = [...new Set(selectedModuleEntries.map((module) => module.feature_set))];
  const selectedModuleFamilyLabels = selectedModuleFamilies.map((family) =>
    getDatabaseVersionFamilyLabel(family),
  );
  const selectedModuleFamilyCopy = selectedModuleFamilyLabels.join(', ');
  const selectedModuleSummary = hasSelectedModules ? getModuleSelectionSummary(selectedModules) : '';

  const sourcePlatformSupport = getPlatformSupport(
    selections.sourceVersion,
    selections.platform,
    selections.operatingSystem,
  );

  if (!sourcePlatformSupport.supported) {
    guideOutput.innerHTML = `
      <article class="guide-panel unsupported-panel">
        <h3>Source environment not supported</h3>
        <p class="status-copy">
          Redis docs do not list <strong>${escapeHtml(platformLabel)}</strong> with
          <strong>${escapeHtml(operatingSystemLabel)}</strong> as a supported environment for the
          current Redis Software version <strong>${escapeHtml(sourcePlatformSupport.versionLabel)}</strong>.
        </p>
        <p class="status-copy">
          Choose a supported operating system or deployment platform for the current cluster before planning this upgrade.
        </p>
      </article>
    `;
    return { feasible: false };
  }

  // Note: the form-side filter in app.js already constrains the current DB
  // version to families bundled with the source cluster, so a defensive
  // source-vs-source DB compatibility check here is unreachable in practice.

  const currentDatabaseFamily = getDatabaseVersionFamily(selections.databaseVersion);
  const currentDatabaseFamilyLabel = getDatabaseVersionFamilyLabel(selections.databaseVersion);

  if (hasSelectedModules && selectedModuleFamilies.some((family) => family !== currentDatabaseFamily)) {
    guideOutput.innerHTML = `
      <article class="guide-panel unsupported-panel">
        <h3>Installed modules do not match the current database version family</h3>
        <p class="status-copy">
          Selected modules use database version families <strong>${escapeHtml(selectedModuleFamilyCopy)}</strong>,
          which do not align with the current Redis database version family
          <strong>${escapeHtml(currentDatabaseFamilyLabel)}</strong>.
        </p>
        <p class="status-copy">
          Choose only installed modules that match the current database version family before planning this upgrade.
        </p>
        <p class="status-copy">
          Selected modules: <strong>${escapeHtml(selectedModuleSummary)}</strong>.
        </p>
      </article>
    `;
    return { feasible: false };
  }

  const { supported, sourceLabel, targetLabel, supportedTargetLabels } = getDirectUpgradeSupport(
    selections.sourceVersion,
    selections.targetVersion,
  );

  if (!supported) {
    const upgradePaths = findUpgradePaths(selections.sourceVersion, selections.targetVersion);
    const hasIndirectPaths = upgradePaths.length > 0;

    const intermediateVersionsCopy = supportedTargetLabels.length
      ? `You must first upgrade to one of these supported intermediate versions: <strong>${escapeHtml(supportedTargetLabels.join(', '))}</strong>.`
      : 'Redis docs do not list any supported direct upgrade targets from this source version in the current app data.';
    const largeJumpMigrationCopy = (!hasIndirectPaths && isLargeVersionJump(selections.sourceVersion, selections.targetVersion))
      ? `
        <p class="status-copy">
          For large version jumps, deploying a new target cluster may be a more practical option than upgrading through multiple intermediate versions.
        </p>
        <p class="status-copy">
          Data can be moved to the new cluster using either <a href="https://redis.github.io/riotx/index.html" target="_blank" rel="noreferrer">Riot-X</a> or <a href="https://redis.io/docs/latest/operate/rs/databases/import-export/replica-of/" target="_blank" rel="noreferrer">Replica Of</a>.
        </p>
      `
      : '';

    const indirectPathsCopy = hasIndirectPaths
      ? `
        <p class="status-copy">
          However, an indirect upgrade path is available through intermediate versions.
          You can proceed to the upgrade guide for step-by-step instructions covering each upgrade step.
        </p>
      `
      : '';

    guideOutput.innerHTML = `
      <article class="guide-panel ${hasIndirectPaths ? '' : 'unsupported-panel'}">
        <h3>Direct upgrade not supported</h3>
        <p class="status-copy">
          Redis docs do not list a direct cluster upgrade path for Redis Software
          <strong>${escapeHtml(sourceLabel)}</strong> → <strong>${escapeHtml(targetLabel)}</strong>.
        </p>
        <p class="status-copy">
          ${intermediateVersionsCopy}
        </p>
        ${largeJumpMigrationCopy}
        ${indirectPathsCopy}
      </article>
    `;

    // Show the static reference section only when the upgrade is genuinely
    // unsupported (no direct path and no indirect path exists).
    migrationReferenceSection.hidden = hasIndirectPaths;
    osUpgradeNote.hidden = isK8sPlatform(selections.platform);

    if (hasIndirectPaths) {
      // OS upgrade also has to be considered on the indirect path. The
      // per-path summary builder figures out which hop the OS step belongs
      // to; here we just decide whether one is needed at all by checking
      // the final target version against the current OS.
      const indirectFinalPlatformSupport = getPlatformSupport(
        selections.targetVersion,
        selections.platform,
        selections.operatingSystem,
      );
      const indirectOsUpgradeRequired =
        !indirectFinalPlatformSupport.supported
        && indirectFinalPlatformSupport.reason === 'operating-system-not-supported';

      // Store the available indirect upgrade paths for the upgrade wizard.
      // Wrapped in its own try/catch so a storage failure (quota exceeded,
      // private-browsing restriction, etc.) cannot prevent the feasible result
      // from being returned and the "Start upgrade guide" button from appearing.
      try {
        const updatedSelections = {
          ...selections,
          upgradePaths,
          isDirect: false,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSelections));
      } catch {
        // Storage failure is non-fatal; the wizard will rebuild paths on load.
      }
      renderProcessSummary(selections, upgradePaths, indirectOsUpgradeRequired, false);
      return { feasible: true, osUpgradeRequired: indirectOsUpgradeRequired, indirect: true };
    }

    return { feasible: false };
  }

  const platformSupport = getPlatformSupport(
    selections.targetVersion,
    selections.platform,
    selections.operatingSystem,
  );

  const osUpgradeRequired = !platformSupport.supported && platformSupport.reason === 'operating-system-not-supported';

  if (!platformSupport.supported && !osUpgradeRequired) {
    guideOutput.innerHTML = `
      <article class="guide-panel unsupported-panel">
        <h3>Environment not supported</h3>
        <p class="status-copy">
          Redis docs do not list <strong>${escapeHtml(platformLabel)}</strong> with
          <strong>${escapeHtml(operatingSystemLabel)}</strong> as a supported environment for
          the target Redis Software version <strong>${escapeHtml(targetLabel)}</strong>.
        </p>
        <p class="status-copy">
          Choose a supported operating system or deployment platform before planning this upgrade.
        </p>
      </article>
    `;
    return { feasible: false };
  }


  const databaseCompatibility = getDatabaseCompatibility(
    selections.targetVersion,
    selections.databaseVersion,
  );

  if (!databaseCompatibility.supported) {
    guideOutput.innerHTML = `
      <article class="guide-panel unsupported-panel">
        <h3>Database version not compatible with the target cluster version</h3>
        <p class="status-copy">
          Redis database version family <strong>${escapeHtml(getDatabaseVersionFamilyLabel(selections.databaseVersion))}</strong>
          is not listed among the bundled/supported database versions for
          Redis Software <strong>${escapeHtml(targetLabel)}</strong>.
        </p>
        <p class="status-copy">
          Upgrade the database separately or choose a target Redis Software version that supports this database family.
        </p>
      </article>
    `;
    return { feasible: false };
  }

  const targetModuleCompatibility = selectedModuleFamilies.map((family) =>
    getDatabaseCompatibility(selections.targetVersion, family),
  );

  if (hasSelectedModules && targetModuleCompatibility.some((compatibility) => !compatibility.supported)) {
    const supportedTargetModuleFamilies = (targetModuleCompatibility[0]?.supportedDatabaseFamilies ?? []).map(
      (family) => getDatabaseVersionFamilyLabel(family),
    );
    const supportedTargetModuleFamiliesCopy = supportedTargetModuleFamilies.length
      ? `Redis Software <strong>${escapeHtml(targetLabel)}</strong> supports modules aligned to database version families <strong>${escapeHtml(supportedTargetModuleFamilies.join(', '))}</strong>.`
      : `Review Redis's bundled database-version support for <strong>${escapeHtml(targetLabel)}</strong> before planning a module-aware upgrade.`;

    guideOutput.innerHTML = `
      <article class="guide-panel unsupported-panel">
        <h3>Installed modules not compatible with the target cluster version</h3>
        <p class="status-copy">
          Selected modules use database version families <strong>${escapeHtml(selectedModuleFamilyCopy)}</strong>,
          which are not supported for the target Redis Software version <strong>${escapeHtml(targetLabel)}</strong>.
        </p>
        <p class="status-copy">
          ${supportedTargetModuleFamiliesCopy}
        </p>
        <p class="status-copy">
          Selected modules: <strong>${escapeHtml(selectedModuleSummary)}</strong>.
        </p>
      </article>
    `;
    return { feasible: false };
  }

  // On the happy path, the process summary below already shows everything the
  // user needs to see, so no per-check confirmation panel is rendered here.
  // The only non-obvious piece worth surfacing is the OS-upgrade warning, which
  // tells the user a dedicated step will appear in the wizard.
  guideOutput.innerHTML = osUpgradeRequired
    ? `
      <section class="warning-panel">
        <h3>Operating system upgrade required</h3>
        <p class="status-copy">
          The current operating system <strong>${escapeHtml(operatingSystemLabel)}</strong>
          is not listed for <strong>${escapeHtml(targetLabel)}</strong> on
          <strong>${escapeHtml(platformLabel)}</strong>.
          An OS upgrade step is included in the upgrade wizard below.
        </p>
      </section>
    `
    : '';

  // Store direct path info for the upgrade wizard.
  // Wrapped in its own try/catch so a storage failure cannot prevent the
  // feasible result from being returned and the button from appearing.
  try {
    const updatedSelections = {
      ...selections,
      upgradePaths: [[selections.sourceVersion, selections.targetVersion]],
      isDirect: true,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSelections));
  } catch {
    // Storage failure is non-fatal; the wizard will rebuild the path on load.
  }

  renderProcessSummary(
    selections,
    [[selections.sourceVersion, selections.targetVersion]],
    osUpgradeRequired,
    true,
  );

  return { feasible: true, osUpgradeRequired };
}

/* ---------------------------------------------------------------------------
   Initialization
   --------------------------------------------------------------------------- */

function initialize() {
  const stored = sessionStorage.getItem(STORAGE_KEY);

  if (!stored) {
    window.location.href = 'index.html';
    return;
  }

  let selections;

  try {
    selections = JSON.parse(stored);
  } catch {
    window.location.href = 'index.html';
    return;
  }

  try {
    renderResultsSummary(selections);
  } catch (e) {
    document.body.innerHTML += `<pre style="color:red">renderResultsSummary error: ${e.message}\n${e.stack}</pre>`;
    return;
  }

  let result;
  try {
    result = renderUpgradePathResult(selections);
  } catch (e) {
    document.body.innerHTML += `<pre style="color:red">renderUpgradePathResult error: ${e.message}\n${e.stack}</pre>`;
    return;
  }

  if (result?.feasible) {
    startUpgradeGuideWrapper.hidden = false;
    startUpgradeGuideButton.addEventListener('click', () => {
      window.location.href = 'upgrade.html';
    });
  }

  editSelectionsButton.addEventListener('click', () => {
    // Route back to the form page that matches the stored deployment type.
    window.location.href = isK8sPlatform(selections.platform) ? 'kubernetes.html' : 'redis-software.html';
  });
}

initialize();