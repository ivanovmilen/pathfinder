#!/usr/bin/env python3
"""Parse the Redis Kubernetes support matrix from redis.io and emit JS constants.

Fetches the markdown alternate of the supported-distributions page (easier to
parse reliably than the rendered HTML) and emits three constants that mirror
the ones in upgrade-data.js:

- K8S_SUPPORT_MATRIX        — operator family → distribution → K8s versions.
- SUPPORTED_OPERATOR_VERSIONS — flat list of every operator patch, newest first.
- OPERATOR_K8S_COMPATIBILITY — per operator patch → distribution → K8s versions
                               (only the six user-selectable distributions).

✅ Supported and ⚠️ Deprecated both count as "currently usable"; ❌ End-of-life
cells are dropped.

The previous version hardcoded a fixed operator-column layout, which silently
mis-attributed columns whenever Redis shipped a new operator patch. This
version reads the column-to-operator mapping from each table-part header row,
so adding 8.0.18-11 (or any future patch) requires no script changes.

Run:  ./_parse_k8s_matrix.py
Or:   curl ... | ./_parse_k8s_matrix.py
"""
import collections
import os
import re
import subprocess
import sys


DOCS_URL = (
    'https://redis.io/docs/latest/operate/kubernetes/reference/'
    'supported_k8s_distributions/index.html.md'
)

# H2 section heading on the page → platform key used in upgrade-data.js. Sections
# not listed here (e.g. the global "Kubernetes version support" overview, or the
# VMware TKG distribution that the app does not track today) are skipped.
SECTION_MAP = {
    'OpenShift Container Platform': 'kubernetes-openshift',
    'Community Kubernetes':         'kubernetes-community',
    'Amazon Elastic Kubernetes Service (EKS)': 'kubernetes-eks',
    'Azure Kubernetes Service (AKS)':          'kubernetes-aks',
    'Google Kubernetes Engine (GKE)':          'kubernetes-gke',
    'Rancher':                                 'kubernetes-rancher',
    'VMware Tanzu Kubernetes Grid Integrated Edition (TKGI)': 'kubernetes-tkgi',
    'VMware vSphere Kubernetes Service (VKS)': 'kubernetes-vks',
}

# Operator families reported in K8S_SUPPORT_MATRIX, ordered newest → oldest.
FAMILIES = ['8.0', '7.22', '7.8', '7.4', '7.2', '6.4', '6.2']

# Output column order for K8S_SUPPORT_MATRIX, matching upgrade-data.js.
# kubernetes-tkg stays empty — the app doesn't surface TKG today; add it to
# SECTION_MAP above to enable.
EMIT_PLATFORMS = [
    'kubernetes-community',
    'kubernetes-openshift',
    'kubernetes-eks',
    'kubernetes-aks',
    'kubernetes-gke',
    'kubernetes-rancher',
    'kubernetes-tkgi',
    'kubernetes-vks',
    'kubernetes-tkg',
]

# Distributions actually selectable in the app's K8s dropdown. Only these get
# per-operator entries in OPERATOR_K8S_COMPATIBILITY; TKGI/VKS/TKG are not
# exposed to users and including them would just be dead weight.
USER_FACING_PLATFORMS = [
    'kubernetes-community',
    'kubernetes-openshift',
    'kubernetes-eks',
    'kubernetes-aks',
    'kubernetes-gke',
    'kubernetes-rancher',
]

# ✅ Supported and ⚠️ Deprecated both count as "currently usable" here; ❌ does not.
SUPPORTED_MARKER = re.compile(r'&#x2705;|:warning:|&#x26a0;')
OPERATOR_RE = re.compile(r'(\d+\.\d+\.\d+-\d+)')


def fetch():
    # Use stdin only when something is actually piped in. The previous version
    # read stdin whenever it wasn't a TTY, which silently produced empty output
    # when invoked under non-interactive shells (stdin connected to /dev/null).
    if not sys.stdin.isatty():
        data = sys.stdin.read()
        if data.strip():
            return data
    result = subprocess.run(['curl', '-sL', DOCS_URL], capture_output=True, text=True)
    return result.stdout


def split_row(line):
    inner = line.strip()
    if inner.startswith('|'):
        inner = inner[1:]
    if inner.endswith('|'):
        inner = inner[:-1]
    return [cell.strip() for cell in inner.split('|')]


def family_of(operator):
    match = re.match(r'(\d+\.\d+)', operator)
    return match.group(1) if match else None


def k8s_version(first_cell):
    """Return the K8s/OpenShift version embedded in a row's first cell, or None.

    Strips markdown emphasis so '**RKE2**' or '**VMware TKG 2.4**' is rejected
    while '1.35' and '4.21' are accepted.
    """
    stripped = re.sub(r'[*\s]+', '', first_cell)
    return stripped if re.fullmatch(r'\d+\.\d+', stripped) else None


def parse(md):
    """Walk the markdown and return (triples, operators_in_order).

    triples            — list of (platform, operator, k8s_version)
    operators_in_order — operator versions in column order of first appearance
                         (newest first, matching how the docs lay out columns)
    """
    triples = []
    operators_in_order = []
    seen_operators = set()
    platform = None
    operators = []  # column index → operator version string for the current part

    for raw in md.splitlines():
        if raw.startswith('## '):
            heading = raw[3:].strip()
            platform = SECTION_MAP.get(heading)
            operators = []
            continue
        if platform is None or not raw.startswith('|'):
            continue

        row = split_row(raw)
        if not row:
            continue

        # Per-part header row: rebuilds the column → operator map.
        if row[0] == 'Redis operator':
            operators = []
            for cell in row[1:]:
                match = OPERATOR_RE.search(cell)
                op = match.group(1) if match else None
                operators.append(op)
                if op and op not in seen_operators:
                    seen_operators.add(op)
                    operators_in_order.append(op)
            continue

        version = k8s_version(row[0])
        if not version:
            continue  # date row, sub-group label, separator, or blank

        for i, cell in enumerate(row[1:]):
            if i >= len(operators):
                break
            op = operators[i]
            if op and SUPPORTED_MARKER.search(cell):
                triples.append((platform, op, version))

    return triples, operators_in_order


def sort_versions(versions):
    def key(v):
        return tuple(int(p) for p in v.split('.'))
    return sorted(set(versions), key=key)


def build_matrix(triples):
    matrix = {fam: {plat: set() for plat in EMIT_PLATFORMS} for fam in FAMILIES}
    for platform, operator, version in triples:
        fam = family_of(operator)
        if fam in FAMILIES and platform in matrix[fam]:
            matrix[fam][platform].add(version)
    return matrix


def build_per_operator(triples, operators_in_order):
    per_op = {op: {plat: set() for plat in USER_FACING_PLATFORMS} for op in operators_in_order}
    for platform, operator, version in triples:
        if platform in USER_FACING_PLATFORMS and operator in per_op:
            per_op[operator][platform].add(version)
    return per_op


def emit(matrix, operators_in_order, per_op):
    # 1. K8S_SUPPORT_MATRIX
    print('export const K8S_SUPPORT_MATRIX = {')
    for fam in FAMILIES:
        print(f"  '{fam}': {{")
        for plat in EMIT_PLATFORMS:
            versions = sort_versions(matrix[fam][plat])
            joined = ', '.join(f"'{v}'" for v in versions)
            print(f"    '{plat}': [{joined}],")
        print('  },')
    print('};')
    print()
    print('export function getSupportedK8sVersions(operatorVersionFamily, platform) {')
    print('  return K8S_SUPPORT_MATRIX[operatorVersionFamily]?.[platform] ?? [];')
    print('}')
    print()

    # 2. SUPPORTED_OPERATOR_VERSIONS — grouped by family for readability.
    print('export const SUPPORTED_OPERATOR_VERSIONS = [')
    by_family = {fam: [] for fam in FAMILIES}
    for op in operators_in_order:
        fam = family_of(op)
        if fam in by_family:
            by_family[fam].append(op)
    for fam in FAMILIES:
        ops = by_family[fam]
        if ops:
            line = ', '.join(f"'{op}'" for op in ops)
            print(f"  {line},")
    print('];')
    print()

    # 3. OPERATOR_K8S_COMPATIBILITY — one operator per line, family-grouped.
    print('export const OPERATOR_K8S_COMPATIBILITY = {')
    last_family = None
    for op in operators_in_order:
        fam = family_of(op)
        if fam != last_family:
            if last_family is not None:
                print()
            print(f"  // {fam}.x family")
            last_family = fam
        parts = []
        for plat in USER_FACING_PLATFORMS:
            versions = sort_versions(per_op[op][plat])
            joined = ','.join(f"'{v}'" for v in versions)
            parts.append(f"'{plat}': [{joined}]")
        print(f"  '{op}': {{ {', '.join(parts)} }},")
    print('};')


if __name__ == '__main__':
    md = fetch()
    triples, operators_in_order = parse(md)
    matrix = build_matrix(triples)
    per_op = build_per_operator(triples, operators_in_order)
    emit(matrix, operators_in_order, per_op)
