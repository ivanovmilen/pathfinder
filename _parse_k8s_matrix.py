#!/usr/bin/env python3
"""Parse Redis k8s support matrix from redis.io and emit JS constant."""
import subprocess, re, sys

def strip_tags(s):
    return re.sub(r'<[^>]+>', ' ', s).strip()

import os

def fetch():
    if not os.isatty(sys.stdin.fileno()):
        return sys.stdin.read()
    r = subprocess.run(
        ['curl', '-s', 'https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/'],
        capture_output=True, text=True
    )
    return r.stdout

content = fetch()

rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.DOTALL)
all_rows = []
for row in rows:
    cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
    if not cells:
        continue
    normalized = []
    for c in cells:
        t = strip_tags(c).strip()
        t = t.replace('&#x26a0;&#xfe0f;', 'WARN').replace('\u26a0\ufe0f', 'WARN')
        t = t.replace('\u2705', 'OK').replace('\u274c', 'FAIL')
        t = re.sub(r'\s+', ' ', t).strip()
        normalized.append(t)
    all_rows.append(normalized)

# 30 operator version columns (indices 1-30 after K8s version cell)
# families: 8.0=1-3, 7.22=4-6, 7.8=7-10, 7.4=11-13, 7.2=14-16, 6.4=17-20, 6.2=21-30
COL_FAMILY = (
    ['8.0']*3 + ['7.22']*3 + ['7.8']*4 + ['7.4']*3 +
    ['7.2']*3 + ['6.4']*4 + ['6.2']*10
)
FAMILIES = ['8.0', '7.22', '7.8', '7.4', '7.2', '6.4', '6.2']

SECTION_MAP = {
    'Community K8s': 'kubernetes-community',
    'OpenShift':     'kubernetes-openshift',
    'Amazon EKS':    'kubernetes-eks',
    'Azure AKS':     'kubernetes-aks',
    'Google GKE':    'kubernetes-gke',
    'RKE2':          'kubernetes-rancher',
    'VMware TKGI':   'kubernetes-tkgi',
    'VMware VKS':    'kubernetes-vks',
}

matrix = {plat: {fam: set() for fam in FAMILIES} for plat in SECTION_MAP.values()}

current_section = None
for row in all_rows:
    if not row:
        continue
    first = row[0].strip()
    if first in SECTION_MAP:
        current_section = SECTION_MAP[first]
        continue
    if current_section is None:
        continue
    # skip header / date rows
    if first in ('Redis operator', '') or re.match(r'^(Jan|Feb|March|April|May|June|July|Aug|Sept|Oct|Nov|Dec)', first):
        continue
    # skip "Rancher" sub-header
    if first == 'Rancher':
        continue
    # K8s version row: must match N.N or N.NN
    if not re.match(r'^\d+\.\d+$', first):
        continue
    k8s_ver = first
    op_cells = row[1:]  # skip K8s version label
    for i, val in enumerate(op_cells):
        if i < len(COL_FAMILY) and val in ('OK', 'WARN'):
            matrix[current_section][COL_FAMILY[i]].add(k8s_ver)

def sort_versions(versions):
    def key(v):
        return tuple(int(p) for p in v.split('.'))
    return sorted(versions, key=key)

print('export const K8S_SUPPORT_MATRIX = {')
for fam in FAMILIES:
    print(f"  '{fam}': {{")
    for plat_key in SECTION_MAP.values():
        versions = sort_versions(matrix[plat_key][fam])
        ver_list = ', '.join(f"'{v}'" for v in versions)
        print(f"    '{plat_key}': [{ver_list}],")
    print('  },')
print('};')
print()
print('export function getSupportedK8sVersions(operatorVersionFamily, platform) {')
print("  return K8S_SUPPORT_MATRIX[operatorVersionFamily]?.[platform] ?? [];")
print('}')

