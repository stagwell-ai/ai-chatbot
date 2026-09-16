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
    'p-brand_health':        '/assets/img/hero-film/1.jpg',
    'p-research':            '/assets/img/hero-film/2.jpg',
    'p-business_impact':     '/assets/img/hero-film/3.jpg',
    'p-reputation':          '/assets/img/hero-film/4.jpg',
    'p-media_monitoring':    '/assets/img/hero-film/5.jpg',
    'p-ai_visibility':       '/assets/img/hero-film/6.jpg',
    'p-real_world_behavior': '/assets/img/hero-film/7.jpg',
    'p-competitive':         '/assets/img/hero-film/agent-cloud.jpg'
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
  new MutationObserver(() => { build(); repic(); lift(); }).observe(root, { childList: true, subtree: true });
})();
