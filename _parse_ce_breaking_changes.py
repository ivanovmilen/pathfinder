#!/usr/bin/env python3
"""Parse Redis Community Edition breaking changes from redis.io and emit JS.

Fetches the markdown alternate of each "What's new in Redis X.Y" page and
extracts the breaking-changes section, emitting one constant that mirrors the
ones in upgrade-data.js:

- DATABASE_BREAKING_CHANGES — database version family → { source, label,
                              dataAvailable, items }, where items is a list of
                              { area, notes } grouped by the release note's
                              own sub-headings.

The page headings are inconsistent across releases:
- 7.2 uses "### Breaking changes" (a single prose paragraph)
- 7.4 uses "### Behavior changes" (prose)
- 8.0 uses "### Breaking changes" with "#### " sub-areas (ACL, Search, ...)
- 8.2 / 8.4 have no breaking/behavior section at all

So we match any heading whose text starts with "breaking"/"behavior changes"/
"backward", capture until the next same-or-higher heading, and treat deeper
headings inside that block as "area" labels. Crucially, a family whose page
has no such section is emitted with dataAvailable=false so the app can say
"no breaking-change data for this range" instead of falsely implying the jump
is clean. Families with no page at all (6.0, 6.2 predate these pages) are
listed in NO_PAGE_FAMILIES and emitted the same way.

Run:  ./_parse_ce_breaking_changes.py
Or:   curl ... | ./_parse_ce_breaking_changes.py   (single page on stdin)
"""
import re
import subprocess
import sys


# Database version family → whats-new page slug, oldest → newest. Families not
# listed here (6.0, 6.2) predate the whats-new pages; see NO_PAGE_FAMILIES.
FAMILY_SLUGS = {
    '7.2': '7-2',
    '7.4': '7-4',
    '8.0': '8-0',
    '8.2': '8-2',
    '8.4': '8-4',
}

# Families the app models but which have no whats-new page to scrape. Emitted
# with dataAvailable=false so the report never implies a clean jump by omission.
NO_PAGE_FAMILIES = ['6.0', '6.2']

DOC_URL_TEMPLATE = 'https://redis.io/docs/latest/develop/whats-new/{slug}/'
MD_URL_TEMPLATE = DOC_URL_TEMPLATE + 'index.html.md'

# A heading (h2-h4) that opens the breaking-changes block.
BREAKING_HEADING = re.compile(
    r'^(#{2,4})\s+(breaking changes|behavior changes|backward.incompat.*)$',
    re.IGNORECASE,
)
HEADING = re.compile(r'^(#{1,6})\s+(.*)$')
# Markdown emphasis/list markers stripped from captured note text.
LIST_MARKER = re.compile(r'^\s*[-*]\s+')


def read_stdin():
    """Return piped markdown, or '' when nothing was piped.

    Reads stdin only when it isn't a TTY *and* actually carries data — a bare
    non-interactive shell (stdin on /dev/null) must fall through to curl, not
    be mistaken for a single piped page.
    """
    if sys.stdin.isatty():
        return ''
    data = sys.stdin.read()
    return data if data.strip() else ''


def fetch(slug):
    """Fetch the markdown for one page over curl."""
    url = MD_URL_TEMPLATE.format(slug=slug)
    result = subprocess.run(['curl', '-sL', url], capture_output=True, text=True)
    return result.stdout


def strip_metadata(md):
    """Drop the leading ```json metadata block the docs prepend to every page."""
    return re.sub(r'```json metadata.*?```', '', md, count=1, flags=re.DOTALL)


def parse_page(md):
    """Return (found, label, items) for one page.

    found  — whether a breaking/behavior section heading was located
    label  — the exact heading text used ("Breaking changes" / "Behavior changes")
    items  — list of {'area': str|None, 'notes': [str, ...]} in document order
    """
    lines = strip_metadata(md).splitlines()

    # Locate the opening heading and its level.
    start = None
    open_level = None
    label = None
    for i, line in enumerate(lines):
        m = BREAKING_HEADING.match(line.strip())
        if m:
            start = i + 1
            open_level = len(m.group(1))
            label = m.group(2).strip().rstrip(':')
            # Normalise casing to Title-case first word for a tidy label.
            label = label[:1].upper() + label[1:]
            break
    if start is None:
        return False, None, []

    items = []
    current = {'area': None, 'notes': []}

    def flush():
        if current['area'] is not None or current['notes']:
            items.append({'area': current['area'], 'notes': list(current['notes'])})

    for line in lines[start:]:
        stripped = line.strip()
        h = HEADING.match(stripped)
        if h:
            level = len(h.group(1))
            if level <= open_level:
                break  # next same-or-higher section ends the block
            # Deeper heading → a new area sub-section.
            flush()
            current = {'area': h.group(2).strip(), 'notes': []}
            continue
        if not stripped:
            continue
        current['notes'].append(LIST_MARKER.sub('', stripped))

    flush()
    return True, label, items


def js_string(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def emit(records):
    print('// Redis Community Edition breaking changes by database version family.')
    print('// Source: https://redis.io/docs/latest/develop/whats-new/<version>/')
    print('// dataAvailable=false means no breaking-change section was published for')
    print('// that family (or the family predates the whats-new pages) — the app must')
    print('// say "no data for this range" rather than imply the jump is clean.')
    print('// Regenerate with: ./_parse_ce_breaking_changes.py')
    print('export const DATABASE_BREAKING_CHANGES = {')
    for family, rec in records.items():
        print(f"  '{family}': {{")
        print(f"    source: {js_string(rec['source'])},")
        label = js_string(rec['label']) if rec['label'] else 'null'
        print(f"    label: {label},")
        print(f"    dataAvailable: {'true' if rec['dataAvailable'] else 'false'},")
        if not rec['items']:
            print('    items: [],')
        else:
            print('    items: [')
            for item in rec['items']:
                area = js_string(item['area']) if item['area'] else 'null'
                notes = ', '.join(js_string(n) for n in item['notes'])
                print(f"      {{ area: {area}, notes: [{notes}] }},")
            print('    ],')
        print('  },')
    print('};')


def main():
    records = {}

    for family in NO_PAGE_FAMILIES:
        records[family] = {
            'source': 'https://redis.io/docs/latest/develop/get-started/',
            'label': None,
            'dataAvailable': False,
            'items': [],
        }

    piped = read_stdin()
    for family, slug in FAMILY_SLUGS.items():
        md = piped or fetch(slug)
        found, label, items = parse_page(md)
        records[family] = {
            'source': DOC_URL_TEMPLATE.format(slug=slug) + '#breaking-changes',
            'label': label,
            'dataAvailable': found,
            'items': items,
        }
        if piped:
            break  # single page on stdin — only one family makes sense

    # Emit oldest → newest for readability.
    order = NO_PAGE_FAMILIES + list(FAMILY_SLUGS.keys())
    ordered = {f: records[f] for f in order if f in records}
    emit(ordered)


if __name__ == '__main__':
    main()
