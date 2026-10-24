# Filigrana

**Turn drawings into music.**

[Play Filigrana](https://bassimatte.github.io/filigrana/) · [More instruments by bassimat](https://bassimatte.github.io/)

A browser instrument that follows ink in a photograph and weaves gentle generative melodies with three independent travellers. Start with `npm run dev` and open http://127.0.0.1:8437. No installation or API keys are needed.

Press **Listen** to hear the ready-made Still trio, or choose **Flowing** or **Floating** for another arrangement. Three colored voice buttons sit above the drawing. Tap one to open its instrument, octave, tuning, and expression settings; tap again or use Close to put it away. Each voice has a separate On/Muted button. Drag a colored point on the drawing to set its origin, or select a voice and click a line. Listen, Restart, and Record stay visible while scrolling. **Pace**, **Space**, and **Output** are the main shared controls; **Explore further** holds branching, seed, tuning details, delay, image reading, composition files, and the frequency readout.

Three numbered, colored voices start at different points on the drawing. Each has its own movement state, exploration history, phrase clock, octave shift (−2 to +2), scale selector, and On checkbox in its settings. Turning one off pauses its movement and fades its sound; the others continue. Restart restores all three saved origins. Rebuilding the image resets the origins while preserving octave, tuning, and enabled choices.

A segment is the entire arc between two junctions or endpoints. An isolated ring becomes a self-loop. At endpoints, the traveller retraces its path. Disconnected components do not silently connect or teleport.

Still is the default: low singing bowl, felt piano, and high harp, in G major pentatonic with call-and-response phrasing and 32% room. Each mood sets its own instrument balance, spacing, pace, room, and decay; changing moods preserves enabled states and starting points. The original felt bell remains available in every voice’s settings. Each traveller can independently snap to major pentatonic, minor pentatonic, major, natural minor, or chromatic notes, or use **Free · no scale** for fractional, unquantized pitches. All three share the tuning root and sound controls. Octave shifts multiply frequencies by exact powers of two after pitch mapping. Bell changes apply to future strikes, preserving existing decays.

Bell pitch starts from inverse line length, compresses the logarithmic range, and stays within MIDI 48–79 before the octave shift. Tuned modes choose the nearest scale note; Free mode keeps the continuous geometric frequency without rounding its pitch or root to a note. Short lines passed during the spacing interval accumulate toward the next note's measured phrase length, rather than generating a flurry of high notes. Long stretches can leave more silence. Every traveller follows every extracted edge; musical grouping does not alter the graph. Each card holds its last struck pitch and strike count; the main readout follows the selected traveller.

Each bell uses multiple sine partials with a rounded attack, a dominant fundamental, soft high partials, independent decays, subtle stereo placement, and a lowpass gently coloured by its traveller's current curve. Up to four unreleased bells overlap per traveller; a fifth fades that traveller's oldest over 250 ms. Each audio channel has its own rapid-strike gate so simultaneous notes from different travellers are permitted. One shared convolution room, gain compensation for the number of active travellers, compressor, and soft limiter keep the ensemble restrained. Room and bell decay are adjustable; decay changes apply to subsequent strikes.

Extraction uses an adaptive local luminance threshold, Zhang–Suen thinning, and junction clustering. Ink sensitivity changes the threshold; Rebuild paths applies it. The supplied photo is the default score, and image uploads stay in the browser. Photography, shadows, fine hatching, and physically broken strokes can cause missing or false connections. Paths view lets you inspect that interpretation. No semantic image model or hand-traced substitute is used.

The original bowed and plucked resonances remain available in each traveller's Instrument selector. Each has its own three parallel bandpass resonators. Their inverse-length mapping (`f = referenceHz × 0.12 × imageDiagonal / segmentLength`) also passes through that traveller's tuning and octave choices, within MIDI 28–96 before transposition. Bow excites continuously; Pluck excites at segment transitions. Ring controls filter Q; the spacing control applies to the eight note instruments. All three audio channels feed one output and one recorder. Audio starts only after pressing Listen; it pauses when the page is hidden. Record captures the entire ensemble and effects as WebM, Ogg, or M4A depending on browser support. This is a sonification experiment, not a calibrated physical simulation of an acoustic object.

`npm test` verifies network topology, loop and endpoint handling, independent traversal and origins, inverse-length tuning, scale membership, exact octave ratios, continuous free pitches, resolution invariance, phrase grouping, and curve response. Audio graph tests verify simultaneous strikes and per-traveller voice limits and muting; browser QA separately checks actual playback and recording. The app is buildless: `dist/` is the complete static site.

## Instruments and delay

Each traveller now has an Instrument selector: felt bell, felt piano, nylon harp, wooden kalimba, low marimba, singing bowl, breathy flute, soft bowed strings, bowed resonance, or plucked resonance. The seven new instruments are acoustic-inspired synthesizers rather than sampled recordings. Their partial spectra, attacks, decay times, brightness, breath noise, and vibrato differ. Bowls, flute, and strings leave longer gaps between notes. Instrument choices are independent, and rebuilding the image preserves them.

**Try a calm trio** assigns a low bowl (−1 octave), felt piano (0), and high harp (+1), all in the current root's major pentatonic scale. It preserves all three starting points and enabled states. The shared Decay slider scales each instrument's envelope; the duration readout refers to the traveller selected by Set start. Bowed and plucked resonances retain filter Q instead of a note decay.

Room and delay now receive all instruments. The delay has an On bypass, 100–1800 ms time, 0–65% feedback, and 0–50% wet mix, defaulting to 650 ms / 28% / 18%. A lowpass in the feedback loop darkens successive echoes. Send, feedback, and return fade down on bypass. Feedback is bounded below unity, parameter changes are smoothed, and the effects feed the same compensated, compressed, limited output as the dry voices. Recording includes the whole mix.

`test/audio-render.html`, served alongside `dist/` from the project root, runs real OfflineAudioContext rendering checks: audible finite output without clipping for all eight note voices, fading delay repeats, delay bypass, stereo placement, and zero-volume silence. It is a development fixture and is excluded from the published static directory. `Resonator.init(context)` accepts an OfflineAudioContext for audio rendering checks; normal playback still creates an AudioContext after Listen.

## Expression, conversation, and compositions

Open **Expression** on any traveller to change its own speed (10–240 px/s), note spacing (0.8–12 seconds before the instrument's breathing factor), volume, and stereo position. **Overall pace** multiplies all three speeds from 25–200%. Volume and pan have independent audio controls for both note instruments and the original resonances; changes are smoothed and do not retune existing notes.

**Call and response** is the default interaction. Each traveller offers phrases as it reaches junctions. One pending phrase is kept per traveller; ready voices take turns in round-robin order, with the selected silence between phrases. Points continue moving while waiting. Notes already ringing are allowed to decay; continuous resonances fade when another voice answers. Turning a traveller off removes its pending phrase. **Independent** restores simultaneous, freely overlapping journeys. The calm trio now includes different speeds, note spacing, levels, and stereo positions for the bowl, piano, and harp, while preserving origins and on/off choices.

Choose an open-ended piece or a 2-, 5-, or 10-minute performance. Timed pieces stop adding notes for the final few seconds and fade smoothly to silence. Pause holds the musical clock. Listen again restarts a finished piece at the saved origins. The journey seed controls random branching and resets on Restart; it repeats route decisions rather than promising bit-identical audio synthesis.

**Save composition** downloads a `.line-score.json` file containing the original embedded image, extraction sensitivity, exact origins, instrument and tuning choices, expression settings, effects, performance length, interaction, and seed. **Load composition** restores those settings locally without starting audio. Images are embedded rather than linked to remote URLs. Imported numeric controls are bounded, enum choices are validated, and incompatible files are rejected. If image decoding changes graph indices across browsers, origins fall back to the nearest saved image coordinates.

The rendering fixture now includes stereo and zero-volume checks, in addition to the eight instruments and delay tests. Performance tests cover conversation fairness and spacing, the ending envelope, independent speeds, repeatable seeded routes, and composition validation/round trips. Live browser visual QA depends on the browser connection; the latest update was checked with controller smoke tests and offline Web Audio rendering when that connection was unavailable.

## Sound-quality refinement

Note synthesis now separates attack, body, and release. Flute and strings sustain a fuller body before releasing, while struck and plucked voices decay in two stages. Piano and harp have richer modal spectra; softly detuned, unequal-level unison layers add body to piano and strings without complete beat cancellation. Small deterministic attack/level variations reduce identical retriggers. Breath and short mechanical transients are band-limited, and vibrato enters gradually with a slower drift layer.

Decay varies gently with register, and upper modes decay sooner. Modes above 42% of the sample rate are removed rather than clamped to one high frequency. Notes gradually darken as they ring; curve-based brightness remains a small additional gesture. Voice stealing fades to an exact zero before stopping. Bowed resonances no longer reset their excitation to zero at every junction.

The room uses reproducible stereo early reflections and a frequency-damped diffuse tail, with filtered send/return paths to preserve the dry attack and reduce low-frequency buildup. The delay feedback loop also removes low-frequency accumulation. The master uses subtle warmth/presence EQ, gentler 2:1 compression, and a peak curve that stays linear for normal quiet signals, preserving soft dynamics instead of continuously applying saturation.

Synthesis tests cover envelope ordering, register limits, high-mode removal, bounded note variation, tonal decay, transparent quiet-signal headroom, and room impulse properties. Offline rendering checks include dense three-voice playback with long effect tails and high-register playback at maximum controls. These remain synthesized, acoustic-inspired voices rather than sampled acoustic instruments.

## Hosting and privacy

`dist/` is the complete static website. GitHub Actions runs the tests and deploys that directory to GitHub Pages on each push to `main`. No API keys, server, or accounts are needed. The original private prototype is separate from this repository.

Open the app, press **Listen**, or choose **Try a calm trio**. Upload a clear drawing with dark lines on light paper for the best results. Your uploaded images, compositions, and recordings are processed locally in your browser; they are not uploaded to a service. The bundled demonstration drawing is public as part of this repository. Google Fonts may be requested for typography. Audio starts after a user gesture; recording formats depend on the browser.

The internal composition identifier remains `line-resonator` so saved prototype compositions remain compatible. New downloads use the Filigrana name.

Code and demonstration artwork are published for viewing; no separate reuse license has been granted. Uploaded artwork remains its owner's work.

## Appearance

Choose **Light**, **Dark**, or **Auto** in the header. Auto follows the device appearance; an explicit choice is remembered in this browser. The controls, waveform, and paths view share the selected palette. The original photograph keeps its natural colors. Changing appearance preserves playback, origins, and composition settings.

## Simpler listening interface

The drawing and voice buttons are visible first. No voice settings or advanced panels open by default. Still, Flowing, and Floating offer complete starting arrangements; editing musical controls marks the arrangement as custom. Appearance remains independent. The fixed playback bar includes recording, whose Save recording action downloads the whole mix. The drawing accepts mouse, pen, and touch point dragging, with select-and-click placement retained. Parameters, graph extraction, composition format, and synthesis remain compatible with earlier versions.

## Felt bell, piano, and bowl refinement

The felt bell now combines a rounded strike with quieter inharmonic modes and a subtle beating overtone. The piano uses register-dependent string stiffness, unequal detuned string layers, a short filtered hammer texture, and faster high-mode decay. The singing bowl uses several unequal mode pairs with slow, different beating rates, a soft articulated onset, and restrained bass. The three profiles also vary their upper-mode attack and brightness slightly with touch and register. These remain synthesized voices, not sampled acoustic recordings.

Upper modes end as they become inaudible, with a brief fade to zero; cleanup follows the longest-ringing oscillator. Additional rendering checks cover the refined trio together at both ends of its register with maximum output and long effects. The interface and saved-composition format are unchanged.
