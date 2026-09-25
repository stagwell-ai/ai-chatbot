/* ═══════════════════════════════════════════════════════════════════════════
   CHAT-SHAPE.JS — the agent card as one column.

   The card is rendered by hero.js at runtime, so this waits for it and then
   makes only the changes CSS cannot: a flex line-break so the pills fall 3+2,
   the placeholder removed in favour of a caret, and the accent key that tells
   each pill's icon which colour it is.

   Nothing is moved out of .pick — the row handler delegates from there, and
   relocating an element out of its delegating ancestor is what silently broke
   this card once before. The single-column order is done in CSS with `order`,
   so every node stays exactly where hero.js put it.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  /* which accent each pill's icon carries. Keyed by the row id hero.js emits */
  const ACCENT = {
    'pickRow-competitive':  'blue',
    'pickRow-brand_health': 'orange',
    'pickRow-leads':        'green',
    'pickRow-audiences':    'purple',
    'pickRow-__other__':    'pink',
  };

  const shape = () => {
    const list = document.getElementById('pickList');
    const input = document.getElementById('pickSite');
    const wrap = document.getElementById('pickSiteWrap');
    const det = document.getElementById('pickDetail');
    if (!list || !input || !wrap || !det) return false;

    const rows = [...list.querySelectorAll('.pick__row')];
    if (rows.length < 5) return false;

    /* 1 · the accent key */
    rows.forEach(r => { if (ACCENT[r.id]) r.dataset.accent = ACCENT[r.id]; });

    /* 2 · three, then two. A zero-height full-width flex item is the only
       reliable way to state a wrap point; it is not a .pick__row, so the
       delegated click handler steps straight over it. */
    if (!list.querySelector('.pick__break')) {
      const br = document.createElement('span');
      br.className = 'pick__break';
      br.setAttribute('aria-hidden', 'true');
      rows[3].before(br);
    }

    /* 3 · the composer. The placeholder goes; the visually-hidden <span> in the
       <label> still names the field, so nothing is lost to a screen reader.
       No autofocus: stealing focus on load drops keyboard and screen-reader
       users into a text field before they have read the page, and on a phone
       it throws up the keyboard over the whole card. The caret is drawn
       instead, and the real one takes over the moment the field is used. */
    if (input.hasAttribute('placeholder')) input.removeAttribute('placeholder');
    if (!wrap.querySelector('.pick__caret')) {
      const caret = document.createElement('span');
      caret.className = 'pick__caret';
      caret.setAttribute('aria-hidden', 'true');
      wrap.appendChild(caret);
    }
    /* the helper line stands beside the caret rather than instead of it. Its
       words come from the <label>'s own visually-hidden text, so the field is
       still saying exactly what it always said. */
    if (!wrap.querySelector('.pick__ph')) {
      const vh = wrap.querySelector('.vh');
      const ph = document.createElement('span');
      ph.className = 'pick__ph';
      ph.setAttribute('aria-hidden', 'true');
      ph.textContent = (vh && vh.textContent.trim()) || 'Your website (optional)';
      wrap.appendChild(ph);
    }
    /* is-blank means only "the field is empty". Whether it is focused is left
       to :focus-within in CSS — a focus event does not fire when the window
       itself is not focused, and the drawn caret must never be left showing
       next to a real one. */
    const sync = () => { wrap.classList.toggle('is-blank', !input.value); };
    if (!input.dataset.caretWired) {
      input.dataset.caretWired = '1';
      ['input', 'change'].forEach(e => input.addEventListener(e, sync));
    }
    sync();

    /* 4 · the answer panel is re-rendered from data on every choice, so it is
       watched rather than patched once. Two jobs: carry the chosen pill's
       accent onto the panel so its icon matches the pill you just pressed,
       and fold the free-text pane's textarea into the one composer at the
       bottom — two live text boxes in one card is one too many. */
    if (!det.dataset.shaped) {
      det.dataset.shaped = '1';
      const siteLabel = (wrap.querySelector('.vh') || {}).textContent || '';
      const ph = () => wrap.querySelector('.pick__ph');

      const mirror = () => {
        const free = document.getElementById('pickFree');
        if (free) free.value = input.value;
      };

      /* The gradient marks THE PROBLEM the question is about, and where that
         sits in the sentence is an editorial call, not a pattern — the client
         wants "stack up against my competitors" in one title and only "my
         brand" in the next, so counting words or stripping the opener both
         get it wrong. Each phrase is named here and matched by substring, so
         it survives small copy edits and simply falls back if the line is
         rewritten. The phrase can sit anywhere in the line; the words around
         it stay navy. */
      const PROBLEM = [
        'stack up against my competitors',
        'my brand',
        'hand-raises are we losing',
        'the people who actually buy',
        'else',
      ];

      const markHeading = () => {
        const h = det.querySelector('.pick__dh');
        if (!h || h.querySelector('.pick__acc')) return;
        const text = h.textContent.trim();
        if (!text) return;

        let at = -1, phrase = '';
        for (const p of PROBLEM) {
          const i = text.toLowerCase().indexOf(p.toLowerCase());
          if (i >= 0) { at = i; phrase = text.substr(i, p.length); break; }
        }
        /* nothing named for this line: paint its last word rather than nothing */
        if (at < 0) {
          const words = text.split(/\s+/);
          if (words.length < 2) return;
          phrase = words[words.length - 1];
          at = text.length - phrase.length;
        }

        /* if the phrase runs to the end of the line, the punctuation that
           closes it goes in the gradient too — a navy question mark hanging
           off orange words reads as a third colour rather than the end of a
           sentence. A phrase sitting mid-line leaves the rest alone. */
        let rest = text.slice(at + phrase.length);
        if (rest && !/[\p{L}\p{N}]/u.test(rest)) { phrase += rest; rest = ''; }

        const span = document.createElement('span');
        span.className = 'pick__acc';
        span.textContent = phrase;
        h.textContent = '';
        if (at) h.appendChild(document.createTextNode(text.slice(0, at)));
        h.appendChild(span);
        if (rest) h.appendChild(document.createTextNode(rest));
      };

      const sync = () => {
        const chosen = document.querySelector('.pick__row[aria-checked="true"]');
        det.dataset.accent = chosen ? (chosen.dataset.accent || '') : '';
        markHeading();

        const freeLabel = det.querySelector('.pick__free');
        const p = ph();
        if (freeLabel) {
          /* the hidden textarea is still what the form reads, so the composer
             feeds it — nothing about submission changes */
          const ta = freeLabel.querySelector('textarea');
          if (p && ta) p.textContent = ta.getAttribute('placeholder') || siteLabel;
          input.removeEventListener('input', mirror);
          input.addEventListener('input', mirror);
          mirror();
        } else {
          if (p) p.textContent = siteLabel;
          input.removeEventListener('input', mirror);
        }
      };

      new MutationObserver(sync).observe(det, { childList: true, subtree: true });
      sync();
    }

    return true;
  };

  if (!shape()) {
    const mo = new MutationObserver(() => { if (shape()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
    /* hero.js re-renders the card from data; re-apply rather than assume once */
    setTimeout(shape, 1200);
  }
  addEventListener('load', shape);
})();
