import {
  OPTIONS,
  SCENARIOS,
  buildScenarioKey,
  findUpgradePaths,
  getClusterVersionFamily,
  getCompatibleModuleVersions,
  getDatabaseCompatibility,
  getDatabaseVersionFamily,
  getDatabaseVersionFamilyLabel,
  getClusterVersionLabel,
  getDirectUpgradeSupport,
  getModuleEntries,
  getModuleLabel,
  getModuleSelectionSummary,
  getPlatformSupport,
  getSupportedOperatingSystemOptions,
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

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
      ${selections.platform.startsWith('kubernetes-') && selections.k8sVersion ? `
      <div>
        <dt>${selections.platform === 'kubernetes-openshift' ? 'OpenShift version' : 'Kubernetes version'}</dt>
        <dd>${escapeHtml(selections.k8sVersion)}</dd>
      </div>
      ` : ''}
      ${selections.platform.startsWith('kubernetes-') ? '' : `
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

function renderProcessSummary(selections, upgradePaths, osUpgradeRequired, isDirect) {
  if (!processSummary || !upgradePaths.length) return;

  // Pick the shortest path as the preview when multiple bridge routes exist.
  const previewPath = upgradePaths.slice().sort((a, b) => a.length - b.length)[0];
  const finalIdx = previewPath.length - 1;
  const isMultiStep = previewPath.length > 2;
  const isK8s = selections.platform.startsWith('kubernetes-');

  const selectedModules = Array.isArray(selections.modules) ? selections.modules : [];
  const moduleNames = selectedModules.length
    ? [...new Set(getModuleEntries(selectedModules).map((m) => m.name))]
    : [];
  const hasModules = moduleNames.length > 0;

  const steps = [];

  for (let i = 1; i < previewPath.length; i++) {
    const stepSource = previewPath[i - 1];
    const stepTarget = previewPath[i];
    const isBridgeHop = isMultiStep && i < finalIdx;
    const targetVersionLabel = escapeHtml(getClusterVersionLabel(stepTarget));

    // Kubernetes platforms upgrade the operator before each cluster upgrade.
    if (isK8s) {
      steps.push('<strong>Upgrade Redis Enterprise Operator</strong>');
    }

    // Cluster upgrade — primary milestone.
    if (isMultiStep) {
      const sourceVersionLabel = escapeHtml(getClusterVersionLabel(stepSource));
      const bridgeTag = isBridgeHop ? ' [Bridge]' : '';
      steps.push(`<strong>Upgrade Cluster</strong> (${sourceVersionLabel} &rarr; ${targetVersionLabel}${bridgeTag})`);
    } else {
      steps.push(`<strong>Upgrade Cluster</strong> to ${targetVersionLabel}`);
    }

    // OS upgrade — final hop only, non-K8s, when required. Specify the target OS.
    if (!isK8s && osUpgradeRequired && i === finalIdx) {
      const supportedTargetOs = getSupportedOperatingSystemOptions(stepTarget, selections.platform);
      const targetOsLabel = supportedTargetOs[0]?.label ?? 'a supported version';
      steps.push(`<strong>Upgrade OS to ${escapeHtml(targetOsLabel)}</strong>`);
    }

    // Database upgrade — secondary action.
    steps.push('(Database upgrade)');

    // Module upgrade — non-K8s only (the operator handles modules implicitly on Kubernetes
    // when spec.redisVersion is bumped). Only appears when the bundled DB family changes
    // between hop endpoints, and is sequenced after the database upgrade to mirror the
    // wizard's `rladmin upgrade db` → `rladmin upgrade module` ordering.
    if (!isK8s && hasModules) {
      const sourceModules = getCompatibleModuleVersions(stepSource, moduleNames);
      const targetModules = getCompatibleModuleVersions(stepTarget, moduleNames);
      const familyChanged = sourceModules.length !== targetModules.length
        || sourceModules.some((m, idx) =>
            m.feature_set !== targetModules[idx]?.feature_set
            || m.version !== targetModules[idx]?.version);
      if (familyChanged && targetModules.length) {
        const moduleList = targetModules
          .map((m) => `${escapeHtml(getModuleLabel(m))} ${escapeHtml(m.version)}`)
          .join(', ');
        steps.push(`(Upgrade modules: ${moduleList})`);
      }
    }
  }

  // Active-Active deployments need a final synchronization check.
  if (selections.activeActive) {
    steps.push('<strong>Verify CRDB Synchronization</strong>');
  }

  const intro = isDirect
    ? 'Your upgrade will proceed directly through these steps in the wizard:'
    : `Your upgrade requires ${previewPath.length - 1} cluster upgrade steps via documented bridge versions:`;

  processSummary.innerHTML = `
    <div class="guide-title-row">
      <h2 id="process-summary-title">Upgrade process summary</h2>
    </div>
    <p class="status-copy">${intro}</p>
    <p class="status-copy">${steps.join(' &rarr; ')}</p>
  `;
  processSummary.hidden = false;
}

function renderUpgradePathResult(selections, scenario) {
  const title =
    scenario?.title ??
    `Redis Enterprise ${getClusterVersionLabel(selections.sourceVersion)} → ${getClusterVersionLabel(selections.targetVersion)} on ${labelForPlatform(selections.platform)}`;
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

  const sourceDatabaseCompatibility = getDatabaseCompatibility(
    selections.sourceVersion,
    selections.databaseVersion,
  );

  if (!sourceDatabaseCompatibility.supported) {
    guideOutput.innerHTML = `
      <article class="guide-panel unsupported-panel">
        <h3>Current database version not compatible with the source cluster version</h3>
        <p class="status-copy">
          Redis database version family <strong>${escapeHtml(sourceDatabaseCompatibility.databaseFamilyLabel)}</strong>
          is not listed among the bundled/supported database versions for the current
          Redis Software version <strong>${escapeHtml(sourceDatabaseCompatibility.versionLabel)}</strong>.
        </p>
        <p class="status-copy">
          Choose the current cluster version or database version family that matches Redis's documented support before planning this upgrade.
        </p>
      </article>
    `;
    return { feasible: false };
  }

  const currentDatabaseFamily = getDatabaseVersionFamily(selections.databaseVersion);

  if (hasSelectedModules && selectedModuleFamilies.some((family) => family !== currentDatabaseFamily)) {
    guideOutput.innerHTML = `
      <article class="guide-panel unsupported-panel">
        <h3>Installed modules do not match the current database version family</h3>
        <p class="status-copy">
          Selected modules use database version families <strong>${escapeHtml(selectedModuleFamilyCopy)}</strong>,
          which do not align with the current Redis database version family
          <strong>${escapeHtml(sourceDatabaseCompatibility.databaseFamilyLabel)}</strong>.
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
    osUpgradeNote.hidden = selections.platform === 'kubernetes-community' || selections.platform === 'kubernetes-openshift' || selections.platform === 'kubernetes-eks' || selections.platform === 'kubernetes-rancher' || selections.platform === 'kubernetes-gke' || selections.platform === 'kubernetes-aks';

    if (hasIndirectPaths) {
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
      renderProcessSummary(selections, upgradePaths, false, false);
      return { feasible: true, osUpgradeRequired: false, indirect: true };
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

  const moduleStatusCopy = hasSelectedModules
    ? `
      <p class="status-copy">
        Selected modules <strong>${escapeHtml(selectedModuleSummary)}</strong>
        match current database version family <strong>${escapeHtml(sourceDatabaseCompatibility.databaseFamilyLabel)}</strong>
        and remain supported for
        Redis Software <strong>${escapeHtml(targetLabel)}</strong>.
      </p>
    `
    : '';

  const osWarningCopy = osUpgradeRequired
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

  guideOutput.innerHTML = `
    <article class="guide-panel">
      <div class="guide-title-row">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <p class="status-copy">
        Direct cluster upgrade path supported by Redis docs for Redis Software
        <strong>${escapeHtml(sourceLabel)}</strong> → <strong>${escapeHtml(targetLabel)}</strong>.
      </p>
      <p class="status-copy">
        Current cluster environment: ${escapeHtml(platformLabel)}${sourcePlatformSupport.osCheckSkipped ? '' : ` on ${escapeHtml(operatingSystemLabel)}`}
        is supported for Redis Software <strong>${escapeHtml(sourceLabel)}</strong>.
      </p>
      <p class="status-copy">
        Current database version family <strong>${escapeHtml(sourceDatabaseCompatibility.databaseFamilyLabel)}</strong>
        is supported for Redis Software <strong>${escapeHtml(sourceLabel)}</strong>.
      </p>
      ${osUpgradeRequired ? '' : `
        <p class="status-copy">
          ${escapeHtml(platformLabel)}${platformSupport.osCheckSkipped ? '' : ` on ${escapeHtml(operatingSystemLabel)}`}
          is supported for the target Redis Software version <strong>${escapeHtml(targetLabel)}</strong>.
        </p>
      `}
      <p class="status-copy">
        Current database version family <strong>${escapeHtml(databaseCompatibility.databaseFamilyLabel)}</strong>
        is supported for Redis Software <strong>${escapeHtml(targetLabel)}</strong>.
      </p>
      ${moduleStatusCopy}
      ${osWarningCopy}
    </article>
  `;

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

  const scenarioKey = buildScenarioKey(selections);
  const scenario = SCENARIOS[scenarioKey];

  try {
    renderResultsSummary(selections);
  } catch (e) {
    document.body.innerHTML += `<pre style="color:red">renderResultsSummary error: ${e.message}\n${e.stack}</pre>`;
    return;
  }

  let result;
  try {
    result = renderUpgradePathResult(selections, scenario);
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
    const isK8s = selections.platform?.startsWith('kubernetes-');
    window.location.href = isK8s ? 'kubernetes.html' : 'redis-software.html';
  });
}

initialize();