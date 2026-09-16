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

        /* the two lists sit under the row, each behind its own mark */
        const who = card.querySelector('.prodcard__who');
        if (who && !who.querySelector('.pc-lab')) {
          const txt = who.textContent.replace(/^\s*Who it'?s for:\s*/i, '').trim();
          who.textContent = '';
          who.insertAdjacentHTML('afterbegin',
            '<svg class="pc-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
            '<circle cx="10" cy="6.4" r="3.1" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
            '<path d="M3.8 16.6c.7-3 3.2-4.6 6.2-4.6s5.5 1.6 6.2 4.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
            '<span class="pc-lab">Who it\u2019s for</span>');
          who.append(document.createTextNode(txt));
        }
        const pills = card.querySelector('.prodcard__pills');
        if (pills && !card.querySelector('.pc-lab--own')) {
          const lab = document.createElement('p');
          lab.className = 'pc-lab--own';
          lab.innerHTML =
            '<svg class="pc-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
            '<rect x="3" y="3" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
            '<rect x="11" y="3" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
            '<rect x="3" y="11" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
            '<path d="M14 11.4v5.2M11.4 14h5.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
            '<span class="pc-lab">What it does</span>';
          const wrap = document.createElement('div');
          wrap.className = 'pc-foot__what';
          pills.insertAdjacentElement('beforebegin', wrap);
          wrap.append(lab, pills);
        }
      });
    });
  };

  build();
  new MutationObserver(build).observe(root, { childList: true, subtree: true });
})();
