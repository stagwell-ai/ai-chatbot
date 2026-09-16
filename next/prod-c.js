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
        if (name && n.trim() && !name.querySelector('.pc-n')) {
          const tag = document.createElement('span');
          tag.className = 'pc-n';
          tag.textContent = '/' + n.trim() + ' ';
          name.prepend(tag);
        }
        /* the problem this group answers reads as the row's own line, once per group */
        if (i === 0 && problem.trim() && name) {
          const h = document.createElement('p');
          h.className = 'pc-row__h';
          h.textContent = problem.trim();
          name.insertAdjacentElement('afterend', h);
        }
        /* the two lists say what they are */
        const who = card.querySelector('.prodcard__who');
        if (who && !who.querySelector('.pc-lab')) {
          const txt = who.textContent.replace(/^\s*Who it'?s for:\s*/i, '').trim();
          who.textContent = '';
          const lab = document.createElement('span');
          lab.className = 'pc-lab';
          lab.textContent = 'Who it’s for';
          who.append(lab, document.createTextNode(txt));
        }
        const pills = card.querySelector('.prodcard__pills');
        if (pills && !pills.previousElementSibling?.classList?.contains('pc-lab--own')) {
          const lab = document.createElement('p');
          lab.className = 'pc-lab pc-lab--own';
          lab.textContent = 'What it does';
          pills.insertAdjacentElement('beforebegin', lab);
        }
      });
    });
  };

  build();
  new MutationObserver(build).observe(root, { childList: true, subtree: true });
})();
