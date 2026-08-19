import {
  OPTIONS,
  escapeHtml,
  getClusterVersionFamily,
  getDatabaseCompatibility,
  getDatabaseVersionFamily,
  getDatabaseVersionFamilyLabel,
  getModuleOptionsForFeatureSet,
  getSupportedK8sVersions,
  getSupportedOperatingSystemOptions,
  isK8sPlatform,
} from './upgrade-data.js';

// Detect which form page is active so app.js can configure itself accordingly.
// kubernetes.html sets data-page-type="kubernetes"; redis-software.html sets
// data-page-type="redis-software".  Defaults to 'redis-software' as a safe
// fallback so the logic below never crashes on an unexpected page.
const PAGE_TYPE = document.body.dataset.pageType ?? 'redis-software';
const IS_K8S_PAGE = PAGE_TYPE === 'kubernetes';

const formControls = {
  sourceVersion: document.querySelector('#source-version'),
  targetVersion: document.querySelector('#target-version'),
  databaseVersion: document.querySelector('#database-version'),
  targetDatabaseVersion: document.querySelector('#target-database-version'),
  activeActive: document.querySelector('#active-active'),
  modules: document.querySelector('#installed-modules'),
  // operatingSystem is null on kubernetes.html (field not present)
  operatingSystem: document.querySelector('#operating-system'),
  k8sDistribution: document.querySelector('#k8s-distribution'),
  // k8sVersion is null on redis-software.html (field not present)
  k8sVersion: document.querySelector('#k8s-version'),
};

const k8sDistributionFieldWrapper = document.querySelector('#k8s-distribution-field');
const k8sVersionFieldWrapper = document.querySelector('#k8s-version-field');

const formOutput = document.querySelector('#form-output');
const updateGuideButton = document.querySelector('#update-guide');

const STORAGE_KEY = 'pathfinder_selections';

const PLACEHOLDER_LABELS = {
  sourceVersion: 'Select current version',
  targetVersion: 'Select target version',
  databaseVersion: 'Select current database version',
  targetDatabaseVersion: 'Select target database version',
  k8sDistribution: 'Select Kubernetes distribution',
  k8sVersion: 'Select Kubernetes version',
  operatingSystem: 'Select operating system',
  modules: 'Select installed modules',
};

const FIELD_LABELS = {
  sourceVersion: 'Current version',
  targetVersion: 'Target version',
  databaseVersion: 'Current database version',
  targetDatabaseVersion: 'Target database version',
  k8sDistribution: 'Kubernetes distribution',
  operatingSystem: 'Operating system',
  modules: 'Installed modules',
  activeActive: 'Active-Active (CRDB)',
};



function populateSelect(select, options, selectedValue, placeholderLabel) {
  select.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholderLabel;
  placeholderOption.selected = !selectedValue;
  select.append(placeholderOption);

  options.forEach((option) => {
    const normalized = typeof option === 'string' ? { value: option, label: option } : option;
    const element = document.createElement('option');
    element.value = normalized.value;
    element.textContent = normalized.label;
    element.selected = normalized.value === selectedValue;
    select.append(element);
  });
}

function getOptionValue(option) {
  return typeof option === 'string' ? option : option.value;
}

function getSelectedModuleValues() {
  return [...formControls.modules.querySelectorAll('input[type="checkbox"]:checked')].map(
    (input) => input.value,
  );
}

function renderModuleSelector(options, selectedValues, { disabled, placeholderLabel, emptyLabel }) {
  formControls.modules.innerHTML = '';
  formControls.modules.setAttribute('aria-disabled', String(disabled));
  const selectedValueSet = new Set(selectedValues);

  if (disabled) {
    const placeholder = document.createElement('div');
    placeholder.className = 'module-selector-placeholder';
    placeholder.textContent = placeholderLabel;
    formControls.modules.append(placeholder);
    return;
  }

  if (options.length) {
    const optionList = document.createElement('div');
    optionList.className = 'module-selector-list';

    options.forEach((option) => {
      const item = document.createElement('label');
      item.className = 'module-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = option.value;
      checkbox.checked = selectedValueSet.has(option.value);

      const copy = document.createElement('span');
      copy.className = 'module-option-copy';

      const label = document.createElement('span');
      label.className = 'module-option-label';
      label.textContent = option.label;

      const meta = document.createElement('span');
      meta.className = 'module-option-meta';
      meta.textContent = `Database family ${getDatabaseVersionFamilyLabel(option.featureSet)}`;

      copy.append(label, meta);
      item.append(checkbox, copy);
      optionList.append(item);
    });

    formControls.modules.append(optionList);
  } else {
    const emptyState = document.createElement('div');
    emptyState.className = 'module-selector-empty';
    emptyState.textContent = emptyLabel;
    formControls.modules.append(emptyState);
  }

  const helper = document.createElement('div');
  helper.className = 'module-selector-helper';
  helper.textContent = 'Leave all boxes unchecked if no modules are installed.';
  formControls.modules.append(helper);
}

function getDatabaseOptionsForSourceVersion(sourceVersion) {
  if (!sourceVersion) {
    return [];
  }

  return OPTIONS.databaseVersions.filter((option) =>
    getDatabaseCompatibility(sourceVersion, getOptionValue(option)).supported,
  );
}

function getOperatingSystemOptionsForSourceVersion(sourceVersion) {
  if (!sourceVersion) {
    return [];
  }

  return getSupportedOperatingSystemOptions(sourceVersion, 'vms');
}

function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

function syncTargetVersionOptions() {
  const sourceVersion = formControls.sourceVersion.value;
  const availableOptions = sourceVersion
    ? OPTIONS.targetVersions.filter((option) => compareVersions(getOptionValue(option), sourceVersion) > 0)
    : OPTIONS.targetVersions;
  const currentTarget = formControls.targetVersion.value;
  const selectedTarget = availableOptions.some(
    (option) => getOptionValue(option) === currentTarget,
  )
    ? currentTarget
    : '';

  populateSelect(
    formControls.targetVersion,
    availableOptions,
    selectedTarget,
    PLACEHOLDER_LABELS.targetVersion,
  );
}

function syncDatabaseVersionOptions() {
  const availableOptions = getDatabaseOptionsForSourceVersion(formControls.sourceVersion.value);
  const currentDatabaseVersion = formControls.databaseVersion.value;
  const selectedDatabaseVersion = availableOptions.some(
    (option) => getOptionValue(option) === currentDatabaseVersion,
  )
    ? currentDatabaseVersion
    : '';

  populateSelect(
    formControls.databaseVersion,
    availableOptions,
    selectedDatabaseVersion,
    PLACEHOLDER_LABELS.databaseVersion,
  );
}

// Target database options are the families bundled with the chosen target
// cluster version that are not older than the current database family — you
// can only run a DB version your target cluster ships, and Pathfinder never
// models a database downgrade.
function getTargetDatabaseOptions(targetVersion, currentDatabaseVersion) {
  if (!targetVersion) {
    return [];
  }

  const currentFamily = currentDatabaseVersion
    ? getDatabaseVersionFamily(currentDatabaseVersion)
    : '';

  return OPTIONS.databaseVersions.filter((option) => {
    const family = getOptionValue(option);
    if (!getDatabaseCompatibility(targetVersion, family).supported) return false;
    if (currentFamily && compareVersions(family, currentFamily) < 0) return false;
    return true;
  });
}

function syncTargetDatabaseVersionOptions() {
  if (!formControls.targetDatabaseVersion) return;

  const availableOptions = getTargetDatabaseOptions(
    formControls.targetVersion.value,
    formControls.databaseVersion.value,
  );
  const currentTargetDatabaseVersion = formControls.targetDatabaseVersion.value;
  const selectedTargetDatabaseVersion = availableOptions.some(
    (option) => getOptionValue(option) === currentTargetDatabaseVersion,
  )
    ? currentTargetDatabaseVersion
    : '';

  populateSelect(
    formControls.targetDatabaseVersion,
    availableOptions,
    selectedTargetDatabaseVersion,
    PLACEHOLDER_LABELS.targetDatabaseVersion,
  );
}

function getEffectivePlatform() {
  if (IS_K8S_PAGE) {
    // The k8s distribution select is the sole platform selector on this page.
    return formControls.k8sDistribution?.value ?? '';
  }
  // redis-software.html has no platform selector — it is always VM/Bare Metal.
  return 'vms';
}

function syncOperatingSystemOptions() {
  // kubernetes.html has no OS field — skip silently.
  if (!formControls.operatingSystem) return;

  const availableOptions = getOperatingSystemOptionsForSourceVersion(formControls.sourceVersion.value);
  const currentOperatingSystem = formControls.operatingSystem.value;
  const selectedOperatingSystem = availableOptions.some(
    (option) => getOptionValue(option) === currentOperatingSystem,
  )
    ? currentOperatingSystem
    : '';

  populateSelect(
    formControls.operatingSystem,
    availableOptions,
    selectedOperatingSystem,
    PLACEHOLDER_LABELS.operatingSystem,
  );
}

function syncK8sVersionOptions() {
  // redis-software.html has no k8s version field — skip silently.
  if (!formControls.k8sVersion) return;

  // The distribution field only exists on the kubernetes page, and there it IS
  // the platform selector. The redis-software page has no k8s version field, so
  // this function already returned above via the formControls.k8sVersion guard.
  const isK8s = IS_K8S_PAGE && Boolean(formControls.k8sDistribution?.value);
  const sourceVersion = formControls.sourceVersion.value;

  if (!isK8s || !sourceVersion) {
    if (k8sVersionFieldWrapper) k8sVersionFieldWrapper.hidden = true;
    formControls.k8sVersion.value = '';
    return;
  }

  const platform = getEffectivePlatform();
  // Normalize patch versions ('6.2.4' → '6.2', '8.0.10' → '8.0') for matrix lookup
  const family = getClusterVersionFamily(sourceVersion);
  const availableVersions = getSupportedK8sVersions(family, platform);

  if (!availableVersions.length) {
    if (k8sVersionFieldWrapper) k8sVersionFieldWrapper.hidden = true;
    formControls.k8sVersion.value = '';
    return;
  }

  const currentK8sVersion = formControls.k8sVersion.value;
  const selectedVersion = availableVersions.includes(currentK8sVersion) ? currentK8sVersion : '';

  if (k8sVersionFieldWrapper) k8sVersionFieldWrapper.hidden = false;
  populateSelect(formControls.k8sVersion, availableVersions, selectedVersion, PLACEHOLDER_LABELS.k8sVersion);
}

function syncModuleOptions() {
  const currentDatabaseVersion = formControls.databaseVersion.value;
  const currentModuleSelection = getSelectedModuleValues();
  const databaseFamily = currentDatabaseVersion
    ? getDatabaseVersionFamily(currentDatabaseVersion)
    : '';
  const hasDatabaseVersion = Boolean(currentDatabaseVersion);
  const availableOptions = hasDatabaseVersion ? getModuleOptionsForFeatureSet(databaseFamily) : [];
  const selectedModules = hasDatabaseVersion
    ? currentModuleSelection.filter((selection) =>
        availableOptions.some((option) => option.value === selection),
      )
    : [];
  const emptyLabel = databaseFamily
    ? `No individual modules are listed for database version family ${getDatabaseVersionFamilyLabel(databaseFamily)}.`
    : '';

  renderModuleSelector(availableOptions, selectedModules, {
    disabled: !hasDatabaseVersion,
    placeholderLabel: PLACEHOLDER_LABELS.modules,
    emptyLabel,
  });
}

function syncSourceAwareOptions() {
  syncTargetVersionOptions();
  syncDatabaseVersionOptions();
  syncTargetDatabaseVersionOptions();
  syncOperatingSystemOptions();
  syncModuleOptions();
  syncK8sVersionOptions();
}

function getSelections() {
  return {
    sourceVersion: formControls.sourceVersion.value,
    targetVersion: formControls.targetVersion.value,
    databaseVersion: formControls.databaseVersion.value,
    targetDatabaseVersion: formControls.targetDatabaseVersion?.value ?? '',
    activeActive: formControls.activeActive.checked,
    modules: getSelectedModuleValues(),
    // operatingSystem is absent on kubernetes.html — fall back to empty string
    operatingSystem: formControls.operatingSystem?.value ?? '',
    platform: getEffectivePlatform(),
    k8sVersion: formControls.k8sVersion?.value ?? '',
  };
}

function renderEmptyState(message, missingFields = []) {
  const missingFieldsMarkup = missingFields.length
    ? `
        <ul>
          ${missingFields.map((field) => `<li>${escapeHtml(field)}</li>`).join('')}
        </ul>
      `
    : '';

  formOutput.innerHTML = `
    <article class="guide-panel">
      <h2>Complete the form to check an upgrade path</h2>
      <p class="status-copy">
        ${escapeHtml(message ?? 'Choose all required values, then click Check Upgrade Path.')}
      </p>
      ${missingFieldsMarkup}
    </article>
  `;
}

function getMissingSelections(selections) {
  const missing = [];

  // Standard version fields are always required
  const standardFields = ['sourceVersion', 'targetVersion', 'databaseVersion', 'targetDatabaseVersion'];
  for (const key of standardFields) {
    if (!selections[key]) missing.push(FIELD_LABELS[key]);
  }

  if (IS_K8S_PAGE) {
    // On the kubernetes page the distribution IS the platform selector.
    if (!formControls.k8sDistribution?.value) {
      missing.push(FIELD_LABELS.k8sDistribution);
    }
  } else {
    // redis-software.html has no platform selector (always VMs/Bare Metal), so
    // the operating system is always required.
    if (!selections.operatingSystem) {
      missing.push(FIELD_LABELS.operatingSystem);
    }
  }

  return missing;
}

const fieldHelpToggles = [...document.querySelectorAll('.field-help-toggle')];

function getHelpPanelForToggle(toggle) {
  const panelId = toggle.getAttribute('aria-controls');
  return panelId ? document.getElementById(panelId) : null;
}

function setHelpToggleOpen(toggle, isOpen) {
  const panel = getHelpPanelForToggle(toggle);

  if (!toggle || !panel) {
    return;
  }

  toggle.setAttribute('aria-expanded', String(isOpen));
  panel.hidden = !isOpen;
}

function closeAllFieldHelp(exceptToggle = null) {
  fieldHelpToggles.forEach((toggle) => {
    if (toggle !== exceptToggle) {
      setHelpToggleOpen(toggle, false);
    }
  });
}

function initializeFieldHelpPanels() {
  if (!fieldHelpToggles.length) {
    return;
  }

  fieldHelpToggles.forEach((toggle) => {
    const panel = getHelpPanelForToggle(toggle);

    if (!panel) {
      return;
    }

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      closeAllFieldHelp(toggle);
      setHelpToggleOpen(toggle, !isOpen);
    });

    panel.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  });

  document.addEventListener('click', (event) => {
    const clickedToggle = fieldHelpToggles.find((toggle) => toggle.contains(event.target));
    const clickedPanel = fieldHelpToggles.find((toggle) => {
      const panel = getHelpPanelForToggle(toggle);
      return panel && panel.contains(event.target);
    });
    closeAllFieldHelp(clickedToggle ?? clickedPanel ?? null);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllFieldHelp();
    }
  });
}

function render() {
  const selections = getSelections();
  const missingSelections = getMissingSelections(selections);

  if (missingSelections.length) {
    renderEmptyState('Choose every required value before checking the upgrade path.', missingSelections);
    return;
  }

  closeAllFieldHelp();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
  window.location.href = 'results.html';
}

function restoreFormFromStorage() {
  const stored = sessionStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return;
  }

  let selections;

  try {
    selections = JSON.parse(stored);
  } catch {
    return;
  }

  if (selections.sourceVersion) {
    formControls.sourceVersion.value = selections.sourceVersion;
    syncSourceAwareOptions();
  }

  if (selections.targetVersion) {
    formControls.targetVersion.value = selections.targetVersion;
  }

  if (selections.databaseVersion) {
    formControls.databaseVersion.value = selections.databaseVersion;
    syncModuleOptions();
  }

  // Target DB options depend on both the target cluster version and the current
  // database family, so re-sync now that both have been restored above.
  if (formControls.targetDatabaseVersion) {
    syncTargetDatabaseVersionOptions();
    if (selections.targetDatabaseVersion) {
      formControls.targetDatabaseVersion.value = selections.targetDatabaseVersion;
    }
  }

  // Only the kubernetes page has a platform control to restore — there,
  // selections.platform holds the k8s distribution value (e.g.
  // 'kubernetes-openshift'). redis-software.html is always VMs/Bare Metal.
  if (selections.platform && IS_K8S_PAGE && formControls.k8sDistribution) {
    formControls.k8sDistribution.value = selections.platform;
    syncK8sVersionOptions();
    if (selections.k8sVersion && formControls.k8sVersion) {
      formControls.k8sVersion.value = selections.k8sVersion;
    }
  }

  if (selections.operatingSystem && !isK8sPlatform(selections.platform)) {
    if (formControls.operatingSystem) {
      formControls.operatingSystem.value = selections.operatingSystem;
    }
  }

  if (selections.activeActive) {
    formControls.activeActive.checked = true;
  }

  if (Array.isArray(selections.modules) && selections.modules.length) {
    selections.modules.forEach((moduleValue) => {
      const checkbox = formControls.modules.querySelector(`input[type="checkbox"][value="${moduleValue}"]`);

      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }
}

function initialize() {
  populateSelect(formControls.sourceVersion, OPTIONS.sourceVersions, '', PLACEHOLDER_LABELS.sourceVersion);
  populateSelect(formControls.targetVersion, OPTIONS.targetVersions, '', PLACEHOLDER_LABELS.targetVersion);
  if (formControls.k8sDistribution) {
    populateSelect(formControls.k8sDistribution, OPTIONS.k8sDistributions, '', PLACEHOLDER_LABELS.k8sDistribution);
  }

  // On the kubernetes page the distribution field is permanently visible.
  if (IS_K8S_PAGE && k8sDistributionFieldWrapper) {
    k8sDistributionFieldWrapper.hidden = false;
  }

  syncSourceAwareOptions();
  initializeFieldHelpPanels();
  restoreFormFromStorage();

  formControls.sourceVersion.addEventListener('change', syncSourceAwareOptions);
  formControls.databaseVersion.addEventListener('change', () => {
    syncModuleOptions();
    // The current database family is the floor for target DB options.
    syncTargetDatabaseVersionOptions();
  });
  // Target cluster version determines which DB families are bundled/offered.
  formControls.targetVersion.addEventListener('change', syncTargetDatabaseVersionOptions);
  formControls.k8sDistribution?.addEventListener('change', syncK8sVersionOptions);
  updateGuideButton.addEventListener('click', render);
  renderEmptyState();
}

initialize();