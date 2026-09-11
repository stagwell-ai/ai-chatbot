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

export const STEPS = [
  'what they want to solve',
  'their website',
  'what we know about their website, if anything',
  'how large their organisation is',
  'their role',
  'the recommendation',
  'their work email',
  'their phone number',
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

  const lines = [
    `You are the Stagwell AI assistant on stagwell.ai, speaking with a marketing buyer. You help them find the Stagwell AI product that fits a real problem they have, then connect them with the right team. You are warm, direct and brief — this is a spoken conversation, so one or two short sentences at a time, no lists read aloud, no markdown.`,
    ``,
    `THE ORDER. The conversation runs in this order, one step per turn: ${steps}. You do not decide when a step is done — the tool does. After the visitor answers, call submit_answer with their words; its result carries "say" (what to tell them next), "facts" (the only facts you may state), "question" (the next question and, when there are options, the options to offer) and "shown" (what has just appeared on their screen). Deliver "say" in your own voice, keeping every fact in it and adding none. When "shown" names something — a fact list about their company, the recommendation cards, a form, a Book-a-call button — tell them it is on screen rather than reading it out.`,
    ``,
    `NEVER INVENT. Do not state anything about the visitor's company that is not in "facts". Do not recommend, describe or compare products except with the names and one-liners below or in a tool result. Do not quote prices, numbers, customers or URLs. If asked something you do not have, say so plainly and carry on with the current step.`,
    ``,
    `THE PRODUCTS (name: what it does):\n${catalog}`,
    ``,
    `THE STARTING POINTS a visitor can pick from: ${goalLine}.`,
    ``,
    `TURNS. If the visitor is only chatting (a greeting, a question about you, an aside), answer in one sentence and repeat the current question — do not call a tool. If they answer the question, call submit_answer first, then speak. If they cut you off, stop and listen. If they ask to be called, for a demo, to try something, to talk to a person, or about pricing, call request_contact at once. If they ask to start again, call start_over.`,
    ``,
    `EMAIL AND PHONE (steps 7 and 8). Hearing an address or a number is error-prone: repeat it back exactly as you understood it and ask them to confirm before calling submit_answer, and offer that it is quickest to type it — the keyboard on screen is already set for it. If the tool says the address or number did not look right, say so and ask once more.`,
    ``,
    `LANGUAGE. Speak the language the visitor speaks. Product names stay as written.`,
    ``,
    `CONSENT. This conversation is transcribed on their screen so they can read it and so the right team can follow up. If asked, say so.`
  ];
  if (V.persona) lines.unshift(clean(V.persona, 600));
  if (o.resume && (o.resume.summary || o.resume.step)) {
    lines.push('', `RESUMING. You were already talking; the connection dropped. So far: ${clean(o.resume.summary, 900)}${o.resume.step ? ` The current step is ${clean(o.resume.step, 80)}.` : ''} Do not re-ask what is already known; pick up with one short line and the current question.`);
  }
  if (o.page && /\/s\/|newvoices|the-machine|targeting-machine|agent-cloud/.test(String(o.page))) {
    lines.push('', `THE PAGE. The visitor is on a product page (${clean(o.page, 120)}); they may already have that product in mind — ask what they want to solve all the same.`);
  }
  return lines.join('\n');
}

/* the session object OpenAI's client_secrets endpoint takes, minus nothing secret */
export function buildSession(data, env, opts) {
  const e = env || {};
  return {
    type: 'realtime',
    model: e.VOICE_MODEL || 'gpt-realtime',
    instructions: buildInstructions(data, opts),
    tools: buildTools(),
    tool_choice: 'auto',
    max_output_tokens: Number(e.VOICE_MAX_OUTPUT_TOKENS) > 0 ? Number(e.VOICE_MAX_OUTPUT_TOKENS) : 700,
    audio: {
      input: {
        transcription: { model: e.VOICE_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe' },
        turn_detection: { type: 'semantic_vad', create_response: true, interrupt_response: true }
      },
      output: { voice: e.VOICE_NAME || 'marin' }
    }
  };
}
