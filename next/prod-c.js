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
      t.id = 'pht-' + k; t.setAttribute('aria-controls', 'php-' + k); t.textContent = h;
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
      if (k === 0) pic.appendChild(media);
      else { const im = new Image(); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.src = STILLS[(seed + k) % STILLS.length]; pic.appendChild(im); }
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
