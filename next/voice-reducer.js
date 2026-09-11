/* ═══════════════════════════════════════════════════════════════════════════
   VOICE REDUCER — OpenAI Realtime server events in, thread operations out.
   Pure, like recommend.js: (state, event) → { state, ops }. The browser
   (voice.js) applies the ops to the thread and the flow; the tests feed it
   recorded events and check the ops. Nothing here touches the DOM, the
   network or the key.

   Ops:
     session.ready                       the session is live
     user.speaking / user.silent         mic activity (server VAD)
     me.interim  { itemId, text }        the visitor's words, still arriving
     me.final    { itemId, text }        …final
     ai.start    { responseId }          the agent begins a turn
     ai.delta    { itemId, text }        the agent's words so far (spoken transcript)
     ai.done     { itemId, text }        …final for that item
     ai.cutoff   { itemId }              the visitor cut the agent off
     ai.end      { responseId, status }  the turn is over
     agent.speaking / agent.silent       audio actually playing
     tool.call   { callId, name, args }  the model wants the flow to act
     error       { code, message }

   Client events (what the browser sends back) are built by clientEvents.*
   so their shapes are tested too. Both the GA and the beta names of the
   transcript events are understood.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.SAIVOICEREDUCER = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  function blank() {
    return {
      ready: false,
      listening: false,           /* server VAD says the visitor is talking */
      speaking: false,            /* the agent's audio is playing */
      response: null,             /* { id, itemIds: [], cutoff } while a turn is in flight */
      items: {},                  /* itemId → { role, text, final } */
      calls: {}                   /* callId → { name, args } already surfaced */
    };
  }

  const str = v => (v == null ? '' : String(v));
  const parseArgs = s => { try { const j = JSON.parse(s || '{}'); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } };

  function reduce(prev, event) {
    const st = Object.assign({}, prev || blank(), { items: Object.assign({}, (prev || blank()).items), calls: Object.assign({}, (prev || blank()).calls) });
    const ops = [];
    const e = event || {};
    const type = str(e.type);
    const item = (id, role) => { if (!st.items[id]) st.items[id] = { role, text: '', final: false }; return st.items[id]; };

    switch (type) {
      case 'session.created':
      case 'session.updated':
        if (!st.ready) { st.ready = true; ops.push({ op: 'session.ready' }); }
        break;

      case 'input_audio_buffer.speech_started':
        st.listening = true;
        ops.push({ op: 'user.speaking' });
        /* the visitor talks over the agent: whatever it was saying is cut off */
        if (st.response && !st.response.cutoff) {
          st.response = Object.assign({}, st.response, { cutoff: true });
          st.response.itemIds.forEach(id => ops.push({ op: 'ai.cutoff', itemId: id }));
        }
        break;
      case 'input_audio_buffer.speech_stopped':
        if (st.listening) { st.listening = false; ops.push({ op: 'user.silent' }); }
        break;
      /* the visitor's turn is committed — its item id is known BEFORE the
         transcript, which arrives after the model has often begun to answer.
         The thread reserves their bubble here so it stays above the reply. */
      case 'input_audio_buffer.committed': {
        if (st.listening) { st.listening = false; ops.push({ op: 'user.silent' }); }
        const id = str(e.item_id);
        if (id) { const it = item(id, 'user'); if (!it.placed) { it.placed = true; ops.push({ op: 'me.committed', itemId: id }); } }
        break;
      }
      case 'conversation.item.created':
      case 'conversation.item.added': {
        const it = e.item || {};
        const audio = Array.isArray(it.content) && it.content.some(c => c && c.type === 'input_audio');
        if (it.type === 'message' && it.role === 'user' && audio && str(it.id)) {
          const rec = item(str(it.id), 'user');
          if (!rec.placed) { rec.placed = true; ops.push({ op: 'me.committed', itemId: str(it.id) }); }
        }
        break;
      }

      case 'conversation.item.input_audio_transcription.delta': {
        const it = item(str(e.item_id), 'user');
        it.text += str(e.delta);
        ops.push({ op: 'me.interim', itemId: str(e.item_id), text: it.text });
        break;
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const it = item(str(e.item_id), 'user');
        it.text = str(e.transcript).trim() || it.text;
        it.final = true;
        ops.push({ op: 'me.final', itemId: str(e.item_id), text: it.text });
        break;
      }

      case 'response.created': {
        const id = str(e.response && e.response.id);
        st.response = { id, itemIds: [], cutoff: false };
        ops.push({ op: 'ai.start', responseId: id });
        break;
      }
      case 'response.output_item.added': {
        const it = e.item || {};
        if (it.type === 'message' && it.role === 'assistant') {
          item(str(it.id), 'assistant');
          if (st.response) st.response = Object.assign({}, st.response, { itemIds: st.response.itemIds.concat([str(it.id)]) });
        }
        break;
      }
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
      case 'response.output_text.delta':
      case 'response.text.delta': {
        const it = item(str(e.item_id), 'assistant');
        it.text += str(e.delta);
        if (st.response && st.response.itemIds.indexOf(str(e.item_id)) === -1) st.response = Object.assign({}, st.response, { itemIds: st.response.itemIds.concat([str(e.item_id)]) });
        ops.push({ op: 'ai.delta', itemId: str(e.item_id), text: it.text });
        break;
      }
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
      case 'response.output_text.done':
      case 'response.text.done': {
        const it = item(str(e.item_id), 'assistant');
        const full = str(e.transcript || e.text).trim();
        if (full) it.text = full;
        it.final = true;
        ops.push({ op: 'ai.done', itemId: str(e.item_id), text: it.text });
        break;
      }

      case 'response.function_call_arguments.done': {
        const callId = str(e.call_id);
        if (callId && !st.calls[callId]) {
          st.calls[callId] = { name: str(e.name), args: parseArgs(e.arguments) };
          ops.push({ op: 'tool.call', callId, name: str(e.name), args: st.calls[callId].args });
        }
        break;
      }
      case 'response.output_item.done': {
        const it = e.item || {};
        if (it.type === 'function_call') {
          const callId = str(it.call_id);
          if (callId && !st.calls[callId]) {
            st.calls[callId] = { name: str(it.name), args: parseArgs(it.arguments) };
            ops.push({ op: 'tool.call', callId, name: str(it.name), args: st.calls[callId].args });
          }
        }
        break;
      }

      case 'response.done': {
        const r = e.response || {};
        const id = str(r.id) || (st.response && st.response.id) || '';
        const status = str(r.status) || 'completed';
        if (status === 'cancelled' && st.response && !st.response.cutoff) st.response.itemIds.forEach(x => ops.push({ op: 'ai.cutoff', itemId: x }));
        st.response = null;
        ops.push({ op: 'ai.end', responseId: id, status });
        break;
      }

      case 'output_audio_buffer.started':
        if (!st.speaking) { st.speaking = true; ops.push({ op: 'agent.speaking' }); }
        break;
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        if (st.speaking) { st.speaking = false; ops.push({ op: 'agent.silent' }); }
        break;

      case 'error': {
        const err = e.error || {};
        ops.push({ op: 'error', code: str(err.code || err.type || 'error'), message: str(err.message).slice(0, 200) });
        break;
      }
      default:
        break;
    }
    return { state: st, ops };
  }

  const clientEvents = {
    /* a typed line while voice is open: into the conversation, then answered */
    userText(text) {
      return [
        { type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: str(text) }] } },
        { type: 'response.create' }
      ];
    },
    /* the flow's answer to a tool call, then the model speaks it */
    toolResult(callId, output) {
      return [
        { type: 'conversation.item.create', item: { type: 'function_call_output', call_id: str(callId), output: JSON.stringify(output == null ? {} : output) } },
        { type: 'response.create' }
      ];
    },
    /* the visitor typed or pressed Start over while the agent was talking */
    cancel() {
      return [{ type: 'response.cancel' }, { type: 'output_audio_buffer.clear' }];
    },
    sessionUpdate(patch) {
      return [{ type: 'session.update', session: patch || {} }];
    }
  };

  return { blank, reduce, clientEvents };
});
