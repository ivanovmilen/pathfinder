import {
  OPTIONS,
  getDatabaseCompatibility,
  getDatabaseVersionFamily,
  getDatabaseVersionFamilyLabel,
  getModuleOptionsForFeatureSet,
  getSupportedK8sVersions,
  getSupportedOperatingSystemOptions,
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
  activeActive: document.querySelector('#active-active'),
  modules: document.querySelector('#installed-modules'),
  // operatingSystem is null on kubernetes.html (field not present)
  operatingSystem: document.querySelector('#operating-system'),
  // platform is null on kubernetes.html (field not present)
  platform: document.querySelector('#deployment-platform'),
  k8sDistribution: document.querySelector('#k8s-distribution'),
  // k8sVersion is null on redis-software.html (field not present)
  k8sVersion: document.querySelector('#k8s-version'),
};

const osFieldWrapper = document.querySelector('#os-field');
const k8sDistributionFieldWrapper = document.querySelector('#k8s-distribution-field');
const k8sVersionFieldWrapper = document.querySelector('#k8s-version-field');

const formOutput = document.querySelector('#form-output');
const updateGuideButton = document.querySelector('#update-guide');

const STORAGE_KEY = 'pathfinder_selections';

const PLACEHOLDER_LABELS = {
  sourceVersion: 'Select current version',
  targetVersion: 'Select target version',
  databaseVersion: 'Select current database version',
  platform: 'Select deployment platform',
  k8sDistribution: 'Select Kubernetes distribution',
  k8sVersion: 'Select Kubernetes version',
  operatingSystem: 'Select operating system',
  modules: 'Select installed modules',
};

const FIELD_LABELS = {
  sourceVersion: 'Current version',
  targetVersion: 'Target version',
  databaseVersion: 'Current database version',
  platform: 'Deployment platform',
  k8sDistribution: 'Kubernetes distribution',
  operatingSystem: 'Operating system',
  modules: 'Installed modules',
  activeActive: 'Active-Active (CRDB)',
};



function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

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

function isK8sPlatformSelected() {
  // On the kubernetes page there is no platform toggle — the k8s distribution
  // IS the platform, so we're always in "k8s mode" when a distribution is
  // selected (or even before one is selected, the page is k8s-only).
  if (IS_K8S_PAGE) return true;
  return formControls.platform?.value === 'kubernetes';
}

function getEffectivePlatform() {
  if (IS_K8S_PAGE) {
    // The k8s distribution select is the sole platform selector on this page.
    return formControls.k8sDistribution?.value ?? '';
  }
  // redis-software.html has no platform selector — it is always VM/Bare Metal.
  if (!formControls.platform) {
    return 'vms';
  }
  if (formControls.platform.value === 'kubernetes') {
    return formControls.k8sDistribution?.value ?? '';
  }
  return formControls.platform.value;
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

  // On the kubernetes page the distribution IS the platform selector.
  // On the redis-software page (when kubernetes is selected), check platform.
  const hasDistribution = Boolean(formControls.k8sDistribution?.value);
  const isK8s = IS_K8S_PAGE
    ? hasDistribution
    : (formControls.platform?.value === 'kubernetes' && hasDistribution);
  const sourceVersion = formControls.sourceVersion.value;

  if (!isK8s || !sourceVersion) {
    if (k8sVersionFieldWrapper) k8sVersionFieldWrapper.hidden = true;
    formControls.k8sVersion.value = '';
    return;
  }

  const platform = getEffectivePlatform();
  // Normalize '6.2.4', '6.2.8', etc. → '6.2' for matrix lookup
  const family = sourceVersion.startsWith('6.2.') ? '6.2' : sourceVersion;
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

function syncPlatformFields() {
  if (IS_K8S_PAGE) {
    // On the kubernetes page the distribution field is always visible and there
    // is no platform toggle or OS field to manage — just keep k8s version in sync.
    syncK8sVersionOptions();
    return;
  }

  const platformValue = formControls.platform?.value ?? '';
  const k8s = platformValue === 'kubernetes';

  // K8s distribution dropdown — visible only when Kubernetes is selected
  if (k8sDistributionFieldWrapper) {
    k8sDistributionFieldWrapper.hidden = !k8s;
  }
  if (formControls.k8sDistribution) {
    formControls.k8sDistribution.disabled = !k8s;
    if (!k8s) formControls.k8sDistribution.value = '';
  }

  // OS dropdown — hidden only when Kubernetes is selected, visible otherwise
  if (osFieldWrapper) {
    osFieldWrapper.hidden = k8s;
  }
  if (formControls.operatingSystem) {
    formControls.operatingSystem.disabled = k8s;
    if (k8s) {
      formControls.operatingSystem.value = '';
    } else {
      // Re-populate OS options when switching back from K8s to ensure they are available
      syncOperatingSystemOptions();
    }
  }

  syncK8sVersionOptions();
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
  syncOperatingSystemOptions();
  syncModuleOptions();
  syncK8sVersionOptions();
}

function getSelections() {
  return {
    sourceVersion: formControls.sourceVersion.value,
    targetVersion: formControls.targetVersion.value,
    databaseVersion: formControls.databaseVersion.value,
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
  const k8sSelected = isK8sPlatformSelected();
  const missing = [];

  // Standard version fields are always required
  const standardFields = ['sourceVersion', 'targetVersion', 'databaseVersion'];
  for (const key of standardFields) {
    if (!selections[key]) missing.push(FIELD_LABELS[key]);
  }

  if (IS_K8S_PAGE) {
    // On the kubernetes page the distribution IS the platform selector.
    if (!formControls.k8sDistribution?.value) {
      missing.push(FIELD_LABELS.k8sDistribution);
    }
  } else {
    // Platform selector is absent on redis-software.html (hardcoded to 'vms').
    // Only validate it when the control is actually present in the DOM.
    if (formControls.platform) {
      if (!formControls.platform.value) {
        missing.push(FIELD_LABELS.platform);
      } else if (k8sSelected && !formControls.k8sDistribution?.value) {
        // K8s distribution is required when Kubernetes is selected as platform
        missing.push(FIELD_LABELS.k8sDistribution);
      }
    }

    // OS is required for non-K8s platforms
    if (!k8sSelected && !selections.operatingSystem) {
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

  if (selections.platform) {
    if (IS_K8S_PAGE) {
      // On the kubernetes page, selections.platform already holds the k8s
      // distribution value (e.g. 'kubernetes-openshift') — restore it directly.
      if (formControls.k8sDistribution) {
        formControls.k8sDistribution.value = selections.platform;
        syncK8sVersionOptions();
        if (selections.k8sVersion && formControls.k8sVersion) {
          formControls.k8sVersion.value = selections.k8sVersion;
        }
      }
    } else if (selections.platform.startsWith('kubernetes-')) {
      // Two-level restore on redis-software page: set platform to 'kubernetes',
      // then restore the specific distribution.
      if (formControls.platform) {
        formControls.platform.value = 'kubernetes';
        syncPlatformFields();
      }
      if (formControls.k8sDistribution) {
        formControls.k8sDistribution.value = selections.platform;
        syncK8sVersionOptions();
        if (selections.k8sVersion && formControls.k8sVersion) {
          formControls.k8sVersion.value = selections.k8sVersion;
        }
      }
    } else {
      if (formControls.platform) {
        formControls.platform.value = selections.platform;
        syncPlatformFields();
      }
    }
  }

  if (selections.operatingSystem && !selections.platform?.startsWith('kubernetes-')) {
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
  // platform select is absent on kubernetes.html
  if (formControls.platform) {
    populateSelect(formControls.platform, OPTIONS.platforms, '', PLACEHOLDER_LABELS.platform);
  }
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
  formControls.databaseVersion.addEventListener('change', syncModuleOptions);
  // platform listener is absent on kubernetes.html
  formControls.platform?.addEventListener('change', syncPlatformFields);
  formControls.k8sDistribution?.addEventListener('change', syncK8sVersionOptions);
  updateGuideButton.addEventListener('click', render);
  renderEmptyState();
}

initialize();