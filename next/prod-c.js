/* ── OPTION C ON THE LISTING ──────────────────────────────────────────────────
   The rows are rendered by products.js. This rearranges what is already there —
   no new words: each row leads with "/NN Product name", then the problem that
   group answers, then what the product does. The group's own header steps aside.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const root = document.querySelector('.pl-c #productsRoot');
  if (!root) return;

  const build = () => {
    root.querySelectorAll('.prodgroup').forEach(group => {
      const n = (group.querySelector('.prodgroup__n') || {}).textContent || '';
      const problem = (group.querySelector('.prodgroup__h') || {}).textContent || '';
      const cards = [...group.querySelectorAll('.prodcard')];
      /* a problem answered by more than one product reads as a stack, not as one wide row */
      if (cards.length > 1) group.dataset.pcMulti = '1'; else delete group.dataset.pcMulti;
      cards.forEach((card, i) => {
        if (card.dataset.pcDone) return;
        card.dataset.pcDone = '1';

        const name = card.querySelector('.prodcard__name');
        /* the number and the problem live on the group's picture, so the row leads with its name */
        if (name && !card.querySelector('.pc-row__h')) {
          const h = document.createElement('p');
          h.className = 'pc-row__h';
          h.textContent = name.textContent.trim();
          name.insertAdjacentElement('afterend', h);
          name.classList.add('pc-hide');
        }

        /* the way in reads the same on every row; on a problem answered by one product it
           moves onto the picture, under the words there */
        const link = card.querySelector('.prodcard__link');
        if (link && !link.dataset.pcNamed) {
          link.dataset.pcNamed = '1';
          link.textContent = 'Explore';
        }
        if (link && cards.length === 1 && !link.dataset.pcOnPic) {
          const words = group.querySelector('.prodgroup__words');
          if (words) { link.dataset.pcOnPic = '1'; words.appendChild(link); }
        }

        /* the two lists sit under the row: a mark, then its label and its words */
        const mk = (name, path) => {
          const i = document.createElement('span');
          i.className = 'pc-ic';
          i.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' + path + '</svg>';
          i.dataset.kind = name;
          return i;
        };
        const WHO = '<circle cx="10" cy="6.4" r="3.1" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
          '<path d="M3.8 16.6c.7-3 3.2-4.6 6.2-4.6s5.5 1.6 6.2 4.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
        const WHAT = '<rect x="3" y="3" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
          '<rect x="11" y="3" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
          '<rect x="3" y="11" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
          '<path d="M14 11.4v5.2M11.4 14h5.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';

        const who = card.querySelector('.prodcard__who');
        if (who && !who.querySelector('.pc-ic')) {
          const txt = who.textContent.replace(/^\s*Who it'?s for:\s*/i, '').trim();
          who.textContent = '';
          const col = document.createElement('span');
          col.className = 'pc-col';
          col.innerHTML = '<span class="pc-lab">Who it\u2019s for</span>';
          col.append(document.createTextNode(txt));
          who.append(mk('who', WHO), col);
        }
        const pills = card.querySelector('.prodcard__pills');
        if (pills && !card.querySelector('.pc-foot__what')) {
          const wrap = document.createElement('div');
          wrap.className = 'pc-foot__what';
          pills.insertAdjacentElement('beforebegin', wrap);
          const col = document.createElement('div');
          col.className = 'pc-col';
          col.innerHTML = '<span class="pc-lab">What it does</span>';
          wrap.append(mk('what', WHAT), col);
          col.append(pills);
        }
      });
    });
  };

  build();

  /* the pictures come from the set we shot for the film and the product stills */
  const PIC = {
    'p-audiences':           '/assets/img/products/targeting-machine-new.jpg',
    'p-leads':               '/assets/img/products/newvoices-voice.jpg',   /* New Voices: the voice, live below */
    'p-marketing_ops':       '/assets/img/products/your-data-walker.jpg',
    'p-ai_workspace':        '/assets/img/products/agent-cloud-code.jpg',
    'p-brand_health':        '/assets/img/tabs/questbrand-women.jpg',
    'p-research':            '/assets/img/hero-film/2.jpg',
    'p-business_impact':     '/assets/img/brand-growth.jpg',
    'p-reputation':          '/assets/img/hero-film/4.jpg',
    'p-media_monitoring':    '/assets/img/hero-film/5.jpg',
    'p-ai_visibility':       '/assets/img/tabs/geopulse.jpg',
    'p-real_world_behavior': '/assets/img/numetrix.jpg',
    'p-competitive':         '/assets/img/hero-film/agent-cloud.jpg',
    'p-newly_added':         '/assets/img/tabs/media-machine.jpg'
  };
  const repic = () => {
    Object.keys(PIC).forEach(id => {
      const img = document.querySelector('#' + id + ' .prodgroup__pic');
      if (img && !img.dataset.pcPic) { img.dataset.pcPic = '1'; img.src = PIC[id]; img.removeAttribute('srcset'); }
    });
  };
  repic();

  /* New Voices is shown as its voice, talking, wherever its picture would be */
  const voice = () => {
    const pic = document.querySelector('.pl-c #p-leads .prodgroup__pic');
    if (pic && window.hcVoice && !pic.dataset.pcVoice) {
      pic.dataset.pcVoice = '1';
      window.hcVoice(pic.parentElement, { after: pic, mid: 0.3 });
    }
  };
  voice();

  /* the closing block on these pages ends the way the homepage ends: the ask, then the two ways in.
     The pair lives inside the chat panel that only opens later, so it is lifted out once. */
  const lift = () => {
    const ways = document.querySelector('.ask-end .ask-end__ways');
    const acts = document.querySelector('.ask-end .ask-end__acts');
    const mini = document.querySelector('.ask-end .ask-mini');
    if (!ways || !acts || !mini || ways.dataset.pcLifted) return;
    ways.dataset.pcLifted = '1';
    mini.insertAdjacentElement('afterend', ways);
  };
  lift();

  /* a problem answered by several products shows one at a time, its tabs turning on their own —
     the way the homepage turns its Products stills */
  const tabify = () => {
    document.querySelectorAll('.pl-c .prodgroup[data-pc-multi]').forEach(group => {
      if (group.dataset.pcTabs) return;
      const cards = [...group.querySelectorAll('.prodcard')];
      const holder = group.querySelector('.prodgroup__cards');
      if (cards.length < 2 || !holder) return;
      group.dataset.pcTabs = '1';

      /* the problem's words step off the picture and become the section's heading */
      const words = group.querySelector('.prodgroup__words');
      const head = group.querySelector('.prodgroup__head');
      if (words && head && !words.dataset.pcLifted) {
        words.dataset.pcLifted = '1';
        head.insertAdjacentElement('beforebegin', words);
      }

      /* the still becomes the stage's own background, so no padding can inset it */
      const pic = group.querySelector('.prodgroup__pic');
      if (pic && head && !head.dataset.pcBg) {
        head.dataset.pcBg = '1';
        head.style.setProperty('--pc-bg', 'url("' + pic.getAttribute('src') + '")');
      }

      /* a few words of the heading take the homepage's colour, painted in as it scrolls up */
      const HL = { 'p-influencer': 'influencer and creator', 'p-newly_added': 'added' };
      const hh = words && words.querySelector('.prodgroup__h');
      if (hh && HL[group.id] && !hh.querySelector('.hl') && hh.textContent.includes(HL[group.id])) {
        const phrase = HL[group.id], txt = hh.textContent, at0 = txt.indexOf(phrase);
        hh.textContent = '';
        hh.append(txt.slice(0, at0));
        const sp = document.createElement('span');
        sp.className = 'hl'; sp.dataset.hl = 'orange'; sp.textContent = phrase;
        hh.append(sp, txt.slice(at0 + phrase.length));
        if (window.hcHighlight) requestAnimationFrame(() => window.hcHighlight(sp));
      }

      const strip = document.createElement('div');
      strip.className = 'pc-tabs';
      const tabs = cards.map((card, i) => {
        const title = card.querySelector('.pc-row__h');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pc-tab';
        b.textContent = (title ? title.textContent : '').trim().replace(/\s*\(.*$/, '') || String(i + 1);
        strip.appendChild(b);
        return b;
      });
      if (words && words.parentElement === group) words.insertAdjacentElement('afterend', strip);
      else holder.insertAdjacentElement('afterbegin', strip);

      /* each product gets the homepage's caption card, laid over the still */
      const caps = cards.map((card, ci) => {
        const cap = document.createElement('a');
        cap.className = 'pc-cap';
        const href = card.querySelector('.prodcard__link');
        if (href) cap.href = href.getAttribute('href') || '#';
        const name = (card.querySelector('.pc-row__h') || {}).textContent || '';
        const line = (card.querySelector('.prodcard__pos') || {}).textContent || '';
        cap.innerHTML = '<svg class="pc-cap__arw" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8" ' +
          'stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<span class="pc-cap__eb"></span><span class="pc-cap__h"></span>';
        cap.querySelector('.pc-cap__eb').textContent = name.trim();
        cap.querySelector('.pc-cap__h').textContent = line.trim();
        head.appendChild(cap);
        /* what it is for and what it does stand beside it, in the same dark style */
        const side = document.createElement('div');
        side.className = 'pc-side';
        const who = card.querySelector('.prodcard__who');
        const what = card.querySelector('.pc-foot__what');
        if (who) side.appendChild(who);
        if (what) side.appendChild(what);
        if (side.children.length) { side.dataset.pcFor = String(ci); head.appendChild(side); cap.pcSide = side; }
        /* the way in sits inside the card, under its words */
        if (href) { href.classList.add('pc-go'); cap.appendChild(href); }
        return cap;
      });

      const stage = null;   /* tab backgrounds stay the still (client, 2026-09-17) */

      let at = 0, timer = 0, taken = false, seen = false;
      const still = matchMedia('(prefers-reduced-motion: reduce)');
      const film = () => { if (stage) { stage.show(names[at]); stage.play(seen && !still.matches); } };
      const arm = () => {
        const t = tabs[at];
        if (!t) return;
        t.classList.remove('is-timing');
        void t.offsetWidth;                        /* restart the fill */
        if (!still.matches && !taken) t.classList.add('is-timing');
      };
      /* each product in a group can bring its own still */
      const TAB_PIC = { 'IMAI': '/assets/img/tabs/imai-crowd.jpg', 'Stagwell AI for SMBs': '/assets/img/tabs/smb-right.jpg',
        'The Media Machine': '/assets/img/tabs/media-machine.jpg', 'NewIntel': '/assets/img/tabs/newintel.jpg',
        'Search+': '/assets/img/tabs/geopulse.jpg', 'Stagwell ID Graph': '/assets/img/tabs/id-graph.jpg' };
      const tabPics = tabs.map(t => TAB_PIC[(t.textContent || '').trim()] || null);
      tabPics.forEach(src => { if (src) { const im = new Image(); im.src = src; } });
      const show = i => {
        at = (i + cards.length) % cards.length;
        if (tabPics[at] && head) head.style.setProperty('--pc-bg', 'url("' + tabPics[at] + '")');
        cards.forEach((c, n) => c.classList.toggle('is-on', n === at));
        tabs.forEach((t, n) => t.classList.toggle('is-on', n === at));
        caps.forEach((c, n) => {
          c.classList.toggle('is-on', n === at);
          if (c.pcSide) c.pcSide.classList.toggle('is-on', n === at);
        });
        film();
      };
      const stop = () => { if (timer) { clearInterval(timer); timer = 0; }
        tabs.forEach(t => t.classList.remove('is-timing')); };
      const start = () => {
        if (timer || taken || !seen || still.matches) return;
        arm();
        timer = setInterval(() => { show(at + 1); arm(); }, 4200);
      };
      tabs.forEach((t, i) => t.addEventListener('click', () => { taken = true; stop(); show(i); }));
      /* phones read this section the homepage's way: the card, then the picture, then the arrows */
      if (head && !head.querySelector('.pc-pic')) {
        const pc = document.createElement('div');
        pc.className = 'pc-pic';
        pc.setAttribute('aria-hidden', 'true');
        head.appendChild(pc);
        const nav = document.createElement('div');
        nav.className = 'pc-arrows';
        nav.innerHTML = '<button type="button" class="pc-arrow" data-d="-1" aria-label="Previous product"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 10H5M9 6l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
          '<button type="button" class="pc-arrow" data-d="1" aria-label="Next product"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M11 6l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
        head.insertAdjacentElement('afterend', nav);
        nav.addEventListener('click', e => { const b = e.target.closest('.pc-arrow'); if (!b) return; taken = true; stop(); show(at + (+b.dataset.d)); });
      }
      show(0);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => {
          const was = seen;
          seen = es[0].isIntersecting;
          seen ? start() : stop();
          if (seen !== was && stage) stage.play(seen && !still.matches);
        }, { threshold: .25 }).observe(group);
      } else { seen = true; start(); }
    });
  };
  tabify();

  /* phones: each run of single-product problems becomes one sideways carousel (the homepage's
     suite rail), with the round arrows under it; wider screens get the list back untouched */
  const railMQ = matchMedia('(max-width: 760px)');
  const rails = () => {
    const body = document.querySelector('.pl-c #productsRoot .prodbody');
    if (!body) return;
    if (railMQ.matches) {
      if (body.querySelector(':scope > .pc-rail-wrap')) return;
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          const wrap = document.createElement('div');
          wrap.className = 'pc-rail-wrap';
          const rail = document.createElement('div');
          rail.className = 'pc-rail';
          run[0].before(wrap);
          wrap.appendChild(rail);
          run.forEach(g => rail.appendChild(g));
          const nav = document.createElement('div');
          nav.className = 'pc-arrows pc-arrows--rail';
          nav.innerHTML = '<button type="button" class="pc-arrow" data-d="-1" aria-label="Previous"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 10H5M9 6l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
            '<button type="button" class="pc-arrow" data-d="1" aria-label="Next"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M11 6l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
          wrap.appendChild(nav);
          nav.addEventListener('click', e => {
            const b = e.target.closest('.pc-arrow'); if (!b) return;
            const card = rail.querySelector('.prodgroup');
            rail.scrollBy({ left: (+b.dataset.d) * ((card ? card.getBoundingClientRect().width : 300) + 12), behavior: 'smooth' });
          });
        }
        run = [];
      };
      [...body.children].forEach(k => {
        if (k.matches('.prodgroup:not([data-pc-multi])')) run.push(k); else flush();
      });
      flush();
    } else {
      body.querySelectorAll(':scope > .pc-rail-wrap').forEach(w => {
        w.querySelectorAll('.pc-rail > .prodgroup').forEach(g => w.before(g));
        w.remove();
      });
    }
  };
  rails();
  railMQ.addEventListener('change', rails);

  /* the wide stills reach the true edges of the window, measured rather than assumed */
  const bleed = () => {
    document.querySelectorAll('.pl-c .prodgroup[data-pc-multi] .prodgroup__head').forEach(head => {
      head.style.marginLeft = '0px';
      head.style.marginRight = '0px';
      const r = head.getBoundingClientRect();
      const w = document.documentElement.clientWidth;
      head.style.marginLeft = (-Math.round(r.left)) + 'px';
      head.style.marginRight = (-Math.round(w - r.right)) + 'px';
    });
  };
  const bleedSoon = () => requestAnimationFrame(() => requestAnimationFrame(bleed));
  bleedSoon();
  addEventListener('resize', bleedSoon);
  addEventListener('load', bleedSoon);

  /* the note about the prototype belongs under the two ways in, not above them */
  const note = () => {
    const n = document.querySelector('.pl-c .prodfoot');
    const acts = document.querySelector('.pl-c .ask-end .ask-end__acts');
    if (!n || !acts || n.dataset.pcMoved) return;
    n.dataset.pcMoved = '1';
    acts.insertAdjacentElement('afterend', n);
  };
  note();
  new MutationObserver(() => { build(); repic(); voice(); lift(); note(); tabify(); rails(); bleedSoon(); }).observe(root, { childList: true, subtree: true });
})();

/* ═══ the product page, re-laid (client, 2026-09-17) ═══════════════════════════════════════════
   How it works becomes a list of steps that turns by itself beside one picture with a dark card
   carrying the live step's words; the long use-case descriptions step back; a picture breaks
   the run of text on The Machine. Nothing is rewritten: the words move, they do not change. */
(() => {
  const page = document.querySelector('.pc-page:not(.pl-c)');
  if (!page) return;
  const more = page.querySelector('.pp-more');
  const steps = more && [...more.querySelectorAll('.pp-steps > li')];
  const media = more && more.querySelector('.pp-more__media');
  /* approved B look (body.hc-b): How it works as tabs over one card, as on the solution
     pages. The first tab keeps the product's own picture (New Voices: its live voice); the
     others take stills from the text-free motion-lab loops. */
  if (document.body.classList.contains('hc-b') && steps && steps.length > 1 && media && !more.dataset.pcHow) {
    more.dataset.pcHow = '1';
    const STILLS = ['orbits', 'pulses', 'circuit', 'terrain', 'globe', 'streams', 'mosaic', 'plexus', 'lanes', 'converge', 'charts', 'clusters', 'tunnel', 'block-rain']
      .map(k => '/assets/video/lab/loops/' + k + '-poster.jpg');
    const slug = (document.body.className.match(/pp--([\w-]+)/) || ['', ''])[1];
    const seed = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0);
    const grid = more.querySelector('.pp-more__grid');
    const head = more.querySelector('.pp-more__head');
    more.classList.add('sp-tabs');
    if (head) { const hb = document.createElement('div'); hb.className = 'sp-tabs__head'; head.parentNode.insertBefore(hb, head); hb.appendChild(head); }
    const bar = document.createElement('div');
    bar.className = 'sp-tabs__bar'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'How it works');
    const box = document.createElement('div'); box.className = 'sp-tabs__panels';
    const tabs = [], panels = [];
    steps.forEach((li, k) => {
      const h = ((li.querySelector('h3') || {}).textContent || '').trim();
      const d = ((li.querySelector('p') || {}).textContent || '').trim();
      const t = document.createElement('button');
      t.type = 'button'; t.className = 'sp-tabs__tab'; t.setAttribute('role', 'tab');
      t.id = 'pht-' + k; t.setAttribute('aria-controls', 'php-' + k); t.textContent = li.dataset.tab || h;
      bar.appendChild(t); tabs.push(t);
      const a = document.createElement('article');
      a.className = 'sp-tabs__panel'; a.setAttribute('role', 'tabpanel'); a.id = 'php-' + k; a.setAttribute('aria-labelledby', 'pht-' + k);
      const txt = document.createElement('div'); txt.className = 'sp-tabs__txt';
      const n = document.createElement('p'); n.className = 'sp-tabs__n';
      n.textContent = String(k + 1).padStart(2, '0') + ' / ' + String(steps.length).padStart(2, '0');
      const h3 = document.createElement('h3'); h3.textContent = h;
      txt.append(n, h3);
      if (d) { const pp = document.createElement('p'); pp.textContent = d; txt.append(pp); }
      const pic = document.createElement('div'); pic.className = 'sp-tabs__pic';
      { const im = new Image(); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.src = STILLS[(seed + k) % STILLS.length]; pic.appendChild(im); }
      a.append(txt, pic); box.appendChild(a); panels.push(a);
    });
    grid.parentNode.insertBefore(bar, grid);
    grid.parentNode.insertBefore(box, grid);
    grid.hidden = true;
    const pick = (i, focus) => {
      tabs.forEach((t, n) => { const on = n === i; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      panels.forEach((p, n) => { p.hidden = n !== i; p.classList.toggle('is-on', n === i); });
      if (focus) tabs[i].focus();
      if (bar.scrollWidth > bar.clientWidth + 2) bar.scrollTo({ left: Math.max(0, tabs[i].offsetLeft - 20), behavior: 'smooth' });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(i));
      t.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); pick((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); pick((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    more.classList.add('is-tabbed');
    pick(0);
  }
  if (steps && steps.length > 1 && media && !more.dataset.pcHow) {
    more.dataset.pcHow = '1';
    const grid = more.querySelector('.pp-more__grid');
    grid.classList.add('pc-how');
    const list = document.createElement('div');
    list.className = 'pc-how__list';
    list.setAttribute('role', 'tablist');
    const card = document.createElement('div');
    card.className = 'pc-how__card';
    card.setAttribute('aria-live', 'polite');
    const btns = steps.map((li, i) => {
      const n = (li.querySelector('b') || {}).textContent || String(i + 1).padStart(2, '0');
      const h = (li.querySelector('h3') || {}).textContent || '';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pc-how__tab';
      b.setAttribute('role', 'tab');
      b.innerHTML = '<span class="pc-how__n"></span><span class="pc-how__t"></span><i class="pc-how__bar" aria-hidden="true"></i>';
      b.querySelector('.pc-how__n').textContent = n;
      b.querySelector('.pc-how__t').textContent = h;
      list.appendChild(b);
      return b;
    });
    media.appendChild(card);
    grid.insertBefore(list, grid.firstChild);
    const ol = more.querySelector('.pp-steps');
    if (ol) ol.hidden = true;
    let at = 0, timer = 0, taken = false, seen = false;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const show = i => {
      at = (i + steps.length) % steps.length;
      btns.forEach((b, n) => { b.classList.toggle('is-on', n === at); b.setAttribute('aria-selected', n === at ? 'true' : 'false'); });
      const li = steps[at];
      card.innerHTML = '';
      const n = document.createElement('span'); n.className = 'pc-how__cn'; n.textContent = btns[at].querySelector('.pc-how__n').textContent;
      const h = document.createElement('h3'); h.textContent = (li.querySelector('h3') || {}).textContent || '';
      const p = document.createElement('p'); p.textContent = (li.querySelector('p') || {}).textContent || '';
      card.append(n, h, p);
      /* on a phone the steps are a sideways row: keep the live one in view (the row only, never the page) */
      if (list.scrollWidth > list.clientWidth + 2) {
        const x = btns[at].getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - 20;
        list.scrollTo({ left: Math.max(0, x), behavior: still ? 'auto' : 'smooth' });
      }
      if (!taken && !still) { const bar = btns[at]; bar.classList.remove('is-timing'); void bar.offsetWidth; bar.classList.add('is-timing'); }
    };
    const run = () => { if (timer || taken || !seen || still) return; show(at); timer = setInterval(() => show(at + 1), 5500); };
    const halt = () => { clearInterval(timer); timer = 0; btns.forEach(b => b.classList.remove('is-timing')); };
    btns.forEach((b, i) => b.addEventListener('click', () => { taken = true; halt(); list.classList.add('is-taken'); show(i); }));
    show(0);
    btns[0].classList.remove('is-timing');
    new IntersectionObserver(es => { seen = es[0].isIntersecting; seen ? run() : halt(); }, { threshold: .35 }).observe(grid);
  }

  /* use cases: the groups become tabs (the homepage's), one group's uses at a time */
  const usesSec = page.querySelector('.pp-uses');
  const groups = usesSec ? [...usesSec.querySelectorAll('.pp-uses__group')] : [];
  if (groups.length > 1 && !usesSec.dataset.pcTabs) {
    usesSec.dataset.pcTabs = '1';
    const gridEl = usesSec.querySelector('.pp-uses__grid');
    const strip = document.createElement('div');
    strip.className = 'pc-utabs';
    strip.setAttribute('role', 'tablist');
    const tbs = groups.map((g, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pc-utab'; b.setAttribute('role', 'tab');
      b.textContent = ((g.querySelector('h3') || {}).textContent || '').trim();
      b.addEventListener('click', () => pick(i));
      strip.appendChild(b);
      return b;
    });
    gridEl.parentElement.insertBefore(strip, gridEl);
    gridEl.classList.add('pc-uses');
    const pick = i => {
      tbs.forEach((b, n) => { b.classList.toggle('is-on', n === i); b.setAttribute('aria-selected', n === i ? 'true' : 'false'); });
      groups.forEach((g, n) => { g.hidden = n !== i; });
      if (strip.scrollWidth > strip.clientWidth + 2) {
        const x = tbs[i].getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft - 24;
        strip.scrollTo({ left: Math.max(0, x), behavior: 'smooth' });
      }
    };
    pick(0);
  }

  /* proof: the figures count up once, when they are first seen */
  const figs = [...page.querySelectorAll('.pp-proof .pp-figs strong')];
  if (figs.length && !matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const parts = figs.map(el => {
      const m = el.textContent.match(/^(\D*)(\d+(?:[.,]\d+)?)(?:([–-])(\d+(?:[.,]\d+)?))?(.*)$/);
      return m ? { el, pre: m[1], a: parseFloat(m[2]), dash: m[3] || '', b: m[4] ? parseFloat(m[4]) : null, post: m[5], text: el.textContent } : null;
    });
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now(), D = 1400;
      const tick = now => {
        const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
        parts.forEach(p => {
          if (!p) return;
          if (k >= 1) { p.el.textContent = p.text; return; }
          p.el.textContent = p.pre + Math.round(p.a * e) + (p.b !== null ? p.dash + Math.round(p.b * e) : '') + p.post;
        });
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: .4 });
    io.observe(figs[0].closest('.pp-figs'));
  }

  /* a picture between the reasons and the uses, so the page is not text after text */
  const uses = page.querySelector('.pp-uses');
  const BREAK = { 'pp--the-machine': '/assets/img/tabs/machine-words.jpg' };
  const key = Object.keys(BREAK).find(k => page.classList.contains(k));
  if (uses && key && !page.querySelector('.pc-break')) {
    const fig = document.createElement('figure');
    fig.className = 'pc-break';
    fig.setAttribute('aria-hidden', 'true');
    fig.innerHTML = '<img alt="" loading="lazy" decoding="async">';
    fig.querySelector('img').src = BREAK[key];
    uses.insertAdjacentElement('beforebegin', fig);
  }
})();

/* New Voices' own page shows its voice, talking, in place of the picture */
(() => {
  const media = document.querySelector('.pc-page.pp--newvoices .pp-more__media');
  if (media && window.hcVoice) window.hcVoice(media, { mid: 0.3 });
})();

/* the closing block on every product page ends with the two ways in, as the homepage does.
   The pair sits inside the chat panel that only opens later, so it is lifted out once. */
(function () {
  'use strict';
  if (!document.body.classList.contains('pc-page')) return;
  const ways = document.querySelector('.ask-end .ask-end__ways');
  const acts = document.querySelector('.ask-end .ask-end__acts');
  if (!ways || !acts || ways.dataset.pcLifted) return;
  ways.dataset.pcLifted = '1';
  acts.appendChild(ways);
  const note = document.querySelector('.pc-page .prodfoot');
  if (note && !note.dataset.pcMoved) { note.dataset.pcMoved = '1'; acts.insertAdjacentElement('afterend', note); }
})();


/* approved B look: under the hero, a composed picture after the Manus solution pages. The page's
   own image sits in a rounded card (a product page's film, which plays in place; a solution
   page's picture), with three small product screens around it, each designed for what that
   product does: a live interview, a prompt, a ranking in AI answers, a creator shortlist, a
   flighting plan… Every page gets its own arrangement and its own screens. The screens carry
   labels, not results: no invented figures. */
(function () {
  'use strict';
  const body = document.body;
  if (!body.classList.contains('hc-b') || !body.classList.contains('pc-page') || body.classList.contains('pl-c')) return;
  const hero = document.querySelector('.pp-hero');
  if (!hero || hero.querySelector('.pc-collage')) return;
  const film = document.querySelector('.pp-film');
  if (film) film.hidden = true;                       /* the AI films are not used here */
  const fig = hero.querySelector('.sp-hero__pic');
  const pic = fig && fig.querySelector('img');
  const slug = (body.className.match(/(?:pp|sp)--([\w-]+)/) || ['', 'x'])[1];
  /* the product pages' centre piece: the product's picture; New Voices its live voice */
  const CENTRE = { 'the-machine': '/assets/img/products/your-data-walker.jpg', 'targeting-machine': '/assets/img/products/targeting-machine-new.jpg',
    'agent-cloud': '/assets/img/products/agent-cloud-code.jpg', 'newvoices': 'voice' };
  const centreSrc = pic ? pic.getAttribute('src') : CENTRE[slug];
  if (!centreSrc) return;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* arrangements on a 1080×480 stage: [main, screen 1, screen 2, screen 3] as x, y, w, h */
  const LAYOUT = {
    A: [[250, 20, 580, 420], [0, 170, 330, 260], [860, 20, 220, 200], [790, 236, 290, 220]],
    C: [[310, 0, 460, 480], [0, 40, 330, 214], [30, 272, 300, 200], [750, 140, 330, 230]],
    D: [[170, 40, 740, 380], [0, 250, 300, 220], [790, 0, 290, 200], [770, 272, 310, 200]],
    E: [[0, 30, 660, 420], [620, 0, 300, 236], [800, 256, 280, 214], [510, 272, 270, 204]]
  };
  const mirror = l => l.map(([x, y, w, h]) => [1080 - x - w, y, w, h]);
  LAYOUT.B = mirror(LAYOUT.A); LAYOUT.F = mirror(LAYOUT.E);
  const PLAN = {
    'the-machine': ['A', { t: 'chat', q: 'Brief the Q3 launch for the team', a: 'Done. The brief, the audience and last quarter’s learnings are in one place, shared in Slack and Figma.' }, { t: 'network', title: 'Shared context', items: ['Slack', 'Figma', 'Adobe'] }, { t: 'list', title: 'Agents at work', items: ['Brief drafted', 'Audience refreshed', 'Assets resized'], metas: ['Now', 'Today', 'Today'] }],
    'targeting-machine': ['E', { t: 'prompt', chips: ['Explore', 'Expand', 'Activate'], q: 'Find people already shopping for an electric car' }, { t: 'network', title: 'Identity graph', items: ['People', 'Households', 'Devices'] }, { t: 'donut', title: 'Audience mix', items: ['High intent', 'Lookalikes', 'Re-engage'] }],
    'newvoices': ['A', { t: 'chat', agent: true, q: 'I switched because setup took five minutes.', a: 'What made you look for something new in the first place?' }, { t: 'note', ink: true, q: 'Interview 200 customers about why they switched' }, { t: 'list', title: 'Themes emerging', items: ['Price clarity', 'Onboarding', 'Support speed'], metas: ['Rising', 'Steady', 'New'] }],
    'agent-cloud': ['D', { t: 'prompt', chips: ['Claude', 'ChatGPT', 'Gemini'], q: 'Draft three headlines for the spring campaign' }, { t: 'list', title: 'Marketing agents', items: ['Copywriter', 'Campaign planner', 'Message tester'], metas: ['Ready', 'Ready', 'Running'], faces: true }, { t: 'chat', q: 'Test these two messages with parents', a: 'Message B lands better. Parents called it clearer and more honest.' }],
    questbrand: ['E', { t: 'trend', title: 'Brand health', sub: 'Awareness · last six months', legend: ['Your brand', 'Competitor'] }, { t: 'bars', title: 'Consideration', sub: 'By week' }, { t: 'donut', title: 'Emotional drivers', items: ['Trust', 'Joy', 'Pride'] }],
    questdiy: ['F', { t: 'survey', title: 'Which name do you prefer?', items: ['Option A', 'Option B', 'Option C'] }, { t: 'map', title: 'Respondents', pin: 'Fielding now' }, { t: 'bars', title: 'Responses', sub: 'By day' }],
    bera: ['A', { t: 'trend', title: 'Brand to business', sub: 'Brand strength and revenue', legend: ['Brand strength', 'Revenue'] }, { t: 'gauge', title: 'Pricing power', sub: 'Versus category' }, { t: 'donut', title: 'Audience priority', items: ['Loyals', 'Switchers', 'Prospects'] }],
    knowledge_machine: ['C', { t: 'network', title: 'Signal map', items: ['Owned', 'Earned', 'Competitor'] }, { t: 'trend', title: 'Sentiment', sub: 'Across channels', legend: ['Positive', 'Negative'] }, { t: 'list', title: 'Who is driving it', items: ['Investors', 'Employees', 'Trade press'], metas: ['Rising', 'Steady', 'New'], faces: true }],
    unicepta: ['D', { t: 'list', title: 'Morning briefing', items: ['Narrative shift in trade press', 'Executive interview picked up', 'Policy debate trending'], metas: ['06:00', '06:00', '06:00'] }, { t: 'map', title: 'Coverage', pin: 'Live' }, { t: 'gauge', title: 'Reputation risk', sub: 'This week' }],
    imai: ['E', { t: 'creators', title: 'Creator shortlist', sub: 'Vetted · fraud-checked' }, { t: 'bars', title: 'Campaign reach', sub: 'By week' }, { t: 'chat', q: 'Find beauty creators in Austin with real audiences', a: 'Here is a vetted shortlist. Every audience passed the fraud check.' }],
    smb_platform: ['B', { t: 'creators', title: 'Creators for you', sub: 'Matched to your brand' }, { t: 'donut', title: 'Audience quality', items: ['Real', 'Suspicious', 'Inactive'] }, { t: 'trend', title: 'Campaign return', sub: 'Return and spend', legend: ['Return', 'Spend'] }],
    geopulse: ['F', { t: 'rank', title: 'AI answer share', items: ['ChatGPT', 'Gemini', 'Perplexity', 'Claude'] }, { t: 'prompt', chips: ['Topic', 'Persona', 'Region'], q: 'Best running shoes for flat feet' }, { t: 'trend', title: 'Visibility', sub: 'You and rivals', legend: ['You', 'Rivals'] }],
    numetrix: ['C', { t: 'map', title: 'Store visits', pin: 'Exposed audience' }, { t: 'bars', title: 'Foot traffic', sub: 'By day' }, { t: 'donut', title: 'Brand lift', items: ['Exposed', 'Control', 'Baseline'] }],
    media_machine: ['D', { t: 'flight', title: 'Flighting plan', items: ['Search', 'Social', 'CTV', 'Audio', 'OOH'] }, { t: 'bars', title: 'Channel scores', sub: 'Evidence of what works', labels: ['Search', 'Social', 'CTV', 'Audio', 'OOH'] }, { t: 'trend', title: 'Projected lift', sub: 'Plan and current', legend: ['Plan', 'Current'] }],
    newintel: ['E', { t: 'list', title: 'This week', items: ['Pricing change', 'New hires in AI', 'Coverage spike', 'Creator launch'], metas: ['Mon', 'Tue', 'Wed', 'Thu'] }, { t: 'trend', title: 'Share of voice', sub: 'You and a competitor', legend: ['You', 'Competitor'] }, { t: 'bars', title: 'Signals', sub: 'By type' }],
    search_plus: ['A', { t: 'prompt', chips: ['ChatGPT', 'Gemini', 'Perplexity'], q: 'Which CRM is best for a small agency?' }, { t: 'rank', title: 'Recommended in answers', items: ['ChatGPT', 'Gemini', 'Perplexity', 'Grok'] }, { t: 'donut', title: 'Mentions', items: ['Recommended', 'Mentioned', 'Absent'] }],
    id_graph: ['B', { t: 'network', title: 'Identity spine', items: ['People', 'Households', 'Media'] }, { t: 'map', title: 'Coverage', pin: 'United States' }, { t: 'list', title: 'Audiences', items: ['Commuters', 'New parents', 'Home movers'], metas: ['Ready', 'Ready', 'Building'], faces: true }]
  };
  const plan = PLAN[slug] || ['A', { t: 'trend', title: 'Performance', sub: 'Last six months', legend: ['This year', 'Last year'] }, { t: 'bars', title: 'Activity', sub: 'By week' }, { t: 'donut', title: 'Mix', items: ['One', 'Two', 'Three'] }];
  const L = LAYOUT[plan[0]];

  let seed = [...slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const INK = '#0B1220', MID = '#8A8E95', SOFT = '#D6D7D3', FAINT = '#EFEFEC';
  const face = n => { n = ((n % 20) + 20) % 20; return '<i class="sx-face" style="background-position:' + (n % 4) * 100 / 3 + '% ' + Math.floor(n / 4) * 25 + '%"></i>'; };
  const headH = (title, sub) => '<div class="sx-h"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  const series = (n, lo, hi, up) => { const a = []; let v = lo + rnd() * (hi - lo) * 0.4; for (let i = 0; i < n; i++) { v = Math.min(hi, Math.max(lo, v + (rnd() - (up ? 0.3 : 0.5)) * (hi - lo) * 0.35)); a.push(v); } return a; };

  const SCREEN = {
    trend(c, w, h) {
      const cw = w - 36, ch = h - 118, n = 6, a = series(n, 0.15, 0.95, true), b = series(n, 0.1, 0.7, false);
      const P = s => s.map((v, i) => [(i * cw / (n - 1)), ch - v * ch]);
      const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const A = P(a), B = P(b), last = A[n - 1];
      let grid = ''; for (let i = 0; i < 4; i++) grid += '<line x1="0" x2="' + cw + '" y1="' + (i * ch / 3).toFixed(1) + '" y2="' + (i * ch / 3).toFixed(1) + '" stroke="' + FAINT + '"/>';
      return headH(c.title, c.sub) +
        '<div class="sx-legend"><span><i style="background:' + INK + '"></i>' + esc(c.legend[0]) + '</span><span><i style="background:' + MID + '"></i>' + esc(c.legend[1]) + '</span></div>' +
        '<svg class="sx-plot" viewBox="-4 -6 ' + (cw + 8) + ' ' + (ch + 12) + '" width="' + cw + '" height="' + ch + '" aria-hidden="true">' + grid +
        '<path d="' + path(A) + ' L' + cw + ' ' + ch + ' L0 ' + ch + ' Z" fill="' + INK + '" fill-opacity=".06"/>' +
        '<path d="' + path(B) + '" fill="none" stroke="' + MID + '" stroke-width="1.6" stroke-dasharray="4 4"/>' +
        '<path d="' + path(A) + '" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>' +
        '<circle cx="' + last[0] + '" cy="' + last[1].toFixed(1) + '" r="7" fill="' + INK + '" fill-opacity=".12"/><circle cx="' + last[0] + '" cy="' + last[1].toFixed(1) + '" r="3.6" fill="' + INK + '"/></svg>' +
        '<div class="sx-axis"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>';
    },
    bars(c, w, h) {
      const days = c.labels ? c.labels : c.sub === 'By day' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : c.sub === 'By type' ? ['Price', 'Hire', 'Press', 'Social', 'Web'] : ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
      const top = Math.floor(rnd() * days.length);
      let b = ''; days.forEach((d, i) => { const v = i === top ? 0.95 : 0.25 + rnd() * 0.6; b += '<div class="sx-bar' + (i === top ? ' is-top' : '') + '"><i style="height:' + (v * 100).toFixed(0) + '%"></i><em>' + d + '</em></div>'; });
      return headH(c.title, c.sub) + '<div class="sx-bars" style="height:' + (h - 100) + 'px">' + b + '</div>';
    },
    donut(c, w, h) {
      const r = 38, C = 2 * Math.PI * r, p = [0.46 + rnd() * 0.1, 0.24 + rnd() * 0.06]; p.push(1 - p[0] - p[1] - 0.03);
      const cols = [INK, MID, SOFT]; let off = 0, ring = '';
      p.forEach((v, i) => { ring += '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + cols[i] + '" stroke-width="12" stroke-dasharray="' + (v * C).toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-off * C).toFixed(1) + '" transform="rotate(-90 50 50)" stroke-linecap="butt"/>'; off += v + 0.01; });
      return headH(c.title) + '<div class="sx-donut"><svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true"><circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + FAINT + '" stroke-width="12"/>' + ring + '</svg>' +
        '<ul>' + c.items.map((t, i) => '<li><i style="background:' + cols[i] + '"></i>' + esc(t) + '</li>').join('') + '</ul></div>';
    },
    gauge(c, w, h) {
      const v = 0.62 + rnd() * 0.22, R = 58, cx = 70, cy = 66;
      const pt = a => [cx + R * Math.cos(Math.PI * (1 - a)), cy - R * Math.sin(Math.PI * (1 - a))];
      const arc = (a0, a1) => { const s = pt(a0), e = pt(a1); return 'M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + ' A' + R + ' ' + R + ' 0 0 1 ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1); };
      const tip = [cx + (R - 18) * Math.cos(Math.PI * (1 - v)), cy - (R - 18) * Math.sin(Math.PI * (1 - v))];
      return headH(c.title, c.sub) + '<div class="sx-gauge"><svg viewBox="0 0 140 80" width="190" height="108" aria-hidden="true"><path d="' + arc(0, 1) + '" fill="none" stroke="' + FAINT + '" stroke-width="12" stroke-linecap="round"/><path d="' + arc(0, v) + '" fill="none" stroke="' + INK + '" stroke-width="12" stroke-linecap="round"/><line x1="' + cx + '" y1="' + cy + '" x2="' + tip[0].toFixed(1) + '" y2="' + tip[1].toFixed(1) + '" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + INK + '"/></svg>' +
        '<div class="sx-scale"><span>Low</span><span>High</span></div></div>';
    },
    chat(c) {
      const me = '<div class="sx-msg is-me">' + esc(c.q) + '</div>', ai = '<div class="sx-msg"><span class="sx-av">' + (c.agent ? face(7) : '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M12 2.8l1.7 4.8 4.8 1.7-4.8 1.7L12 15.8l-1.7-4.8L5.5 9.3l4.8-1.7z"/></svg>') + '</span><p>' + esc(c.a) + '</p></div>';
      return '<div class="sx-chat">' + (c.agent ? ai + me : me + ai) + '<div class="sx-typing"><i></i><i></i><i></i></div></div>';
    },
    prompt(c) {
      return '<div class="sx-prompt"><div class="sx-chips">' + c.chips.map((t, i) => '<span' + (i ? '' : ' class="is-on"') + '>' + esc(t) + '</span>').join('') + '</div>' +
        '<div class="sx-field"><p>' + esc(c.q) + '<i class="sx-caret"></i></p><div class="sx-field__bar"><span class="sx-plus">+</span><span class="sx-send"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div></div></div>';
    },
    list(c, w, h) {
      const n = Math.max(1, Math.min(c.items.length, Math.floor((h - 64) / 44)));
      return headH(c.title) + '<ul class="sx-list">' + c.items.slice(0, n).map((t, i) => '<li>' + (c.faces ? face(3 + i * 5) : '<i class="sx-ico' + (i ? '' : ' is-on') + '"></i>') + '<span><b>' + esc(t) + '</b></span><em' + (i ? '' : ' class="is-on"') + '>' + esc((c.metas || [])[i] || '') + '</em></li>').join('') + '</ul>';
    },
    rank(c, w, h) {
      return headH(c.title) + '<ul class="sx-rank">' + c.items.slice(0, Math.max(2, Math.floor((h - 58) / 40))).map((t, i) => '<li><em' + (i ? '' : ' class="is-on"') + '>' + esc(t.charAt(0)) + '</em><span>' + esc(t) + '</span><i><b style="width:' + (92 - i * 17 - rnd() * 6).toFixed(0) + '%"' + (i ? '' : ' class="is-on"') + '></b></i></li>').join('') + '</ul>';
    },
    survey(c) {
      return '<div class="sx-q">' + esc(c.title) + '</div><ul class="sx-survey">' + c.items.map((t, i) => '<li' + (i === 1 ? ' class="is-on"' : '') + '><i></i><span>' + esc(t) + '</span><b style="width:' + (i === 1 ? 72 : 30 + rnd() * 30).toFixed(0) + '%"></b></li>').join('') + '</ul><div class="sx-next"><span>Continue</span></div>';
    },
    map(c, w, h) {
      const mw = w - 36, mh = h - 76; let dots = '';
      const land = [[0.18, 0.4, 0.17, 0.3], [0.3, 0.72, 0.08, 0.2], [0.52, 0.35, 0.1, 0.22], [0.56, 0.68, 0.08, 0.22], [0.74, 0.38, 0.17, 0.26], [0.86, 0.78, 0.07, 0.12]];
      for (let y = 6; y < mh; y += 9) for (let x = 4; x < mw; x += 9) { const u = x / mw, v = y / mh; if (land.some(l => ((u - l[0]) / l[2]) ** 2 + ((v - l[1]) / l[3]) ** 2 < 1)) dots += '<circle cx="' + x + '" cy="' + y + '" r="1.7" fill="' + SOFT + '"/>'; }
      const pins = [[0.2, 0.42], [0.55, 0.36], [0.76, 0.42], [0.31, 0.7]].map((p, i) => '<circle cx="' + (p[0] * mw).toFixed(0) + '" cy="' + (p[1] * mh).toFixed(0) + '" r="' + (i ? 3.5 : 5) + '" fill="' + INK + '"/>' + (i ? '' : '<circle cx="' + (p[0] * mw).toFixed(0) + '" cy="' + (p[1] * mh).toFixed(0) + '" r="12" fill="' + INK + '" fill-opacity=".12"/>')).join('');
      return headH(c.title) + '<div class="sx-map"><svg viewBox="0 0 ' + mw + ' ' + mh + '" width="' + mw + '" height="' + mh + '" aria-hidden="true">' + dots + pins + '</svg><span class="sx-pin">' + esc(c.pin) + '</span></div>';
    },
    wave(c, w, h) {
      let bars = ''; const n = Math.floor((w - 40) / 6);
      for (let i = 0; i < n; i++) { const u = i / (n - 1), env = Math.pow(Math.sin(Math.PI * u), 0.9); bars += '<i style="height:' + (8 + env * 70 * (0.3 + 0.7 * Math.abs(Math.sin(i * 1.3 + rnd())))).toFixed(0) + '%"></i>'; }
      return '<div class="sx-call">' + face(9) + '<span><b>' + esc(c.title) + '</b><em><i></i>' + esc(c.status) + ' · 04:12</em></span></div><div class="sx-wave">' + bars + '</div>' +
        '<div class="sx-call__acts"><span></span><span class="is-end"></span><span></span></div>';
    },
    creators(c) {
      let g = ''; for (let i = 0; i < 6; i++) g += '<li>' + face([1, 6, 11, 14, 17, 2][i]) + (i % 3 === 0 ? '<b class="sx-ok"></b>' : '') + '</li>';
      return headH(c.title, c.sub) + '<ul class="sx-creators">' + g + '</ul>';
    },
    network(c, w, h) {
      /* a hub in ink, a ring of nodes wired to it, and the three named nodes as pills */
      const top = 58, cw = w - 36, ch = h - top - 16, hub = [cw / 2, ch / 2 + 4];
      const pts = []; const n = 11;
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * Math.PI * 2 + (rnd() - 0.5) * 0.25, d = 0.62 + rnd() * 0.36; pts.push([hub[0] + Math.cos(a) * cw * 0.46 * d, hub[1] + Math.sin(a) * ch * 0.46 * d]); }
      let g = '';
      pts.forEach((p, i) => { g += '<line x1="' + hub[0].toFixed(1) + '" y1="' + hub[1].toFixed(1) + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#CFD0CC" stroke-width="1.1"/>'; const q = pts[(i + 2) % n]; if (i % 3 === 0) g += '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke="#E4E4E0" stroke-width="1"/>'; });
      const named = [1, 5, 8];
      pts.forEach((p, i) => { if (!named.includes(i)) g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.6" fill="' + MID + '"/>'; });
      g += '<circle cx="' + hub[0].toFixed(1) + '" cy="' + hub[1].toFixed(1) + '" r="20" fill="' + INK + '" fill-opacity=".08"/><circle cx="' + hub[0].toFixed(1) + '" cy="' + hub[1].toFixed(1) + '" r="10" fill="' + INK + '"/>';
      const tags = c.items.map((t, i) => { const p = pts[named[i]]; const x = Math.min(w - 44, Math.max(44, 18 + p[0])), y = Math.min(h - 18, Math.max(top + 12, top + p[1])); return '<span class="sx-tag" style="left:' + x.toFixed(0) + 'px;top:' + y.toFixed(0) + 'px">' + esc(t) + '</span>'; }).join('');
      return headH(c.title) + '<svg class="sx-net" viewBox="0 0 ' + cw + ' ' + ch + '" width="' + cw + '" height="' + ch + '" aria-hidden="true">' + g + '</svg>' + tags;
    },
    flight(c, w, h) {
      const rows = c.items.map((t, i) => { const s = rnd() * 45, l = 25 + rnd() * (100 - s - 25); return '<li><span>' + esc(t) + '</span><i><b style="left:' + s.toFixed(0) + '%;width:' + l.toFixed(0) + '%"' + (i === 1 ? ' class="is-on"' : '') + '></b></i></li>'; }).join('');
      return headH(c.title) + '<div class="sx-weeks"><span></span><span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span><span>W6</span></div><ul class="sx-flight">' + rows + '</ul>';
    }
  };

  /* three kinds of scene, as the Manus solution pages vary theirs: a picture with screens
     round it, a fan of tilted cards, or a grid of tiles. Each page names its kind. */
  const SCENE = {
    'agent-cloud': ['fan', [{ t: 'note', ink: true, q: 'Draft three headlines for the spring campaign' }, { t: 'prompt', chips: ['Claude', 'ChatGPT', 'Gemini'], q: 'Draft three headlines for the spring campaign' }, { t: 'list', title: 'Marketing agents', items: ['Copywriter', 'Campaign planner', 'Message tester'], metas: ['Ready', 'Ready', 'Running'], faces: true }, { t: 'note', q: 'Test these two messages with parents' }]],
    questdiy: ['fan', [{ t: 'note', ink: true, q: 'Which name do you prefer?' }, { t: 'survey', title: 'Which name do you prefer?', items: ['Option A', 'Option B', 'Option C'] }, { t: 'map', title: 'Respondents', pin: 'Fielding now' }, { t: 'note', q: 'Field it in 100+ countries' }]],
    search_plus: ['fan', [{ t: 'note', ink: true, q: 'Which CRM is best for a small agency?' }, { t: 'rank', title: 'Recommended in answers', items: ['ChatGPT', 'Gemini', 'Perplexity', 'Grok'] }, { t: 'chat', q: 'Which CRM is best for a small agency?', a: 'Three names come up first. Yours is one of them in two of the three assistants.' }, { t: 'note', q: 'Recommended, not just mentioned' }]],
    smb_platform: ['fan', [{ t: 'note', ink: true, q: 'Find creators who fit my brand' }, { t: 'creators', title: 'Creators for you', sub: 'Matched to your brand' }, { t: 'donut', title: 'Audience quality', items: ['Real', 'Suspicious', 'Inactive'] }, { t: 'note', q: 'Prove ROI without a big team' }]],
    'targeting-machine': ['tiles', { sub: 'Ready to activate', items: ['High intent', 'Lookalikes', 'In market', 'Households', 'Lapsed', 'Loyal'] }],
    media_machine: ['tiles', { sub: 'Scored', items: ['Search', 'Social', 'CTV', 'Audio', 'OOH', 'Retail'] }],
    newintel: ['tiles', { sub: 'This week', items: ['Pricing', 'Hiring', 'Coverage', 'Creators', 'Product', 'Partnerships'] }],
    geopulse: ['tiles', { sub: 'Answers tracked', items: ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'Grok', 'Copilot'] }]
  };
  SCREEN.note = c => '<div class="sx-note' + (c.ink ? ' is-ink' : '') + '"><span class="sx-note__mark"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2.8l1.7 4.8 4.8 1.7-4.8 1.7L12 15.8l-1.7-4.8L5.5 9.3l4.8-1.7z"/></svg></span><p>' + esc(c.q) + '</p></div>';
  const spark = () => { const v = series(8, 0.15, 0.95, true); return '<svg viewBox="0 0 120 40" width="120" height="40" aria-hidden="true"><polyline points="' + v.map((y, i) => (i * 120 / 7).toFixed(1) + ',' + (38 - y * 34).toFixed(1)).join(' ') + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="120" cy="' + (38 - v[7] * 34).toFixed(1) + '" r="3.5" fill="currentColor"/></svg>'; };
  const TONES = ['is-ink', 'is-dark', 'is-light', 'is-white', 'is-light', 'is-ink'];

  const narrow = matchMedia('(max-width: 700px)');
  const kind = SCENE[slug] ? SCENE[slug][0] : 'collage';
  const content = centreSrc === 'voice' ? null : (() => { const im = new Image(); im.src = centreSrc; im.alt = ''; im.decoding = 'async'; return im; })();
  if (fig) fig.hidden = true;
  let wrap = null, ro = null;
  const build = () => {
    const small = narrow.matches;
    const next = document.createElement('div');
    let SW = 1080, SH = 480, html = '';
    const card = (cls, x, y, w, h, inner, rot) => '<div class="pc-collage__card ' + cls + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px' + (rot ? ';rotate:' + rot + 'deg' : '') + '">' + inner + '</div>';
    if (kind === 'fan') {
      const cs = SCENE[slug][1];
      const lay = small ? [[10, 0, 240, 150, -5], [130, 110, 260, 320, 4]] : [[20, 150, 280, 190, -7], [300, 10, 330, 420, 4], [640, 70, 330, 310, -4], [860, 220, 220, 180, 6]];
      SW = small ? 400 : 1080; SH = small ? 440 : 480;
      lay.forEach(([x, y, w, h, r], k) => { const c = cs[k]; html += card('pc-collage__ui pc-collage__ui--' + (k + 1) + ' sx sx--' + c.t, x, y, w, h, SCREEN[c.t](c, w, h), r); });
    } else if (kind === 'tiles') {
      const cfg = SCENE[slug][1]; const cols = small ? 2 : 3, tw = small ? 190 : 340, th = small ? 150 : 220, gap = small ? 20 : 30;
      SW = small ? 400 : 1080; SH = small ? 320 : 470;
      cfg.items.slice(0, small ? 4 : 6).forEach((t, k) => {
        const x = (k % cols) * (tw + gap), y = Math.floor(k / cols) * (th + gap);
        html += card('pc-collage__ui sx sx--tile ' + TONES[(k + seed) % TONES.length], x, y, tw, th,
          '<span class="sx-tile__ico"><i></i></span><div class="sx-tile__body"><b>' + esc(t) + '</b><span>' + esc(cfg.sub) + '</span></div><div class="sx-tile__spark">' + spark() + '</div>');
      });
    } else {
      const lay = small ? [[0, 0, 400, 270], [18, 206, 364, 230]] : L;
      SW = small ? 400 : 1080; SH = small ? 440 : 480;
      html += card('pc-collage__main', ...lay[0], '');
      for (let k = 1; k < lay.length; k++) { const [x, y, w, h] = lay[k], c = plan[k]; html += card('pc-collage__ui pc-collage__ui--' + k + ' sx sx--' + c.t, x, y, w, h, SCREEN[c.t](c, w, h)); }
    }
    next.className = 'pc-collage pc-collage--' + kind + (small ? ' pc-collage--phone' : ' pc-collage--' + plan[0]);
    next.innerHTML = '<div class="pc-collage__stage" style="width:' + SW + 'px;height:' + SH + 'px">' + html + '</div>';
    const main = next.querySelector('.pc-collage__main');
    if (main) { if (content) main.appendChild(content); else if (window.hcVoice) { main.classList.add('has-voice'); window.hcVoice(main, { mid: 0.3 }); } }
    if (wrap) { wrap.replaceWith(next); if (ro) ro.disconnect(); } else hero.appendChild(next);
    wrap = next;
    const stage = wrap.querySelector('.pc-collage__stage');
    const pad = small ? 32 : 40;
    const fit = () => { const W = wrap.clientWidth, k = Math.min(1, (W - pad) / SW); stage.style.setProperty('--k', k.toFixed(4)); stage.style.left = ((W - SW * k) / 2).toFixed(1) + 'px'; stage.style.top = '0px'; wrap.style.height = Math.round(SH * k) + 'px'; };
    fit();
    ro = new ResizeObserver(fit); ro.observe(wrap);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      wrap.classList.add('is-armed');
      const w0 = wrap;
      new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { w0.classList.add('is-in'); io.disconnect(); } }, { threshold: 0.2 }).observe(w0);
    }
  };
  build();
  narrow.addEventListener('change', build);
})();
