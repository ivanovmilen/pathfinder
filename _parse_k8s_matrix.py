#!/usr/bin/env python3
"""Parse the Redis Kubernetes support matrix from redis.io and emit JS constants.

Fetches the markdown alternate of the supported-distributions page and emits the
three constants that live in upgrade-data.js:

- K8S_SUPPORT_MATRIX         — operator family → distribution → K8s versions.
- SUPPORTED_OPERATOR_VERSIONS — flat list of every operator patch, newest first.
- OPERATOR_K8S_COMPATIBILITY — per operator patch → distribution → K8s versions
                               (only the six user-selectable distributions).

Page layout this script understands (redesigned page — one matrix, no
per-distribution sections):

- "### Latest release"  — a summary table for the newest operator.
- "### Version history" — one matrix split into "#### Table part N of M" blocks.
  Columns are operator releases (newest → oldest, a handful per part); rows are
  OpenShift versions. Part 1 carries a second leading column pairing each
  OpenShift version with its Kubernetes version; later parts repeat the same rows
  in the same order with only the OpenShift column, so Kubernetes versions are
  recovered by row position. A row whose OpenShift cell is "&mdash;" is a
  Kubernetes version with no OpenShift pairing (e.g. 1.36).

The page publishes ONE Kubernetes list per operator plus an OpenShift list, not a
list per distribution — so community/eks/aks/gke/rancher share the Kubernetes
list. ✅ Supported and ⚠️ Deprecated both count as "currently usable"; ❌ End of
life and blank cells are dropped.

The script refuses to print anything if the page no longer parses sensibly (no
operators found, tables misaligned between parts, or the derived data disagreeing
with the page's own "Latest release" table). Silent empty output is what broke the
previous version when the page was redesigned.

Run:  ./_parse_k8s_matrix.py            print the three constants to stdout
      ./_parse_k8s_matrix.py --write    rewrite them in place in upgrade-data.js
      curl ... | ./_parse_k8s_matrix.py -   parse a page piped on stdin
"""
import re
import subprocess
import sys
from pathlib import Path

DOCS_URL = (
    'https://redis.io/docs/latest/operate/kubernetes/reference/'
    'supported_k8s_distributions/index.html.md'
)
DATA_FILE = Path(__file__).resolve().parent / 'upgrade-data.js'

# Platforms that share the page's single (non-OpenShift) Kubernetes list.
SHARED_K8S_PLATFORMS = [
    'kubernetes-community',
    'kubernetes-eks',
    'kubernetes-aks',
    'kubernetes-gke',
    'kubernetes-rancher',
]
OPENSHIFT = 'kubernetes-openshift'

# Output order for K8S_SUPPORT_MATRIX. TKGI/VKS/TKG are not published on the page
# any more (and not selectable in the app), so they are emitted empty.
MATRIX_PLATFORMS = [
    'kubernetes-community',
    OPENSHIFT,
    'kubernetes-eks',
    'kubernetes-aks',
    'kubernetes-gke',
    'kubernetes-rancher',
    'kubernetes-tkgi',
    'kubernetes-vks',
    'kubernetes-tkg',
]
# Distributions actually selectable in the app's dropdown.
USER_FACING_PLATFORMS = [
    'kubernetes-community',
    OPENSHIFT,
    'kubernetes-eks',
    'kubernetes-aks',
    'kubernetes-gke',
    'kubernetes-rancher',
]

USABLE = re.compile(r'&#x2705;|&#x26a0;|:warning:')   # ✅ supported, ⚠️ deprecated
OPERATOR_RE = re.compile(r'\b(\d+\.\d+\.\d+-\d+)\b')
VERSION_RE = re.compile(r'\d+\.\d+')


class PageError(Exception):
    """The page no longer looks like the layout this parser understands."""


def fetch():
    # stdin is opt-in: auto-reading it blocks forever when stdin is an open pipe
    # with no writer (CI runners, cron, agent shells), because read() waits for an
    # EOF that never comes.
    if '-' in sys.argv[1:] or '--stdin' in sys.argv[1:]:
        return sys.stdin.read()
    result = subprocess.run(
        ['curl', '-fsSL', '--max-time', '60', DOCS_URL],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise PageError('could not download %s (curl exit %d): %s'
                        % (DOCS_URL, result.returncode, result.stderr.strip()))
    return result.stdout


def split_row(line):
    inner = line.strip()
    if inner.startswith('|'):
        inner = inner[1:]
    if inner.endswith('|'):
        inner = inner[:-1]
    return [cell.strip() for cell in inner.split('|')]


def is_separator(cells):
    return all(set(c) <= set('-: ') for c in cells)


def norm_openshift(version):
    """The page zero-pads OpenShift minors ('4.05'); the app uses '4.5'."""
    major, minor = version.split('.')
    return '%s.%d' % (major, int(minor))


def version_key(version):
    return tuple(int(p) for p in version.split('.'))


def sorted_versions(versions):
    return sorted(set(versions), key=version_key)


def family_of(operator):
    return re.match(r'(\d+\.\d+)', operator).group(1)


def parse_version_history(md):
    """Return (operators_in_order, {operator: {'kubernetes': [...], 'openshift': [...]}})."""
    lines = md.splitlines()
    try:
        start = next(i for i, l in enumerate(lines) if l.strip() == '### Version history')
    except StopIteration:
        raise PageError('no "### Version history" section found')

    parts = {}                # part number -> ordered data rows
    part_no = None
    operators = []            # column → operator for the current table chunk
    lead = 0                  # label columns before the first operator column
    order = []                # operators in order of first appearance

    for line in lines[start:]:
        m = re.match(r'####\s+Table part\s+(\d+)\s+of\s+\d+', line)
        if m:
            part_no = int(m.group(1))
            parts.setdefault(part_no, [])
            continue
        if part_no is None or not line.startswith('|'):
            continue

        cells = split_row(line)
        if is_separator(cells):
            continue

        # Header row: names the operator behind each column in this chunk.
        header_ops = [OPERATOR_RE.search(c) for c in cells]
        if sum(1 for o in header_ops if o) >= 1 and not VERSION_RE.fullmatch(cells[0]):
            lead = next(i for i, o in enumerate(header_ops) if o)
            operators = [o.group(1) if o else None for o in header_ops[lead:]]
            for op in operators:
                if op and op not in order:
                    order.append(op)
            continue

        # Data row: first cell is an OpenShift version or "&mdash;" (no OpenShift).
        first = cells[0]
        if not (VERSION_RE.fullmatch(first) or first == '&mdash;'):
            continue    # release-date row, "OpenShift | Kubernetes" label row, …
        if not operators:
            raise PageError('data row before any operator header in part %d' % part_no)
        k8s = cells[1] if lead >= 2 else None
        statuses = cells[lead:lead + len(operators)]
        parts[part_no].append((first, k8s, list(zip(operators, statuses))))

    if not order:
        raise PageError('no operator releases found in the version history')
    if 1 not in parts or not parts[1]:
        raise PageError('version-history part 1 (the one naming Kubernetes versions) is missing')

    # Part 1 names the Kubernetes version of every row; later parts repeat the
    # same rows in the same order, so align by position — and verify the rows
    # really do line up before trusting that.
    reference = parts[1]
    if any(k8s is None or not VERSION_RE.fullmatch(k8s) for _, k8s, _ in reference):
        raise PageError('part 1 rows do not all carry a Kubernetes version column')

    result = {op: {'kubernetes': [], 'openshift': []} for op in order}
    for number, rows in sorted(parts.items()):
        if len(rows) != len(reference):
            raise PageError('part %d has %d rows but part 1 has %d — table layout changed'
                            % (number, len(rows), len(reference)))
        for (label, _, cells), (ref_label, ref_k8s, _) in zip(rows, reference):
            if label != ref_label:
                raise PageError('part %d row "%s" does not line up with part 1 row "%s"'
                                % (number, label, ref_label))
            for operator, status in cells:
                if operator and USABLE.search(status):
                    result[operator]['kubernetes'].append(ref_k8s)
                    if label != '&mdash;':
                        result[operator]['openshift'].append(norm_openshift(label))

    for op in order:
        result[op]['kubernetes'] = sorted_versions(result[op]['kubernetes'])
        result[op]['openshift'] = sorted_versions(result[op]['openshift'])
    return order, result


def cross_check_latest_release(md, order, result):
    """The page's own "Latest release" table must agree with the version history.

    This catches column misalignment, which would otherwise produce plausible-
    looking but wrong data.
    """
    lines = md.splitlines()
    try:
        s = next(i for i, l in enumerate(lines) if l.strip() == '### Latest release')
        e = next(i for i, l in enumerate(lines) if i > s and l.strip() == '### Version history')
    except StopIteration:
        raise PageError('no "### Latest release" section to cross-check against')
    section = lines[s:e]

    prose = ' '.join(l for l in section if not l.startswith('|'))
    mentioned = [op for op in order if op in set(OPERATOR_RE.findall(prose))]
    if not mentioned:
        raise PageError('the "Latest release" section does not name an operator release')
    newest = mentioned[0]          # `order` is newest-first

    k8s, openshift = [], []
    for line in section:
        if not line.startswith('|'):
            continue
        cells = split_row(line)
        if (len(cells) >= 3 and (VERSION_RE.fullmatch(cells[0]) or cells[0] == '&mdash;')
                and VERSION_RE.fullmatch(cells[1]) and USABLE.search(cells[2])):
            k8s.append(cells[1])
            if cells[0] != '&mdash;':
                openshift.append(norm_openshift(cells[0]))
    if not k8s:
        raise PageError('could not read any rows from the "Latest release" table')

    derived = result[newest]
    if sorted_versions(k8s) != derived['kubernetes'] or sorted_versions(openshift) != derived['openshift']:
        raise PageError(
            'version history disagrees with the "Latest release" table for %s:\n'
            '  latest release : kubernetes=%s openshift=%s\n'
            '  version history: kubernetes=%s openshift=%s'
            % (newest, sorted_versions(k8s), sorted_versions(openshift),
               derived['kubernetes'], derived['openshift']))
    return newest


def parse(md):
    order, result = parse_version_history(md)
    newest = cross_check_latest_release(md, order, result)
    for op in order:
        if not result[op]['kubernetes'] and not result[op]['openshift']:
            if op == newest:
                raise PageError('no usable versions parsed for the newest operator %s' % op)
            sys.stderr.write('warning: operator %s has no supported versions on the page\n' % op)
    return order, result


def q(version):
    return "'%s'" % version


def build_blocks(order, result):
    """The three JS constants, each starting with the comment that opens its block."""
    families = []
    for op in order:
        fam = family_of(op)
        if fam not in families:
            families.append(fam)

    # --- K8S_SUPPORT_MATRIX
    out = [
        '// Kubernetes version compatibility matrix.',
        '// Maps operator version family → Kubernetes platform → list of supported K8s versions',
        '// (✅ Supported and ⚠️ Deprecated both treated as currently usable, ❌ End-of-life dropped).',
        '// Source: https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/',
        '//',
        '// The page publishes ONE Kubernetes list per operator release plus an OpenShift list (any',
        '// CNCF-conformant distribution running a supported Kubernetes version is supported). So',
        "// community/eks/aks/gke/rancher share the same list in each family — the union across that",
        '// family\'s operator releases — and openshift carries its own. TKGI/VKS/TKG are no longer',
        '// published, so they stay empty.',
        '// Regenerate with: ./_parse_k8s_matrix.py --write',
        'export const K8S_SUPPORT_MATRIX = {',
    ]
    for fam in families:
        ops = [o for o in order if family_of(o) == fam]
        k8s = sorted_versions(v for o in ops for v in result[o]['kubernetes'])
        openshift = sorted_versions(v for o in ops for v in result[o]['openshift'])
        out.append("  '%s': {" % fam)
        for platform in MATRIX_PLATFORMS:
            if platform == OPENSHIFT:
                versions = openshift
            elif platform in SHARED_K8S_PLATFORMS:
                versions = k8s
            else:
                versions = []
            out.append("    '%s': [%s]," % (platform, ', '.join(q(v) for v in versions)))
        out.append('  },')
    out.append('};')
    matrix = '\n'.join(out)

    # --- SUPPORTED_OPERATOR_VERSIONS (grouped by family, newest first)
    out = [
        '// Supported Redis Enterprise operator versions for the Kubernetes upgrade path.',
        '// Source: https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/',
        '// Regenerate with: ./_parse_k8s_matrix.py --write',
        'export const SUPPORTED_OPERATOR_VERSIONS = [',
    ]
    for fam in families:
        out.append('  %s,' % ', '.join(q(o) for o in order if family_of(o) == fam))
    out.append('];')
    operators = '\n'.join(out)

    # --- OPERATOR_K8S_COMPATIBILITY (one operator per line, family-grouped)
    out = [
        '// Per-operator-version Kubernetes/OpenShift compatibility.',
        '// Lists every K8s or OpenShift version that is ✅ Supported or ⚠️ Deprecated for each',
        '// operator patch release on the six user-selectable distributions (community/openshift/eks/',
        '// aks/gke/rancher). TKGI/VKS data is captured in K8S_SUPPORT_MATRIX but not here, since the',
        '// app does not expose those distributions in the form.',
        '// Source: https://redis.io/docs/latest/operate/kubernetes/reference/supported_k8s_distributions/',
        '//',
        '// The page publishes one Kubernetes list per operator release plus an OpenShift list, so the',
        '// five non-OpenShift distributions share the same list for each operator.',
        '// Regenerate with: ./_parse_k8s_matrix.py --write',
        'export const OPERATOR_K8S_COMPATIBILITY = {',
    ]
    last = None
    for op in order:
        fam = family_of(op)
        if fam != last:
            if last is not None:
                out.append('')
            out.append('  // %s.x family' % fam)
            last = fam
        cells = []
        for platform in USER_FACING_PLATFORMS:
            versions = result[op]['openshift'] if platform == OPENSHIFT else result[op]['kubernetes']
            cells.append("'%s': [%s]" % (platform, ','.join(q(v) for v in versions)))
        out.append("  '%s': { %s }," % (op, ', '.join(cells)))
    out.append('};')
    compat = '\n'.join(out)

    return [matrix, operators, compat]


# (text that opens the block, text that closes it) — used by --write.
BLOCK_BOUNDS = [
    ('// Kubernetes version compatibility matrix.', '\n};'),
    ('// Supported Redis Enterprise operator versions', '\n];'),
    ('// Per-operator-version Kubernetes/OpenShift compatibility.', '\n};'),
]


def write_blocks(blocks):
    """Replace the three constants in upgrade-data.js. All-or-nothing."""
    src = DATA_FILE.read_text()
    for (opener, closer), text in zip(BLOCK_BOUNDS, blocks):
        start = src.find(opener)
        if start < 0:
            raise PageError('could not find "%s" in %s' % (opener, DATA_FILE.name))
        end = src.find(closer, start)
        if end < 0:
            raise PageError('could not find the end of the block opened by "%s"' % opener)
        src = src[:start] + text + src[end + len(closer):]
    DATA_FILE.write_text(src)


def main():
    try:
        order, result = parse(fetch())
        blocks = build_blocks(order, result)
        if '--write' in sys.argv[1:]:
            write_blocks(blocks)
            sys.stderr.write('updated %s: %d operators, newest %s\n'
                             % (DATA_FILE.name, len(order), order[0]))
        else:
            print('\n\n'.join(blocks))
    except PageError as err:
        sys.stderr.write('error: %s\n' % err)
        sys.exit(1)


if __name__ == '__main__':
    main()
