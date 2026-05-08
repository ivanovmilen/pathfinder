import {
  ACTIVE_ACTIVE_UPGRADE_DOC_URL,
  OPTIONS,
  OS_UPGRADE_DOC_URL,
  OPERATOR_K8S_COMPATIBILITY,
  SUPPORTED_OPERATOR_VERSIONS,
  getClusterVersionFamily,
  getOperatorVersionsForK8s,
  getCompatibleModuleVersions,
  getDatabaseVersionFamilyLabel,
  getClusterVersionLabel,
  getModuleEntries,
  getModuleLabel,
  getModuleSelectionSummary,
  getPlatformSupport,
  getSupportedOperatingSystemOptions,
} from './upgrade-data.js';

const upgradeSummary = document.querySelector('#upgrade-summary');
const backToResultsButton = document.querySelector('#back-to-results');

const pathSelectionEl = document.querySelector('#path-selection');
const pathSelectionContent = document.querySelector('#path-selection-content');
const pathSelectionConfirm = document.querySelector('#path-selection-confirm');

const wizardEl = document.querySelector('#wizard');
const wizardStepContent = document.querySelector('#wizard-step-content');
const wizardStepIndicator = document.querySelector('#wizard-step-indicator');
const wizardStepDots = document.querySelector('#wizard-step-dots');
const wizardPrevButton = document.querySelector('#wizard-prev');
const wizardNextButton = document.querySelector('#wizard-next');

const STORAGE_KEY = 'pathfinder_selections';

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

function getSupportedOperatingSystemLabels(clusterVersion, platform) {
  return getSupportedOperatingSystemOptions(clusterVersion, platform).map((option) => option.label);
}

/**
 * Extract unique module names from the user's selected module values.
 * Returns an empty array when no modules are selected.
 */
function getSelectedModuleNames(selections) {
  const moduleValues = Array.isArray(selections.modules) ? selections.modules : [];
  if (!moduleValues.length) return [];
  const entries = getModuleEntries(moduleValues);
  return [...new Set(entries.map((m) => m.name))];
}

/**
 * Build an HTML <ul> listing the recommended module versions for a given
 * cluster target version, based on the user's selected modules.
 * Returns an empty string when no modules are selected or no compatible
 * versions are found.
 */
function buildModuleVersionListHtml(targetVersion, moduleNames) {
  if (!moduleNames.length) return '';
  const compatible = getCompatibleModuleVersions(targetVersion, moduleNames);
  if (!compatible.length) return '';
  const items = compatible
    .map(
      (m) =>
        `<li><strong>${escapeHtml(getModuleLabel(m))}</strong> — version <code>${escapeHtml(m.version)}</code> (feature set ${escapeHtml(m.feature_set)})</li>`,
    )
    .join('\n              ');
  return `
          <ul>
            ${items}
          </ul>`;
}

/* ---------------------------------------------------------------------------
   Summary renderer
   --------------------------------------------------------------------------- */

function renderUpgradeSummary(selections) {
  const selectedModules = Array.isArray(selections.modules) ? selections.modules : [];

  upgradeSummary.innerHTML = `
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

/* ---------------------------------------------------------------------------
   Wizard step content builders
   --------------------------------------------------------------------------- */

const CLUSTER_UPGRADE_DOC_URL =
  'https://redis.io/docs/latest/operate/rs/installing-upgrading/upgrading/upgrade-cluster/';
const DATABASE_UPGRADE_DOC_URL =
  'https://redis.io/docs/latest/operate/rs/installing-upgrading/upgrading/upgrade-database/';
const SUPPORTED_UPGRADE_PATHS_DOC_URL =
  'https://redis.io/docs/latest/operate/rs/installing-upgrading/upgrading/upgrade-cluster/#supported-upgrade-paths';
const K8S_UPGRADE_DOC_URL =
  'https://redis.io/docs/latest/operate/kubernetes/upgrade/';
const K8S_DB_UPGRADE_DOC_URL =
  'https://redis.io/docs/latest/operate/kubernetes/upgrade/upgrade-redis-cluster/#upgrade-databases';

/** Kubernetes deployment method constants */
const K8S_DEPLOYMENT_METHODS = [
  { value: 'kubectl', label: 'Standard (Operator-based)', description: 'Deploy the operator using kubectl and bundle.yaml' },
  { value: 'helm', label: 'Helm', description: 'Deploy the operator using the redis/redis-enterprise-operator Helm chart' },
  { value: 'openshift-cli', label: 'OpenShift CLI', description: 'Deploy the operator using oc and openshift.bundle.yaml' },
  { value: 'openshift-olm', label: 'OpenShift OperatorHub (OLM)', description: 'Operator is managed by OLM via Subscription' },
];

const OPENSHIFT_METHODS = ['openshift-cli', 'openshift-olm'];
const NON_OPENSHIFT_METHODS = ['kubectl', 'helm'];

function buildPreUpgradeStep(selections) {
  const sourceLabel = getClusterVersionLabel(selections.sourceVersion);
  const targetLabel = getClusterVersionLabel(selections.targetVersion);

  // Build optional K8s version compatibility warnings shown before the checklist.
  // Both use the "newest operator in the family" rule: warn when the selected K8s
  // version is not in the newest patch's compatibility list for that family.
  let k8sVersionWarningHtml = '';
  if (
    (selections.platform === 'kubernetes-community' || selections.platform === 'kubernetes-openshift' || selections.platform === 'kubernetes-eks' || selections.platform === 'kubernetes-rancher' || selections.platform === 'kubernetes-gke' || selections.platform === 'kubernetes-aks') &&
    selections.k8sVersion
  ) {
    const k8sVersionLabel = selections.platform === 'kubernetes-openshift' ? 'OpenShift version' : 'Kubernetes version';

    // --- Source-family check ---
    const sourceFamily = getClusterVersionFamily(selections.sourceVersion);
    const newestSourceOperator = SUPPORTED_OPERATOR_VERSIONS.find(
      (v) => v.startsWith(sourceFamily + '.')
    );
    const newestSourceSupportsK8s = newestSourceOperator
      ? (OPERATOR_K8S_COMPATIBILITY[newestSourceOperator]?.[selections.platform] ?? []).includes(selections.k8sVersion)
      : true; // no data → suppress warning

    // --- Target-family check ---
    const targetFamily = getClusterVersionFamily(selections.targetVersion);
    const newestTargetOperator = SUPPORTED_OPERATOR_VERSIONS.find(
      (v) => v.startsWith(targetFamily + '.')
    );
    const newestTargetSupportsK8s = newestTargetOperator
      ? (OPERATOR_K8S_COMPATIBILITY[newestTargetOperator]?.[selections.platform] ?? []).includes(selections.k8sVersion)
      : true; // no data → suppress warning

    if (newestSourceOperator && !newestSourceSupportsK8s) {
      k8sVersionWarningHtml += `
      <section class="warning-panel">
        <p class="status-copy">
          ${k8sVersionLabel} <strong>${escapeHtml(selections.k8sVersion)}</strong> is not supported
          by the latest <strong>${escapeHtml(sourceLabel)}</strong> operator
          (<code>${escapeHtml(newestSourceOperator)}</code>). Your current Kubernetes cluster may
          already be incompatible with the newest patch of your installed operator family. Review the
          <a href="https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/"
             target="_blank" rel="noreferrer">supported Kubernetes distributions table</a>
          and consider upgrading your Kubernetes cluster before proceeding.
        </p>
      </section>`;
    }

    if (newestTargetOperator && !newestTargetSupportsK8s) {
      k8sVersionWarningHtml += `
      <section class="warning-panel">
        <p class="status-copy">
          ${k8sVersionLabel} <strong>${escapeHtml(selections.k8sVersion)}</strong> is not supported
          by the latest <strong>${escapeHtml(targetLabel)}</strong> operator
          (<code>${escapeHtml(newestTargetOperator)}</code>). You may need to upgrade your Kubernetes
          cluster before upgrading Redis Enterprise.
          Refer to the
          <a href="https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/"
             target="_blank" rel="noreferrer">supported Kubernetes distributions table</a>
          for the full list of supported versions.
        </p>
      </section>`;
    }
  }

  return {
    title: 'Pre-upgrade checks',
    html: `
      <p class="status-copy">Complete these checks before starting the upgrade from
        <strong>${escapeHtml(sourceLabel)}</strong> to <strong>${escapeHtml(targetLabel)}</strong>.</p>
      ${k8sVersionWarningHtml}
      <ol class="wizard-step-list">
        <li>
          <strong>Check cluster alerts</strong> — Log in to the Redis Enterprise admin console and
          navigate to <strong>Cluster &gt; Alerts</strong>. Alternatively, query alerts via the REST API:
          <pre><code>curl -s -k -u &lt;username&gt;:&lt;password&gt; https://&lt;FQDN&gt;:9443/v1/alerts | jq</code></pre>
          Resolve all active alerts before proceeding.
        </li>
        <li>
          <strong>Run the pre-upgrade system check</strong> — Execute the <code>rlcheck</code> utility
          on each node:
          <pre><code>sudo /opt/redislabs/bin/rlcheck --continue-on-error</code></pre>
          All tests must pass with no errors. Reference:
          <a href="https://redis.io/docs/latest/operate/rs/references/cli-utilities/rlcheck/" target="_blank" rel="noreferrer">rlcheck documentation</a>.
        </li>
        <li>
          <strong>Check cluster health</strong> — Run <code>rladmin status extra all</code> and verify
          that all nodes and shards show <strong>OK</strong> status. Resolve any failed or stuck
          state-machine states before proceeding. Also run
          <code>rladmin cluster running_actions</code> and wait for all running tasks (resyncs,
          failovers, backups) to complete before proceeding.
        </li>
        <li>
          <strong>Ensure a current backup exists</strong> — Confirm that database backups have completed
          successfully and are healthy. Reference:
          <a href="https://redis.io/docs/latest/operate/rs/databases/import-export/export-data/" target="_blank" rel="noreferrer">Export database data</a>.
        </li>
        <li>
          <strong>Perform log cleanup on each cluster node</strong> — Inspect <code>/tmp</code> and
          <code>/var/opt/redislabs/log/</code> on every node. Remove any old
          <code>debug*.tar.gz</code> files or crash files to free disk space before the upgrade.
        </li>
        <li>
          <strong>Test database endpoints</strong> — Connect to every database endpoint using
          <code>redis-cli</code> or Redis Insight. If any database is not reachable, do not proceed
          with the upgrade until connectivity is restored.
        </li>
        <li>
          <strong>Generate a pre-upgrade support package</strong> — Run
          <code>rladmin cluster debug_info</code> to create a support package. Reference:
          <a href="https://redis.io/docs/latest/operate/rs/installing-upgrading/creating-support-package/#create-support-package" target="_blank" rel="noreferrer">Create a support package</a>.
          Share the generated package with Redis Support and your TAM before starting the upgrade.
        </li>
      </ol>
      <section class="wizard-step-ref">
        <h4>Reference</h4>
        <a href="${escapeHtml(
          (selections.platform === 'kubernetes-community' || selections.platform === 'kubernetes-openshift' || selections.platform === 'kubernetes-eks' || selections.platform === 'kubernetes-rancher' || selections.platform === 'kubernetes-gke' || selections.platform === 'kubernetes-aks')
            ? K8S_UPGRADE_DOC_URL
            : CLUSTER_UPGRADE_DOC_URL
        )}" target="_blank" rel="noreferrer">
          ${(selections.platform === 'kubernetes-community' || selections.platform === 'kubernetes-openshift' || selections.platform === 'kubernetes-eks' || selections.platform === 'kubernetes-rancher' || selections.platform === 'kubernetes-gke' || selections.platform === 'kubernetes-aks')
            ? 'Upgrade Redis Enterprise for Kubernetes — Redis docs'
            : 'Upgrade a Redis Enterprise cluster — Redis docs'}
        </a>
        <a href="https://redis.io/docs/latest/operate/rs/references/cli-utilities/rlcheck/" target="_blank" rel="noreferrer">
          rlcheck utility — Redis docs
        </a>
        <a href="https://redis.io/docs/latest/operate/rs/databases/import-export/export-data/" target="_blank" rel="noreferrer">
          Export database data — Redis docs
        </a>
        <a href="https://redis.io/docs/latest/operate/rs/installing-upgrading/creating-support-package/#create-support-package" target="_blank" rel="noreferrer">
          Create a support package — Redis docs
        </a>
      </section>
    `,
  };
}

function buildClusterUpgradeStep(selections) {
  const sourceLabel = getClusterVersionLabel(selections.sourceVersion);
  const targetLabel = getClusterVersionLabel(selections.targetVersion);

  return {
    title: 'Upgrade the cluster',
    html: `
      <p class="status-copy">
        Upgrade each cluster node from <strong>${escapeHtml(sourceLabel)}</strong> to
        <strong>${escapeHtml(targetLabel)}</strong>. Choose one of the two methods below.
        Complete all upgrade prerequisites before starting either method.
      </p>

      <h4>Option 1: In-place upgrade</h4>
      <p class="status-copy">
        Directly upgrade Redis Software on each node in the cluster. This method is simpler than
        the rolling upgrade method, but might cause brief service interruptions as each node is
        upgraded. Starting with the primary (master) node, follow these steps for every node in
        the cluster. Upgrade each node separately to ensure cluster availability.
      </p>
      <ol class="wizard-step-list">
        <li>
          <strong>Complete all prerequisites</strong> before starting the upgrade.
        </li>
        <li>
          <strong>Verify node operation</strong> with the following commands:
          <pre><code>rlcheck
rladmin status extra all</code></pre>
          Do not proceed if any shard, node, or endpoint is not OK.
        </li>
        <li>
          <strong>Download the Redis Software installation package</strong> for
          <strong>${escapeHtml(targetLabel)}</strong> from the
          <a href="https://cloud.redis.io" target="_blank" rel="noreferrer">Download Center</a>
          to the machine running the node.
        </li>
        <li>
          <strong>Extract the installation package:</strong>
          <pre><code>tar vxf &lt;tarfile name&gt;</code></pre>
          Note: You cannot change the installation path or the user during the upgrade.
        </li>
        <li>
          <strong>Run the install script.</strong> The installation script automatically recognizes
          the upgrade and responds accordingly:
          <pre><code>sudo ./install.sh</code></pre>
          The upgrade replaces all node processes, which might briefly interrupt any active
          connections.
        </li>
        <li>
          <strong>Verify the node is upgraded and still operational:</strong>
          <pre><code>rlcheck
rladmin status extra all</code></pre>
        </li>
        <li>
          <strong>Visit the Cluster Manager UI.</strong> If it was open in a browser during the
          upgrade, refresh the browser to reload the console.
          Repeat steps 2–7 for each remaining node in the cluster.
        </li>
      </ol>

      <h4>Option 2: Rolling upgrade</h4>
      <p class="status-copy">
        Minimize downtime by replacing nodes one at a time while keeping the rest of the cluster
        operational. Recommended for production environments that require continuous availability.
        Choose one of the following sub-methods.
      </p>

      <h4>Extra node method</h4>
      <p class="status-copy">
        Recommended if you have additional resources available.
      </p>
      <ol class="wizard-step-list">
        <li>
          <strong>Complete all prerequisites</strong> before starting the rolling upgrade.
        </li>
        <li>
          Install <strong>${escapeHtml(targetLabel)}</strong> on a new node.
        </li>
        <li>
          <strong>Add the new node to the cluster.</strong>
        </li>
        <li>
          <strong>If the cluster uses DNS</strong>, add the new node's IP address to the DNS
          records.
        </li>
        <li>
          <strong>Promote the first new node to become the primary node.</strong>
        </li>
        <li>
          Remove one node running <strong>${escapeHtml(sourceLabel)}</strong> from the cluster.
        </li>
        <li>
          <strong>Repeat steps 2–6</strong> until all nodes running
          <strong>${escapeHtml(sourceLabel)}</strong> are removed. If the final node to remove is
          the primary node, demote it to a secondary node before removing it.
        </li>
      </ol>

      <h4>Replace node method</h4>
      <p class="status-copy">
        Recommended if you cannot temporarily allocate additional resources.
      </p>
      <ol class="wizard-step-list">
        <li>
          <strong>Complete all prerequisites</strong> before starting the rolling upgrade.
        </li>
        <li>
          Remove a node running <strong>${escapeHtml(sourceLabel)}</strong> from the cluster.
        </li>
        <li>
          <strong>Uninstall Redis Software</strong> from the removed node:
          <pre><code>sudo ./rl_uninstall.sh</code></pre>
        </li>
        <li>
          Install <strong>${escapeHtml(targetLabel)}</strong> on the removed node or on a new
          node.
        </li>
        <li>
          <strong>Add the node to the cluster.</strong> To reuse the removed node's ID, run
          <code>rladmin cluster join</code> with the <code>replace_node</code> flag:
          <pre><code>rladmin cluster join nodes &lt;cluster_member_ip_address&gt; username &lt;username&gt; password &lt;password&gt; replace_node &lt;node_id&gt;</code></pre>
        </li>
        <li>
          <strong>If the cluster uses DNS</strong>, add the new node's IP address to the DNS
          records.
        </li>
        <li>
          <strong>Promote the first new node to become the primary node.</strong>
        </li>
        <li>
          <strong>Verify node health.</strong> Run <code>rlcheck</code> on all nodes and
          <code>rladmin status extra all</code> on the new node:
          <pre><code>rlcheck
rladmin status extra all</code></pre>
        </li>
        <li>
          <strong>Repeat steps 2–8</strong> until all nodes running
          <strong>${escapeHtml(sourceLabel)}</strong> are replaced. If the final node to remove is
          the primary node, demote it to a secondary node before removing it.
        </li>
      </ol>

      <section class="wizard-step-ref">
        <h4>Reference</h4>
        <a href="${escapeHtml(CLUSTER_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
          Upgrade a Redis Enterprise cluster — Redis docs
        </a>
        <a href="${escapeHtml(SUPPORTED_UPGRADE_PATHS_DOC_URL)}" target="_blank" rel="noreferrer">
          Supported upgrade paths — Redis docs
        </a>
      </section>
    `,
  };
}

function buildOsUpgradeStep(selections) {
  const operatingSystemLabel = labelForOperatingSystem(selections.operatingSystem);
  const platformLabel = labelForPlatform(selections.platform);
  const targetLabel = getClusterVersionLabel(selections.targetVersion);
  const supportedTargetOsList = getSupportedOperatingSystemLabels(
    selections.targetVersion,
    selections.platform,
  );
  const targetOsCopy = supportedTargetOsList.length
    ? `Documented supported operating systems for <strong>${escapeHtml(targetLabel)}</strong>
       on <strong>${escapeHtml(platformLabel)}</strong>: <strong>${escapeHtml(supportedTargetOsList.join(', '))}</strong>.`
    : `Review Redis's supported-platforms documentation for the target OS options.`;

  return {
    title: 'Upgrade the operating system',
    html: `
      <section class="warning-panel" style="margin-bottom:1rem;">
        <p class="status-copy">
          The current operating system <strong>${escapeHtml(operatingSystemLabel)}</strong>
          is not listed as supported for <strong>${escapeHtml(targetLabel)}</strong>
          on <strong>${escapeHtml(platformLabel)}</strong>. An OS upgrade is required.
        </p>
        <p class="status-copy">${targetOsCopy}</p>
      </section>
      <p class="status-copy">
        To upgrade the operating system on a Redis Software cluster to a later major version,
        perform a <strong>rolling upgrade</strong>. Because you upgrade one node at a time, you can
        upgrade your cluster's OS without downtime.
      </p>
      <ol class="wizard-step-list">
        <li>
          <strong>Prerequisites</strong>
          <ul>
            <li>
              Upgrade all nodes in the cluster to a Redis Software version that supports both the
              OS's <strong>current version</strong> and the <strong>target OS version</strong>.
              See <a href="https://redis.io/docs/latest/operate/rs/references/supported-platforms/" target="_blank" rel="noreferrer">Supported platforms</a>
              to verify compatibility.
            </li>
            <li>
              If the cluster uses <strong>custom directories</strong>, make sure the target OS version
              also supports custom directories, and specify the same custom directories during
              installation for all nodes.
            </li>
          </ul>
        </li>
        <li>
          <strong>Choose a rolling upgrade method:</strong>
          <ul>
            <li>
              <strong>Extra node method</strong> — recommended if you have additional resources
              available. You add a new node running the target OS, migrate shards to it, then remove
              the old node.
            </li>
            <li>
              <strong>Replace node method</strong> — recommended if you cannot temporarily allocate
              additional resources. You remove a node, upgrade or replace it, then rejoin it to the
              cluster.
            </li>
          </ul>
        </li>
        <li>
          <strong>Extra node method steps:</strong>
          <ul>
            <li>Create a node with the target OS version.</li>
            <li>Install the cluster's current Redis Software version on the new node using the
              installation package for the target OS version.</li>
            <li>Add the new node to the cluster.</li>
            <li>If the cluster uses DNS, add the new node's IP address to the DNS records.</li>
            <li>Remove one node running the earlier OS version from the cluster.</li>
            <li>Repeat until all nodes with the earlier OS version are removed. If the final node
              to remove is the <strong>primary node</strong>, demote it to a secondary node before
              you remove it.</li>
          </ul>
        </li>
        <li>
          <strong>Replace node method steps:</strong>
          <ul>
            <li>Remove a node with the earlier OS version from the cluster.</li>
            <li>Uninstall Redis Software from the removed node:
              <pre><code>sudo ./rl_uninstall.sh</code></pre>
            </li>
            <li>Either upgrade the existing node to the target OS version, or create a new node
              with the target OS version.</li>
            <li>Install the cluster's current Redis Software version on the upgraded node using the
              installation package for the target OS version.</li>
            <li>Add the new node to the cluster. If you want to reuse the removed node's ID:
              <pre><code>rladmin cluster join nodes &lt;cluster_member_ip_address&gt; username &lt;username&gt; password &lt;password&gt; replace_node &lt;node_id&gt;</code></pre>
            </li>
            <li>If the cluster uses DNS, add the new node's IP address to the DNS records.</li>
            <li>Repeat until all nodes with the earlier OS version are replaced. If the final node
              to remove is the <strong>primary node</strong>, demote it to a secondary node before
              you remove it.</li>
          </ul>
        </li>
        <li>
          <strong>Verify node health after each node replacement:</strong>
          <ul>
            <li>Run <code>rlcheck</code> on all nodes — the expected output is
              <code>ALL TESTS PASSED</code>.</li>
            <li>Run <code>rladmin status extra all</code> on the new node — verify
              <code>OK</code> status for the cluster, nodes, endpoints, and shards.</li>
          </ul>
        </li>
      </ol>
      <section class="wizard-step-ref">
        <h4>Reference</h4>
        <a href="${escapeHtml(OS_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
          Upgrade a cluster's operating system — Redis docs
        </a>
      </section>
    `,
  };
}

function buildDatabaseUpgradeStep(selections) {
  const targetLabel = getClusterVersionLabel(selections.targetVersion);
  const moduleNames = getSelectedModuleNames(selections);
  const hasModules = moduleNames.length > 0;
  const moduleVersionListHtml = hasModules
    ? buildModuleVersionListHtml(selections.targetVersion, moduleNames)
    : '';

  const isK8s = selections.platform === 'kubernetes-community' || selections.platform === 'kubernetes-openshift';

  if (isK8s) {
    if (selections.activeActive) {
      return {
        title: 'Upgrade Active-Active databases',
        html: `
          <p class="status-copy">
            After all participating clusters are upgraded to
            <strong>${escapeHtml(targetLabel)}</strong>, upgrade your
            <strong>RedisEnterpriseActiveActiveDatabase (REAADB)</strong> custom resources.
            You only need to apply the change on <strong>one</strong> participating cluster —
            it propagates automatically to all others. All participating clusters must be running
            operator version 8.0.2-2 or later.
          </p>
          <ol class="wizard-step-list">
            <li>
              <strong>Verify all participating clusters are upgraded</strong> — Confirm that every
              participating cluster's REC state is <strong>Running</strong>:
              <pre><code>kubectl get rec</code></pre>
            </li>
            <li>
              <strong>Edit the REAADB custom resource on one participating cluster</strong> — Set
              <code>spec.redisVersion</code> to the desired Redis database version string (e.g.
              <code>"7.2"</code>, <code>"7.4"</code>, <code>"8.0"</code>, or
              <code>"8.2"</code>):
              <pre><code>kubectl edit reaadb &lt;your-reaadb-name&gt;</code></pre>
              Under <code>spec</code>, set:
              <pre><code>spec:
  redisVersion: "8.2"</code></pre>
            </li>
            <li>
              <strong>Keep existing module versions unchanged (if applicable)</strong> — If your
              REAADB uses supported (bundled) modules, do not change the <code>moduleList</code>
              version numbers when upgrading <code>redisVersion</code>. The database will
              automatically use the module versions bundled with the new Redis version.
            </li>
            <li>
              <strong>Apply the change:</strong>
              <pre><code>kubectl apply -f &lt;reaadb-name&gt;.yaml</code></pre>
              The operator propagates the version change to all other participating clusters
              automatically.
            </li>
            <li>
              <strong>Monitor the upgrade</strong> — Watch the REAADB status across participating
              clusters to confirm the new Redis version is active:
              <pre><code>kubectl get reaadb &lt;your-reaadb-name&gt;</code></pre>
            </li>
          </ol>
          <section class="wizard-step-ref">
            <h4>Reference</h4>
            <a href="${escapeHtml(K8S_DB_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
              Upgrade databases (Kubernetes) — Redis docs
            </a>
          </section>
        `,
      };
    }

    return {
      title: 'Upgrade the database',
      html: `
        <p class="status-copy">
          After the Redis Enterprise cluster (REC) upgrade is complete and the REC state is
          <strong>Running</strong>, upgrade your
          <strong>RedisEnterpriseDatabase (REDB)</strong> custom resources to
          <strong>${escapeHtml(targetLabel)}</strong>.
        </p>
        <ol class="wizard-step-list">
          <li>
            <strong>Verify the REC upgrade is complete</strong> — Confirm the cluster state is
            <strong>Running</strong> before upgrading any databases:
            <pre><code>kubectl get rec</code></pre>
          </li>
          <li>
            <strong>Edit the REDB custom resource</strong> — Set <code>spec.redisVersion</code>
            to the desired Redis database version string (e.g. <code>"7.2"</code>,
            <code>"7.4"</code>, <code>"8.0"</code>, or <code>"8.2"</code> — note: this is a
            string value):
            <pre><code>kubectl edit redb &lt;your-redb-name&gt;</code></pre>
            Under <code>spec</code>, set:
            <pre><code>spec:
  redisVersion: "8.2"</code></pre>
          </li>
          <li>
            <strong>Apply the change:</strong>
            <pre><code>kubectl apply -f &lt;redb-name&gt;.yaml</code></pre>
          </li>
          <li>
            <strong>Monitor the upgrade</strong> — Watch the REDB status to confirm the database
            is running the new Redis version:
            <pre><code>kubectl get redb &lt;your-redb-name&gt;</code></pre>
          </li>
          <li>
            <strong>Verify the upgrade policy</strong> — If your cluster
            <code>redisUpgradePolicy</code> or database <code>redisVersion</code> is set to
            <code>major</code>, minor version upgrades will be blocked. See the Redis upgrade
            policy documentation for details.
          </li>
          <li>
            <strong>Test application connectivity</strong> — Test read and write operations to
            confirm that applications are functioning correctly.
          </li>
        </ol>
        <section class="wizard-step-ref">
          <h4>Reference</h4>
          <a href="${escapeHtml(K8S_DB_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
            Upgrade databases (Kubernetes) — Redis docs
          </a>
        </section>
      `,
    };
  }

  if (selections.activeActive) {
    return {
      title: 'Upgrade Active-Active databases',
      html: `
        <p class="status-copy">This deployment uses Active-Active (CRDB) databases. Active-Active
          upgrades follow a dedicated procedure that coordinates changes across all participating
          clusters.</p>
        <ol class="wizard-step-list">
          <li>
            <strong>Upgrade Redis Software on all participating clusters first</strong> — Before
            upgrading any Active-Active database instance, ensure that Redis Software has been
            upgraded on each node in every cluster where the Active-Active instances are located.
            All participating clusters must be running
            <strong>${escapeHtml(targetLabel)}</strong> before proceeding.
          </li>
          <li>
            <strong>Check the status of all Active-Active database instances</strong> — Run
            <code>rladmin status</code> on each participating cluster to check the status of every
            Active-Active database instance. The status output may show one or more of the following
            indicators:
            <ul>
              <li>
                <strong>OLD REDIS VERSION</strong> — The database instance is running a Redis version
                that is outdated or not fully compatible with the current Redis Software cluster
                version. You should upgrade the database to a later version of Redis bundled with the
                cluster's current Redis Software version.
              </li>
              <li>
                <strong>OLD CRDB PROTOCOL VERSION</strong> — This instance uses an older CRDB
                protocol. Redis Software versions 5.4.2 and later use CRDB protocol version 1. You
                can upgrade the CRDB protocol version when you upgrade the Active-Active database
                instances.
              </li>
              <li>
                <strong>OLD CRDB FEATURESET VERSION</strong> — The database feature set version is
                outdated. After all Active-Active database instances are upgraded, you will need to
                upgrade the feature set version.
              </li>
            </ul>
          </li>
          <li>
            <strong>Upgrade each Active-Active database instance</strong> — For each Active-Active
            database instance, upgrade the Redis database version and any enabled modules by running:
            <pre><code>rladmin upgrade db { db:&lt;ID&gt; | &lt;database-name&gt; }</code></pre>
            If the CRDB protocol version is outdated, a warning message will appear — read it
            carefully and confirm the CRDB protocol update.
          </li>
          <li>
            <strong>Upgrade the feature set version if outdated</strong> — If
            <code>rladmin status</code> showed <strong>OLD CRDB FEATURESET VERSION</strong> for any
            instance, upgrade the feature set after all Active-Active database instances have been
            upgraded and the CRDB protocol is current. To do this:
            <ul>
              <li>
                Find the <code>&lt;CRDB-GUID&gt;</code> of your Active-Active database using
                <code>crdb-cli crdb list</code> and match the fully qualified domain name
                (CLUSTER-FQDN) of your cluster to the associated GUID.
              </li>
              <li>
                Update the feature set for each Active-Active database. See the feature version
                guidelines in the reference documentation for details.
              </li>
            </ul>
          </li>
          <li>
            <strong>Update module information if applicable</strong> — If your Active-Active database
            uses modules, update the module information in the CRDB configuration after upgrading. To
            check if a database uses modules, run:
            <pre><code>rladmin status modules db { db:&lt;ID&gt; | &lt;database-name&gt; }</code></pre>
            Then update the CRDB configuration with:
            <pre><code>crdb-cli crdb update --crdb-guid &lt;CRDB-GUID&gt; --update-db-config-modules true</code></pre>
            The <code>crdb-cli</code> tool will prompt you to verify that all Active-Active database
            instances and their modules have been updated before continuing.
            ${hasModules && moduleVersionListHtml ? `
            <p style="margin-top:0.5rem;"><strong>Compatible module versions for
            ${escapeHtml(targetLabel)}:</strong></p>
            ${moduleVersionListHtml}
            ` : ''}
          </li>
          <li>
            <strong>Verify replication health</strong> — After all upgrades are complete, confirm
            that CRDB status shows all instances as synchronized across all participating clusters
            with no replication lag.
          </li>
          <li>
            <strong>Test application connectivity</strong> — Test read and write operations against
            each participating cluster to confirm that data is consistent and applications are
            functioning correctly.
          </li>
        </ol>
        <section class="wizard-step-ref">
          <h4>Reference</h4>
          <a href="${escapeHtml(ACTIVE_ACTIVE_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
            Upgrade an Active-Active database — Redis docs
          </a>
          <a href="${escapeHtml(DATABASE_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
            Upgrade a Redis Enterprise database — Redis docs
          </a>
        </section>
      `,
    };
  }

  return {
    title: 'Upgrade the database',
    html: `
      <p class="status-copy">After all cluster nodes are running
        <strong>${escapeHtml(targetLabel)}</strong>, upgrade each database to the latest
        bundled Redis database version.</p>
      <ol class="wizard-step-list">
        <li>
          <strong>Understand the default upgrade behavior</strong> — When you upgrade an existing
          database, it uses the latest bundled Redis version unless you specify a different version
          with the <code>redis_version</code> option in the REST API or
          <code>rladmin upgrade db</code>.
        </li>
        <li>
          <strong>View available Redis database versions</strong> — Before upgrading, check which
          Redis database versions are available:
          <ul>
            <li>
              In the Cluster Manager UI, see Redis database versions on the
              <strong>Cluster &gt; Configuration</strong> screen.
            </li>
            <li>
              Send a <code>GET /nodes</code> REST API request and see
              <code>supported_database_versions</code> in the response.
            </li>
          </ul>
        </li>
        <li>
          <strong>Verify version compatibility</strong> — Verify that both the current database
          version and the target database version are supported by the cluster's Redis Software
          version.
        </li>
        <li>
          <strong>Determine the current database version</strong> — To determine the current
          database version:
          <ul>
            <li>
              Use the Cluster Manager UI to open the <strong>Configuration</strong> tab for the
              database and select <strong>About</strong>.
            </li>
            <li>
              Use the <code>rladmin status extra all</code> command to display configuration
              details.
            </li>
          </ul>
        </li>
        <li>
          <strong>Verify the cluster is fully upgraded and operational</strong> — Confirm that all
          cluster nodes have been upgraded to <strong>${escapeHtml(targetLabel)}</strong> and that
          the cluster is healthy before proceeding with database upgrades.
        </li>
        <li>
          <strong>Check client compatibility with the database version</strong> — If you run Redis
          Stack commands with Go-Redis versions 9 and later or Lettuce versions 6 and later, set
          the client's protocol version to RESP2 before upgrading your database to Redis version
          7.2 to prevent potential application issues due to RESP3 breaking changes. See the
          reference documentation for client prerequisites for Redis 7.2 upgrade for more details
          and examples.
        </li>
        <li>
          <strong>Back up your data</strong> — To avoid data loss during the upgrade, back up your
          data. Confirm that database backups have completed successfully and are healthy before
          proceeding.
        </li>
        <li>
          <strong>Upgrade the database</strong> — Use <code>rladmin</code> to upgrade the database.
          During the upgrade process, the database will restart without losing any data. Use the
          <code>preserve_roles</code> option to keep the database's current state, including primary
          shard placement, and prevent the cluster from becoming unbalanced:
          <pre><code>rladmin upgrade db &lt;database name | database ID&gt; preserve_roles</code></pre>
          To upgrade the database to a version other than the default version, use the
          <code>redis_version</code> parameter:
          <pre><code>rladmin upgrade db &lt;database name | database ID&gt; redis_version &lt;version&gt; preserve_roles</code></pre>
        </li>
        ${hasModules ? `
        <li>
          <strong>Upgrade installed modules</strong> — After upgrading the database, verify that each
          installed module is running a version compatible with
          <strong>${escapeHtml(targetLabel)}</strong>. Use <code>rladmin status modules</code> to
          check installed module versions. If a module needs to be updated, use:
          <pre><code>rladmin upgrade module db_name &lt;database name&gt; module_name &lt;module&gt; version &lt;version&gt; module_args &lt;args&gt;</code></pre>
          ${moduleVersionListHtml ? `
          <p style="margin-top:0.5rem;"><strong>Compatible module versions for
          ${escapeHtml(targetLabel)}:</strong></p>
          ${moduleVersionListHtml}
          ` : ''}
        </li>
        ` : ''}
        <li>
          <strong>Verify the database upgrade</strong> — Check the Redis database compatibility
          version for the database to confirm the upgrade:
          <ul>
            <li>
              Use the Cluster Manager UI — open the <strong>Configuration</strong> tab for the
              database and select <strong>About</strong>.
            </li>
            <li>
              Use <code>rladmin status databases extra all</code> to display a list of the databases
              in your cluster and their current Redis database compatibility version.
            </li>
          </ul>
        </li>
        <li>
          <strong>Test application connectivity</strong> — Test read and write operations to confirm
          that applications are functioning correctly and that no breaking changes affect your
          workloads.
        </li>
      </ol>
      <section class="wizard-step-ref">
        <h4>Reference</h4>
        <a href="${escapeHtml(DATABASE_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
          Upgrade a Redis Enterprise database — Redis docs
        </a>
      </section>
    `,
  };
}


function buildK8sDeploymentMethodStep(selections) {
  const isOpenShift = selections.platform === 'kubernetes-openshift';
  const defaultMethod = isOpenShift ? 'openshift-cli' : 'kubectl';
  const allowedValues = isOpenShift ? OPENSHIFT_METHODS : NON_OPENSHIFT_METHODS;

  const filteredMethods = K8S_DEPLOYMENT_METHODS.filter((m) => allowedValues.includes(m.value));

  const radioButtons = filteredMethods.map((method) => {
    const checked = method.value === defaultMethod ? 'checked' : '';
    return `
      <label class="path-option">
        <input type="radio" name="k8s-deployment-method" value="${escapeHtml(method.value)}" ${checked} />
        <span class="path-option-label">
          <strong>${escapeHtml(method.label)}</strong>
          <span class="path-option-detail">${escapeHtml(method.description)}</span>
        </span>
      </label>`;
  }).join('');

  return {
    title: 'Select Kubernetes deployment method',
    html: `
      <p class="status-copy">Choose the method you used to deploy the Redis Enterprise operator.
        The upgrade procedure differs depending on the deployment method.</p>
      <div class="path-options">
        ${radioButtons}
      </div>
      <p class="status-copy" style="margin-top:1rem;">
        <strong>Note:</strong> Your selection will be used to tailor the cluster upgrade instructions
        in the following steps. You can navigate back to change this at any time.
      </p>
      <section class="wizard-step-ref">
        <h4>Reference</h4>
        <a href="${escapeHtml(K8S_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
          Upgrade Redis Enterprise for Kubernetes — Redis docs
        </a>
      </section>
    `,
    onEnter() {
      // Restore previous selection from sessionStorage if available
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const s = JSON.parse(stored);
          if (s.k8sDeploymentMethod) {
            const radio = wizardStepContent.querySelector(
              `input[name="k8s-deployment-method"][value="${s.k8sDeploymentMethod}"]`
            );
            if (radio) radio.checked = true;
          }
        } catch { /* ignore */ }
      }
    },
    onLeave() {
      // Persist selected deployment method
      const selected = wizardStepContent.querySelector('input[name="k8s-deployment-method"]:checked');
      if (selected) {
        try {
          const stored = sessionStorage.getItem(STORAGE_KEY);
          const s = stored ? JSON.parse(stored) : {};
          s.k8sDeploymentMethod = selected.value;
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        } catch { /* ignore */ }
      }
    },
  };
}

function getK8sDeploymentMethod(platform) {
  const isOpenShift = platform === 'kubernetes-openshift';
  const allowedValues = isOpenShift ? OPENSHIFT_METHODS : NON_OPENSHIFT_METHODS;
  const defaultMethod = isOpenShift ? 'openshift-cli' : 'kubectl';
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const s = JSON.parse(stored);
      const method = s.k8sDeploymentMethod;
      // Validate stored method is valid for current platform; fall back to default if stale
      if (method && allowedValues.includes(method)) {
        return method;
      }
    }
  } catch { /* ignore */ }
  return defaultMethod;
}

function buildK8sClusterUpgradeHtml(sourceLabel, targetLabel, method, platform, sourceVersion, targetVersion, k8sVersion) {
  const methodLabel = K8S_DEPLOYMENT_METHODS.find((m) => m.value === method)?.label ?? method;

  const isRelevantPlatform = platform === 'kubernetes-community' || platform === 'kubernetes-openshift' || platform === 'kubernetes-eks' || platform === 'kubernetes-rancher' || platform === 'kubernetes-gke' || platform === 'kubernetes-aks';

  const filteredOperatorVersions = isRelevantPlatform
    ? getOperatorVersionsForK8s(sourceVersion, k8sVersion, platform)
    : [];

  // Find the newest operator in each family (first match — array is ordered newest-first).
  const sourceFamily = getClusterVersionFamily(sourceVersion);
  const targetFamily = getClusterVersionFamily(targetVersion);
  const newestSourceOperator = isRelevantPlatform
    ? SUPPORTED_OPERATOR_VERSIONS.find((v) => v.startsWith(sourceFamily + '.'))
    : undefined;

  const newestTargetOperator = isRelevantPlatform
    ? SUPPORTED_OPERATOR_VERSIONS.find((v) => v.startsWith(targetFamily + '.'))
    : undefined;

  const newestSourceSupportsK8s = newestSourceOperator && k8sVersion
    ? (OPERATOR_K8S_COMPATIBILITY[newestSourceOperator]?.[platform] ?? []).includes(k8sVersion)
    : true; // no data → suppress warning

  const newestTargetSupportsK8s = newestTargetOperator && k8sVersion
    ? (OPERATOR_K8S_COMPATIBILITY[newestTargetOperator]?.[platform] ?? []).includes(k8sVersion)
    : true; // no data → suppress warning

  let k8sUpgradeWarningHtml = '';
  if (isRelevantPlatform && k8sVersion) {
    if (newestSourceOperator && !newestSourceSupportsK8s) {
      k8sUpgradeWarningHtml += `<section class="warning-panel">
        <p class="status-copy">
          Kubernetes version <strong>${escapeHtml(k8sVersion)}</strong> is not supported by the
          latest <strong>${escapeHtml(sourceLabel)}</strong> operator
          (<code>${escapeHtml(newestSourceOperator)}</code>). Your current Kubernetes cluster may
          already be incompatible with the newest patch of your installed operator family. Review the
          <a href="https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/"
            target="_blank" rel="noreferrer">supported Kubernetes distributions</a> table and consider
          upgrading your Kubernetes cluster before proceeding.
        </p>
      </section>`;
    }
    if (newestTargetOperator && !newestTargetSupportsK8s) {
      k8sUpgradeWarningHtml += `<section class="warning-panel">
        <p class="status-copy">
          Kubernetes version <strong>${escapeHtml(k8sVersion)}</strong> is not supported by the
          latest <strong>${escapeHtml(targetLabel)}</strong> operator
          (<code>${escapeHtml(newestTargetOperator)}</code>). A Kubernetes cluster upgrade may be
          required before or alongside the Redis Enterprise operator upgrade.
          Check the
          <a href="https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/"
            target="_blank" rel="noreferrer">supported Kubernetes distributions</a> table to confirm
          which Kubernetes versions are compatible with the target operator.
        </p>
      </section>`;
    }
  }

  const operatorVersionRemarkHtml = filteredOperatorVersions.length
    ? `<p class="status-copy">The operator version must be one of the supported versions compatible with your Kubernetes version: <code>${escapeHtml(k8sVersion)}</code>:
        ${filteredOperatorVersions.map((v) => `<code>${escapeHtml(v)}</code>`).join(', ')}.
        See the <a href="https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/" target="_blank" rel="noreferrer">supported Kubernetes distributions</a> reference page.
      </p>`
    : '';

  let operatorUpgradeHtml = '';

  if (method === 'kubectl') {
    operatorUpgradeHtml = `
        <li>
          <strong>Apply the updated operator bundle</strong> — Download the latest operator bundle for
          <strong>${escapeHtml(targetLabel)}</strong> and apply it to the namespace:
          <pre><code>kubectl apply -f bundle.yaml</code></pre>
          This deploys the new operator version including the updated <code>RedisEnterpriseCluster</code>
          CRD, RBAC resources, and operator deployment.
        </li>`;
  } else if (method === 'openshift-cli') {
    operatorUpgradeHtml = `
        <li>
          <strong>Apply the updated OpenShift operator bundle</strong> — Download the latest operator
          bundle for <strong>${escapeHtml(targetLabel)}</strong> and apply it to the namespace:
          <pre><code>oc apply -f openshift.bundle.yaml</code></pre>
          This deploys the new operator version including the updated <code>RedisEnterpriseCluster</code>
          CRD, RBAC resources, and operator deployment.
        </li>`;
  } else if (method === 'openshift-olm') {
    operatorUpgradeHtml = `
        <li>
          <strong>Update the operator via OperatorHub (OLM)</strong> — If you use automatic updates, the
          Operator Lifecycle Manager (OLM) will update the operator when a new version is published to
          the OperatorHub catalog.
          <br><br>
          If you use <strong>manual updates</strong>, navigate to <strong>Operators &gt; Installed Operators</strong>
          in the OpenShift web console, find the Redis Enterprise operator, and approve the pending
          install plan for the new version.
          <br><br>
          You can also edit the <code>Subscription</code> resource directly:
          <pre><code>oc get subscription redis-enterprise -n &lt;namespace&gt; -o yaml</code></pre>
          Verify the <code>currentCSV</code> matches the target operator version after approval.
        </li>`;
  } else if (method === 'helm') {
    operatorUpgradeHtml = `
        <li>
          <strong>Upgrade the operator via Helm</strong> — Update your Helm repo and upgrade the release
          to the version matching <strong>${escapeHtml(targetLabel)}</strong>:
          <pre><code>helm repo update
helm upgrade &lt;release-name&gt; redis/redis-enterprise-operator \\
  --namespace &lt;namespace&gt; \\
  --set redisEnterprise.versionTag=&lt;target-tag&gt;</code></pre>
          Review the chart's <code>values.yaml</code> for any new or changed configuration options
          introduced in the target version.
        </li>`;
  }

  return `
      <p class="status-copy">Upgrade the Redis Enterprise cluster from
        <strong>${escapeHtml(sourceLabel)}</strong> to <strong>${escapeHtml(targetLabel)}</strong>
        using the <strong>${escapeHtml(methodLabel)}</strong> deployment method.</p>
      ${k8sUpgradeWarningHtml}
      ${operatorVersionRemarkHtml}
      <ol class="wizard-step-list">
        <li>
          <strong>Check prerequisites</strong> —
          <ul>
            <li>Verify that the Redis Enterprise operator version you are upgrading to supports
              <strong>${escapeHtml(targetLabel)}</strong>. Check the
              <a href="https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/" target="_blank" rel="noreferrer">supported distributions table</a>.</li>
            <li>Ensure the Kubernetes cluster has enough resources (CPU, memory) to handle the
              rolling restart of Redis Enterprise pods.</li>
            <li>Back up your <code>RedisEnterpriseCluster</code> (REC) and <code>RedisEnterpriseDatabase</code>
              (REDB) custom resource definitions before upgrading.</li>
          </ul>
        </li>
        ${operatorUpgradeHtml}
        <li>
          <strong>Verify the operator upgrade</strong> — After the operator is updated, verify the new
          operator pod is running:
          <pre><code>kubectl get deployment redis-enterprise-operator -n &lt;namespace&gt;</code></pre>
          Check operator logs for errors:
          <pre><code>kubectl logs deployment/redis-enterprise-operator -n &lt;namespace&gt; --tail=50</code></pre>
        </li>
        <li>
          <strong>Reapply the admission controller webhook</strong> — After the operator upgrade,
          reapply the <code>ValidatingWebhookConfiguration</code> to ensure it matches the new operator
          version. Download the latest admission controller bundle and apply it:
          <pre><code>kubectl apply -f admission.bundle.yaml</code></pre>
          Verify the webhook is operational:
          <pre><code>kubectl get validatingwebhookconfigurations</code></pre>
        </li>
        <li>
          <strong>Update the RedisEnterpriseCluster (REC) image</strong> — Edit the REC custom resource
          and update the <code>redisEnterpriseImageSpec.versionTag</code> to the target version tag:
          <pre><code>kubectl patch rec &lt;rec-name&gt; -n &lt;namespace&gt; --type merge -p \\
  '{"spec":{"redisEnterpriseImageSpec":{"versionTag":"&lt;target-tag&gt;"}}}'</code></pre>
          The operator will perform a rolling restart of the Redis Enterprise StatefulSet pods.
        </li>
        <li>
          <strong>Monitor the rolling upgrade</strong> — Watch the StatefulSet pods restart one by one:
          <pre><code>kubectl rollout status statefulset/&lt;rec-name&gt; -n &lt;namespace&gt; --watch</code></pre>
          Verify all pods are running and ready:
          <pre><code>kubectl get pods -n &lt;namespace&gt; -l app=redis-enterprise</code></pre>
        </li>
        <li>
          <strong>Verify the cluster upgrade</strong> — Check the REC status to confirm the upgrade
          completed successfully:
          <pre><code>kubectl get rec -n &lt;namespace&gt;</code></pre>
          The <code>STATUS</code> should show <strong>Running</strong> and the
          <code>REDIS ENTERPRISE VERSION</code> should match the target version.
        </li>
      </ol>
      <section class="wizard-step-ref">
        <h4>Reference</h4>
        <a href="${escapeHtml(K8S_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
          Upgrade Redis Enterprise for Kubernetes — Redis docs
        </a>
      </section>
    `;
}

function buildK8sClusterUpgradeStep(selections) {
  const sourceLabel = getClusterVersionLabel(selections.sourceVersion);
  const targetLabel = getClusterVersionLabel(selections.targetVersion);
  const stepTitle = 'Upgrade the cluster';

  return {
    title: stepTitle,
    html: buildK8sClusterUpgradeHtml(sourceLabel, targetLabel, getK8sDeploymentMethod(selections.platform), selections.platform, selections.sourceVersion, selections.targetVersion, selections.k8sVersion),
    onEnter() {
      const currentMethod = getK8sDeploymentMethod(selections.platform);
      wizardStepContent.innerHTML = `
        <article class="wizard-step-panel guide-panel">
          <h3 class="wizard-step-title">${escapeHtml(stepTitle)}</h3>
          ${buildK8sClusterUpgradeHtml(sourceLabel, targetLabel, currentMethod, selections.platform, selections.sourceVersion, selections.targetVersion, selections.k8sVersion)}
        </article>
      `;
    },
  };
}

function buildK8sDatabaseUpgradeStep(selections) {
  const targetLabel = getClusterVersionLabel(selections.targetVersion);
  const moduleNames = getSelectedModuleNames(selections);
  const hasModules = moduleNames.length > 0;
  const moduleVersionListHtml = hasModules
    ? buildModuleVersionListHtml(selections.targetVersion, moduleNames)
    : '';

  if (selections.activeActive) {
    return {
      title: 'Upgrade Active-Active databases (Kubernetes)',
      html: `
        <p class="status-copy">This deployment uses Active-Active (CRDB) databases on Kubernetes.
          After the operator and cluster are upgraded, update each Active-Active database's custom
          resource.</p>
        <ol class="wizard-step-list">
          <li>
            <strong>Ensure all participating clusters are upgraded</strong> — Before upgrading any
            Active-Active database, verify that the Redis Enterprise operator and cluster (REC) have
            been upgraded to <strong>${escapeHtml(targetLabel)}</strong> on all participating Kubernetes
            clusters.
          </li>
          <li>
            <strong>Update the RedisEnterpriseActiveActiveDatabase (REAADB) resource</strong> — Edit
            each REAADB custom resource to set the target Redis database version:
            <pre><code>kubectl patch reaadb &lt;reaadb-name&gt; -n &lt;namespace&gt; --type merge -p \\
  '{"spec":{"redisVersion":"&lt;target-redis-version&gt;"}}'</code></pre>
            The operator will coordinate the upgrade across all participating clusters.
          </li>
          ${hasModules ? `
          <li>
            <strong>Update module versions</strong> — If your Active-Active databases use modules,
            update the module specifications in the REAADB custom resource to versions compatible with
            <strong>${escapeHtml(targetLabel)}</strong>.
            ${moduleVersionListHtml ? `
            <p style="margin-top:0.5rem;"><strong>Compatible module versions for
            ${escapeHtml(targetLabel)}:</strong></p>
            ${moduleVersionListHtml}
            ` : ''}
          </li>
          ` : ''}
          <li>
            <strong>Verify replication health</strong> — After the upgrade, confirm that the REAADB
            status shows all instances as synchronized across all participating clusters:
            <pre><code>kubectl get reaadb -n &lt;namespace&gt;</code></pre>
          </li>
          <li>
            <strong>Test application connectivity</strong> — Test read and write operations against
            each participating cluster to confirm data consistency and application functionality.
          </li>
        </ol>
        <section class="wizard-step-ref">
          <h4>Reference</h4>
          <a href="${escapeHtml(K8S_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
            Upgrade Redis Enterprise for Kubernetes — Redis docs
          </a>
          <a href="${escapeHtml(ACTIVE_ACTIVE_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
            Upgrade an Active-Active database — Redis docs
          </a>
        </section>
      `,
    };
  }

  return {
    title: 'Upgrade the database',
    html: `
      <p class="status-copy">After the Redis Enterprise cluster is running
        <strong>${escapeHtml(targetLabel)}</strong>, upgrade each database by updating its
        <code>RedisEnterpriseDatabase</code> (REDB) custom resource.</p>
      <ol class="wizard-step-list">
        <li>
          <strong>Check current database versions</strong> — List all REDB resources and their current
          Redis versions:
          <pre><code>kubectl get redb -n &lt;namespace&gt;</code></pre>
        </li>
        <li>
          <strong>Update the REDB custom resource</strong> — For each database, update the
          <code>redisVersion</code> field in the REDB spec to the target Redis database version:
          <pre><code>kubectl patch redb &lt;redb-name&gt; -n &lt;namespace&gt; --type merge -p \\
  '{"spec":{"redisVersion":"&lt;target-redis-version&gt;"}}'</code></pre>
          The operator will perform a rolling restart of the database shards.
        </li>
        ${hasModules ? `
        <li>
          <strong>Update module versions</strong> — If your databases use modules, update the
          <code>modulesList</code> in the REDB spec with versions compatible with
          <strong>${escapeHtml(targetLabel)}</strong>:
          <pre><code>kubectl patch redb &lt;redb-name&gt; -n &lt;namespace&gt; --type merge -p \\
  '{"spec":{"modulesList":[{"name":"&lt;module-name&gt;","version":"&lt;version&gt;"}]}}'</code></pre>
          ${moduleVersionListHtml ? `
          <p style="margin-top:0.5rem;"><strong>Compatible module versions for
          ${escapeHtml(targetLabel)}:</strong></p>
          ${moduleVersionListHtml}
          ` : ''}
        </li>
        ` : ''}
        <li>
          <strong>Verify the database upgrade</strong> — Check the REDB status to confirm each database
          is running the target version:
          <pre><code>kubectl get redb -n &lt;namespace&gt; -o wide</code></pre>
          The <code>STATUS</code> should show <strong>active</strong> and the Redis version should
          match the target.
        </li>
        <li>
          <strong>Test application connectivity</strong> — Test read and write operations to confirm
          that applications are functioning correctly.
        </li>
      </ol>
      <section class="wizard-step-ref">
        <h4>Reference</h4>
        <a href="${escapeHtml(K8S_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
          Upgrade Redis Enterprise for Kubernetes — Redis docs
        </a>
        <a href="${escapeHtml(DATABASE_UPGRADE_DOC_URL)}" target="_blank" rel="noreferrer">
          Upgrade a Redis Enterprise database — Redis docs
        </a>
      </section>
    `,
  };
}

/* ---------------------------------------------------------------------------
   Wizard navigation
   --------------------------------------------------------------------------- */

function buildWizardSteps(selections, selectedPath) {
  // selectedPath is an array of version strings, e.g. ['6.4', '7.4', '8.0.16']
  const versionStops = selectedPath || [selections.sourceVersion, selections.targetVersion];
  const isMultiStep = versionStops.length > 2;
  const isK8s = selections.platform.startsWith('kubernetes-');

  // Pre-upgrade checks apply to the overall upgrade journey
  const steps = [buildPreUpgradeStep(selections)];

  // For Kubernetes platforms, add deployment method selection step
  if (isK8s) {
    steps.push(buildK8sDeploymentMethodStep(selections));
  }

  const moduleNames = getSelectedModuleNames(selections);

  // When the upgrade requires multiple steps and the user has selected modules,
  // add a note reminding them that module compatibility must be verified at each step.
  // Intermediate stops (every stop except the final target) are flagged as
  // "Bridge version" so the user can tell required stepping-stones from the
  // final destination at a glance.
  if (isMultiStep && moduleNames.length > 0) {
    const finalIdx = versionStops.length - 1;
    const stopsHtml = versionStops.map((v, idx) => {
      if (idx === 0) return ''; // skip source — no module upgrade needed before the first step
      const label = escapeHtml(getClusterVersionLabel(v));
      const bridgeTag = idx < finalIdx ? ' <em>(Bridge version)</em>' : '';
      const compatible = getCompatibleModuleVersions(v, moduleNames);
      if (!compatible.length) return `<li><strong>${label}</strong>${bridgeTag} — no compatible module version data available.</li>`;
      const items = compatible
        .map((m) => `${escapeHtml(getModuleLabel(m))} <code>${escapeHtml(m.version)}</code>`)
        .join(', ');
      return `<li><strong>${label}</strong>${bridgeTag} — ${items}</li>`;
    }).filter(Boolean).join('\n            ');

    steps.push({
      title: 'Module upgrade considerations',
      html: `
        <p class="status-copy">This upgrade path requires multiple upgrade steps, and you have
          modules installed. Module versions must be compatible with each intermediate Redis Software
          version. <strong>Upgrade your modules at each step before proceeding to the next cluster
          upgrade.</strong></p>
        <p class="status-copy">Intermediate stops are marked as <em>Bridge version</em> — they are
          documented stepping-stone releases required to reach the final target.</p>
        <p class="status-copy">Recommended module versions per upgrade step target:</p>
        <ul class="wizard-step-list">
          ${stopsHtml}
        </ul>
        <p class="status-copy">Each database upgrade step below includes specific module upgrade
          instructions and compatible versions for that step.</p>
      `,
    });
  }

  const finalStopIdx = versionStops.length - 1;
  for (let i = 0; i < versionStops.length - 1; i++) {
    const stepSource = versionStops[i];
    const stepTarget = versionStops[i + 1];
    const stepSelections = { ...selections, sourceVersion: stepSource, targetVersion: stepTarget };
    const isBridgeHop = isMultiStep && (i + 1) < finalStopIdx;
    const stepLabel = isMultiStep
      ? ` (${isBridgeHop ? 'Bridge version: ' : ''}${escapeHtml(getClusterVersionLabel(stepSource))} → ${escapeHtml(getClusterVersionLabel(stepTarget))})`
      : '';

    // Use K8s-specific steps when platform is Kubernetes
    const clusterStep = isK8s
      ? buildK8sClusterUpgradeStep(stepSelections)
      : buildClusterUpgradeStep(stepSelections);
    if (isMultiStep) {
      clusterStep.title = `Upgrade the cluster${stepLabel}`;
    }
    steps.push(clusterStep);

    // Check OS compatibility at each hop (skip for Kubernetes platforms)
    if (!isK8s) {
      const hopPlatformSupport = getPlatformSupport(
        stepTarget,
        selections.platform,
        selections.operatingSystem,
      );
      if (!hopPlatformSupport.supported && hopPlatformSupport.reason === 'operating-system-not-supported') {
        const osStep = buildOsUpgradeStep(stepSelections);
        if (isMultiStep) {
          osStep.title = `Upgrade the operating system${stepLabel}`;
        }
        steps.push(osStep);
      }
    }

    const dbStep = isK8s
      ? buildK8sDatabaseUpgradeStep(stepSelections)
      : buildDatabaseUpgradeStep(stepSelections);
    if (isMultiStep) {
      dbStep.title = `${dbStep.title}${stepLabel}`;
    }
    steps.push(dbStep);
  }

  return steps;
}

function renderWizard(steps) {
  let currentStep = 0;

  function renderCurrentStep() {
    const step = steps[currentStep];
    const total = steps.length;

    wizardStepIndicator.textContent = `Step ${currentStep + 1} of ${total}`;

    wizardStepDots.innerHTML = steps
      .map(
        (s, i) =>
          `<button type="button" class="wizard-dot${i === currentStep ? ' wizard-dot-active' : ''}"
                  aria-label="Go to step ${i + 1}: ${escapeHtml(s.title)}"
                  data-step="${i}"></button>`,
      )
      .join('');

    wizardStepContent.innerHTML = `
      <article class="wizard-step-panel guide-panel">
        <h3 class="wizard-step-title">${escapeHtml(step.title)}</h3>
        ${step.html}
      </article>
    `;

    wizardPrevButton.hidden = currentStep === 0;
    wizardNextButton.textContent = currentStep === total - 1 ? 'Done ✓' : 'Next →';

    // Call onEnter lifecycle hook if the step defines one
    if (typeof step.onEnter === 'function') {
      step.onEnter();
    }
  }

  function leaveCurrentStep() {
    const step = steps[currentStep];
    if (typeof step.onLeave === 'function') {
      step.onLeave();
    }
  }

  wizardPrevButton.addEventListener('click', () => {
    if (currentStep > 0) {
      leaveCurrentStep();
      currentStep--;
      renderCurrentStep();
      wizardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  wizardNextButton.addEventListener('click', () => {
    if (currentStep < steps.length - 1) {
      leaveCurrentStep();
      currentStep++;
      renderCurrentStep();
      wizardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      leaveCurrentStep();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  wizardStepDots.addEventListener('click', (event) => {
    const dot = event.target.closest('.wizard-dot');
    if (!dot) return;
    leaveCurrentStep();
    currentStep = Number(dot.dataset.step);
    renderCurrentStep();
    wizardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  wizardEl.hidden = false;
  renderCurrentStep();
}

/* ---------------------------------------------------------------------------
   Initialization
   --------------------------------------------------------------------------- */

function renderPathSelection(selections, upgradePaths, onPathSelected) {
  const pathOptions = upgradePaths.map((path, index) => {
    const labels = path.map((v) => escapeHtml(getClusterVersionLabel(v)));
    const pathDescription = labels.join(' → ');
    const stepCount = path.length - 1;
    return `
      <label class="path-option">
        <input type="radio" name="upgrade-path" value="${index}"
               ${index === 0 ? 'checked' : ''} />
        <span class="path-option-label">
          <strong>${pathDescription}</strong>
          <span class="path-option-detail">${stepCount}-step upgrade</span>
        </span>
      </label>
    `;
  });

  pathSelectionContent.innerHTML = `
    <p class="status-copy">
      A direct upgrade from <strong>${escapeHtml(getClusterVersionLabel(selections.sourceVersion))}</strong>
      to <strong>${escapeHtml(getClusterVersionLabel(selections.targetVersion))}</strong>
      is not supported. Select an upgrade path through intermediate versions:
    </p>
    <div class="path-options">
      ${pathOptions.join('')}
    </div>
  `;

  pathSelectionEl.hidden = false;

  pathSelectionConfirm.addEventListener('click', () => {
    const selected = pathSelectionContent.querySelector('input[name="upgrade-path"]:checked');
    const selectedIndex = selected ? Number(selected.value) : 0;
    const selectedPath = upgradePaths[selectedIndex];
    pathSelectionEl.hidden = true;
    onPathSelected(selectedPath);
  });
}

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

  renderUpgradeSummary(selections);

  const upgradePaths = selections.upgradePaths || [];
  const isDirect = selections.isDirect !== false;

  if (isDirect || upgradePaths.length <= 1) {
    // Direct path or single indirect path — go straight to wizard
    const selectedPath = upgradePaths[0] || [selections.sourceVersion, selections.targetVersion];
    const steps = buildWizardSteps(selections, selectedPath);
    renderWizard(steps);
  } else {
    // Multiple indirect paths — show path selection UI
    renderPathSelection(selections, upgradePaths, (selectedPath) => {
      const steps = buildWizardSteps(selections, selectedPath);
      renderWizard(steps);
    });
  }

  backToResultsButton.addEventListener('click', () => {
    window.location.href = 'results.html';
  });
}

initialize();