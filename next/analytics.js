/* ═══════════════════════════════════════════════════════════════════════════
   ANALYTICS — one function every important action goes through (brief §45):

       SAIANALYTICS.track(name, properties)

   Destinations, in order, each optional:
     · SAI.events — the in-page bus the demo console reads (redacts PII itself)
     · window.dataLayer — Google Tag Manager, if the page ever carries it
     · window.gtag / window.mixpanel / window.analytics (Segment) — if present
   Nothing is fetched from here; adding a server sink means adding a line
   below, not touching the conversation.

   No personal information is ever passed in: the caller sends the email's
   DOMAIN, never the address, and phone as given:true/false. The bus would
   redact an address anyway; this file makes it a rule, not a rescue.

   The flag: data/kimi.json flags.analytics. With it false the calls are
   no-ops (the SAI bus still gets the record, because the demo console is a
   development tool, not analytics).
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const EVENTS = [
  'kimi_started', 'kimi_goal_selected', 'kimi_free_text_submitted', 'kimi_question_answered',
  'kimi_model_fallback', 'kimi_deterministic_mode', 'kimi_contact_viewed', 'kimi_contact_submitted',
  'kimi_recommendation_generated', 'kimi_product_clicked', 'kimi_demo_clicked',
  'kimi_self_service_clicked', 'kimi_external_site_clicked', 'kimi_lead_delivery'
];

const S = () => window.SAI || null;
const flags = () => { const s = S(); return (s && s.data && s.data.kimi && s.data.kimi.flags) || {}; };
const enabled = () => flags().analytics !== false;

const PII_KEYS = /^(email|phone|name|first|last|address)$/i;
function scrub(props) {
  const out = {};
  Object.keys(props || {}).forEach(k => {
    if (PII_KEYS.test(k)) return;               /* never, whatever the caller meant */
    const v = props[k];
    if (v === undefined) return;
    out[k] = v;
  });
  return out;
}

function track(name, properties) {
  const type = String(name || '');
  if (!type) return null;
  const props = scrub(properties);
  props.ts = Date.now();
  let rec = null;
  try { const s = S(); if (s && s.events) rec = s.events.emit(type, props); } catch (e) { /* the console is not the product */ }
  if (!enabled()) return rec;
  try { if (Array.isArray(window.dataLayer)) window.dataLayer.push(Object.assign({ event: type }, props)); } catch (e) {}
  try { if (typeof window.gtag === 'function') window.gtag('event', type, props); } catch (e) {}
  try { if (window.mixpanel && typeof window.mixpanel.track === 'function') window.mixpanel.track(type, props); } catch (e) {}
  try { if (window.analytics && typeof window.analytics.track === 'function') window.analytics.track(type, props); } catch (e) {}
  return rec;
}

window.SAIANALYTICS = { track, EVENTS: EVENTS.slice(), enabled };
})();
