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
    'p-leads':               '/assets/img/products/new-voices-android.jpg',
    'p-marketing_ops':       '/assets/img/products/the-machine-v2.jpg',
    'p-ai_workspace':        '/assets/img/products/agent-cloud-code.jpg',
    'p-brand_health':        '/assets/img/questbrand.jpg',
    'p-research':            '/assets/img/hero-film/2.jpg',
    'p-business_impact':     '/assets/img/brand-growth.jpg',
    'p-reputation':          '/assets/img/hero-film/4.jpg',
    'p-media_monitoring':    '/assets/img/hero-film/5.jpg',
    'p-ai_visibility':       '/assets/img/geopulse.jpg',
    'p-real_world_behavior': '/assets/img/numetrix.jpg',
    'p-competitive':         '/assets/img/hero-film/agent-cloud.jpg',
    'p-newly_added':         '/assets/img/hero-film/6.jpg'
  };
  const repic = () => {
    Object.keys(PIC).forEach(id => {
      const img = document.querySelector('#' + id + ' .prodgroup__pic');
      if (img && !img.dataset.pcPic) { img.dataset.pcPic = '1'; img.src = PIC[id]; img.removeAttribute('srcset'); }
    });
  };
  repic();

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
      const caps = cards.map(card => {
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
        /* who it's for and what it does move inside the dark card with it */
        const who = card.querySelector('.prodcard__who');
        const what = card.querySelector('.pc-foot__what');
        if (who) cap.appendChild(who);
        if (what) cap.appendChild(what);
        head.appendChild(cap);
        /* the way in rides on the still, at its foot */
        if (href) { href.classList.add('pc-go'); head.appendChild(href); }
        return cap;
      });

      let at = 0, timer = 0, taken = false, seen = false;
      const still = matchMedia('(prefers-reduced-motion: reduce)');
      const show = i => {
        at = (i + cards.length) % cards.length;
        cards.forEach((c, n) => c.classList.toggle('is-on', n === at));
        tabs.forEach((t, n) => t.classList.toggle('is-on', n === at));
        caps.forEach((c, n) => c.classList.toggle('is-on', n === at));
      };
      const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };
      const start = () => {
        if (timer || taken || !seen || still.matches) return;
        timer = setInterval(() => show(at + 1), 4200);
      };
      tabs.forEach((t, i) => t.addEventListener('click', () => { taken = true; stop(); show(i); }));
      show(0);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => {
          seen = es[0].isIntersecting;
          seen ? start() : stop();
        }, { threshold: .25 }).observe(group);
      } else { seen = true; start(); }
    });
  };
  tabify();

  /* the note about the prototype belongs under the two ways in, not above them */
  const note = () => {
    const n = document.querySelector('.pl-c .prodfoot');
    const acts = document.querySelector('.pl-c .ask-end .ask-end__acts');
    if (!n || !acts || n.dataset.pcMoved) return;
    n.dataset.pcMoved = '1';
    acts.insertAdjacentElement('afterend', n);
  };
  note();
  new MutationObserver(() => { build(); repic(); lift(); note(); tabify(); }).observe(root, { childList: true, subtree: true });
})();
