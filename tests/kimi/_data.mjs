/* Shared loader for the Kimi test suites: the real data/*.json files and the
   pure browser modules, loaded in node exactly as the page loads them. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);

const json = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name + '.json'), 'utf8'));

export const DATA = {
  solutions: json('solutions'),
  goals: json('goals'),
  taxonomy: json('taxonomy'),
  scoring: json('scoring'),
  questions: json('questions'),
  routing: json('routing'),
  kimi: json('kimi')
};

export const R = require(path.join(ROOT, 'next', 'recommend.js'));
export const Q = require(path.join(ROOT, 'next', 'select-question.js'));
export const CARDS = fs.existsSync(path.join(ROOT, 'next', 'cards.js')) ? require(path.join(ROOT, 'next', 'cards.js')) : null;

/* the no-model path, end to end: text → keyword intents + bands → recommendation */
export function readText(text, goal) {
  const intents = R.keywordIntents(text, DATA);
  const bands = R.bandsFromText(text, DATA);
  return R.recommend({ goal: goal || null, intents, companySize: bands.companySize,
    creatorProgramSize: bands.creatorProgramSize, geographicScope: bands.geographicScope }, DATA);
}

/* walk the conversation deterministically: a goal, then answer every question
   with the suggestion whose value is in `picks` (by suggestion id or value) */
export function walk(goal, picks, opts) {
  const o = opts || {};
  const state = { primaryGoal: goal || null, intents: o.intents ? o.intents.slice() : [], askedQuestionIds: [],
    companySize: o.companySize || null, creatorProgramSize: o.creatorProgramSize || null, geographicScope: o.geographicScope || null };
  const trail = [];
  for (let i = 0; i < 12; i++) {
    const reco = R.recommend({ goal: state.primaryGoal, intents: state.intents, companySize: state.companySize,
      creatorProgramSize: state.creatorProgramSize, geographicScope: state.geographicScope }, DATA);
    const q = Q.selectQuestion(state, reco, DATA);
    if (!q) return { state, reco, trail };
    state.askedQuestionIds.push(q.id);
    const pick = (q.suggestions || []).find(s => picks.indexOf(s.id) !== -1 || picks.indexOf(s.value) !== -1) || null;
    trail.push({ id: q.id, picked: pick ? pick.id : null });
    if (pick) Q.applySuggestion(state, q, pick);
  }
  throw new Error('conversation did not end');
}
