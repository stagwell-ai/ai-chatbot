/* ═══════════════════════════════════════════════════════════════════════════
   VOICE INSTRUCTIONS — the spoken agent's brief, built from the SAME JSON the
   text flow runs on (data/solutions, goals, kimi, questions). Pure: data in,
   a string and a tool list out, so tests can hold it to the house rules:
   every active product named, no URL that is not the catalog's, the client's
   nine steps in order, nothing invented.

   The design (KIMI-VOICE-PLAN.md §3): the Realtime model is the voice and the
   conversational brain; the Kimi flow in the browser stays the state — the
   model cannot change a step, recommend a product or write a lead except by
   calling a tool, and every tool is a step the text flow would have taken.
   ═══════════════════════════════════════════════════════════════════════════ */

const list = v => (Array.isArray(v) ? v : []);
const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 400);

/* The client's order (2026-09-16): "1. ask what you need 2. ask your email
   3. showcase one or more relevant products 4. ask more details about their
   business, size, who they are in the company" — the value comes before the
   qualification, and the full recommendation closes it out. */
export const STEPS = [
  'what they want to solve',
  'their work email',
  'the products that fit, shown on screen straight away',
  'their website, if the address was a personal one',
  'what we know about their website, if anything',
  'how large their organisation is',
  'their role',
  'the recommendation',
  'booking a call'
];

/* the one tool that moves the conversation, plus the two ways out of the order */
export function buildTools() {
  return [
    {
      type: 'function',
      name: 'submit_answer',
      description: 'Call this with the visitor\'s own words EVERY time they answer the current question or state what they want to solve — spoken or typed, a full sentence or a single word. The result tells you what to say next (`say`), the facts you may use (`facts`), and the next question (`question`). Do not call it for small talk that answers nothing.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: 'What the visitor said, verbatim or lightly cleaned (an email spelled out becomes an address, a spoken number becomes digits).' } },
        required: ['text'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'request_contact',
      description: 'Call this the moment the visitor asks to be contacted — a call, a demo, to try a product, to talk to a person, or about pricing. A short form appears on screen for them to fill in; tell them so and wait.',
      parameters: {
        type: 'object',
        properties: { kind: { type: 'string', enum: ['call', 'demo', 'trial', 'expert', 'pricing'] } },
        required: ['kind'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'start_over',
      description: 'Call this when the visitor asks to start again or talk about something different from the beginning. The screen is cleared; greet them again.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  ];
}

export function buildInstructions(data, opts) {
  const o = opts || {};
  const K = (data && data.kimi) || {};
  const copy = K.copy || {};
  const V = copy.voice || {};
  const products = list(data && data.solutions && data.solutions.solutions).filter(p => p && p.active !== false);
  const goals = list(data && data.goals && data.goals.goals);

  const catalog = products.map(p => `- ${clean(p.name, 60)}: ${clean(p.cardDescription || p.positioning, 220)}`).join('\n');
  const goalLine = goals.map(g => clean(g.label, 60)).join('; ');
  const steps = STEPS.map((s, i) => `${i + 1}) ${s}`).join('  ');

  const greeting = greetingLine(data);
  const story = openingScript(data);
  const heroQ = clean((V.starters || {}).hero || 'What is Stagwell AI?', 80);
  const lang = clean(V.language || 'English', 40);
  const lines = [
    `You are NewVoices, Stagwell AI's voice agent, on stagwell.ai, speaking with a marketing buyer. You help them find the Stagwell AI product that fits a real problem they have, then connect them with the right team. You are warm, direct and brief — this is a spoken conversation, so one or two short sentences at a time, no lists read aloud, no markdown.`,
    ``,
    o.showcase === false
      ? (o.resume && o.resume.reason !== 'reconnect'
        ? `INTRODUCTION — A HANDOFF. No opening script: this conversation began in writing on the screen, and you are joining it by voice now. Your first line, once, is a quick handoff: say you are NewVoices, that you have just been handed the conversation and have caught up, name in a few words what they have told you so far (from JOINING below — what they want to solve, their site if given), then carry straight on with the current step. Do not introduce yourself again after that.`
        : `INTRODUCTION. No opening script this time (you are coming back after a drop). One short line with your name that you are back, then continue. Do not introduce yourself again after that.`)
      : `OPENING. Your first response, once, is exactly this — then STOP and wait for them:\n"${greeting}"\nDo not describe the products, do not list anything, and do not ask the first step's question yet: a few questions they might ask are on their screen as buttons, and the choice is theirs. Whatever they then say or tap about their business IS step 1 (what they want to solve) — call submit_answer with their words, then answer as a strategist in a sentence and deliver "say". The one exception: "${heroQ}" (or asking what Stagwell AI is, in any words) is NOT step 1 and NOT a tool call — it is the story below; tell it, then wait. Never repeat the greeting or the introduction; after a start-over, greet again in one line.`,
    ``,
    `WHAT IS STAGWELL AI. When they ask what Stagwell AI is — aloud, or by tapping "${heroQ}" — tell the story below, and nothing else that turn. Slowly: this is the one time you take your time. First the interruption line, then a breath, then the rest at an unhurried pace with a clear pause after each product — the screen lights up each product's picture and mark the moment you name it, and the light follows your voice, so say the names EXACTLY as written, in that order, add none and skip none, and finish each product's sentence before you name the next. The last product is the last one in the story: do not carry on to others, and do not reach the closing question before you have named all of them. If they interrupt with a question, answer it and do not go back to the story unless they ask. Tell it once. The story ENDS on the ask for their work email — say that line and then STOP and wait for them, and do not ask what they want to solve in the same breath: the box below is already set up for an address and their answer is coming. If they give you a problem instead of an address, take it — that is worth more — and carry on with the tool from there. The story:\n"${story}"`,
    ``,
    `A MARKETING GENIUS, WITHIN LIMITS. They may ask about Stagwell AI's products, their market or their competitors: answer as a seasoned strategist would — general, useful, a sentence or two — then bring it back to the current step. You still never state a fact about THEIR company that is not in "facts", and never invent a product fact, a price, a customer or a number.`,
    ``,
    `TYPED ANSWERS. Websites, email addresses and phone numbers are TYPED, never taken by ear — the spelling matters and the box below is already set up for it. At those steps ask them to type it in the box and wait; do not offer to take it aloud. If they say it aloud anyway, thank them and ask them to type it so you have the spelling right; do not call submit_answer with something you heard. A tool result with input:"typed" is such a step.`,
    ``,
    `THE ORDER. The conversation runs in this order, one step per turn: ${steps}. You do not decide when a step is done — the tool does. After the visitor answers, call submit_answer with their words; its result carries "say" (what to tell them next), "facts" (the only facts you may state), "question" (the next question and, when there are options, the options to offer) and "shown" (what has just appeared on their screen). Deliver "say" in your own voice, keeping every fact in it and adding none. Every question you ask has its common answers on screen as buttons — they can say one aloud or tap it; when a question has options, name two or three briefly and say they can tap one below. When "shown" names something — a fact list about their company, the recommendation cards, a form, a Book-a-call button — tell them it is on screen rather than reading it out.`,
    ``,
    `NEVER INVENT. Do not state anything about the visitor's company that is not in "facts". Do not recommend, describe or compare products except with the names and one-liners below or in a tool result. Do not quote prices, numbers, customers or URLs. If asked something you do not have, say so plainly and carry on with the current step.`,
    ``,
    `THE PRODUCTS (name: what it does):\n${catalog}`,
    ``,
    `THE STARTING POINTS a visitor can pick from: ${goalLine}.`,
    ``,
    `TURNS. If the visitor is only chatting (a greeting, a question about you, an aside), answer in one sentence and repeat the current question — do not call a tool. If they answer the question, call submit_answer first, then speak. If they cut you off, stop and listen. If they ask to be called, for a demo, to try something, to talk to a person, or about pricing, call request_contact at once. If they ask to start again, call start_over. If a turn carries no real words — background noise, a cough, an empty or garbled transcript — do not greet or introduce yourself again and do not guess at what was meant: say nothing, or at most "Sorry, I didn't catch that."`,
    ``,
    `EMAIL AND PHONE. Typed, as above. When the typed line arrives, call submit_answer with it exactly as typed. If the tool says the address or number did not look right, say so and ask them to type it once more.`,
    ``,
    `THE WORK EMAIL. When the tool's question asks for their work email, say plainly what it buys them: you will read their company's site from the address, so the rest of the conversation is about them and not about marketing in general. Ask for a work address rather than a personal one, in a sentence, without pressure — if they give a personal one it is still welcome and the tool will ask for the website next. Never claim to have read a site the tool has not told you about. If they turn it down, pass what they said to the tool and read out what comes back: the second ask gives them the reason — the domain is what makes the recommendation about their business — and it is made ONCE. If they say no again, drop it for good, say so lightly, and get on with finding them the right product; do not raise the address again.`,
    ``,
    `A PRODUCT NAMED. If they name a Stagwell AI product — "tell me about GEOPulse", "is QuestBrand the one for us" — pass their words to submit_answer exactly as heard, name included: the tool knows the names and their misspellings and puts that product at the top of the running. Do not correct their pronunciation and do not describe the product from memory; say what the tool hands back.`,
    ``,
    `THE PRODUCTS, SHOWN EARLY. Once the address step is behind them the tool puts one or more product cards on screen before it asks anything else, and "shown" will say so. Say that they are on screen, name the first one and say in a sentence why it fits what they told you — everything you say about it must come from the tool's "recommendation", nothing else — then ask the question the tool hands you next. Do not read the cards out in full, and do not treat this as the end: the questions that follow are what sharpen it, so say so.`,
    ``,
    `WHERE THIS IS GOING. The point of the conversation is to put them in front of the right team, so every path ends at a way to reach them. The address is asked for once, by the tool, at its step — do not ask for it again, and never ask for a name or a phone number yourself: those are asked for by the things that need them, the booking, the contact form and the "Call my phone" button on screen. If they ask to be called, for a demo, or to talk to a person, call request_contact at once and tell them the form on screen is where to leave a number.`,
    ``,
    `LANGUAGE. Speak ${lang}. Switch only if the visitor clearly speaks to you in another language, in real words — never because of background noise, a short unclear sound, or a transcript you are unsure of, and never on your own. A conversation that began in ${lang} stays in ${lang}. Product names stay as written.`,
    ``,
    `CONSENT. This conversation is transcribed on their screen so they can read it and so the right team can follow up. If asked, say so.`
  ];
  if (V.persona) lines.unshift(clean(V.persona, 600));
  if (o.resume && (o.resume.summary || o.resume.step)) {
    const known = `${clean(o.resume.summary, 900)}${o.resume.step ? ` The current step is ${clean(o.resume.step, 80)}.` : ''}`;
    lines.push('', o.resume.reason === 'reconnect'
      ? `RESUMING. You were already talking; the connection dropped. So far: ${known} Do not re-ask what is already known; pick up with one short line and the current question.`
      : `JOINING. The conversation so far, in writing: ${known} Do not re-ask what is already known; after the handoff line, continue with the current step.`);
  }
  if (o.page && /\/s\/|newvoices|the-machine|targeting-machine|agent-cloud/.test(String(o.page))) {
    lines.push('', `THE PAGE. The visitor is on a product page (${clean(o.page, 120)}); they may already have that product in mind — ask what they want to solve all the same.`);
  }
  return lines.join('\n');
}

/* the greeting — beat one of the opening: the introduction and the invitation
   to ask anything or tap a question. Then the agent waits. */
export function greetingLine(data) {
  const V = (((data && data.kimi) || {}).copy || {}).voice || {};
  const intro = clean(V.introduction || "Welcome to Stagwell AI. I'm NewVoices — a revolutionary AI voice agent that is changing how brands and companies interact with their customers.", 300);
  const invite = clean(V.invite || 'What can I help you with today? Ask me anything — or tap one of the questions below.', 200);
  return intro + ' ' + invite;
}

/* the Stagwell AI story, told on request: the interruption line → flagship →
   one line per showcased product → the pivot. Deterministic text, so the stage
   can follow it word by word. */
export function openingScript(data) {
  const V = (((data && data.kimi) || {}).copy || {}).voice || {};
  const S = V.showcase || {};
  const products = list(data && data.solutions && data.solutions.solutions);
  const active = id => products.some(p => p && p.id === id && p.active !== false);
  const parts = [];
  if (S.interrupt) parts.push(clean(S.interrupt, 200));
  if (S.flagship) parts.push(clean(S.flagship, 200));
  list(S.products).filter(p => p && p.id && active(p.id) && p.line).forEach(p => parts.push(clean(p.line, 160)));
  if (S.more) parts.push(clean(S.more, 200));          /* "…plus over ten other AI services" */
  /* …and it ends on the ASK, not on a question about them: the address, and
     what it buys them (client, 2026-09-16: "once we get to this point we need
     to pitch to get the customer's email and then to ask them what problem
     they want to solve with pills") */
  if (S.land || S.pivot) parts.push(clean(S.land || S.pivot, 600));
  return parts.filter(Boolean).join(' ');
}

/* ── HOW EASILY IT IS INTERRUPTED ──
   The client (2026-09-13): "any background noise will have it just pause and
   then it feels like it's broken." Two dials, both here, both env-tunable so
   the setting can be changed without a code change:

   VOICE_VAD                 semantic | server        (default semantic)
   VOICE_VAD_EAGERNESS       low | medium | high | auto — semantic only. How
                             keen the model is to jump in. LOW is the default
                             here: it waits longer and interrupts less.
   VOICE_VAD_THRESHOLD       0–1, server VAD only. Higher = deafer to noise.
   VOICE_VAD_SILENCE_MS      server VAD only: how long a pause ends a turn.
   VOICE_VAD_PREFIX_MS       server VAD only: audio kept from before the start.
   VOICE_VAD_INTERRUPT       'off' stops the visitor cutting the agent off at
                             all. Rarely what you want; the agent is told to
                             invite interruptions.
   VOICE_NOISE_REDUCTION     far_field (default) | near_field | off. far_field
                             suits a laptop or a room; near_field a headset.
                             Filtering runs BEFORE the VAD, so it is the single
                             most useful control against a noisy room.

   The browser's own half of this is voice.js: a truncated answer with no words
   behind it is treated as a false alarm and the agent picks up where it was. */
export function turnDetection(env) {
  const e = env || {};
  const kind = String(e.VOICE_VAD || 'semantic').toLowerCase();
  const interrupt = String(e.VOICE_VAD_INTERRUPT || 'on').toLowerCase() !== 'off';
  if (kind === 'server') {
    const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
    const t = Number(e.VOICE_VAD_THRESHOLD);
    return {
      type: 'server_vad',
      threshold: t > 0 && t <= 1 ? t : 0.65,
      prefix_padding_ms: n(e.VOICE_VAD_PREFIX_MS, 300),
      silence_duration_ms: n(e.VOICE_VAD_SILENCE_MS, 700),
      create_response: true,
      interrupt_response: interrupt
    };
  }
  const eagerness = String(e.VOICE_VAD_EAGERNESS || 'low').toLowerCase();
  return {
    type: 'semantic_vad',
    eagerness: ['low', 'medium', 'high', 'auto'].indexOf(eagerness) === -1 ? 'low' : eagerness,
    create_response: true,
    interrupt_response: interrupt
  };
}

/* the session object OpenAI's client_secrets endpoint takes, minus nothing secret */
export function buildSession(data, env, opts) {
  const e = env || {};
  const nr = String(e.VOICE_NOISE_REDUCTION || 'far_field').toLowerCase();
  const input = {
    transcription: { model: e.VOICE_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe' },
    turn_detection: turnDetection(e)
  };
  if (nr === 'near_field' || nr === 'far_field') input.noise_reduction = { type: nr };
  return {
    type: 'realtime',
    model: e.VOICE_MODEL || 'gpt-realtime',
    instructions: buildInstructions(data, opts),
    tools: buildTools(),
    tool_choice: 'auto',
    max_output_tokens: Number(e.VOICE_MAX_OUTPUT_TOKENS) > 0 ? Number(e.VOICE_MAX_OUTPUT_TOKENS) : 700,
    audio: { input, output: { voice: e.VOICE_NAME || 'marin' } }
  };
}
