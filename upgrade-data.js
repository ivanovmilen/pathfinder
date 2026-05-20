export const DEFAULT_SELECTIONS = {
  sourceVersion: '7.22',
  targetVersion: '8.0.10',
  databaseVersion: '7.4',
  modules: 'none',
  operatingSystem: 'ubuntu-20.04',
  platform: 'vms',
  activeActive: false,
};

const CLUSTER_VERSION_LABELS = {
  '6.0': '6.0.x',
  '6.2.4': '6.2.4',
  '6.2.8': '6.2.8',
  '6.2.10': '6.2.10',
  '6.2.12': '6.2.12',
  '6.2.18': '6.2.18',
  '6.4': '6.4.x',
  '7.2': '7.2.x',
  '7.4': '7.4.x',
  '7.8': '7.8.x',
  '7.22': '7.22.x',
  '8.0.2': '8.0.2',
  '8.0.6': '8.0.6',
  '8.0.10': '8.0.10',
  '8.0.16': '8.0.16',
  '8.0.18': '8.0.18',
};

const DOCUMENTED_SOURCE_VERSIONS = [
  '6.0',
  '6.2.4',
  '6.2.8',
  '6.2.10',
  '6.2.12',
  '6.2.18',
  '6.4',
  '7.2',
  '7.4',
  '7.8',
  '7.22',
];

const DOCUMENTED_TARGET_VERSIONS = ['6.4', '7.2', '7.4', '7.8', '7.22', '8.0.2', '8.0.6', '8.0.10', '8.0.16', '8.0.18'];

// This selector uses the bundled Redis DB version families from the Redis docs'
// "Default Redis database versions" table, not the separate default upgraded/new
// database version column.
const DOCUMENTED_DATABASE_VERSION_FAMILIES = ['6.0', '6.2', '7.2', '7.4', '8.0', '8.2', '8.4'];

const DATABASE_VERSION_FAMILY_LABELS = {
  '6.0': '6.0',
  '6.2': '6.2',
  '7.2': '7.2',
  '7.4': '7.4',
  '8.0': '8.0',
  '8.2': '8.2',
  '8.4': '8.4',
};

const MODULE_NAME_LABELS = {
  rejson: 'RedisJSON',
  redistimeseries: 'RedisTimeSeries',
  redisearch: 'RediSearch',
  redisbloom: 'RedisBloom',
};

const MODULE_VERSION_DATA = [
  { name: 'rejson', version: '2.4.18', feature_set: '6.2' },
  { name: 'rejson', version: '2.6.23', feature_set: '7.2' },
  { name: 'rejson', version: '2.8.18', feature_set: '7.4' },
  { name: 'rejson', version: '8.0.7', feature_set: '8.0' },
  { name: 'rejson', version: '8.2.10', feature_set: '8.2' },
  { name: 'rejson', version: '8.4.3', feature_set: '8.4' },
  { name: 'redistimeseries', version: '1.8.22', feature_set: '6.2' },
  { name: 'redistimeseries', version: '1.10.23', feature_set: '7.2' },
  { name: 'redistimeseries', version: '1.12.13', feature_set: '7.4' },
  { name: 'redistimeseries', version: '8.0.7', feature_set: '8.0' },
  { name: 'redistimeseries', version: '8.2.9', feature_set: '8.2' },
  { name: 'redistimeseries', version: '8.4.8', feature_set: '8.4' },
  { name: 'redisearch', version: '2.6.33', feature_set: '6.2' },
  { name: 'redisearch', version: '2.8.34', feature_set: '7.2' },
  { name: 'redisearch', version: '2.10.27', feature_set: '7.4' },
  { name: 'redisearch', version: '8.0.3', feature_set: '8.0' },
  { name: 'redisearch', version: '8.2.8', feature_set: '8.2' },
  { name: 'redisearch', version: '8.4.6', feature_set: '8.4' },
  { name: 'redisbloom', version: '2.4.22', feature_set: '6.2' },
  { name: 'redisbloom', version: '2.6.27', feature_set: '7.2' },
  { name: 'redisbloom', version: '2.8.19', feature_set: '7.4' },
  { name: 'redisbloom', version: '8.0.10', feature_set: '8.0' },
  { name: 'redisbloom', version: '8.2.11', feature_set: '8.2' },
  { name: 'redisbloom', version: '8.4.4', feature_set: '8.4' },
];

// All Kubernetes distributions officially supported by Redis Enterprise.
// Source: https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/
const ALL_K8S_DISTRIBUTIONS = [
  'kubernetes-community',
  'kubernetes-openshift',
  'kubernetes-eks',
  'kubernetes-aks',
  'kubernetes-gke',
  'kubernetes-rancher',
  'kubernetes-tkgi',
  'kubernetes-tkg',
];

// VMware VKS support was introduced in the 8.0 operator era.
const ALL_K8S_DISTRIBUTIONS_WITH_VKS = [...ALL_K8S_DISTRIBUTIONS, 'kubernetes-vks'];

const PLATFORM_SUPPORT_BY_CLUSTER_VERSION = {
  '6.0': ['vms', 'bare-metal', ...ALL_K8S_DISTRIBUTIONS],
  '6.2': ['vms', 'bare-metal', ...ALL_K8S_DISTRIBUTIONS],
  '6.4': ['vms', 'bare-metal', ...ALL_K8S_DISTRIBUTIONS],
  '7.2': ['vms', 'bare-metal', ...ALL_K8S_DISTRIBUTIONS],
  '7.4': ['vms', 'bare-metal', ...ALL_K8S_DISTRIBUTIONS],
  '7.8': ['vms', 'bare-metal', ...ALL_K8S_DISTRIBUTIONS],
  '7.22': ['vms', 'bare-metal', ...ALL_K8S_DISTRIBUTIONS],
  '8.0': ['vms', 'bare-metal', ...ALL_K8S_DISTRIBUTIONS_WITH_VKS],
};

const OS_SUPPORT_BY_CLUSTER_VERSION = {
  // Includes the OS rows marked with a Redis deprecation warning, because the
  // supported-platforms table still lists them as supported for those versions.
  // Redis's current supported-platforms page does not include a 6.0 row, so this
  // app reuses the documented 6.2 platform families for 6.0 only to avoid
  // leaving the earliest supported upgrade sources completely unvalidated.
  '6.0': ['rhel-8', 'rhel-7', 'ubuntu-18.04', 'ubuntu-16.04', 'amazon-linux-1'],
  '6.2': ['rhel-8', 'rhel-7', 'ubuntu-18.04', 'ubuntu-16.04', 'amazon-linux-1'],
  '6.4': ['rhel-8', 'rhel-7', 'ubuntu-20.04', 'ubuntu-18.04', 'ubuntu-16.04', 'amazon-linux-2', 'amazon-linux-1'],
  '7.2': ['rhel-8', 'rhel-7', 'ubuntu-20.04', 'ubuntu-18.04', 'ubuntu-16.04', 'amazon-linux-2', 'amazon-linux-1'],
  '7.4': ['rhel-9', 'rhel-8', 'ubuntu-20.04', 'ubuntu-18.04', 'amazon-linux-2'],
  '7.8': ['rhel-9', 'rhel-9-fips', 'rhel-8', 'ubuntu-22.04', 'ubuntu-20.04', 'amazon-linux-2'],
  '7.22': ['rhel-9', 'rhel-9-fips', 'rhel-8', 'ubuntu-22.04', 'ubuntu-20.04', 'amazon-linux-2'],
  '8.0': ['rhel-9', 'rhel-9-fips', 'rhel-8', 'ubuntu-22.04', 'ubuntu-20.04', 'amazon-linux-2'],
};

const DATABASE_COMPATIBILITY_BY_CLUSTER_VERSION = {
  // Redis's current database-upgrade table starts at 6.2.x. This app treats 6.0
  // as supporting only the 6.0 database family because 6.2 first appears in the
  // later 6.2.x/6.4.2 rows.
  '6.0': ['6.0'],
  '6.2': ['6.0', '6.2'],
  '6.4': ['6.0', '6.2'],
  '7.2': ['6.0', '6.2', '7.2'],
  '7.4': ['6.0', '6.2', '7.2'],
  '7.8': ['6.2', '7.2', '7.4'],
  '7.22': ['6.2', '7.2', '7.4'],
  // Redis docs show that 8.0.x maintenance releases bundle at least 6.2/7.2/7.4/8.0/8.2.
  // Version 8.4 appears starting with 8.0.10, but this app models the broader 8.0.x family.
  '8.0': ['6.2', '7.2', '7.4', '8.0', '8.2'],
};

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// True for any selectable Kubernetes distribution. OPTIONS.k8sDistributions is
// the source of truth for "selectable" — every value there is prefixed
// `kubernetes-`, so the prefix check matches every user-reachable input.
export function isK8sPlatform(value) {
  return typeof value === 'string' && value.startsWith('kubernetes-');
}

function buildVersionOptions(versions) {
  return versions.map((version) => ({ value: version, label: getClusterVersionLabel(version) }));
}

function getModuleEntryLabel(module) {
  return MODULE_NAME_LABELS[module.name] ?? module.name;
}

function getModuleEntryValue(module) {
  return [module.feature_set, module.name, module.version].join('__');
}

const MODULE_BUNDLES_BY_FEATURE_SET = MODULE_VERSION_DATA.reduce((accumulator, module) => {
  if (!accumulator[module.feature_set]) {
    accumulator[module.feature_set] = [];
  }

  accumulator[module.feature_set].push(module);
  return accumulator;
}, {});

const MODULES_BY_NAME = MODULE_VERSION_DATA.reduce((accumulator, module) => {
  if (!accumulator[module.name]) {
    accumulator[module.name] = [];
  }

  accumulator[module.name].push(module);
  return accumulator;
}, {});

const MODULES_BY_VALUE = MODULE_VERSION_DATA.reduce((accumulator, module) => {
  accumulator[getModuleEntryValue(module)] = module;
  return accumulator;
}, {});

function buildModuleBundleSummary(featureSet) {
  return (MODULE_BUNDLES_BY_FEATURE_SET[featureSet] ?? [])
    .map((module) => `${getModuleEntryLabel(module)} ${module.version}`)
    .join(', ');
}

function buildModuleOptions() {
  const featureSetOptions = DOCUMENTED_DATABASE_VERSION_FAMILIES.filter(
    (featureSet) => MODULE_BUNDLES_BY_FEATURE_SET[featureSet]?.length,
  ).map((featureSet) => ({
    value: featureSet,
    label: `Feature set ${DATABASE_VERSION_FAMILY_LABELS[featureSet]} bundle — ${buildModuleBundleSummary(featureSet)}`,
  }));

  return [{ value: 'none', label: 'No modules installed' }, ...featureSetOptions];
}

export const OPTIONS = {
  sourceVersions: buildVersionOptions(DOCUMENTED_SOURCE_VERSIONS),
  targetVersions: buildVersionOptions(DOCUMENTED_TARGET_VERSIONS),
  databaseVersions: DOCUMENTED_DATABASE_VERSION_FAMILIES,
  modules: buildModuleOptions(),
  operatingSystems: [
    { value: 'rhel-9', label: 'RHEL 9 & compatible distros' },
    { value: 'rhel-9-fips', label: 'RHEL 9 FIPS mode' },
    { value: 'rhel-8', label: 'RHEL 8 & compatible distros' },
    { value: 'rhel-7', label: 'RHEL 7 & compatible distros' },
    { value: 'ubuntu-22.04', label: 'Ubuntu 22.04' },
    { value: 'ubuntu-20.04', label: 'Ubuntu 20.04' },
    { value: 'ubuntu-18.04', label: 'Ubuntu 18.04' },
    { value: 'ubuntu-16.04', label: 'Ubuntu 16.04' },
    { value: 'amazon-linux-2', label: 'Amazon Linux 2' },
    { value: 'amazon-linux-1', label: 'Amazon Linux 1' },
  ],
  platforms: [
    { value: 'bare-metal', label: 'Bare Metal' },
    { value: 'vms', label: 'VMs' },
    { value: 'kubernetes', label: 'Kubernetes' },
  ],
  k8sDistributions: [
    { value: 'kubernetes-eks', label: 'Amazon EKS' },
    { value: 'kubernetes-aks', label: 'Azure AKS' },
    { value: 'kubernetes-community', label: 'Community Kubernetes' },
    { value: 'kubernetes-gke', label: 'Google GKE' },
    { value: 'kubernetes-openshift', label: 'OpenShift Container Platform' },
    { value: 'kubernetes-rancher', label: 'Rancher' },
  ],
};

const DIRECT_CLUSTER_UPGRADE_PATHS = {
  // Redis docs list 6.0 as supporting only 7.2 as a documented direct target;
  // 6.4 is reachable only through the 7.x bridges below.
  '6.0': ['7.2'],
  '6.2.4': ['6.4', '7.2', '7.4'],
  '6.2.8': ['6.4', '7.2', '7.4'],
  '6.2.10': ['6.4', '7.2', '7.4', '7.8'],
  '6.2.12': ['6.4', '7.2', '7.4', '7.8'],
  '6.2.18': ['6.4', '7.2', '7.4', '7.8'],
  // 6.4 supports a direct upgrade to 8.0 only through 8.0.2/8.0.6/8.0.10. Reaching
  // 8.0.16 or 8.0.18 requires an intermediate 7.x bridge version.
  '6.4': ['6.4', '7.2', '7.4', '7.8', '7.22', '8.0.2', '8.0.6', '8.0.10'],
  '7.2': ['7.2', '7.4', '7.8', '7.22', '8.0.2', '8.0.6', '8.0.10', '8.0.16', '8.0.18'],
  '7.4': ['7.4', '7.8', '7.22', '8.0.2', '8.0.6', '8.0.10', '8.0.16', '8.0.18'],
  '7.8': ['7.8', '7.22', '8.0.2', '8.0.6', '8.0.10', '8.0.16', '8.0.18'],
  '7.22': ['7.22', '8.0.2', '8.0.6', '8.0.10', '8.0.16', '8.0.18'],
};

export const UPGRADE_PATH_DOC_URL =
  'https://redis.io/docs/latest/operate/rs/installing-upgrading/upgrading/upgrade-cluster/#supported-upgrade-paths';

export const DATABASE_COMPATIBILITY_DOC_URL =
  'https://redis.io/docs/latest/operate/rs/installing-upgrading/upgrading/upgrade-database/';

export const OS_UPGRADE_DOC_URL =
  'https://redis.io/docs/latest/operate/rs/installing-upgrading/upgrading/upgrade-os/';

export const ACTIVE_ACTIVE_UPGRADE_DOC_URL =
  'https://redis.io/docs/latest/operate/rs/installing-upgrading/upgrading/upgrade-active-active/';

export const OS_UPGRADE_CONSIDERATIONS = [
  'Confirm the Redis Software version used for the OS work supports both the current operating system and the operating system you plan to end on. If it does not, plan an intermediate Redis version first.',
  'Redis documents operating system changes as a rolling upgrade. Upgrade or replace one node at a time so cluster services stay available while you validate each step.',
  'Choose the extra-node method when temporary capacity is available, or the replace-node method when you need to reuse existing node capacity.',
  'Before touching any node, run rlcheck and rladmin status extra all, confirm persistence, replication, or export-based recovery readiness, and capture current cluster health for rollback planning.',
  'If the cluster uses DNS or custom installation directories, plan those updates in advance and reuse the same custom-directory layout on every replacement node.',
  'If the final node removed from the cluster is the primary node, demote it before removal and verify node health again before continuing.',
];

export function getClusterVersionLabel(version) {
  return CLUSTER_VERSION_LABELS[version] ?? version;
}

export function getClusterVersionFamily(version) {
  if (!version) return version;
  if (version.startsWith('6.2.')) {
    return '6.2';
  }
  // Both 8.0.10 and 8.0.16 share the documented 8.0 platform/OS/database matrix.
  if (version.startsWith('8.0.')) {
    return '8.0';
  }

  return version;
}

// Cluster version families currently served from the Redis Download Center
// (cloud.redis.io). Older families are only available via the redis.io
// downloads archive or by request through Redis Support / your TAM.
const DOWNLOAD_CENTER_FAMILIES = new Set(['7.22', '8.0']);

export function isInDownloadCenter(clusterVersion) {
  return DOWNLOAD_CENTER_FAMILIES.has(getClusterVersionFamily(clusterVersion));
}

export function getDatabaseVersionFamily(version) {
  if (version.startsWith('8.4.')) {
    return '8.4';
  }

  if (version.startsWith('8.2.')) {
    return '8.2';
  }

  if (version.startsWith('8.0.')) {
    return '8.0';
  }

  if (version.startsWith('7.4.')) {
    return '7.4';
  }

  if (version.startsWith('7.2.')) {
    return '7.2';
  }

  if (version.startsWith('6.2.')) {
    return '6.2';
  }

  if (version.startsWith('6.0.')) {
    return '6.0';
  }

  return version;
}

export function getDatabaseVersionFamilyLabel(version) {
  const family = getDatabaseVersionFamily(version);
  return DATABASE_VERSION_FAMILY_LABELS[family] ?? family;
}

export function getModuleBundle(featureSet) {
  return MODULE_BUNDLES_BY_FEATURE_SET[featureSet] ?? [];
}

export function getModuleBundleSummary(featureSet) {
  return buildModuleBundleSummary(featureSet);
}

export function getModulesByName(name) {
  return MODULES_BY_NAME[name] ?? [];
}

export function getModuleOptionsForFeatureSet(featureSet) {
  return (MODULE_BUNDLES_BY_FEATURE_SET[featureSet] ?? []).map((module) => ({
    value: getModuleEntryValue(module),
    label: `${getModuleEntryLabel(module)} ${module.version}`,
    featureSet: module.feature_set,
  }));
}

export function getModuleEntries(moduleValues = []) {
  return moduleValues.map((value) => MODULES_BY_VALUE[value]).filter(Boolean);
}

export function getModuleSelectionSummary(moduleValues = []) {
  return getModuleEntries(moduleValues)
    .map((module) => `${getModuleEntryLabel(module)} ${module.version}`)
    .join(', ');
}

/**
 * Given a target cluster version and an array of module names, return the
 * recommended module version for each name. The lookup uses
 * DATABASE_COMPATIBILITY_BY_CLUSTER_VERSION to determine which database
 * families the cluster version supports, then prefers the module entry whose
 * feature_set matches the cluster's own version family (e.g. an 8.0.x cluster
 * picks the 8.0 module rather than a newer 8.2 module that the cluster also
 * happens to support). Falls back to the highest compatible feature_set when
 * no version-matched entry exists (e.g. 7.22 has no '7.22' module family, so
 * the highest compatible one — typically '7.4' — is used).
 *
 * Returns an array of module objects ({ name, version, feature_set }).
 */
export function getCompatibleModuleVersions(clusterVersion, moduleNames) {
  const versionFamily = getClusterVersionFamily(clusterVersion);
  const compatibleFamilies = DATABASE_COMPATIBILITY_BY_CLUSTER_VERSION[versionFamily] ?? [];

  const results = [];

  for (const name of moduleNames) {
    const moduleVersions = MODULES_BY_NAME[name] ?? [];
    const compatible = moduleVersions.filter((m) => compatibleFamilies.includes(m.feature_set));

    if (compatible.length === 0) continue;

    // Prefer the entry whose feature_set matches the cluster's own version family.
    const versionMatched = compatible.find((m) => m.feature_set === versionFamily);
    if (versionMatched) {
      results.push(versionMatched);
      continue;
    }

    // Fall back to the highest compatible feature_set.
    const best = compatible.reduce((prev, curr) =>
      compatibleFamilies.indexOf(curr.feature_set) > compatibleFamilies.indexOf(prev.feature_set)
        ? curr
        : prev,
    );
    results.push(best);
  }

  return results;
}

export function getModuleLabel(moduleObj) {
  return getModuleEntryLabel(moduleObj);
}

// Pick the module versions that match a specific database family. Unlike
// getCompatibleModuleVersions (which picks based on a cluster version and falls
// back to the highest compatible family), this returns the module bundled with
// the exact DB family the user is upgrading to. Modules without an entry for
// that family are dropped.
export function getModulesForDatabaseFamily(databaseFamily, moduleNames) {
  return moduleNames
    .map((name) => (MODULES_BY_NAME[name] ?? []).find((module) => module.feature_set === databaseFamily))
    .filter(Boolean);
}

// Redis Software 7.8.2 introduced implicit module upgrades inside `rladmin upgrade db`.
// On older targets the user still needs to upgrade modules separately (or use the
// `latest_with_modules` flag on the DB upgrade command).
const IMPLICIT_MODULE_UPGRADE_FAMILIES = new Set(['7.8', '7.22', '8.0']);

export function clusterUpgradesModulesImplicitly(clusterVersion) {
  return IMPLICIT_MODULE_UPGRADE_FAMILIES.has(getClusterVersionFamily(clusterVersion));
}

export function getDirectUpgradeSupport(sourceVersion, targetVersion) {
  const supportedTargets = (DIRECT_CLUSTER_UPGRADE_PATHS[sourceVersion] ?? []).filter(
    (version) => version !== sourceVersion,
  );

  return {
    supported: DIRECT_CLUSTER_UPGRADE_PATHS[sourceVersion]?.includes(targetVersion) ?? false,
    sourceLabel: getClusterVersionLabel(sourceVersion),
    targetLabel: getClusterVersionLabel(targetVersion),
    supportedTargets,
    supportedTargetLabels: supportedTargets.map((version) => getClusterVersionLabel(version)),
  };
}

/**
 * Find all upgrade paths from sourceVersion to targetVersion with at most
 * 2 upgrade steps (i.e., at most one intermediate version). Returns an array
 * of paths, where each path is an array of version strings (including source
 * and target). Returns an empty array if no path exists within the limit.
 */
export function findUpgradePaths(sourceVersion, targetVersion) {
  if (sourceVersion === targetVersion) return [[sourceVersion]];

  // Direct path — single upgrade step
  if (DIRECT_CLUSTER_UPGRADE_PATHS[sourceVersion]?.includes(targetVersion)) {
    return [[sourceVersion, targetVersion]];
  }

  // Two-step paths via one intermediate version (source → intermediate → target)
  const results = [];
  const intermediates = (DIRECT_CLUSTER_UPGRADE_PATHS[sourceVersion] ?? []).filter(
    (v) => v !== sourceVersion,
  );

  for (const mid of intermediates) {
    if (DIRECT_CLUSTER_UPGRADE_PATHS[mid]?.includes(targetVersion)) {
      results.push([sourceVersion, mid, targetVersion]);
    }
  }

  return results;
}

export function getPlatformSupport(clusterVersion, platform, operatingSystem) {
  const versionFamily = getClusterVersionFamily(clusterVersion);
  const supportedPlatforms = PLATFORM_SUPPORT_BY_CLUSTER_VERSION[versionFamily] ?? [];

  if (!supportedPlatforms.includes(platform)) {
    return {
      supported: false,
      reason: 'platform-not-supported',
      versionLabel: getClusterVersionLabel(clusterVersion),
    };
  }

  // Redis docs list Kubernetes as a dedicated supported platform, but Kubernetes
  // distro/version details are handled in separate documentation. This app keeps
  // the current OS dropdown, but does not use it to block Kubernetes selections.
  if (platform.startsWith('kubernetes-')) {
    return {
      supported: true,
      reason: 'supported',
      versionLabel: getClusterVersionLabel(clusterVersion),
      osCheckSkipped: true,
    };
  }

  const supportedOperatingSystems = OS_SUPPORT_BY_CLUSTER_VERSION[versionFamily] ?? [];

  return {
    supported: supportedOperatingSystems.includes(operatingSystem),
    reason: supportedOperatingSystems.includes(operatingSystem)
      ? 'supported'
      : 'operating-system-not-supported',
    versionLabel: getClusterVersionLabel(clusterVersion),
    supportedOperatingSystems,
  };
}

export function getSupportedOperatingSystemOptions(clusterVersion, platform = 'vms') {
  return OPTIONS.operatingSystems.filter((option) =>
    getPlatformSupport(clusterVersion, platform, option.value).supported,
  );
}

export function getDatabaseCompatibility(clusterVersion, databaseVersion) {
  const versionFamily = getClusterVersionFamily(clusterVersion);
  const databaseFamily = getDatabaseVersionFamily(databaseVersion);
  const supportedDatabaseFamilies = DATABASE_COMPATIBILITY_BY_CLUSTER_VERSION[versionFamily] ?? [];

  return {
    supported: supportedDatabaseFamilies.includes(databaseFamily),
    databaseFamily,
    databaseFamilyLabel: DATABASE_VERSION_FAMILY_LABELS[databaseFamily] ?? databaseFamily,
    supportedDatabaseFamilies,
    versionLabel: getClusterVersionLabel(clusterVersion),
  };
}

// Latest bundled database family for the given cluster version. The compatibility
// arrays are stored in ascending order, so the last entry is the newest bundled
// family. Returns an empty string when the cluster version isn't in the table.
export function getRecommendedTargetDatabaseFamily(clusterVersion) {
  const family = getClusterVersionFamily(clusterVersion);
  const supported = DATABASE_COMPATIBILITY_BY_CLUSTER_VERSION[family] ?? [];
  return supported[supported.length - 1] ?? '';
}

// Used for the pre-cluster-upgrade DB upgrade in Case-A-style hops: when the
// current DB family isn't supported by the target cluster, the user has to
// upgrade the DB while still on the source cluster — so the new DB family must
// be supported by BOTH source and target. Returns the highest family that
// satisfies all three constraints (in source's bundles, in target's bundles,
// not below the current family). Empty string if none — e.g., when there's no
// safe step and a different cluster path is required.
const DATABASE_FAMILY_ORDER = ['6.0', '6.2', '7.2', '7.4', '8.0', '8.2', '8.4'];

export function getPreClusterUpgradeDatabaseFamily(sourceClusterVersion, targetClusterVersion, currentDatabaseFamily) {
  const sourceFamily = getClusterVersionFamily(sourceClusterVersion);
  const targetFamily = getClusterVersionFamily(targetClusterVersion);
  const sourceSupported = DATABASE_COMPATIBILITY_BY_CLUSTER_VERSION[sourceFamily] ?? [];
  const targetSupported = new Set(DATABASE_COMPATIBILITY_BY_CLUSTER_VERSION[targetFamily] ?? []);
  const currentIdx = DATABASE_FAMILY_ORDER.indexOf(currentDatabaseFamily);

  const candidates = sourceSupported.filter((family) =>
    targetSupported.has(family) && DATABASE_FAMILY_ORDER.indexOf(family) >= currentIdx,
  );
  return candidates[candidates.length - 1] ?? '';
}

// Classify what action the user needs to take on the database for a given hop.
// `required`:    the current DB family is no longer bundled, so the upgrade is mandatory.
// `recommended`: the current DB family is still bundled but a newer family is available,
//                so Redis recommends moving to it after the cluster upgrade.
// `none`:        the current DB family equals the latest bundled — nothing to do.
export function getDatabaseUpgradeRequirement(currentDatabaseFamily, targetClusterVersion) {
  const recommended = getRecommendedTargetDatabaseFamily(targetClusterVersion);
  const compatibility = getDatabaseCompatibility(targetClusterVersion, currentDatabaseFamily);

  if (!compatibility.supported) {
    return { status: 'required', recommended, currentDatabaseFamily };
  }
  if (currentDatabaseFamily === recommended) {
    return { status: 'none', recommended, currentDatabaseFamily };
  }
  return { status: 'recommended', recommended, currentDatabaseFamily };
}


// Kubernetes version compatibility matrix.
// Maps operator version family → Kubernetes platform → list of supported K8s versions
// (✅ Supported and ⚠️ Deprecated both treated as currently usable, ❌ End-of-life dropped).
// Source: https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/
// Regenerate with: ./_parse_k8s_matrix.py
export const K8S_SUPPORT_MATRIX = {
  '8.0': {
    'kubernetes-community': ['1.31', '1.32', '1.33', '1.34', '1.35'],
    'kubernetes-openshift': ['4.16', '4.17', '4.18', '4.19', '4.20', '4.21'],
    'kubernetes-eks': ['1.31', '1.32', '1.33', '1.34', '1.35'],
    'kubernetes-aks': ['1.31', '1.32', '1.33', '1.34', '1.35'],
    'kubernetes-gke': ['1.31', '1.32', '1.33', '1.34', '1.35'],
    'kubernetes-rancher': ['1.29', '1.30', '1.31', '1.32', '1.33', '1.34', '1.35'],
    'kubernetes-tkgi': ['1.20', '1.21', '1.22', '1.23', '1.24'],
    'kubernetes-vks': ['1.32', '1.33', '1.34', '1.35'],
    'kubernetes-tkg': [],
  },
  '7.22': {
    'kubernetes-community': ['1.30', '1.31', '1.32', '1.33'],
    'kubernetes-openshift': ['4.15', '4.16', '4.17', '4.18', '4.19'],
    'kubernetes-eks': ['1.30', '1.31', '1.32', '1.33'],
    'kubernetes-aks': ['1.30', '1.31', '1.32', '1.33'],
    'kubernetes-gke': ['1.30', '1.31', '1.32', '1.33'],
    'kubernetes-rancher': ['1.28', '1.29', '1.30'],
    'kubernetes-tkgi': ['1.17', '1.18', '1.19', '1.20', '1.21'],
    'kubernetes-vks': [],
    'kubernetes-tkg': [],
  },
  '7.8': {
    'kubernetes-community': ['1.28', '1.29', '1.30', '1.31', '1.32'],
    'kubernetes-openshift': ['4.12', '4.13', '4.14', '4.15', '4.16', '4.17', '4.18'],
    'kubernetes-eks': ['1.27', '1.28', '1.29', '1.30', '1.31', '1.32'],
    'kubernetes-aks': ['1.27', '1.28', '1.29', '1.30', '1.31', '1.32'],
    'kubernetes-gke': ['1.28', '1.29', '1.30', '1.31', '1.32'],
    'kubernetes-rancher': ['1.26', '1.27', '1.28', '1.29'],
    'kubernetes-tkgi': ['1.17', '1.18', '1.19', '1.20'],
    'kubernetes-vks': [],
    'kubernetes-tkg': [],
  },
  '7.4': {
    'kubernetes-community': ['1.26', '1.27', '1.28', '1.29', '1.30'],
    'kubernetes-openshift': ['4.11', '4.12', '4.13', '4.14', '4.15', '4.16'],
    'kubernetes-eks': ['1.25', '1.26', '1.27', '1.28', '1.29'],
    'kubernetes-aks': ['1.26', '1.27', '1.28', '1.29', '1.30'],
    'kubernetes-gke': ['1.25', '1.26', '1.27', '1.28', '1.29', '1.30'],
    'kubernetes-rancher': ['1.24', '1.25', '1.26', '1.27', '1.28'],
    'kubernetes-tkgi': ['1.16', '1.17', '1.18', '1.19'],
    'kubernetes-vks': [],
    'kubernetes-tkg': [],
  },
  '7.2': {
    'kubernetes-community': ['1.24', '1.25', '1.26', '1.27', '1.28'],
    'kubernetes-openshift': ['4.10', '4.11', '4.12', '4.13', '4.14'],
    'kubernetes-eks': ['1.23', '1.24', '1.25', '1.26', '1.27'],
    'kubernetes-aks': ['1.25', '1.26', '1.27'],
    'kubernetes-gke': ['1.23', '1.24', '1.25', '1.26', '1.27'],
    'kubernetes-rancher': ['1.23', '1.24', '1.25', '1.26'],
    'kubernetes-tkgi': ['1.14', '1.15', '1.16', '1.17'],
    'kubernetes-vks': [],
    'kubernetes-tkg': [],
  },
  '6.4': {
    'kubernetes-community': ['1.22', '1.23', '1.24', '1.25', '1.26', '1.27'],
    'kubernetes-openshift': ['4.8', '4.9', '4.10', '4.11', '4.12'],
    'kubernetes-eks': ['1.22', '1.23', '1.24', '1.25'],
    'kubernetes-aks': ['1.23', '1.24', '1.25', '1.26'],
    'kubernetes-gke': ['1.22', '1.23', '1.24', '1.25', '1.26'],
    'kubernetes-rancher': ['1.21', '1.22', '1.23', '1.24'],
    'kubernetes-tkgi': ['1.13', '1.14', '1.15'],
    'kubernetes-vks': [],
    'kubernetes-tkg': [],
  },
  '6.2': {
    'kubernetes-community': ['1.16', '1.17', '1.18', '1.19', '1.20', '1.21', '1.22', '1.23', '1.24', '1.25'],
    'kubernetes-openshift': ['3.11', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11'],
    'kubernetes-eks': ['1.18', '1.19', '1.20', '1.21', '1.22', '1.23'],
    'kubernetes-aks': ['1.18', '1.19', '1.20', '1.21', '1.22', '1.23', '1.24'],
    'kubernetes-gke': ['1.18', '1.19', '1.20', '1.21', '1.22', '1.23', '1.24', '1.25'],
    'kubernetes-rancher': ['1.17', '1.18', '1.19', '1.20', '1.21', '1.22', '1.23', '1.24'],
    'kubernetes-tkgi': ['1.07', '1.08', '1.10', '1.11', '1.12', '1.13', '1.14', '1.15'],
    'kubernetes-vks': [],
    'kubernetes-tkg': [],
  },
};

/**
 * Returns the list of supported Kubernetes versions for the given operator
 * version family and platform, or an empty array when no data is available.
 * @param {string} operatorVersionFamily  e.g. '8.0', '7.22'
 * @param {string} platform               e.g. 'kubernetes-openshift'
 * @returns {string[]}
 */
export function getSupportedK8sVersions(operatorVersionFamily, platform) {
  return K8S_SUPPORT_MATRIX[operatorVersionFamily]?.[platform] ?? [];
}

// Supported Redis Enterprise operator versions for the Kubernetes upgrade path.
// Source: https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/
// Regenerate with: ./_parse_k8s_matrix.py
export const SUPPORTED_OPERATOR_VERSIONS = [
  '8.0.18-11', '8.0.10-21', '8.0.6-6', '8.0.2-2',
  '7.22.2-21', '7.22.0-15', '7.22.0-7',
  '7.8.6-1', '7.8.4-9', '7.8.4-8', '7.8.2-6',
  '7.4.6-2', '7.4.2-12', '7.4.2-2',
  '7.2.4-12', '7.2.4-7', '7.2.4-2',
  '6.4.2-8', '6.4.2-6', '6.4.2-5', '6.4.2-4',
  '6.2.18-41', '6.2.18-3', '6.2.12-1', '6.2.10-45', '6.2.10-34', '6.2.10-4', '6.2.8-15', '6.2.8-11', '6.2.8-2', '6.2.4-1',
];

// Per-operator-version Kubernetes/OpenShift compatibility.
// Lists every K8s or OpenShift version that is ✅ Supported or ⚠️ Deprecated for each
// operator patch release on the six user-selectable distributions (community/openshift/eks/
// aks/gke/rancher). TKGI/VKS data is captured in K8S_SUPPORT_MATRIX but not here, since the
// app does not expose those distributions in the form.
// Source: https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/
// Regenerate with: ./_parse_k8s_matrix.py
export const OPERATOR_K8S_COMPATIBILITY = {
  // 8.0.x family
  '8.0.18-11': { 'kubernetes-community': ['1.33','1.34','1.35'], 'kubernetes-openshift': ['4.18','4.19','4.20','4.21'], 'kubernetes-eks': ['1.33','1.34','1.35'], 'kubernetes-aks': ['1.33','1.34','1.35'], 'kubernetes-gke': ['1.33','1.34','1.35'], 'kubernetes-rancher': ['1.33','1.34','1.35'] },
  '8.0.10-21': { 'kubernetes-community': ['1.32','1.33','1.34','1.35'], 'kubernetes-openshift': ['4.17','4.18','4.19','4.20'], 'kubernetes-eks': ['1.32','1.33','1.34'], 'kubernetes-aks': ['1.32','1.33','1.34'], 'kubernetes-gke': ['1.32','1.33','1.34','1.35'], 'kubernetes-rancher': ['1.32','1.33','1.34'] },
  '8.0.6-6': { 'kubernetes-community': ['1.32','1.33','1.34'], 'kubernetes-openshift': ['4.17','4.18','4.19','4.20'], 'kubernetes-eks': ['1.32','1.33','1.34'], 'kubernetes-aks': ['1.32','1.33','1.34'], 'kubernetes-gke': ['1.32','1.33','1.34'], 'kubernetes-rancher': ['1.31','1.32','1.33','1.34'] },
  '8.0.2-2': { 'kubernetes-community': ['1.31','1.32','1.33','1.34'], 'kubernetes-openshift': ['4.16','4.17','4.18','4.19','4.20'], 'kubernetes-eks': ['1.31','1.32','1.33','1.34'], 'kubernetes-aks': ['1.31','1.32','1.33','1.34'], 'kubernetes-gke': ['1.31','1.32','1.33','1.34'], 'kubernetes-rancher': ['1.29','1.30','1.31','1.32','1.33'] },

  // 7.22.x family
  '7.22.2-21': { 'kubernetes-community': ['1.30','1.31','1.32','1.33'], 'kubernetes-openshift': ['4.15','4.16','4.17','4.18','4.19'], 'kubernetes-eks': ['1.30','1.31','1.32','1.33'], 'kubernetes-aks': ['1.30','1.31','1.32','1.33'], 'kubernetes-gke': ['1.30','1.31','1.32','1.33'], 'kubernetes-rancher': ['1.28','1.29','1.30'] },
  '7.22.0-15': { 'kubernetes-community': ['1.30','1.31','1.32','1.33'], 'kubernetes-openshift': ['4.15','4.16','4.17','4.18','4.19'], 'kubernetes-eks': ['1.30','1.31','1.32','1.33'], 'kubernetes-aks': ['1.30','1.31','1.32','1.33'], 'kubernetes-gke': ['1.30','1.31','1.32','1.33'], 'kubernetes-rancher': ['1.28','1.29','1.30'] },
  '7.22.0-7': { 'kubernetes-community': ['1.30','1.31','1.32'], 'kubernetes-openshift': ['4.15','4.16','4.17','4.18'], 'kubernetes-eks': ['1.30','1.31','1.32'], 'kubernetes-aks': ['1.30','1.31','1.32'], 'kubernetes-gke': ['1.30','1.31','1.32'], 'kubernetes-rancher': ['1.28','1.29','1.30'] },

  // 7.8.x family
  '7.8.6-1': { 'kubernetes-community': ['1.28','1.29','1.30','1.31','1.32'], 'kubernetes-openshift': ['4.13','4.14','4.15','4.16','4.17','4.18'], 'kubernetes-eks': ['1.28','1.29','1.30','1.31','1.32'], 'kubernetes-aks': ['1.29','1.30','1.31','1.32'], 'kubernetes-gke': ['1.29','1.30','1.31','1.32'], 'kubernetes-rancher': ['1.27','1.28','1.29'] },
  '7.8.4-9': { 'kubernetes-community': ['1.28','1.29','1.30','1.31'], 'kubernetes-openshift': ['4.12','4.13','4.14','4.15','4.16','4.17','4.18'], 'kubernetes-eks': ['1.27','1.28','1.29','1.30'], 'kubernetes-aks': ['1.27','1.28','1.29','1.30'], 'kubernetes-gke': ['1.28','1.29','1.30'], 'kubernetes-rancher': ['1.26','1.27','1.28'] },
  '7.8.4-8': { 'kubernetes-community': ['1.28','1.29','1.30','1.31'], 'kubernetes-openshift': ['4.12','4.13','4.14','4.15','4.16'], 'kubernetes-eks': ['1.27','1.28','1.29','1.30'], 'kubernetes-aks': ['1.27','1.28','1.29','1.30'], 'kubernetes-gke': ['1.28','1.29','1.30'], 'kubernetes-rancher': ['1.26','1.27','1.28'] },
  '7.8.2-6': { 'kubernetes-community': ['1.28','1.29','1.30','1.31'], 'kubernetes-openshift': ['4.12','4.13','4.14','4.15','4.16'], 'kubernetes-eks': ['1.27','1.28','1.29','1.30'], 'kubernetes-aks': ['1.27','1.28','1.29','1.30'], 'kubernetes-gke': ['1.28','1.29','1.30'], 'kubernetes-rancher': ['1.26','1.27','1.28'] },

  // 7.4.x family
  '7.4.6-2': { 'kubernetes-community': ['1.26','1.27','1.28','1.29','1.30'], 'kubernetes-openshift': ['4.12','4.13','4.14','4.15','4.16'], 'kubernetes-eks': ['1.26','1.27','1.28','1.29'], 'kubernetes-aks': ['1.27','1.28','1.29','1.30'], 'kubernetes-gke': ['1.27','1.28','1.29','1.30'], 'kubernetes-rancher': ['1.25','1.26','1.27','1.28'] },
  '7.4.2-12': { 'kubernetes-community': ['1.26','1.27','1.28','1.29'], 'kubernetes-openshift': ['4.11','4.12','4.13','4.14','4.15'], 'kubernetes-eks': ['1.25','1.26','1.27','1.28'], 'kubernetes-aks': ['1.26','1.27','1.28','1.29'], 'kubernetes-gke': ['1.25','1.26','1.27','1.28','1.29'], 'kubernetes-rancher': ['1.25','1.26','1.27'] },
  '7.4.2-2': { 'kubernetes-community': ['1.26','1.27','1.28','1.29'], 'kubernetes-openshift': ['4.11','4.12','4.13','4.14'], 'kubernetes-eks': ['1.25','1.26','1.27','1.28'], 'kubernetes-aks': ['1.26','1.27','1.28'], 'kubernetes-gke': ['1.25','1.26','1.27'], 'kubernetes-rancher': ['1.24','1.25','1.26','1.27'] },

  // 7.2.x family
  '7.2.4-12': { 'kubernetes-community': ['1.24','1.25','1.26','1.27','1.28'], 'kubernetes-openshift': ['4.11','4.12','4.13','4.14'], 'kubernetes-eks': ['1.23','1.24','1.25','1.26','1.27'], 'kubernetes-aks': ['1.25','1.26','1.27'], 'kubernetes-gke': ['1.24','1.25','1.26','1.27'], 'kubernetes-rancher': ['1.23','1.24','1.25','1.26'] },
  '7.2.4-7': { 'kubernetes-community': ['1.24','1.25','1.26','1.27'], 'kubernetes-openshift': ['4.10','4.11','4.12','4.13'], 'kubernetes-eks': ['1.23','1.24','1.25','1.26','1.27'], 'kubernetes-aks': ['1.25','1.26','1.27'], 'kubernetes-gke': ['1.23','1.24','1.25','1.26','1.27'], 'kubernetes-rancher': ['1.23','1.24','1.25'] },
  '7.2.4-2': { 'kubernetes-community': ['1.24','1.25','1.26','1.27'], 'kubernetes-openshift': ['4.10','4.11','4.12','4.13'], 'kubernetes-eks': ['1.23','1.24','1.25','1.26','1.27'], 'kubernetes-aks': ['1.25','1.26','1.27'], 'kubernetes-gke': ['1.23','1.24','1.25','1.26','1.27'], 'kubernetes-rancher': ['1.23','1.24','1.25'] },

  // 6.4.x family
  '6.4.2-8': { 'kubernetes-community': ['1.23','1.24','1.25','1.26','1.27'], 'kubernetes-openshift': ['4.10','4.11','4.12'], 'kubernetes-eks': ['1.22','1.23','1.24','1.25'], 'kubernetes-aks': ['1.23','1.24','1.25','1.26'], 'kubernetes-gke': ['1.22','1.23','1.24','1.25','1.26'], 'kubernetes-rancher': ['1.22','1.23','1.24'] },
  '6.4.2-6': { 'kubernetes-community': ['1.23','1.24','1.25','1.26','1.27'], 'kubernetes-openshift': ['4.9','4.10','4.11','4.12'], 'kubernetes-eks': ['1.22','1.23','1.24','1.25'], 'kubernetes-aks': ['1.23','1.24','1.25','1.26'], 'kubernetes-gke': ['1.22','1.23','1.24','1.25','1.26'], 'kubernetes-rancher': ['1.22','1.23','1.24'] },
  '6.4.2-5': { 'kubernetes-community': ['1.22','1.23','1.24','1.25','1.26'], 'kubernetes-openshift': ['4.8','4.9','4.10','4.11','4.12'], 'kubernetes-eks': ['1.22','1.23','1.24'], 'kubernetes-aks': ['1.23','1.24','1.25'], 'kubernetes-gke': ['1.22','1.23','1.24','1.25'], 'kubernetes-rancher': ['1.21','1.22','1.23','1.24'] },
  '6.4.2-4': { 'kubernetes-community': ['1.22','1.23','1.24','1.25','1.26'], 'kubernetes-openshift': ['4.8','4.9','4.10','4.11','4.12'], 'kubernetes-eks': ['1.22','1.23','1.24'], 'kubernetes-aks': ['1.23','1.24','1.25'], 'kubernetes-gke': ['1.22','1.23','1.24','1.25'], 'kubernetes-rancher': ['1.21','1.22','1.23','1.24'] },

  // 6.2.x family
  '6.2.18-41': { 'kubernetes-community': ['1.22','1.23','1.24','1.25'], 'kubernetes-openshift': ['4.8','4.9','4.10','4.11'], 'kubernetes-eks': ['1.21','1.22','1.23'], 'kubernetes-aks': ['1.22','1.23','1.24'], 'kubernetes-gke': ['1.21','1.22','1.23','1.24','1.25'], 'kubernetes-rancher': ['1.21','1.22','1.23','1.24'] },
  '6.2.18-3': { 'kubernetes-community': ['1.22','1.23','1.24','1.25'], 'kubernetes-openshift': ['4.8','4.9','4.10','4.11'], 'kubernetes-eks': ['1.21','1.22','1.23'], 'kubernetes-aks': ['1.22','1.23','1.24'], 'kubernetes-gke': ['1.21','1.22','1.23','1.24','1.25'], 'kubernetes-rancher': ['1.21','1.22','1.23','1.24'] },
  '6.2.12-1': { 'kubernetes-community': ['1.22','1.23','1.24'], 'kubernetes-openshift': ['4.7','4.8','4.9','4.10','4.11'], 'kubernetes-eks': ['1.21','1.22','1.23'], 'kubernetes-aks': ['1.22','1.23','1.24'], 'kubernetes-gke': ['1.21','1.22','1.23','1.24'], 'kubernetes-rancher': ['1.21','1.22','1.23'] },
  '6.2.10-45': { 'kubernetes-community': ['1.21','1.22','1.23','1.24'], 'kubernetes-openshift': ['4.7','4.8','4.9','4.10'], 'kubernetes-eks': ['1.19','1.20','1.21','1.22'], 'kubernetes-aks': ['1.21','1.22','1.23'], 'kubernetes-gke': ['1.19','1.20','1.21','1.22','1.23'], 'kubernetes-rancher': ['1.19','1.20','1.21','1.22'] },
  '6.2.10-34': { 'kubernetes-community': ['1.19','1.20','1.21','1.22','1.23'], 'kubernetes-openshift': ['4.6','4.7','4.8','4.9','4.10'], 'kubernetes-eks': ['1.18','1.19','1.20','1.21','1.22'], 'kubernetes-aks': ['1.19','1.20','1.21','1.22','1.23'], 'kubernetes-gke': ['1.19','1.20','1.21','1.22'], 'kubernetes-rancher': ['1.18','1.19','1.20','1.21','1.22'] },
  '6.2.10-4': { 'kubernetes-community': ['1.18','1.19','1.20','1.21','1.22'], 'kubernetes-openshift': ['3.11','4.5','4.6','4.7','4.8','4.9'], 'kubernetes-eks': ['1.18','1.19','1.20','1.21'], 'kubernetes-aks': ['1.20','1.21','1.22'], 'kubernetes-gke': ['1.20','1.21','1.22'], 'kubernetes-rancher': ['1.17','1.18','1.19','1.20'] },
  '6.2.8-15': { 'kubernetes-community': ['1.18','1.19','1.20','1.21','1.22'], 'kubernetes-openshift': ['3.11','4.5','4.6','4.7','4.8','4.9'], 'kubernetes-eks': ['1.18','1.19','1.20','1.21'], 'kubernetes-aks': ['1.19','1.20','1.21','1.22'], 'kubernetes-gke': ['1.19','1.20','1.21','1.22'], 'kubernetes-rancher': ['1.17','1.18','1.19','1.20'] },
  '6.2.8-11': { 'kubernetes-community': ['1.18','1.19','1.20','1.21','1.22'], 'kubernetes-openshift': ['3.11','4.5','4.6','4.7','4.8','4.9'], 'kubernetes-eks': ['1.18','1.19','1.20','1.21'], 'kubernetes-aks': ['1.19','1.20','1.21','1.22'], 'kubernetes-gke': ['1.19','1.20','1.21','1.22'], 'kubernetes-rancher': ['1.17','1.18','1.19','1.20'] },
  '6.2.8-2': { 'kubernetes-community': ['1.18','1.19','1.20','1.21'], 'kubernetes-openshift': ['3.11','4.5','4.6','4.7','4.8'], 'kubernetes-eks': ['1.18','1.19','1.20','1.21'], 'kubernetes-aks': ['1.19','1.20','1.21'], 'kubernetes-gke': ['1.19','1.20','1.21'], 'kubernetes-rancher': ['1.17','1.18','1.19','1.20'] },
  '6.2.4-1': { 'kubernetes-community': ['1.16','1.17','1.18','1.19','1.20','1.21'], 'kubernetes-openshift': ['3.11','4.5','4.6','4.7','4.8'], 'kubernetes-eks': ['1.18','1.19','1.20','1.21'], 'kubernetes-aks': ['1.18','1.19'], 'kubernetes-gke': ['1.18','1.19','1.20','1.21'], 'kubernetes-rancher': ['1.17','1.18','1.19','1.20'] },
};


/**
 * Extract the major.minor family prefix from an operator or source version string.
 * Examples: '7.22.2-21' → '7.22', '6.2.4' → '6.2', '7.22' → '7.22', '8.0' → '8.0'
 *
 * @param {string} version
 * @returns {string}
 */
function getVersionFamily(version) {
  if (!version) return '';
  const match = version.match(/^([0-9]+\.[0-9]+)/);
  return match ? match[1] : version;
}

/**
 * Returns the subset of SUPPORTED_OPERATOR_VERSIONS whose major.minor family
 * matches the source version family AND that are compatible (✅ or ⚠️) with
 * the given Kubernetes/OpenShift version on the given platform.
 *
 * @param {string} sourceVersion  e.g. '7.22', '7.22.2-21', '6.2.4'
 * @param {string} k8sVersion     e.g. '1.30', '4.16'
 * @param {string} platform       e.g. 'kubernetes-community', 'kubernetes-openshift'
 * @returns {string[]}
 */
export function getOperatorVersionsForK8s(sourceVersion, k8sVersion, platform) {
  if (!sourceVersion || !k8sVersion || !platform) return [];
  if (platform !== 'kubernetes-community' && platform !== 'kubernetes-openshift' && platform !== 'kubernetes-eks' && platform !== 'kubernetes-rancher' && platform !== 'kubernetes-gke' && platform !== 'kubernetes-aks') return [];

  const sourceFamily = getVersionFamily(sourceVersion);

  return SUPPORTED_OPERATOR_VERSIONS.filter((opVer) => {
    if (getVersionFamily(opVer) !== sourceFamily) return false;
    const supported = OPERATOR_K8S_COMPATIBILITY[opVer]?.[platform] ?? [];
    return supported.includes(k8sVersion);
  });
}
