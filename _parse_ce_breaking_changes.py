#!/usr/bin/env python3
"""Parse Redis database breaking changes from redis.io and emit JS.

Fetches the markdown alternate of the official redis.io pages and extracts the
breaking-changes section, emitting one constant that mirrors the ones in
upgrade-data.js. Where Redis Software's own release notes carry a dedicated
"Redis database version ... breaking changes" section (7.2, 7.4, 8.0) that is
the source: it is the list written for Redis Software users and is more
complete than the open-source "What's new" summary (see RS_SECTIONS). The other
families come from their "What's new in Redis X.Y" page:

- DATABASE_BREAKING_CHANGES — database version family → { source, label,
                              dataAvailable, items }, where items is a list of
                              { area, notes } grouped by the release note's
                              own sub-headings.

The "What's new" headings are inconsistent across releases ("Breaking changes"
for 7.2 and 8.0, "Behavior changes" for 7.4, and no such section at all for
8.2 / 8.4 / 8.6 / 8.8), so we match any heading whose text starts with
"breaking"/"behavior changes"/"backward", capture until the next same-or-higher
heading, and treat deeper headings inside that block as "area" labels. Crucially, a family whose page
has no such section is emitted with dataAvailable=false so the app can say
"no breaking-change data for this range" instead of falsely implying the jump
is clean. Families with no page at all (6.0, 6.2 predate these pages) are
listed in NO_PAGE_FAMILIES and emitted the same way.

Run:  ./_parse_ce_breaking_changes.py
Or:   curl ... | ./_parse_ce_breaking_changes.py -   (single page on stdin)
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
    '8.6': '8-6',
    '8.8': '8-8',
}

# Families the app models but which have no whats-new page to scrape. Emitted
# with dataAvailable=false so the report never implies a clean jump by omission.
NO_PAGE_FAMILIES = ['6.0', '6.2']

DOC_URL_TEMPLATE = 'https://redis.io/docs/latest/develop/whats-new/{slug}/'
MD_URL_TEMPLATE = DOC_URL_TEMPLATE + 'index.html.md'

# Families whose breaking changes Redis Software's release notes list under a
# dedicated heading, which is used instead of the "What's new" page:
#   page       release-notes page that holds the section (its doc URL)
#   heading    regex for the section heading
#   area_level heading level (number of #) of the sub-headings that name the areas;
#              text before the first one is the section's boilerplate intro
#   anchor     the section's anchor, used for the link shown in the app
RS_NOTES = 'https://redis.io/docs/latest/operate/rs/release-notes/'
RS_SECTIONS = {
    '7.2': {
        'page': RS_NOTES + 'rs-7-2-4-releases/rs-7-2-4-52/',
        'heading': r'Redis 7\.2 breaking changes',
        'area_level': 5,
        'anchor': 'redis-72-breaking-changes',
    },
    '7.4': {
        'page': RS_NOTES + 'rs-7-8-releases/',
        'heading': r'Redis database version 7\.4 breaking changes',
        'area_level': 5,
        'anchor': 'redis-74-breaking-changes',
    },
    '8.0': {
        'page': RS_NOTES + 'rs-8-0-releases/',
        'heading': r'Redis database version 8 breaking changes',
        'area_level': 4,
        'anchor': 'redis-8-breaking-changes',
    },
}

# A heading (h2-h4) that opens the breaking-changes block.
BREAKING_HEADING = re.compile(
    r'^(#{2,4})\s+(breaking changes|behavior changes|backward.incompat.*)$',
    re.IGNORECASE,
)
HEADING = re.compile(r'^(#{1,6})\s+(.*)$')
# Markdown emphasis/list markers stripped from captured note text.
LIST_MARKER = re.compile(r'^\s*[-*]\s+')


def read_stdin():
    """Return piped markdown when `-`/`--stdin` is passed, else ''.

    stdin is opt-in. Auto-reading it whenever it isn't a TTY blocks forever when
    stdin is an open pipe with no writer (CI runners, cron, agent shells), because
    read() waits for an EOF that never comes. Requiring an explicit `-`/`--stdin`
    keeps a bare `./_parse_ce_breaking_changes.py` non-blocking and defaulting to
    curl.
    """
    if '-' in sys.argv[1:] or '--stdin' in sys.argv[1:]:
        return sys.stdin.read()
    return ''


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


def fetch_checked(url):
    """Fetch a page, failing loudly: a moved page must not read as "no data"."""
    result = subprocess.run(['curl', '-fsSL', '--max-time', '30', url],
                            capture_output=True, text=True)
    if result.returncode != 0 or not result.stdout.strip():
        sys.exit(f'could not fetch {url} (curl exit {result.returncode})')
    return result.stdout


FENCE = re.compile(r'^\s*(```|~~~)')
BULLET = re.compile(r'^(\s*)[-*]\s+(.*)$')
# A pull-request reference such as "[#10651](https://github.com/redis/redis/pull/10651)".
# This tool serves Redis Software users, so the GitHub references are dropped.
PR_LINK = re.compile(r'\s*\[#\d+\]\(https?://github\.com/[^)\s]*\)')
LINK = re.compile(r'\[([^\[\]]+)\]\(([^)\s]*)(\)?)')
CODE_SPAN = re.compile(r'(`[^`]*`)')


def keep_redis_link(match):
    """Keep well-formed redis.io links; reduce anything else to its text.

    The release notes contain a few malformed links (a missing closing
    parenthesis), which would otherwise render as broken anchors.
    """
    text, url, closed = match.groups()
    if closed and url.startswith('https://redis.io/') and not url.endswith(','):
        return match.group(0)
    # A missing ")" lets the comma that followed the link fall into the URL.
    return text + (',' if url.endswith(',') else '')


def outside_code(text, fix):
    """Apply `fix` to the parts of `text` that are not inline code."""
    return ''.join(part if part.startswith('`') else fix(part)
                   for part in CODE_SPAN.split(text))


def drop_unbalanced_parens(text):
    depth = 0
    out = []
    for char in text:
        if char == '(':
            depth += 1
        elif char == ')':
            if depth == 0:
                continue
            depth -= 1
        out.append(char)
    return ''.join(out)


def tidy(text):
    """Remove GitHub PR references and the punctuation they leave behind."""
    text = PR_LINK.sub('', text)
    text = LINK.sub(keep_redis_link, text)
    text = outside_code(text, lambda part: re.sub(r'\(\s*(?:,\s*)*\)', '', part))
    text = drop_unbalanced_parens(text)
    text = outside_code(text, lambda part: re.sub(r'\s+([:;,.])', r'\1', part))
    text = outside_code(text, lambda part: re.sub(r',\s*([:;.])', r'\1', part))
    # Source typos such as "` nondeterministic_output_order`" (space inside the code span).
    text = CODE_SPAN.sub(lambda m: '`' + m.group(1)[1:-1].strip() + '`' if m.group(1)[1:-1].strip() else m.group(1), text)
    return re.sub(r'\s{2,}', ' ', text).strip()


def merge_bullet(head, subs):
    """Fold a bullet's nested bullets into one note (notes render one level deep)."""
    head = head.rstrip()
    if not subs:
        return head
    if head.endswith(('.', '!', '?')):
        return head + ' ' + ' '.join(s if s.endswith(('.', '!', '?')) else s + '.' for s in subs)
    return head.rstrip(' :-\u2013\u2014;,') + ': ' + '; '.join(s.rstrip('.') for s in subs) + '.'


def area_notes(elements):
    """Turn one area's lines into the app's notes: one string per top-level bullet.

    Code samples are dropped, together with the "...examples show:" line that
    introduces them, and nested bullets are folded into their parent.
    """
    kept = []
    for kind, indent, text in elements:
        if kind == 'code':
            while kept and kept[-1][2].rstrip().endswith(':'):
                kept.pop()
            continue
        text = tidy(text)
        if text:
            kept.append((kind, indent, text))

    notes = []
    head, subs = None, []

    def flush():
        if head is not None:
            notes.append(merge_bullet(head, subs))

    for kind, indent, text in kept:
        if kind == 'bullet' and indent == 0:
            flush()
            head, subs = text, []
        elif kind == 'bullet':  # nested bullet
            if head is None:
                head, subs = text, []
            else:
                subs.append(text)
        elif indent > 0:  # indented line continuing the previous bullet
            if subs:
                subs[-1] += ' ' + text
            elif head is not None:
                head += ' ' + text
            else:
                head, subs = text, []
        else:
            flush()
            head, subs = None, []
            notes.append(text)
    flush()
    return [n for n in notes if n]


def parse_rs_section(md, heading, area_level):
    """Return the items of a Redis Software release-notes breaking-changes section.

    Returns None when the section heading is missing. `area_level` headings name
    the areas; text before the first one is boilerplate and is skipped, and a
    shallower heading after the areas begin ends the section.
    """
    lines = strip_metadata(md).splitlines()
    opener = re.compile(r'^(#{2,5})\s+' + heading + r'\b', re.IGNORECASE)
    start = open_level = None
    for i, line in enumerate(lines):
        m = opener.match(line.strip())
        if m:
            start, open_level = i + 1, len(m.group(1))
            break
    if start is None:
        return None

    areas = []  # [(name, elements)]
    in_fence = False
    for line in lines[start:]:
        if FENCE.match(line):
            in_fence = not in_fence
            if areas:
                areas[-1][1].append(('code', 0, ''))
            continue
        if in_fence:
            continue
        stripped = line.strip()
        h = HEADING.match(stripped)
        if h:
            level = len(h.group(1))
            if level <= open_level or (areas and level < area_level):
                break
            if level == area_level:
                areas.append((h.group(2).strip(), []))
            continue
        if not areas or not stripped:
            continue
        bullet = BULLET.match(line)
        if bullet:
            areas[-1][1].append(('bullet', len(bullet.group(1)), bullet.group(2).strip()))
        else:
            areas[-1][1].append(('text', len(line) - len(line.lstrip()), stripped))

    return [{'area': name, 'notes': notes}
            for name, elements in areas
            for notes in [area_notes(elements)] if notes]


# Redis's own notes sometimes send readers to the open-source GitHub releases page.
# This tool serves Redis Software users, so those links are repointed at the
# redis.io page the note came from instead.
GITHUB_RELEASES = re.compile(r'https://github\.com/redis/redis/releases[^\s)]*')


def point_links_at_docs(items, source):
    return [
        {'area': item['area'], 'notes': [GITHUB_RELEASES.sub(source, n) for n in item['notes']]}
        for item in items
    ]


def js_string(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def emit(records):
    print('// Redis breaking changes by database version family.')
    print('// Sources: the "Redis database version ... breaking changes" sections of the Redis')
    print('// Software release notes (7.2, 7.4, 8.0), and the "What\'s new" pages at')
    print('// https://redis.io/docs/latest/develop/whats-new/<version>/ for the other families.')
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
        if family in RS_SECTIONS and not piped:
            spec = RS_SECTIONS[family]
            items = parse_rs_section(fetch_checked(spec['page'] + 'index.html.md'),
                                     spec['heading'], spec['area_level'])
            if not items:
                sys.exit(f"no breaking-changes section for {family} on {spec['page']}"
                         ' - page layout changed?')
            records[family] = {
                'source': f"{spec['page']}#{spec['anchor']}",
                'label': 'Breaking changes',
                'dataAvailable': True,
                'items': items,
            }
            continue
        md = piped or fetch(slug)
        found, label, items = parse_page(md)
        source = DOC_URL_TEMPLATE.format(slug=slug) + '#breaking-changes'
        records[family] = {
            'source': source,
            'label': label,
            'dataAvailable': found,
            'items': point_links_at_docs(items, source),
        }
        if piped:
            break  # single page on stdin — only one family makes sense

    # Emit oldest → newest for readability.
    order = NO_PAGE_FAMILIES + list(FAMILY_SLUGS.keys())
    ordered = {f: records[f] for f in order if f in records}
    emit(ordered)


if __name__ == '__main__':
    main()
