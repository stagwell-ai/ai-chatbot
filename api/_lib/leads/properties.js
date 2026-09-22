/* ═══════════════════════════════════════════════════════════════════════════
   HUBSPOT PROPERTIES — the contact-property definitions (brief §31–§32) and
   the mapping from a normalised lead onto them. Internal names are stable;
   labels can change. The definitions are created ONCE by
   scripts/hubspot-setup.mjs (or by an admin), never during a visitor's
   request.
   ═══════════════════════════════════════════════════════════════════════════ */
export const GROUP = { name: 'stagwell_ai', label: 'Stagwell AI discovery' };

const opt = (value, label) => ({ value, label: label || value, hidden: false });

export const PROPERTIES = [
  { name: 'stagwell_ai_primary_goal', label: 'Stagwell AI · primary goal', type: 'enumeration', fieldType: 'select',
    options: [opt('brand_awareness', 'Increase brand awareness'), opt('audience_growth', 'Grow your audience'), opt('reputation', 'Protect brand reputation'), opt('competition', 'Track your competition'), opt('brand_impact', 'Measure brand impact'), opt('operations', 'Scale business operations')] },
  { name: 'stagwell_ai_contact_request', label: 'Stagwell AI · asked for', type: 'enumeration', fieldType: 'select',
    options: [opt('call', 'A call'), opt('demo', 'A demo'), opt('trial', 'A trial / to get started'), opt('expert', 'A specialist'), opt('pricing', 'Pricing')] },
  { name: 'stagwell_ai_role', label: 'Stagwell AI · role', type: 'enumeration', fieldType: 'select',
    options: [opt('founder', 'Founder / owner'), opt('manager', 'Marketing manager'), opt('director_vp', 'Director / VP'), opt('c_suite', 'C-suite'), opt('other', 'Other')] },
  { name: 'stagwell_ai_site_known', label: 'Stagwell AI · site recognised', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_industry', label: 'Stagwell AI · industry', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_company_size', label: 'Stagwell AI · company size', type: 'enumeration', fieldType: 'select',
    options: [opt('smb', 'Under 250 people'), opt('mid_market', '250 to 2,500'), opt('enterprise', '2,500 or more')] },
  { name: 'stagwell_ai_use_case', label: 'Stagwell AI · use case', type: 'string', fieldType: 'textarea' },
  { name: 'stagwell_ai_primary_product', label: 'Stagwell AI · primary product', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_secondary_products', label: 'Stagwell AI · secondary products', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_recommendation_confidence', label: 'Stagwell AI · recommendation confidence', type: 'number', fieldType: 'number' },
  { name: 'stagwell_ai_conversation_summary', label: 'Stagwell AI · conversation summary', type: 'string', fieldType: 'textarea' },
  { name: 'stagwell_ai_conversation_steps', label: 'Stagwell AI · conversation steps', type: 'number', fieldType: 'number' },
  { name: 'stagwell_ai_session_id', label: 'Stagwell AI · session id', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_landing_page', label: 'Stagwell AI · landing page', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_utm_source', label: 'Stagwell AI · UTM source', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_utm_medium', label: 'Stagwell AI · UTM medium', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_utm_campaign', label: 'Stagwell AI · UTM campaign', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_utm_content', label: 'Stagwell AI · UTM content', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_llm_mode', label: 'Stagwell AI · model mode', type: 'string', fieldType: 'text' },
  { name: 'stagwell_ai_last_submitted', label: 'Stagwell AI · last submitted', type: 'string', fieldType: 'text' },
  /* what they TICKED on the booking form, as opposed to what the engine
     recommended — the two are worth telling apart when a rep reads the record */
  { name: 'stagwell_ai_products_requested', label: 'Stagwell AI · products they asked about', type: 'string', fieldType: 'textarea' },
  { name: 'stagwell_ai_source', label: 'Stagwell AI · came from', type: 'string', fieldType: 'text' }
];

const CONF = { high: 0.9, medium: 0.6, low: 0.3 };

/* a normalised lead (schema.js) → the flat HubSpot properties object */
export function toHubSpotProperties(lead, summary) {
  const d = lead.discovery || {};
  const a = lead.attribution || {};
  const useCase = [d.rawProblemText, d.summary].filter(Boolean).join(' — ');
  const props = {
    email: lead.email,
    firstname: lead.firstname,
    lastname: lead.lastname,
    phone: lead.phone,
    company: lead.company,
    website: d.website || lead.website,
    jobtitle: d.roleText,                       /* their own words, when they typed a title */
    stagwell_ai_role: d.role,
    stagwell_ai_site_known: d.website ? (d.siteKnown ? 'yes' : 'no') : null,
    stagwell_ai_contact_request: d.contactRequest,
    stagwell_ai_primary_goal: d.primaryGoal,
    stagwell_ai_industry: d.industry,
    stagwell_ai_company_size: d.companySize,
    stagwell_ai_use_case: useCase || null,
    stagwell_ai_primary_product: d.primary,
    stagwell_ai_secondary_products: (d.secondary || []).join(';') || null,
    stagwell_ai_recommendation_confidence: d.confidence ? (CONF[d.confidence.level] != null ? CONF[d.confidence.level] : null) : null,
    stagwell_ai_conversation_summary: summary,
    stagwell_ai_conversation_steps: d.steps != null ? d.steps : null,
    stagwell_ai_session_id: d.sessionId,
    stagwell_ai_landing_page: a.landingPage,
    stagwell_ai_utm_source: a.utmSource,
    stagwell_ai_utm_medium: a.utmMedium,
    stagwell_ai_utm_campaign: a.utmCampaign,
    stagwell_ai_utm_content: a.utmContent,
    stagwell_ai_llm_mode: d.llmStatus ? d.llmStatus + (d.llmProvider ? ' · ' + d.llmProvider : '') : null,
    stagwell_ai_last_submitted: lead.receivedAt,
    stagwell_ai_products_requested: (d.productsRequested || []).join('; ') || null,
    stagwell_ai_source: lead.source || null
  };
  Object.keys(props).forEach(k => { if (props[k] == null || props[k] === '') delete props[k]; });
  return props;
}
