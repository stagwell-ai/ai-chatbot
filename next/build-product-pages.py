#!/usr/bin/env python3
"""
build-product-pages.py — the four product landing pages, generated.

Writes next/{slug}.html for each product in PRODUCTS, built from the
homepage's own parts (next/index.html: the head, the logo symbol, the bar,
the phone menu, the hero chat, the footer) plus the content below, and keeps
the "Products" dropdown in the homepage bar in step with the list.

Run from anywhere:   python3 next/build-product-pages.py

Edit the CONTENT here and re-run; never hand-edit the generated HTML, the next
run overwrites it. Styles live in next/product.css, the dropdown's behaviour
in next/navdrop.js.

Content source: "Stagwell AI — Four Ad Landing Page Definitions" (Stagwell,
2026-09-10; mats/from stagwell/products/). The titles and descriptions are the
document's own. The "more information" bullets are written there as notes to
the designer ("Position The Machine as…", "Show…"), so they are set here as
plain statements of the same facts, with nothing added. Every proof figure is
one the document marks "subject to approval" — the page flags them as
candidates until the product owners sign them off.
"""
import html
import pathlib
import re

NEXT = pathlib.Path(__file__).resolve().parent
ROOT = NEXT.parent

# ── the content ─────────────────────────────────────────────────────────────
# Order = the definitions document's own: The Machine, The Targeting Machine,
# New Voices, Agent Cloud. It is also the order of the dropdown.
PRODUCTS = [
    dict(
        slug='the-machine', name='The Machine',
        kind='Enterprise agentic marketing operating system',
        logo='<img class="pp-logo pp-logo--screen" src="/assets/img/companies/the-machine/logo-wide.png" alt="The Machine" width="570" height="100">',
        title='Turn your marketing stack into an intelligent system.',
        description="The Machine is Stagwell's agentic operating system for marketing. It connects people, tools, data, and institutional knowledge across strategy, creative, production, and media - improving the systems teams already use rather than forcing a rip-and-replace.",
        url='https://machine.live/',
        image=('/assets/img/companies/the-machine/hero.jpg', 1600, 900),
        sections=[
            ('Works with your existing stack', 'An intelligence and orchestration layer that plugs into the tools and processes you already have.'),
            ('Unifies the marketing workflow', 'Strategy, creative, production, media and performance work from shared context instead of disconnected handoffs.'),
            ('AI agents execute repeatable work', 'Competitive monitoring, brief generation, asset versioning, brand-compliance review and performance optimization.'),
            ('Gets smarter over time', 'Every brief, asset, campaign and result feeds a shared intelligence layer, so the next cycle is faster and better informed.'),
            ('Built for enterprise outcomes', 'Faster time to market, less duplicated martech spend, less manual coordination, more content at scale and tighter performance feedback loops.'),
        ],
        proof_kind='figs',
        proof=[('20–40%', 'reduction in martech stack redundancy'),
               ('~50%', 'savings in strategy and insights workflows'),
               ('~30%', 'savings in creative production cost'),
               ('10x', 'content volume without proportional headcount growth')],
        proof_note='Presented by Stagwell as estimates and targets based on early integrations.',
    ),
    dict(
        slug='targeting-machine', name='The Targeting Machine',
        kind='Privacy-first audience intelligence and activation',
        # the file shipped as its "logo.svg" is an architecture diagram, not a mark:
        # the name is set in type until the official logo arrives
        logo='<span class="pp-logo pp-logo--type">The Targeting Machine</span>',
        title='Turn fragmented data into audiences you can activate.',
        description="The Targeting Machine is an enterprise-grade, privacy-first audience intelligence platform that combines first-party data, third-party media data, Stagwell's proprietary consumer intelligence, and the Stagwell ID Graph to move from deeper audience understanding to activation.",
        url='https://www.themarketingcloud.com/marketplace/sats',
        image=('/assets/img/companies/targeting-machine/ui-1.jpg', 1100, 692),
        sections=[
            ('Build high-intent audiences', 'Stagwell proprietary datasets and your first-party data identify audiences by both behavior and attitudes.'),
            ('Scale seed segments', 'Tightly defined segments expand into high-fidelity lookalike audiences.'),
            ('Activate without manual handoffs', 'Audience intelligence moves straight into activation platforms, accelerating multi-channel campaign launches.'),
            ('Optimize in real time', 'Secure AI and real-time monitoring show how campaigns perform and refine targeting across channels.'),
            ('Built for governed enterprise data', 'Conversational querying, differential privacy, Stagwell ID Graph connectivity and infrastructure powered by Palantir Foundry.'),
        ],
        proof_kind='figs',
        proof=[('260M', 'U.S. consumers covered by the Stagwell ID Graph'),
               ('123M', 'U.S. households covered by the Stagwell ID Graph')],
        proof_note="Secure activation, with patented differential-privacy technology from Harvard's OpenDP project.",
    ),
    dict(
        slug='newvoices', name='New Voices',
        kind='AI voice insight campaigns',
        logo='<img class="pp-logo" src="/assets/img/companies/newvoices/logo-white.png" alt="New Voices" width="2560" height="441">',
        title='Hear why your customers act - at scale.',
        description='New Voices uses AI voice agents to interview real customers at scale, capturing the nuance, emotion, language, and context that written surveys and behavioral data often miss - then converting those conversations into decision-ready market intelligence.',
        url='https://newvoices.ai/',
        image=('/assets/img/newvoices.jpg', 1400, 1680),
        sections=[
            ('Start with a business decision', 'Each campaign is framed around the decision you need to make; the questions, audience segments and interview flow are designed around it.'),
            ('Natural AI voice interviews', 'Scalable conversations that give respondents room to explain in their own words.'),
            ('Conversations become structured insight', 'Recurring themes, emotional drivers, objections, unmet needs and the actual language customers use.'),
            ('Outputs teams can act on', 'Executive summaries, sentiment analysis, key themes, quote libraries, segment differences, message testing, competitive perception, journey friction and recommendations.'),
            ('Across the customer lifecycle', 'Product development, brand positioning, campaign optimization, customer experience and competitive intelligence.'),
        ],
        proof_kind='figs',
        proof=[('10x', 'more meaningful insight than written surveys'),
               ('50x', 'more insight-rich context than behavioral data alone')],
        proof_note='Based on real conversations, transformed into structured intelligence.',
    ),
    dict(
        slug='agent-cloud', name='Agent Cloud',
        kind='Secure AI workspace and marketing agent toolkit',
        # only the "A" mark ships as a file; the name is set beside it in type
        logo='<span class="pp-logo pp-logo--mark"><img src="/assets/img/companies/agent-cloud/logo.svg" alt="" width="40" height="40">Agent Cloud</span>',
        title='Give your marketing team one secure place to use the best AI.',
        description='Agent Cloud is a secure AI workspace for marketers that brings leading LLMs, pre-built marketing assistants, and build-your-own agent capabilities into one governed environment - reducing tool sprawl while making advanced AI easier to use across the organization.',
        url='https://www.themarketingcloud.com/marketplace/agent-cloud',
        image=('/assets/img/companies/agent-cloud/ui-2.jpg', 1100, 692),
        sections=[
            ('Leading AI models in one place', 'Enterprise access to the major multimodal models, so teams choose the best model for each task without separate subscriptions.'),
            ('Purpose-built marketing agents', 'Research, brand audits, creative briefs, image and video generation, social listening and search discoverability.'),
            ('Build custom assistants', 'Describe the workflow, create an agent, add tools or instructions, and share it across the organization.'),
            ('Governed AI use', 'Enterprise-grade security and organizational controls. Proprietary and client data is not used to train the underlying models.'),
            ('Consolidated AI operations', 'Less shadow AI, tool sprawl and fragmented billing, and a repeatable, shareable way to use AI in daily marketing work.'),
        ],
        proof_kind='words',
        proof=[('Leading models', 'Enterprise-grade access to the leading AI models'),
               ('Custom agents', 'Created by teams and shared across the organization'),
               ('Central governance', 'Organizational controls over how AI is used')],
        proof_note='[TESTIMONIALS — agency leaders using Agent Cloud; to come from the product owner, pending approval]',
    ),
]

# ── helpers ─────────────────────────────────────────────────────────────────
def t(s):
    """Escape copy for HTML, and set the document's spaced hyphen as a spaced
    en dash — the Word source types ' - ' where the sentence means a dash."""
    return html.escape(s.replace(' - ', ' – '), quote=False)

def a(s):
    return html.escape(s, quote=True)

def must(s, needle, count=1):
    n = s.count(needle)
    assert n == count, f'expected {count}x {needle[:70]!r}, found {n}'

def between(s, start, end_after, from_=0):
    i = s.index(start, from_)
    j = s.index(end_after, i) + len(end_after)
    return i, j

# ── the dropdown (bar) and the list under "Products" (phone menu) ───────────
def nav_block(current=None):
    rows = []
    for p in PRODUCTS:
        cur = ' aria-current="page"' if p['slug'] == current else ''
        rows.append(f'            <li><a class="nav__pitem" href="/next/{p["slug"]}"{cur}>'
                    f'<span class="nav__pname">{t(p["name"])}</span><span class="nav__pdesc">{t(p["kind"])}</span></a></li>')
    return ('      <!-- products:nav — a temporary dropdown to the product pages, generated by\n'
            '           build-product-pages.py (behaviour: navdrop.js; styles: end of home.css) -->\n'
            '      <li class="nav__drop">\n'
            '        <button type="button" class="nav__droptrig" aria-expanded="false" aria-controls="navDrop">Products<svg class="nav__chev" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n'
            '        <div class="nav__panel" id="navDrop">\n'
            '          <ul class="nav__plist">\n' + '\n'.join(rows) + '\n'
            '          </ul>\n'
            '          <a class="nav__pall" href="/next/products">All products</a>\n'
            '        </div>\n'
            '      </li>\n'
            '      <!-- /products:nav -->')

def menu_block(current=None):
    rows = []
    for p in PRODUCTS:
        cur = ' aria-current="page"' if p['slug'] == current else ''
        rows.append(f'          <li><a href="/next/{p["slug"]}"{cur}>{t(p["name"])}</a></li>')
    return ('      <!-- products:menu -->\n'
            '      <li><a href="/next/products">Products</a>\n'
            '        <ul class="menu__sub">\n' + '\n'.join(rows) + '\n        </ul>\n      </li>\n'
            '      <!-- /products:menu -->')

def put_blocks(s, current=None):
    """Replace the dropdown and the menu list — by their markers once they
    have them, otherwise by the hand-written markup the first version used."""
    if '<!-- products:nav' in s:
        i, j = between(s, '      <!-- products:nav', '<!-- /products:nav -->')
    else:
        i, j = between(s, '      <!-- Products: a temporary dropdown', '\n      </li>')
    s = s[:i] + nav_block(current) + s[j:]
    if '<!-- products:menu -->' in s:
        i, j = between(s, '      <!-- products:menu -->', '<!-- /products:menu -->')
    else:
        i, j = between(s, '      <li><a href="/next/products">Products</a>\n        <ul class="menu__sub">', '\n      </li>')
    return s[:i] + menu_block(current) + s[j:]

# ── one page ────────────────────────────────────────────────────────────────
VIDEO_JS = '''<script>
/* the film: poster and a play disc until it is asked for; controls once it plays; back to
   the poster when it ends */
(function () {
  const f = document.querySelector('.pp-film'); if (!f) return;
  const v = f.querySelector('video'), b = f.querySelector('.pp-film__play'); if (!v || !b) return;
  b.addEventListener('click', () => { v.controls = true; const p = v.play(); if (p && p.catch) p.catch(() => {}); });
  v.addEventListener('play', () => f.classList.add('is-playing'));
  v.addEventListener('ended', () => { f.classList.remove('is-playing'); v.controls = false; v.load(); });
})();
</script>'''

def page(p, home):
    slug, name = p['slug'], p['name']

    head = home[:home.index('</head>')]
    for old, new in [
        ('<title>Ask Stagwell</title>', f'<title>{t(name)} | Stagwell AI</title>'),
        ('<meta name="description" content="Whatever the challenge, we deliver results">', f'<meta name="description" content="{a(p["title"])}">'),
        ('<link rel="canonical" href="https://stagwell.vercel.app/next">', f'<link rel="canonical" href="https://stagwell.vercel.app/next/{slug}">'),
        ('<meta property="og:title" content="Ask Stagwell">', f'<meta property="og:title" content="{a(name)} | Stagwell AI">'),
        ('<meta property="og:description" content="Whatever the challenge, we deliver results">', f'<meta property="og:description" content="{a(p["title"])}">'),
        ('<meta property="og:url" content="https://stagwell.vercel.app/next">', f'<meta property="og:url" content="https://stagwell.vercel.app/next/{slug}">'),
        ('<link rel="stylesheet" href="/next/home.css">', '<link rel="stylesheet" href="/next/home.css">\n<link rel="stylesheet" href="/next/product.css">'),
    ]:
        must(head, old); head = head.replace(old, new)

    i = home.index('<svg width="0"'); symbol = home[i:home.index('</svg>', i) + 6]

    i = home.index('<header class="nav" id="nav">'); j = home.index('<!-- the chat, full screen over the page')
    chrome = put_blocks(home[i:j].rstrip(), current=slug)
    # no chat overlay on these pages: the magnifiers jump to the page's own chat at the foot
    chrome, n = re.subn(r'<button type="button" class="nav__search" id="navSearch"[^>]*>(.*?)</button>',
                        r'<a class="nav__search" href="#ask" aria-label="Ask Stagwell">\1</a>', chrome, flags=re.S)
    assert n == 1, 'nav search'
    chrome, n = re.subn(r'<button type="button" class="menu__search" id="menuSearch"[^>]*>(.*?)</button>',
                        r'<a class="menu__search" href="#ask">\1</a>', chrome, flags=re.S)
    assert n == 1, 'menu search'

    # the homepage's chat, as it is: the box, the thinking canvas, the six pills
    i = home.index('    <div class="chat">'); k = home.index('id="agentTags"', i)
    chat = home[i:home.index('</ul>', k) + 5]

    i = home.index('<footer class="foot">'); footer = home[i:home.index('</footer>') + 9]

    src, w, h = p['image']
    steps = '\n'.join(
        f'        <li class="rv" style="--d:{0.06 * n:.2f}s"><b>{n + 1:02d}</b><div><h3>{t(hd)}</h3><p>{t(tx)}</p></div></li>'
        for n, (hd, tx) in enumerate(p['sections']))
    figs = '\n'.join(f'      <li><strong>{t(big)}</strong><span>{t(line)}</span></li>' for big, line in p['proof'])
    words = p['proof_kind'] == 'words'
    flag = 'Candidate proof · pending approval' if words else 'Candidate figures · pending approval'

    body = f'''
<!-- Generated by next/build-product-pages.py — edit the content there, not here. -->
<main id="top">

<section class="pp-hero">
  <div class="pp-wrap pp-hero__in">
    {p['logo']}
    <p class="pp-eyebrow">{t(p['kind'])}</p>
    <h1 class="pp-title">{t(p['title'])}</h1>
    <p class="pp-lede">{t(p['description'])}</p>
    <div class="pp-acts">
      <button type="button" class="btn btn--accent btn--lg" data-cta="session" data-where="hero">Book a demo</button>
      <a class="pp-site" href="{a(p['url'])}" target="_blank" rel="noopener" data-product-site>Visit {t(name)} website<svg class="pp-site__ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 11 11 5M6.5 5H11v4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
    </div>
  </div>
</section>

<section class="pp-film" aria-label="The {a(name)} film">
  <div class="pp-film__frame">
    <video preload="none" playsinline poster="/assets/video/{slug}-poster.jpg" aria-label="{a(name)}, a 15-second film">
      <source src="/assets/video/{slug}-15s.mp4" type="video/mp4">
    </video>
    <button type="button" class="pp-film__play" aria-label="Play the film"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></button>
  </div>
</section>

<section class="pp-more">
  <div class="pp-wrap">
    <div class="pp-more__head">
      <p class="pp-sign rv">How it works</p>
      <h2 class="pp-h2 rv" style="--d:.1s">What <span>{t(name)}</span> does</h2>
    </div>
    <div class="pp-more__grid">
      <div class="pp-more__media"><img src="{src}" alt="" width="{w}" height="{h}" loading="lazy" decoding="async"></div>
      <ol class="pp-steps">
{steps}
      </ol>
    </div>
    <p class="pp-mid"><button type="button" class="btn btn--ink btn--lg" data-cta="session" data-where="mid">Book a demo</button></p>
  </div>
</section>

<section class="pp-proof">
  <div class="pp-wrap">
    <div class="pp-proof__head"><p class="pp-sign">Proof</p><span class="pp-flag">{flag}</span></div>
    <ul class="pp-figs{' pp-figs--words' if words else ''}">
{figs}
    </ul>
    <p class="pp-proof__note">{t(p['proof_note'])}</p>
  </div>
</section>

<!-- the close: the homepage's own chat (home.js draws it, hero-agent.js runs the
     conversation), then Book a demo once more -->
<section class="pp-close">
  <div class="hero__in pp-ask" id="ask">
    <h2 class="pp-close__h">How can we help?</h2>
    <p class="pp-close__lede">Whatever the challenge, we deliver results</p>
{chat}
    <p class="pp-close__demo"><button type="button" class="btn btn--accent btn--lg" data-cta="session" data-where="close">Book a demo</button></p>
  </div>
</section>

</main>
'''
    scripts = '\n'.join(f'<script src="/next/{f}"></script>' for f in
                        ['data-loader.js', 'engine.js', 'flow.js', 'research.js', 'lead.js', 'home.js', 'hero-agent.js', 'navdrop.js'])
    out = (head + '</head>\n'
           '<!-- data-lead-cta: the shared booking modal (lead.js) delegates every [data-cta] click -->\n'
           f'<body class="home pp pp--{slug}" data-lead-cta>\n\n' + symbol + '\n\n' + chrome + '\n' + body + '\n' +
           footer + '\n\n' + scripts + '\n' + VIDEO_JS + '\n</body>\n</html>\n')
    assert 'id="chatOver"' not in out and out.count('id="ask"') == 1 and out.count('id="agentForm"') == 1
    return out

# ── run ─────────────────────────────────────────────────────────────────────
def main():
    ix = NEXT / 'index.html'
    home = put_blocks(ix.read_text())
    must(home, '<script src="/next/navdrop.js"></script>')
    for p in PRODUCTS:
        for f in (f'assets/video/{p["slug"]}-15s.mp4', f'assets/video/{p["slug"]}-poster.jpg', p['image'][0].lstrip('/')):
            assert (ROOT / f).exists(), f'missing {f}'
    pages = {p['slug']: page(p, home) for p in PRODUCTS}
    ix.write_text(home)
    for slug, out in pages.items():
        (NEXT / f'{slug}.html').write_text(out)
        print(f'next/{slug}.html  {len(out):>6} bytes')
    print('next/index.html   dropdown updated')

if __name__ == '__main__':
    main()
