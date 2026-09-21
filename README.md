# IELTS Listening Spelling Trainer

A browser-based dictation simulator for the one skill the IELTS Listening test keeps
testing: hearing a surname, postcode or reference code spelled out letter by letter and
typing it in real time without falling behind.

The machine dictates a freshly generated string using the browser's built-in speech
synthesis, you type along, the app scores the attempt with a character-level diff and
adapts the pause between characters to how you actually performed.

- **No lists, no database.** Every surname, UK postcode, US ZIP and reference code is
  generated on the fly from a seeded random number generator, so any item can be retried
  exactly.
- **Real browser voices.** British, American, Australian and other accents come from
  whatever the browser exposes at runtime. Desktop Chrome has the widest voice set.
- **Keyboard only.** Start a session with one key and never touch the mouse.
- **Everything persists** in `localStorage`: settings, the adapted speed and the session
  history.

## Running

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | Development server                                              |
| `npm test`          | Vitest unit tests for the generators, tokeniser, diff and timing |
| `npm run typecheck` | `tsc --noEmit`                                                  |
| `npm run lint`      | ESLint (Next.js config, React Compiler rules)                    |
| `npm run build`     | Production build                                                |

Pages:

- `/` the trainer.
- `/debug` 20 generated items per content type and preset with their spoken token lists,
  a box to speak any string letter by letter with the current gap and voice, and the
  built-in pronunciation map.

## Keys

| State     | Key                     | Action                                                     |
| --------- | ----------------------- | ---------------------------------------------------------- |
| any       | `[` / `]`               | Faster / slower: rate ±0.05 in continuous delivery, gap ∓50 ms in token delivery (applies from the next token) |
| any       | `{` / `}`               | Fine step: rate ±0.01 or gap ∓10 ms                        |
| any       | `Esc`                   | Close the settings drawer or the summary; otherwise abort the item (not scored) |
| Ready     | `Space` / `Enter`       | Start an item                                              |
| Ready     | `S` / `T`               | Settings drawer / session summary                          |
| Dictating | type                    | Every keystroke is recorded with its time                  |
| Dictating | `Enter`                 | Submit early                                               |
| Dictating | `Tab` or `Ctrl+R`       | Replay the item from the start (once, if allowed; counted in stats) |
| Result    | `Enter` / `Space`       | Next item                                                  |
| Result    | `Backspace`             | Retry the same item (same seed, same voice)                |
| Result    | `R`                     | Listen to the item again (not scored)                      |
| Result    | `S` / `T`               | Settings drawer / session summary                          |

The attempt auto-submits when the typed length reaches the target length after dictation
has finished, or after a configurable silence (default 1.5 s) once dictation has finished.

`R` cannot be the replay key while dictating because R is a letter you may need to type,
so replay is on `Tab` (and `Ctrl+R`) during dictation and on `R` in the result view.

## Settings (drawer, key `S`)

| Group    | Control                                                  | Default   |
| -------- | -------------------------------------------------------- | --------- |
| Content  | Content type (surname / UK postcode / US ZIP / reference / mixed with checkboxes) | mixed |
| Content  | Difficulty preset (easy / medium / hard)                 | medium    |
| Content  | Surname flavour (British / American / both)              | both      |
| Content  | Read whole word first (surnames)                         | on        |
| Content  | Announce type ("The postcode is" before spelling)       | on        |
| Speech   | Locale and voice picker, grouped by accent, with a test button | en-GB, default voice |
| Speech   | Random accent each item                                  | off       |
| Speech   | Speech rate 0.5–2.0                                      | 1.0       |
| Speech   | Zero style (oh / zero / random)                          | random    |
| Speech   | Grouping "double L" / "triple 7" (never / always / random) | random  |
| Timing   | Delivery: precise token by token / natural flow (one utterance) | precise |
| Timing   | Pause between letters (natural flow): none / comma / full stop | comma |
| Timing   | Timing mode (precise): pause after token / fixed cadence | pause     |
| Timing   | Gap 0–2000 ms in 10 ms steps, slider or exact number (always visible) | 500 ms |
| Timing   | Adaptive speed                                           | on        |
| Timing   | Auto-submit silence 0.5–3 s                              | 1.5 s     |
| Feedback | Live token boxes while dictating                         | off       |
| Feedback | Allow one replay                                         | on        |
| Feedback | Ding on correct                                          | off       |
| Scoring  | Ignore spaces (postcode space optional)                  | on        |
| Advanced | Letter pronunciation: plain letters / spelled out        | plain     |
| Advanced | Pronunciation map editor (en-GB and en-US columns, per-letter overrides) | built-in map |
| Advanced | Reset speed · Export JSON · Clear history · Reset all settings | —    |

While dictating, a row of boxes shows one box per spoken token with the current one
highlighted. With *live token boxes* on, the boxes also show the spoken text and turn
green or red as you type; with it off they stay blank, which is closer to the exam.

### Adaptive timing

After each attempt the gap for the next item changes:

| Outcome                                                        | Change  |
| -------------------------------------------------------------- | ------- |
| Correct, no replay, every keystroke before the next token began | −100 ms |
| Correct but at least one keystroke lagged behind the speaker    | hold    |
| One character wrong or missing                                  | +50 ms  |
| Two or more wrong, or a replay used                             | +150 ms |
| Every third consecutive correct item                            | extra −50 ms |

In continuous delivery the same rules move the speech rate instead (100 ms of gap
corresponds to 0.10 of rate). Both values are clamped and persisted, so the next session
starts where the last one ended.

### Delivery and timing

An item is spoken as one introductory phrase ("The surname is Bell, that's" / "The
postcode is"), one pause, then the spelling. There are two ways to deliver the spelling
(Settings → Timing):

- **Precise, token by token** (default): each token is its own utterance, so the gap
  slider sets the pause between letters exactly. *Pause after token* measures the gap
  from the moment a token finishes; *fixed cadence* measures it from the moment a token
  starts, so letters land on a steady beat. The engine's measured start-up delay is
  subtracted from every wait so the heard silence is close to the configured gap, and
  0 ms means "as fast as the voice allows".
- **Natural flow, one utterance**: the whole spelling is one utterance, "S, W, 1, A",
  spoken at the voice's own pace with no per-letter delay but no exact control either.
  *Pause between letters* picks the separator (nothing, a comma or a full stop); *speech
  rate* is the fine speed control and adaptive speed moves it. The gap slider then only
  applies after the intro and between postcode halves. Token progress comes from the
  voice's word-boundary events when it provides them (local voices do), otherwise from
  a learned characters-per-second estimate.

The Web Speech API charges a start-up delay for every utterance: roughly 50–150 ms for a
local voice and several hundred milliseconds for a Google network voice. Local voices are
therefore listed first and chosen by default. The `/debug` page shows the measured start
latency and speaking speed of the current voice.

### Letter pronunciation

By default the voice is handed the letter itself ("A", "W", "double L"), which every
modern voice reads as the letter name with natural prosody. If a voice misreads a letter,
switch *Letter pronunciation* to "spelled out" (the §6.2 map: "ay", "double you", "zed"
or "zee" by voice language) or fill in a single cell of the pronunciation map to override
just that letter. Digits and symbols are always spoken as words ("seven", "oh"/"zero",
"dash", "slash").

## Project structure

```
app/
  layout.tsx            root layout, wraps the app in SettingsProvider
  page.tsx              the trainer (Ready -> Dictating -> Result on one screen)
  debug/page.tsx        generator / token / speech debug page
components/
  Trainer.tsx           state machine, keyboard flow, timing capture
  TrainerInput.tsx      the large monospace input (memoised)
  TokenRow.tsx          one box per spoken token, live feedback colouring
  GapTimerBar.tsx       fills over each pause between tokens
  ResultsView.tsx       verdict, aligned diff, spoken form, adaptation message
  KeystrokeSparkline.tsx keystroke dots on a timeline with token-start lines
  StatsBar.tsx          accuracy, streak, current gap
  SessionSummary.tsx    stats, gap trajectory, error heat-map, per-type accuracy, export
  SettingsPanel.tsx     the side drawer
  VoicePicker.tsx       runtime voice enumeration grouped by accent
  PronunciationEditor.tsx editable spoken-form table
  SettingsProvider.tsx  context over the persisted settings and session stores
lib/
  generators/           surname, ukPostcode, usZip, alnum, index (createItem)
  speech/               pronounce (spoken forms), tokenizer (double/triple), speaker
                        (timed utterance queue), voices (enumeration and fallback)
  scoring/              diff (Levenshtein alignment), adaptive (gap rules),
                        stats (lag analysis, session statistics)
  rng.ts                mulberry32 seeded PRNG
  storage.ts            localStorage wrapper with in-memory fallback
  store.ts              persistent stores read through useSyncExternalStore
  settings.ts           defaults and validation
  session.ts            session shape, validation, export
types.ts                shared types
```

## How the content is generated

- **Surnames** are assembled from onset / nucleus / coda fragments in two flavours
  (Anglo and immigrant). Post-filters reject four identical consecutive letters and
  consonant runs of four or more that are not themselves a table fragment. Hard items may
  carry a hyphen or apostrophe (`O'Kearney-Szewicz`).
- **UK postcodes** follow the six official patterns with the letters that never appear
  in a position excluded (no Q, V, X first; no C, I, K, M, O, V inward).
- **US ZIP codes** are five digits, five digits with a forced repeat (to trigger
  "double"), or ZIP+4.
- **Reference codes** come from per-preset templates (`LLDD`, `DDD/LLL-DD`, …); easy
  avoids confusable letters, hard favours them and forces repeated runs.

Every generated string is turned into speech tokens: runs of identical characters become
"double X" / "triple X" according to the grouping mode, spaces become a 1.5× pause,
hyphens are "dash" or "hyphen", digits are words, and letters are either the letter itself
or a spelled-out form ("ay", "double you", "zed"/"zee") depending on the letter
pronunciation setting.

## Notes for this prototype

- Desktop Chrome is the target. Firefox and Safari work but their voices differ.
- Chrome needs a user gesture before the first utterance; pressing Space to start counts.
- If Chrome stops firing `onend` for an utterance, a fallback timeout (about the expected
  spoken length plus a margin) keeps the queue moving.
- Keystroke times are kept in refs, not state, so typing never waits on a render.
