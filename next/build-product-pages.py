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
import json
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
        hero_bg='/assets/img/products/hero-the-machine.jpg',   # Julian's hero picture, 2026-09-10
        logo='<img class="pp-logo pp-logo--screen" src="/assets/img/companies/the-machine/logo-wide.png" alt="The Machine" width="570" height="100">',
        title='Turn your marketing stack into an intelligent system.',
        description="The Stagwell Machines is a family of agentic solutions for enterprise marketing organizations – each built for a specific job; all connected under one operating layer. Unlike point solutions that make individual tasks smarter, the Machines share context: every signal, decision, and result carries forward. The Machine is that operating layer: it sits on top of the tools teams already use – Slack, Figma, Adobe, analytics platforms and project systems – and connects them into one system with shared memory. Connected by design.",   # Stagwell AI Messaging FINAL, 2026-09-16
        # the line under the title, two lines at most (client); the definitions' own
        # description moves under the film, whole
        summary="Stagwell's agentic operating system for marketing, built on the tools you already use.",
        url='https://machine.live/',
        image=('/assets/img/products/the-machine.jpg', 1122, 1402),   # Julian's product image, 2026-09-10
        sections=[
            ('Works inside your existing workflows', 'Sits on top of Slack, Figma, Adobe, analytics platforms and project systems rather than replacing them – no rip and replace.'),
            ('One system of record', 'Insight, decision and result live in one place – strategy, creative, production, media and performance work from shared context instead of disconnected handoffs.'),
            ('AI agents execute repeatable work', 'Competitive monitoring, brief generation, asset versioning, brand-compliance review and performance optimization.'),
            ('Context persists rather than resets', 'Every brief, asset, campaign and result carries forward into shared memory, so the next cycle is faster and better informed – the result compounds.'),
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
        hero_bg='/assets/img/products/hero-targeting-machine.jpg',   # Julian's hero picture, 2026-09-10
        # built 2026-09-10 to sit beside The Machine's as one family (client): the
        # four-petal mark lifted from Julian's product image, in the brand's sky so
        # it reads on the blue hero, and "THE TARGETING MACHINE" in Roobert — the
        # face The Machine's logo is set in — at The Machine's own cap height, stem
        # weight, tracking and mark-to-word spacing, on the same 100-unit canvas, so
        # the same CSS height gives the same size. (The file shipped as its
        # "logo.svg" is an architecture diagram, not a mark.)
        # the mark takes the teal of the How it works image (client), not the sky it first had
        # on a phone the picture under the mark is mid-teal and the teal mark
        # vanished (1.2:1): phones get the sky lockup (3.6:1), desktops keep teal
        logo='<picture><source media="(max-width:820px)" srcset="/assets/img/companies/targeting-machine/logo-lockup.png" width="963" height="100"><img class="pp-logo" src="/assets/img/companies/targeting-machine/logo-lockup-teal.png" alt="The Targeting Machine" width="963" height="100"></picture>',
        title='Turn fragmented data into audiences you can activate.',
        description="For the insights leader tired of guessing who to reach. First-party data is fragmented, and lookalike models are educated guesses – so The Targeting Machine connects fragmented first-party data with the Stagwell ID Graph and proprietary intelligence from BERA.ai, The Harris Poll and more, building audience profiles from real behavioral and attitudinal signals. One of the Stagwell Machines: connected by design.",   # Stagwell AI Messaging FINAL, 2026-09-16
        # the line under the title, two lines at most (client); the definitions' own
        # description moves under the film, whole
        summary='Privacy-first audience intelligence, from first-party data to activation.',
        url='https://www.themarketingcloud.com/marketplace/sats',
        image=('/assets/img/products/targeting-machine.jpg', 1122, 1402),   # Julian's product image, 2026-09-10
        sections=[
            ('Audiences built from people already exhibiting the behavior', "Real behavioral signals from your first-party data and the Stagwell ID Graph – not a model's educated guess."),
            ('Attitudinal and behavioral layering', 'Proprietary intelligence from BERA.ai, The Harris Poll and more, layered on what people actually do, to expand addressable reach.'),
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
        kind='AI voice agents and insight campaigns',
        hero_bg='/assets/img/products/hero-newvoices-2.jpg',   # Julian's "new voices hero 2", 2026-09-10 13:35 (new name: no stale cache)
        logo='<img class="pp-logo" src="/assets/img/companies/newvoices/logo-white.png" alt="New Voices" width="2560" height="441">',
        title='Hear why your customers act - at scale.',
        description='New Voices puts lifelike AI voice agents on your customer conversations, 24/7 and in any language. The same agents that qualify and book leads, resolve service and win back lapsing customers also interview customers at scale - capturing the nuance, emotion, language and context that written surveys and behavioral data miss, and converting it into decision-ready market intelligence.',
        # the line under the title, two lines at most (client); the definitions' own
        # description moves under the film, whole
        summary='AI voice agents that interview your customers at scale and turn it into insight.',
        url='https://newvoices.ai/',
        # Julian's product image (mats/from stagwell/product imaages/new voices.png, 2026-09-10)
        image=('/assets/img/products/newvoices.jpg', 1122, 1402),
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
        hero_bg='/assets/img/products/hero-agent-cloud.jpg',   # Julian's hero picture, 2026-09-10
        hero_tone='light',   # the picture is pale sky blue: ink type and a dark bar, not white on white
        # only the "A" mark ships as a file; the name is set beside it in type
        logo='<span class="pp-logo pp-logo--mark"><img src="/assets/img/companies/agent-cloud/logo.svg" alt="" width="40" height="40">Agent Cloud</span>',
        title='Give your marketing team one secure place to use the best AI.',
        description='Agent Cloud is a secure AI workspace for marketers that brings leading LLMs, pre-built marketing assistants, and build-your-own agent capabilities into one governed environment - reducing tool sprawl while making advanced AI easier to use across the organization.',
        # the line under the title, two lines at most (client); the definitions' own
        # description moves under the film, whole
        summary='A secure AI workspace for marketers: leading LLMs and marketing agents in one place.',
        url='https://www.themarketingcloud.com/marketplace/agent-cloud',
        image=('/assets/img/products/agent-cloud.jpg', 1122, 1402),   # Julian's product image, 2026-09-10
        sections=[
            ('Leading AI models in one place', 'Enterprise access to the major multimodal models, so teams choose the best model for each task without separate subscriptions.'),
            ('Purpose-built marketing agents', 'Research, brand audits, creative briefs, image and video generation, social listening and search discoverability.'),
            ('Build custom assistants', 'Describe the workflow, create an agent, add tools or instructions, and share it across the organization.'),
            ('Governed AI use', 'Enterprise-grade security and organizational controls. Proprietary and client data is not used to train the underlying models.'),
            ('Consolidated AI operations', 'Less shadow AI, tool sprawl and fragmented billing, and a repeatable, shareable way to use AI in daily marketing work.'),
        ],
        proof_kind='words',
        proof_title='Secure adoption, at scale',   # the document: "proof should focus on secure adoption and operational scale"
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


def chat_block(home):
    """The homepage chat box, the thinking canvas and the six pills — MINUS the
    hero's "Call my phone" widget. That widget belongs under the homepage hero;
    everywhere else this block lands in the closing section, which carries its
    own copy a few lines below, and two in one section is clutter."""
    i = home.index('    <div class="chat">'); k = home.index('id="agentTags"', i)
    chat = home[i:home.index('</ul>', k) + 5]
    j = chat.find('<div data-call="callHero"')
    if j != -1:
        j = chat.rindex('\n', 0, chat.rindex('<!--', 0, j))     # the comment above it goes too
        end = chat.index('\n', chat.index('</div>', j)) + 1
        chat = chat[:j + 1] + chat[end:]
    assert 'callHero' not in chat, 'the hero mount was not removed from the copied chat box'
    return chat


def between(s, start, end_after, from_=0):
    i = s.index(start, from_)
    j = s.index(end_after, i) + len(end_after)
    return i, j

# ── the dropdown (bar) and the list under "Products" (phone menu) ───────────
def nav_block(current=None):
    rows = []
    for p in PRODUCTS:
        cur = ' aria-current="page"' if p['slug'] == current else ''
        # the product's own image, cropped square, at the head of its row (client)
        rows.append(f'            <li><a class="nav__pitem" href="/{p["slug"]}"{cur}>'
                    f'<img class="nav__pthumb" src="/assets/img/products/thumb-{p["slug"]}.jpg" alt="" width="48" height="48" decoding="async">'
                    f'<span class="nav__ptext"><span class="nav__pname">{t(p["name"])}</span><span class="nav__pdesc">{t(p["kind"])}</span></span></a></li>')
    return ('      <!-- products:nav — a temporary dropdown to the product pages, generated by\n'
            '           build-product-pages.py (behaviour: navdrop.js; styles: end of home.css) -->\n'
            '      <li class="nav__drop">\n'
            '        <button type="button" class="nav__droptrig" aria-expanded="false" aria-controls="navDrop">Products<svg class="nav__chev" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n'
            '        <div class="nav__panel" id="navDrop">\n'
            '          <ul class="nav__plist">\n' + '\n'.join(rows) + '\n'
            '          </ul>\n'
            '          <a class="nav__pall" href="/products">View all products</a>\n'
            '        </div>\n'
            '      </li>\n'
            '      <!-- /products:nav -->')

def menu_block(current=None):
    rows = []
    for p in PRODUCTS:
        cur = ' aria-current="page"' if p['slug'] == current else ''
        # the same square picture and line as the bar's dropdown (client)
        rows.append(f'          <li><a href="/{p["slug"]}"{cur}>'
                    f'<img class="menu__thumb" src="/assets/img/products/thumb-{p["slug"]}.jpg" alt="" width="48" height="48" decoding="async" loading="lazy">'
                    f'<span class="menu__ptext"><span class="menu__pname">{t(p["name"])}</span><span class="menu__pdesc">{t(p["kind"])}</span></span></a></li>')
    # "Products" is the group's title, not a link (client: a link above four
    # links read as confusing); the way to the listing closes the group, as
    # "View all products" does in the bar's dropdown
    return ('      <!-- products:menu -->\n'
            '      <li class="menu__group"><span class="menu__label">Products</span>\n'
            '        <ul class="menu__sub">\n' + '\n'.join(rows) + '\n        </ul>\n'
            '        <a class="menu__all" href="/products">View all products</a>\n      </li>\n'
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
        i, j = between(s, '      <li><a href="/products">Products</a>\n        <ul class="menu__sub">', '\n      </li>')
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

PP_CLOSE_JS = '''<script>
/* the close's field on a product page: there is no hero chat to hand over to,
   so the conversation opens right here, in place of the field */
(function () {
  const f = document.getElementById('ppAsk'), i = document.getElementById('ppAskInput'),
        chat = document.getElementById('ask'), form = document.getElementById('agentForm'), input = document.getElementById('agentInput');
  if (!f || !i || !chat || !form || !input) return;
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = i.value.trim(); if (!v) { i.focus(); return; }
    f.hidden = true; chat.hidden = false; input.value = v; i.value = ''; form.requestSubmit();
  });
})();
</script>'''

def page(p, home):
    slug, name = p['slug'], p['name']

    head = home[:home.index('</head>')]
    for old, new in [
        ('<title>Stagwell AI</title>', f'<title>{t(name)} | Stagwell AI</title>'),
        ('<meta name="description" content="Whatever the challenge, we deliver results">', f'<meta name="description" content="{a(p["title"])}">'),
        ('<link rel="canonical" href="https://stagwell.vercel.app/">', f'<link rel="canonical" href="https://stagwell.vercel.app/{slug}">'),
        ('<meta property="og:title" content="Stagwell AI">', f'<meta property="og:title" content="{a(name)} | Stagwell AI">'),
        ('<meta property="og:description" content="Whatever the challenge, we deliver results">', f'<meta property="og:description" content="{a(p["title"])}">'),
        ('<meta property="og:url" content="https://stagwell.vercel.app/">', f'<meta property="og:url" content="https://stagwell.vercel.app/{slug}">'),
        ('<link rel="stylesheet" href="/next/home.css">', '<link rel="stylesheet" href="/next/home.css">\n<link rel="stylesheet" href="/next/product.css">'),
    ]:
        must(head, old); head = head.replace(old, new)

    i = home.index('<svg width="0"'); symbol = home[i:home.index('</svg>', i) + 6]

    i = home.index('<header class="nav" id="nav">'); j = home.index('<!-- the chat, full screen over the page')
    chrome = put_blocks(home[i:j].rstrip(), current=slug)
    # the bar's chat button opens the homepage's chat overlay here too (client,
    # 2026-09-10: "the chat button next to Book a demo doesn't open"); a question
    # asked there opens the chat at the foot of the page (home.js)
    chrome += '\n\n' + home[home.index('<!-- the chat, full screen over the page'):home.index('<main id="top">')].rstrip()

    # the homepage's chat, without the hero's callback widget (see chat_block)
    chat = chat_block(home)

    i = home.index('<footer class="foot">'); footer = home[i:home.index('</footer>') + 9]

    # the close: the homepage's own "How can we help?" section, duplicated as it
    # is (client) — the bobbing dots, the turning hint, Book a demo and Call me.
    # Its field hands over to the hero chat on the homepage (home.js scrolls up to
    # it); these pages have no hero chat, so the form carries its own id and the
    # conversation opens in place, in the chat hidden beside it (PP_CLOSE_JS).
    i = home.index('<section class="ask-end" id="start">'); close = home[i:home.index('</section>', i) + 10]
    # the homepage close's own resting field stays on the homepage: here the
    # chat's canvas moves under the section instead (below)
    close = close.replace('\n  <canvas class="hero__think" id="endThink" aria-hidden="true"></canvas>', '')
    for old, new in [('id="askEndInput"', 'id="ppAskInput"'), ('for="askEndInput"', 'for="ppAskInput"'), ('id="askEnd"', 'id="ppAsk"')]:
        must(close, old); close = close.replace(old, new)
    ways = '      <div class="ask-end__ways">'
    must(close, ways)
    # the thinking field comes out of the chat and lies under the whole section,
    # so it moves across all of the white "How can we help?" band (client) instead
    # of a 600x300 block pinned to the box, which looked cropped
    canvas = '<canvas class="hero__think" id="agentThink" aria-hidden="true"></canvas>'
    must(chat, canvas)
    close = close.replace(ways, '      <div class="hero__in pp-ask" id="ask" hidden>\n' + chat.replace(canvas, '') + '\n      </div>\n' + ways)
    close = close.replace('<section class="ask-end" id="start">', '<section class="ask-end" id="start">\n  ' + canvas, 1)

    src, w, h = p['image']
    # a phone gets its own How it works picture where Julian made one — 16:9,
    # the ratio the phone crops to anyway (client, 2026-09-10); the others keep
    # the desktop picture, cropped
    import os
    mob = f'/assets/img/products/{p["slug"]}-mobile.jpg'
    has_mob = os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', mob.lstrip('/')))
    pic = f'<img src="{src}" alt="" width="{w}" height="{h}" loading="lazy" decoding="async">'
    if has_mob:
        pic = f'<picture><source media="(max-width:820px)" srcset="{mob}" width="1672" height="941">{pic}</picture>'
    steps = '\n'.join(
        f'        <li class="rv" style="--d:{0.06 * n:.2f}s"><b>{n + 1:02d}</b><div><h3>{t(hd)}</h3><p>{t(tx)}</p></div></li>'
        for n, (hd, tx) in enumerate(p['sections']))
    figs = '\n'.join(f'      <li><strong>{t(big)}</strong><span>{t(line)}</span></li>' for big, line in p['proof'])
    words = p['proof_kind'] == 'words'
    flag = 'Candidate proof · pending approval' if words else 'Candidate figures · pending approval'
    # the band's heading: the definitions give none, so it names the product —
    # except Agent Cloud, whose proof the document frames as secure adoption at scale
    proof_title = p.get('proof_title') or f'{name}, by the numbers'

    body = f'''
<!-- Generated by next/build-product-pages.py — edit the content there, not here. -->
<main id="top">

<section class="pp-hero{' pp-hero--photo' if p.get('hero_bg') else ''}{' pp-hero--light' if p.get('hero_tone') == 'light' else ''}"{f' style="--hero-bg:url({p["hero_bg"]})"' if p.get('hero_bg') else ''}>
  <div class="pp-wrap pp-hero__in">
    {p['logo']}
    <p class="pp-eyebrow">{t(p['kind'])}</p>
    <h1 class="pp-title">{t(p['title'])}</h1>
    <p class="pp-lede">{t(p['summary'])}</p>
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

<!-- the definitions' description, whole: between the film and How it works (client) -->
<section class="pp-about">
  <div class="pp-wrap">
    <p class="pp-about__text rv">{t(p['description'])}</p>
  </div>
</section>

<section class="pp-more">
  <div class="pp-wrap">
    <div class="pp-more__head">
      <p class="pp-sign rv">How it works</p>
      <h2 class="pp-h2 rv" style="--d:.1s">What <span>{t(name)}</span> does</h2>
    </div>
    <div class="pp-more__grid">
      <div class="pp-more__media">{pic}</div>
      <ol class="pp-steps">
{steps}
      </ol>
    </div>
    <p class="pp-mid"><button type="button" class="btn btn--ink btn--lg" data-cta="session" data-where="mid">Book a demo</button></p>
  </div>
</section>

<section class="pp-proof">
  <div class="pp-wrap">
    <div class="pp-proof__head">
      <p class="pp-sign rv">Proof</p>
      <h2 class="pp-h2 rv" style="--d:.08s">{t(proof_title)}</h2>
      <span class="pp-flag rv" style="--d:.14s">{flag}</span>
    </div>
    <ul class="pp-figs pp-figs--n{len(p['proof'])}{' pp-figs--words' if words else ''}">
{figs}
    </ul>
    <p class="pp-proof__note">{t(p['proof_note'])}</p>
  </div>
</section>

{close}

</main>
'''
    # the homepage's own scripts, in its order: the chat at the foot is the
    # homepage's chat, and whatever it needs (the Kimi flow, 2026-09-10:
    # recommend, select-question, cards, analytics, kimi-flow before
    # hero-agent) it gets here too, so a change on the homepage can't leave
    # these pages behind
    home_js = re.findall(r'<script src="/next/([^"]+)"></script>', home[home.index('<body'):])
    assert 'hero-agent.js' in home_js and 'home.js' in home_js, home_js
    for f in home_js: assert (NEXT / f).exists(), f'missing next/{f}'
    scripts = '\n'.join(f'<script src="/next/{f}"></script>' for f in home_js)
    out = (head + '</head>\n'
           '<!-- data-lead-cta: the shared booking modal (lead.js) delegates every [data-cta] click -->\n'
           f'<body class="home pp pp--{slug}{" pp--light-hero" if p.get("hero_tone") == "light" else ""}" data-lead-cta>\n\n' + symbol + '\n\n' + chrome + '\n' + body + '\n' +
           footer + '\n\n' + scripts + '\n' + VIDEO_JS + '\n' + PP_CLOSE_JS + '\n</body>\n</html>\n')
    assert out.count('id="chatOver"') == 1 and out.count('id="ask"') == 1 and out.count('id="agentForm"') == 1 and 'id="askEnd"' not in out and 'endThink' not in out
    return out

# ── run ─────────────────────────────────────────────────────────────────────
def site_chrome(home):
    """The homepage's bar and phone menu, for a page with no chat of its own:
    the chat buttons go to the homepage's."""
    i = home.index('<header class="nav" id="nav">'); j = home.index('<!-- the chat, full screen over the page')
    ch = put_blocks(home[i:j].rstrip())
    ch, n1 = re.subn(r'<button type="button" class="nav__search" id="navSearch"[^>]*>(.*?)</button>',
                     r'<a class="nav__search" href="/#ask" aria-label="Ask Stagwell AI">\1</a>', ch, flags=re.S)
    ch, n2 = re.subn(r'<button type="button" class="menu__search" id="menuSearch"[^>]*>(.*?)</button>',
                     r'<a class="menu__search" href="/#ask">\1</a>', ch, flags=re.S)
    assert n1 == 1 and n2 == 1
    return ch

# ── Book a demo: its own page (client, 2026-09-10) ──────────────────────────
# Every "Book a demo" used to open lead.js's modal ("Book a strategy session")
# over the page. It is a page now: the brand gradient, the demo's own title
# and line (data/cta.json's "demo" copy — "a strategy session" read wrong
# after a Book a demo button, client), and the same form — lead.js mounts it into
# #bookForm with visible labels, the same work-email check and the same events.
BOOK_BODY = """<main class="bk">
  <section class="bk-hero">
    <div class="pp-wrap bk__in">
      <div class="bk__copy">
        <h1 class="bk__title">Book a demo</h1>
        <!-- the demo's own line, set as three points with icons so the side has
             something to hold (client, 2026-09-10: "too simple… add an icon
             something more interesting"); the words are the line's, nothing added -->
        <ul class="bk__points">
          <li><span class="bk__ic"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></span>Thirty minutes</li>
          <li><span class="bk__ic"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c2.4-.2 4.4 1.4 5 4.3"/></svg></span>With the team who runs the product</li>
          <li><span class="bk__ic"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg></span>Walked through against your brand, not a generic reel</li>
        </ul>
      </div>
      <div class="bk__card">
        <div id="bookForm" data-kind="demo" aria-label="Book a demo"></div>
      </div>
    </div>
  </section>
</main>
"""

def book_page(home):
    head = home[:home.index('</head>')]
    for old, new in [
        ('<title>Stagwell AI</title>', '<title>Book a demo | Stagwell AI</title>'),
        ('<meta name="description" content="Whatever the challenge, we deliver results">', '<meta name="description" content="Book a demo: thirty minutes with the team who runs the product, walking through it against your brand.">'),
        ('<link rel="canonical" href="https://stagwell.vercel.app/">', '<link rel="canonical" href="https://stagwell.vercel.app/book">'),
        ('<meta property="og:title" content="Stagwell AI">', '<meta property="og:title" content="Book a demo | Stagwell AI">'),
        ('<meta property="og:description" content="Whatever the challenge, we deliver results">', '<meta property="og:description" content="Book a demo: thirty minutes with the team who runs the product, walking through it against your brand.">'),
        ('<meta property="og:url" content="https://stagwell.vercel.app/">', '<meta property="og:url" content="https://stagwell.vercel.app/book">'),
        ('<link rel="stylesheet" href="/next/home.css">', '<link rel="stylesheet" href="/next/home.css">\n<link rel="stylesheet" href="/next/product.css">'),
    ]:
        must(head, old); head = head.replace(old, new)
    i = home.index('<svg width="0"'); symbol = home[i:home.index('</svg>', i) + 6]
    i = home.index('<footer class="foot">'); footer = home[i:home.index('</footer>') + 9]
    scripts = '\n'.join(f'<script src="/next/{f}"></script>' for f in ('call.js', 'lead.js', 'home.js', 'navdrop.js'))
    out = (head + '</head>\n<body class="home pp bk-page" data-lead-cta>\n\n' + symbol + '\n\n' + site_chrome(home) + '\n' +
           BOOK_BODY + '\n' + footer + '\n\n' + scripts + '\n</body>\n</html>\n')
    assert out.count('id="bookForm"') == 1 and out.count('id="navBurger"') == 1
    return out

# the listing's hero and paragraph, in the page itself so they paint with the
# first frame (they were drawn by products.js after the data loaded, and the
# close and footer flashed up under the bar first: client, 2026-09-10)
LISTING_HERO = '''
      <section class="pp-hero pl-hero">
        <div class="pp-wrap pp-hero__in">
          <p class="pp-eyebrow">The Stagwell Marketing Cloud</p>
          <h1 class="pp-title">Every product in the suite, grouped by the problem it solves.</h1>
          <p class="pp-lede">Start with the problem; the product follows.</p>
          <div class="pp-acts">
            <button type="button" class="btn btn--accent btn--lg" data-cta="demo">Book a demo</button>
            <a class="pp-site" href="/#ask">Find my fit in a conversation<svg class="pp-site__ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
          </div>
        </div>
      </section>
      <section class="pp-about pl-about">
        <div class="pp-wrap">
          <p class="pp-about__text rv">Brand tracking, competitive benchmarking, consumer research, creator programs, AI-search visibility, reputation monitoring, audience activation and voice agents, each built by a team that does this and nothing else.</p>
        </div>
      </section>
'''

def listing_page(home):
    """/products, built like a product page (client, 2026-09-10: "not the
    same footer as the home page… not the same final CTA… the background not the
    visual language"): the homepage's head, bar, menu, "How can we help?" (with
    the chat and the thinking field) and footer, and products.js rendering the
    list into #productsRoot. listing.css styles the list on home.css's tokens."""
    head = home[:home.index('</head>')]
    desc = 'Every product in the Stagwell Marketing Cloud, grouped by the problem it solves.'
    for old, new in [
        ('<title>Stagwell AI</title>', '<title>Every product | Stagwell AI</title>'),
        ('<meta name="description" content="Whatever the challenge, we deliver results">', f'<meta name="description" content="{desc}">'),
        ('<link rel="canonical" href="https://stagwell.vercel.app/">', '<link rel="canonical" href="https://stagwell.vercel.app/products">'),
        ('<meta property="og:title" content="Stagwell AI">', '<meta property="og:title" content="Every product | Stagwell AI">'),
        ('<meta property="og:description" content="Whatever the challenge, we deliver results">', f'<meta property="og:description" content="{desc}">'),
        ('<meta property="og:url" content="https://stagwell.vercel.app/">', '<meta property="og:url" content="https://stagwell.vercel.app/products">'),
        ('<link rel="stylesheet" href="/next/home.css">', '<link rel="stylesheet" href="/next/home.css">\n<link rel="stylesheet" href="/next/product.css">\n<link rel="stylesheet" href="/next/listing.css">'),
    ]:
        must(head, old); head = head.replace(old, new)
    i = home.index('<svg width="0"'); symbol = home[i:home.index('</svg>', i) + 6]
    i = home.index('<header class="nav" id="nav">'); j = home.index('<!-- the chat, full screen over the page')
    chrome = put_blocks(home[i:j].rstrip())
    chrome += '\n\n' + home[home.index('<!-- the chat, full screen over the page'):home.index('<main id="top">')].rstrip()   # the chat overlay, as on the homepage
    chat = chat_block(home)
    # the close, exactly as the product pages carry it (see page())
    i = home.index('<section class="ask-end" id="start">'); close = home[i:home.index('</section>', i) + 10]
    close = close.replace('\n  <canvas class="hero__think" id="endThink" aria-hidden="true"></canvas>', '')
    for old, new in [('id="askEndInput"', 'id="ppAskInput"'), ('for="askEndInput"', 'for="ppAskInput"'), ('id="askEnd"', 'id="ppAsk"')]:
        must(close, old); close = close.replace(old, new)
    ways = '      <div class="ask-end__ways">'
    canvas = '<canvas class="hero__think" id="agentThink" aria-hidden="true"></canvas>'
    must(close, ways); must(chat, canvas)
    close = close.replace(ways, '      <div class="hero__in pp-ask" id="ask" hidden>\n' + chat.replace(canvas, '') + '\n      </div>\n' + ways)
    close = close.replace('<section class="ask-end" id="start">', '<section class="ask-end" id="start">\n  ' + canvas, 1)
    i = home.index('<footer class="foot">'); footer = home[i:home.index('</footer>') + 9]
    home_js = re.findall(r'<script src="/next/([^"]+)"></script>', home[home.index('<body'):])
    scripts = '\n'.join(f'<script src="/next/{f}"></script>' for f in home_js + ['products.js', 'prodtoc.js'])
    body = ('<main id="top" class="pl">\n' + LISTING_HERO + '\n  <div id="productsRoot"><!-- products.js renders the list here --></div>\n</main>\n\n' + close)
    out = (head + '</head>\n<body class="home pp pl-page" data-lead-cta>\n\n' + symbol + '\n\n' + chrome + '\n' + body + '\n' +
           footer + '\n\n' + scripts + '\n' + PP_CLOSE_JS + '\n</body>\n</html>\n')
    assert out.count('id="productsRoot"') == 1 and out.count('id="ask"') == 1 and out.count('id="navBurger"') == 1 and 'endThink' not in out
    return out

# ── the other products: /s/{id}, built like the four (client, 2026-09-10) ──────
# "All these Explore pages need to look like the product pages we did today…
# CTA, chat at the end, same footer, same hero treatment; we don't have images,
# so do gradients in the brand's style." One page per active product from
# data/solutions.json: the product pages' hero on a Stagwell gradient (three,
# in turn), the product's own words (positioning, card line, who it's for,
# capabilities), its picture from the listing, the products teams pair it with,
# then the homepage's "How can we help?" with its chat, and its footer. No film
# and no proof section: there are none for these, and nothing is invented.
# ┌─ CAUTION (2026-09-16) ────────────────────────────────────────────────────
# │ The five hand pages this script writes — products, newvoices, agent-cloud,
# │ the-machine, targeting-machine — were re-themed by hand afterwards
# │ (home-c.css / prod-c.css, the hc-page classes, the hcLaunch widget). Running
# │ this script rewrites them WITHOUT that theme. Until it is taught the C theme,
# │ run it for the /s/ pages only and `git checkout` the five afterwards, or
# │ edit those five directly. Their copy is kept in sync here so the two agree.
# └───────────────────────────────────────────────────────────────────────────
SOL_OWN = {'targeting_machine': '/targeting-machine', 'newvoices': '/newvoices',
           'machines_family': '/the-machine', 'agent_cloud': '/agent-cloud'}
# a first sentence too long to be a title (220 characters): its own second
# sentence carries the title, the long one moves under the hero
SOL_GRADS = ('g1', 'g2', 'g3')
# a product's own hero ground where Julian set one (the rest keep the Stagwell
# gradients until the final backgrounds pass). 'light' grounds take the
# light-hero rules: ink type, the bar in its dark state over them.
# IMAI (influencermarketing.ai), 2026-09-10: pastel turquoise, green and purple
# UNICEPTA, 2026-09-10: pastel peach and pastel green
SOL_HERO = {'imai': 'light', 'unicepta': 'light'}

def sol_pictures():
    """The listing's still for each product (products.js PICTURE), so a product
    reads the same on both pages."""
    src = (NEXT / 'products.js').read_text(); i = src.index('const PICTURE = {'); j = src.index('};', i)
    return dict(re.findall(r"(\w+):\s*'([^']+)'", src[i:j]))

def frame(home, *, title, desc, path, body_class, body, css=('product.css',), extra_js=()):
    """A page on the homepage's head, bar, menu, "How can we help?" (chat and
    thinking field) and footer, with `body` in between — the product pages'
    recipe, for pages that carry no film."""
    head = home[:home.index('</head>')]
    for old, new in [
        ('<title>Stagwell AI</title>', f'<title>{t(title)}</title>'),
        ('<meta name="description" content="Whatever the challenge, we deliver results">', f'<meta name="description" content="{a(desc)}">'),
        ('<link rel="canonical" href="https://stagwell.vercel.app/">', f'<link rel="canonical" href="https://stagwell.vercel.app{path}">'),
        ('<meta property="og:title" content="Stagwell AI">', f'<meta property="og:title" content="{a(title)}">'),
        ('<meta property="og:description" content="Whatever the challenge, we deliver results">', f'<meta property="og:description" content="{a(desc)}">'),
        ('<meta property="og:url" content="https://stagwell.vercel.app/">', f'<meta property="og:url" content="https://stagwell.vercel.app{path}">'),
        ('<link rel="stylesheet" href="/next/home.css">', '<link rel="stylesheet" href="/next/home.css">' + ''.join(f'\n<link rel="stylesheet" href="/next/{c}">' for c in css)),
    ]:
        must(head, old); head = head.replace(old, new)
    i = home.index('<svg width="0"'); symbol = home[i:home.index('</svg>', i) + 6]
    i = home.index('<header class="nav" id="nav">'); j = home.index('<!-- the chat, full screen over the page')
    chrome = put_blocks(home[i:j].rstrip())
    chrome += '\n\n' + home[home.index('<!-- the chat, full screen over the page'):home.index('<main id="top">')].rstrip()   # the chat overlay, as on the homepage
    chat = chat_block(home)
    i = home.index('<section class="ask-end" id="start">'); close = home[i:home.index('</section>', i) + 10]
    close = close.replace('\n  <canvas class="hero__think" id="endThink" aria-hidden="true"></canvas>', '')
    for old, new in [('id="askEndInput"', 'id="ppAskInput"'), ('for="askEndInput"', 'for="ppAskInput"'), ('id="askEnd"', 'id="ppAsk"')]:
        must(close, old); close = close.replace(old, new)
    ways = '      <div class="ask-end__ways">'
    canvas = '<canvas class="hero__think" id="agentThink" aria-hidden="true"></canvas>'
    must(close, ways); must(chat, canvas)
    close = close.replace(ways, '      <div class="hero__in pp-ask" id="ask" hidden>\n' + chat.replace(canvas, '') + '\n      </div>\n' + ways)
    close = close.replace('<section class="ask-end" id="start">', '<section class="ask-end" id="start">\n  ' + canvas, 1)
    i = home.index('<footer class="foot">'); footer = home[i:home.index('</footer>') + 9]
    home_js = re.findall(r'<script src="/next/([^"]+)"></script>', home[home.index('<body'):])
    scripts = '\n'.join(f'<script src="/next/{f}"></script>' for f in list(home_js) + list(extra_js))
    out = (head + '</head>\n<body class="' + body_class + '" data-lead-cta>\n\n' + symbol + '\n\n' + chrome + '\n' +
           '<!-- Generated by next/build-product-pages.py — edit the content there, not here. -->\n<main id="top">\n' + body +
           '\n' + close + '\n</main>\n\n' + footer + '\n\n' + scripts + '\n' + PP_CLOSE_JS + '\n</body>\n</html>\n')
    assert out.count('id="ask"') == 1 and out.count('id="navBurger"') == 1 and 'endThink' not in out
    return out

ARROW = '<svg class="pp-site__ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 11 11 5M6.5 5H11v4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
GO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

def solution_page(home, s, n, by_id, pics):
    sid, name = s['id'], s['name']
    # the headline is the catalog's own `tagline` (the client's Product Package
    # Checklist field), not the first sentence of `positioning` split off by
    # regex — that gave The Targeting Machine the headline "Your data." and
    # needed a hard-coded override for the ID Graph. What goes under the film is
    # whatever `positioning` says that the headline and the card have not said.
    sent = [x for x in re.split(r'(?<=[.!?])\s+', s['positioning'].strip()) if x]
    card = s['cardDescription']
    norm = lambda x: re.sub(r'\W+', '', x).lower()
    title = s.get('tagline') or sent[0]
    # a sentence the headline already said is not repeated: "It is the identity
    # spine under Stagwell's audience work." is the ID Graph's headline with two
    # words in front of it, so it counts as said. The card is matched exactly —
    # it often EXTENDS a sentence of the positioning rather than repeating it,
    # and the longer version on the card is not a reason to drop the shorter
    # one from the page.
    ttl, crd = norm(title), norm(card)          # not t / c: t() is the escaper
    told = lambda x: x == crd or x in ttl or ttl in x
    about = ' '.join(x for x in sent if not told(norm(x)))
    eyebrow = s.get('whoFor') or 'The Stagwell Marketing Cloud'
    if s.get('url'):
        site = f'<a class="pp-site" href="{a(s["url"])}" target="_blank" rel="noopener" data-product-site>Visit {t(name)} website{ARROW}</a>'
    elif s.get('signupUrl'):
        site = f'<a class="pp-site" href="{a(s["signupUrl"])}" target="_blank" rel="noopener" data-product-site>Get started with {t(name)}{ARROW}</a>'
    else:
        site = ''
    # the Machines carry the messaging document's proof points (2026-09-16); the
    # rest keep their capability tags as the steps
    caps = s.get('proofPoints') or s.get('capabilityTags') or s.get('valueProps') or []
    hero_cls = (f'sp-hero--{sid}' + (' pp-hero--light' if SOL_HERO[sid] == 'light' else '')) if sid in SOL_HERO else f'sp-hero--{SOL_GRADS[n % len(SOL_GRADS)]}'
    steps = '\n'.join(f'        <li class="rv" style="--d:{0.06 * k:.2f}s"><b>{k + 1:02d}</b><div><h3>{t(c)}</h3></div></li>' for k, c in enumerate(caps))
    pic = pics.get(sid)
    media = (f'<img src="{a(pic)}" alt="" loading="lazy" decoding="async">' if pic else f'<span class="sp-tile">{t(name)}</span>')
    also_ids = [c for c in s.get('companions', []) if c in by_id and by_id[c].get('active')]
    also = ''
    if also_ids:
        rows = '\n'.join(f'        <li><a class="sp-also__item" href="{a(SOL_OWN.get(c, "/s/" + c))}"><span><b class="sp-also__n">{t(by_id[c]["name"])}</b>'
                         f'<span class="sp-also__w">{t(by_id[c].get("whoFor") or by_id[c]["cardDescription"])}</span></span>{GO}</a></li>' for c in also_ids)
        also = f"""
<section class="sp-also">
  <div class="pp-wrap">
    <p class="pp-sign rv">Related</p>
    <h2 class="pp-h2 sp-also__h rv" style="--d:.08s">Teams solving this also ask about</h2>
    <ul class="sp-also__list">
{rows}
    </ul>
  </div>
</section>
"""
    about_html = f"""
<section class="pp-about">
  <div class="pp-wrap">
    <p class="pp-about__text rv">{t(about)}</p>
  </div>
</section>
""" if about else ''
    body = f"""
<section class="pp-hero sp-hero {hero_cls}">
  <div class="pp-wrap pp-hero__in">
    <p class="sp-mark">{t(name)}</p>
    <p class="pp-eyebrow">{t(eyebrow)}</p>
    <h1 class="pp-title">{t(title)}</h1>
    <p class="pp-lede">{t(card)}</p>
    <div class="pp-acts">
      <button type="button" class="btn btn--accent btn--lg" data-cta="session" data-where="hero">Book a demo</button>
      {site}
    </div>
  </div>
</section>
{about_html}
<section class="pp-more">
  <div class="pp-wrap">
    <div class="pp-more__head">
      <p class="pp-sign rv">How it works</p>
      <h2 class="pp-h2 rv" style="--d:.1s">What <span>{t(name)}</span> does</h2>
    </div>
    <div class="pp-more__grid">
      <div class="pp-more__media">{media}</div>
      <ol class="pp-steps">
{steps}
      </ol>
    </div>
    <p class="pp-mid"><button type="button" class="btn btn--ink btn--lg" data-cta="session" data-where="mid">Book a demo</button></p>
  </div>
</section>
{also}"""
    return frame(home, title=f'{name} | Stagwell AI', desc=card, path=f'/s/{sid}', body_class=f'home pp sp sp--{sid}' + (' pp--light-hero' if SOL_HERO.get(sid) == 'light' else ''), body=body)

def sync_chrome(home):
    """The listing (/products) and the solution pages (/s/{id}) carry
    the homepage's bar and phone menu exactly (client, 2026-09-10: "the
    navigation is broken in the inner pages… it has to be consistent"). Their
    own header and old drawer are replaced between the site-chrome markers;
    nav.js drives the menu there and site-nav.css dresses it against ribbon.css."""
    ch = site_chrome(home)
    for name in ('solution.html',):   # products.html is built by listing_page() now
        f = NEXT / name; s = f.read_text()
        START, END = '<!-- site-chrome: the homepage bar and phone menu, copied by build-product-pages.py -->', '<!-- /site-chrome -->'
        if START in s:
            a = s.index(START); b = s.index(END) + len(END)
        else:
            a = s.index('<header class="nav" id="nav">'); b = s.index('</aside>', a) + len('</aside>')
        s = s[:a] + START + '\n' + ch + '\n' + END + s[b:]
        s = s.replace('href="/why" style="color:#FFFFFF;font-size:20px', 'href="/products" style="color:#FFFFFF;font-size:20px')
        s = s.replace('href="/why"', 'href="/#why"')
        # the listing has no [data-cta] handler of its own (the solution pages
        # do, in solution.js): lead.js's opt-in delegate takes Book a demo there
        if name == 'products.html' and 'data-lead-cta' not in s[:s.index('>', s.index('<body'))]:
            k = s.index('>', s.index('<body')); s = s[:k] + ' data-lead-cta' + s[k:]
        if 'src="/next/navdrop.js"' not in s:
            s = s.replace('</body>', '<script src="/next/navdrop.js" defer></script>\n</body>')
        assert s.count('id="navBurger"') == 1 and 'class="mnav"' not in s and 'id="navScrim"' not in s, name
        f.write_text(s)
        print(f'next/{name}   bar and menu copied from the homepage')

# ═══ DEEP CONTENT, RENDERED FROM data/explainers.json ════════════════════════
# The three sections on a product page that go beyond the catalog entry — the
# differentiators, the use-case library and what it connects to. They are
# generated HERE from the same file SAIKIMI.explore() walks in the chat, so the
# page and the agent can never drift apart.
#
# The five hand-themed pages cannot be regenerated whole (see the CAUTION
# above), so these sections are INJECTED between markers instead: the builder
# rewrites only what is between them and leaves Julian's theme alone.
HAND_THEMED = {'the-machine', 'targeting-machine', 'newvoices', 'agent-cloud'}
EXPLAINER_START = '<!-- explainers:start · generated from data/explainers.json by next/build-product-pages.py -->'
EXPLAINER_END = '<!-- explainers:end -->'
TICK = ('<svg class="pp-with__ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" '
        'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>')


def explainers_html(ex, name):
    """The differentiators, the use-case library and the connects-to strip.
    answerOnly items (the does-NOT-do list) are never rendered: they exist so
    the agent can answer a direct question, not to be read off a page."""
    out = []
    diffs = ex.get('differentiators') or []
    if diffs:
        items = '\n'.join(
            f'      <div class="pp-diff__item rv" style="--d:{i * .07:.2f}s"><span class="pp-diff__n">{i + 1:02d}</span>'
            f'<h3>{t(d["title"])}</h3><p>{t(d["line"])}</p></div>' for i, d in enumerate(diffs))
        out.append(
            '<section class="pp-diff">\n  <div class="pp-wrap">\n    <div class="pp-more__head">\n'
            '      <p class="pp-sign rv">Differentiators</p>\n'
            f'      <h2 class="pp-h2 rv" style="--d:.1s">What sets {t(name)} apart</h2>\n'
            '    </div>\n    <div class="pp-diff__grid">\n' + items + '\n    </div>\n  </div>\n</section>')
    groups = ex.get('useCaseGroups') or []
    if groups:
        gs = []
        for gi, g in enumerate(groups):
            li = '\n'.join(f'          <li><h4>{t(c["name"])}</h4><p>{t(c["line"])}</p></li>' for c in g['items'])
            gs.append(f'      <div class="pp-uses__group rv" style="--d:{gi * .05:.2f}s">\n'
                      f'        <h3>{t(g["label"])}</h3>\n        <ul class="pp-uses__list">\n{li}\n        </ul>\n      </div>')
        out.append('<section class="pp-uses">\n  <div class="pp-wrap">\n    <div class="pp-more__head">\n'
                   '      <p class="pp-sign rv">Use cases</p>\n'
                   '      <h2 class="pp-h2 rv" style="--d:.1s">What teams use it for</h2>\n    </div>\n'
                   '    <div class="pp-uses__grid">\n' + '\n'.join(gs) + '\n    </div>\n  </div>\n</section>')
    conn = ex.get('connectsTo') or []
    if conn:
        li = '\n'.join(f'      <li class="rv" style="--d:{i * .06:.2f}s">{TICK}<div><b>{t(c["title"])}</b>'
                      f'<span>{t(c["line"])}</span></div></li>' for i, c in enumerate(conn))
        out.append('<section class="pp-with">\n  <div class="pp-wrap">\n    <div class="pp-more__head">\n'
                   '      <p class="pp-sign rv">No rip and replace</p>\n'
                   '      <h2 class="pp-h2 rv" style="--d:.1s">What it connects to</h2>\n    </div>\n'
                   '    <ul class="pp-with__grid">\n' + li + '\n    </ul>\n  </div>\n</section>')
    return '\n\n'.join(out)


def inject_explainers(html, ex, name):
    """Rewrite only what sits between the markers, so a hand-themed page keeps
    its theme. A page with no markers is returned untouched."""
    if EXPLAINER_START not in html:
        return html
    must(html, EXPLAINER_START)
    must(html, EXPLAINER_END)
    head, rest = html.split(EXPLAINER_START, 1)
    _, tail = rest.split(EXPLAINER_END, 1)
    return head + EXPLAINER_START + '\n' + explainers_html(ex, name) + '\n' + EXPLAINER_END + tail


def main():
    ix = NEXT / 'index.html'
    home = put_blocks(ix.read_text())
    must(home, '<script src="/next/navdrop.js"></script>')
    for p in PRODUCTS:
        for f in (f'assets/video/{p["slug"]}-15s.mp4', f'assets/video/{p["slug"]}-poster.jpg', p['image'][0].lstrip('/'),
                  f'assets/img/products/thumb-{p["slug"]}.jpg',
                  *([p['hero_bg'].lstrip('/')] if p.get('hero_bg') else [])):
            assert (ROOT / f).exists(), f'missing {f}'
    pages = {p['slug']: page(p, home) for p in PRODUCTS}
    ix.write_text(home)
    sync_chrome(home)
    (NEXT / 'book.html').write_text(book_page(home)); print('next/book.html    Book a demo page')
    # products.html carries the same hand theme; see HAND_THEMED
    print('next/products.html  hand-themed — left alone')
    sols = json.loads((ROOT / 'data' / 'solutions.json').read_text())['solutions']
    by_id = {x['id']: x for x in sols}
    pics = sol_pictures()
    (NEXT / 's').mkdir(exist_ok=True)
    gen = [x for x in sols if x.get('active') and x['id'] not in SOL_OWN]
    for n, x in enumerate(gen):
        (NEXT / 's' / f"{x['id']}.html").write_text(solution_page(home, x, n, by_id, pics))
    print(f'next/s/*.html   {len(gen)} product pages: ' + ', '.join(x['id'] for x in gen))
    for slug, out in pages.items():
        # HAND_THEMED pages were re-themed by hand after this script wrote them
        # (home-c.css / prod-c.css, the hc-page classes, the hcLaunch widget).
        # Overwriting them strips that theme, so the script leaves them alone
        # and only rewrites what sits between the explainer markers below. Their
        # copy is still kept in PRODUCTS above so the two agree; to rebuild one
        # from scratch, take it out of this set and re-theme it afterwards.
        if slug in HAND_THEMED:
            print(f'next/{slug}.html  hand-themed — left alone (explainers still injected)')
            continue
        (NEXT / f'{slug}.html').write_text(out)
        print(f'next/{slug}.html  {len(out):>6} bytes')
    # the deep sections, into whichever pages carry the markers
    ex_all = json.loads((ROOT / 'data' / 'explainers.json').read_text())['products']
    own = {v.lstrip('/'): k for k, v in SOL_OWN.items()}      # 'the-machine' -> 'machines_family'
    for f in sorted(NEXT.glob('*.html')) + sorted((NEXT / 's').glob('*.html')):
        html = f.read_text()
        if EXPLAINER_START not in html:
            continue
        pid = own.get(f.stem, f.stem)
        ex = ex_all.get(pid)
        if not ex:
            continue
        name = ex.get('name') or (by_id[pid]['name'] if pid in by_id else f.stem)
        f.write_text(inject_explainers(html, ex, name))
        print(f'next/{f.relative_to(NEXT)}   explainers injected ({pid})')
    print('next/index.html   dropdown updated')

if __name__ == '__main__':
    main()
