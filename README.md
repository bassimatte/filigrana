# Filigrana

**Turn drawings into music.**

[Play Filigrana](https://bassimatte.github.io/filigrana/) · [More instruments by bassimat](https://bassimatte.github.io/)

A browser instrument that follows ink in a photograph and weaves gentle generative melodies with three independent travellers. Start with `npm run dev` and open http://127.0.0.1:8437. No installation or API keys are needed.

Press **Listen** to hear the ready-made Floating trio, or choose another arrangement from the **Preset** dropdown. Three colored voice buttons sit above the drawing. Tap one to open its instrument, octave, tuning, and expression settings; tap again or use Close to put it away. Each voice has a separate On/Muted button. Drag a colored point on the drawing to set its origin, or select a voice and click a line. Listen, Restart, and Record stay visible while scrolling. **Journey** groups Pace with interaction and branching; **Main & FX** holds Output, Space (reverb), and Delay. **Settings** holds recording format, numeric journey seed, and credits; **Explore further** holds tuning details, image reading, composition files, and the frequency readout.

Three numbered, colored voices start at different points on the drawing. Each has its own movement state, exploration history, phrase clock, octave shift (−2 to +2), scale selector, and On checkbox in its settings. Turning one off pauses its movement and fades its sound; the others continue. Restart restores all three saved origins. Rebuilding the image resets the origins while preserving octave, tuning, and enabled choices.

A segment is the entire arc between two junctions or endpoints. An isolated ring becomes a self-loop. At endpoints, the traveller retraces its path. Disconnected components do not silently connect or teleport.

Floating is the default: flute, low soft strings, and high felt bell, in G major pentatonic with Independent voices, Wander branching, and 48% room. Each mood sets its own instrument balance, spacing, pace, room, and starting decay; changing moods preserves enabled states and starting points. The original felt bell remains available in every voice’s settings. **Scale · all voices** applies one scale to the trio; changing a voice’s Tuning afterward keeps that voice’s individual choice. The shared selector shows Mixed while the voices use different scales. Each traveller can choose major pentatonic, minor pentatonic, major, natural minor, chromatic, or **Free · no scale** for fractional, unquantized pitches. The voices share the tuning root, pace, output, and effects, while each has its own decay. Octave shifts multiply frequencies by exact powers of two after pitch mapping. Decay changes apply to future notes, preserving existing decays.

Bell pitch starts from inverse line length, compresses the logarithmic range, and stays within MIDI 48–79 before the octave shift. Tuned modes choose the nearest scale note; Free mode keeps the continuous geometric frequency without rounding its pitch or root to a note. Short lines passed during the spacing interval accumulate toward the next note's measured phrase length, rather than generating a flurry of high notes. Long stretches can leave more silence. Every traveller follows every extracted edge; musical grouping does not alter the graph. Each card holds its last struck pitch and strike count; the main readout follows the selected traveller.

Each bell uses multiple sine partials with a rounded attack, a dominant fundamental, soft high partials, independent decays, subtle stereo placement, and a lowpass gently coloured by its traveller's current curve. Up to four unreleased bells overlap per traveller; a fifth fades that traveller's oldest over 250 ms. Each audio channel has its own rapid-strike gate so simultaneous notes from different travellers are permitted. One shared convolution room, gain compensation for the number of active travellers, compressor, and soft limiter keep the ensemble restrained. Each voice has its own decay control; bowed and plucked resonances use that control for filter resonance.

Extraction uses an adaptive local luminance threshold, Zhang–Suen thinning, and junction clustering. Ink sensitivity changes the threshold; Rebuild paths applies it. The supplied photo is the default score, and image uploads stay in the browser. Photography, shadows, fine hatching, and physically broken strokes can cause missing or false connections. Paths view lets you inspect that interpretation. No semantic image model or hand-traced substitute is used.

The original bowed and plucked resonances remain available in each traveller's Instrument selector. Each has its own three parallel bandpass resonators. Their inverse-length mapping (`f = referenceHz × 0.12 × imageDiagonal / segmentLength`) also passes through that traveller's tuning and octave choices, within MIDI 28–96 before transposition. Bow excites continuously; Pluck excites at segment transitions. Ring controls filter Q; the spacing control applies to the twelve note instruments. All three audio channels feed one output and one recorder. Audio starts after Listen or Record and continues when the tab is hidden. Record captures the entire ensemble and effects as MP3 or 24-bit WAV, selected through the settings icon. This is a sonification experiment, not a calibrated physical simulation of an acoustic object.

`npm test` verifies network topology, loop and endpoint handling, independent traversal and origins, inverse-length tuning, scale membership, exact octave ratios, continuous free pitches, resolution invariance, phrase grouping, and curve response. Audio graph tests verify simultaneous strikes and per-traveller voice limits and muting; browser QA separately checks actual playback and recording. The app is buildless: `dist/` is the complete static site.

## Instruments and delay

Each traveller now has an Instrument selector: felt bell, felt piano, nylon harp, wooden kalimba, low marimba, singing bowl, breathy flute, soft bowed strings, bowed resonance, or plucked resonance. The seven new instruments are acoustic-inspired synthesizers rather than sampled recordings. Their partial spectra, attacks, decay times, brightness, breath noise, and vibrato differ. Bowls, flute, and strings leave longer gaps between notes. Instrument choices are independent, and rebuilding the image preserves them.

**Try a calm trio** assigns a low bowl (−1 octave), felt piano (0), and high harp (+1), all in the current root's major pentatonic scale. It preserves all three starting points and enabled states. Each voice has its own Decay control in Expression; the displayed duration reflects that voice and instrument. Bowed and plucked resonances use the control for filter resonance.

Room and delay now receive all instruments. The delay has an On bypass, 100–1800 ms time, 0–65% feedback, and 0–50% wet mix, defaulting to 650 ms / 28% / 18%. A lowpass in the feedback loop darkens successive echoes. Send, feedback, and return fade down on bypass. Feedback is bounded below unity, parameter changes are smoothed, and the effects feed the same compensated, compressed, limited output as the dry voices. Recording includes the whole mix.

`test/audio-render.html`, served alongside `dist/` from the project root, runs real OfflineAudioContext rendering checks: audible finite output without clipping for all twelve note voices, fading delay repeats, delay bypass, stereo placement, and zero-volume silence. It is a development fixture and is excluded from the published static directory. `Resonator.init(context)` accepts an OfflineAudioContext for audio rendering checks; normal playback still creates an AudioContext after Listen.

## Expression, conversation, and compositions

Open **Expression** on any traveller to change its own speed (10–240 px/s), note spacing (0.8–12 seconds before the instrument's breathing factor), volume, and stereo position. **Overall pace** multiplies all three speeds from 25–200%. Volume and pan have independent audio controls for both note instruments and the original resonances; changes are smoothed and do not retune existing notes.

**Independent** is the default interaction. **Call and response** is available under Explore further. Each traveller offers phrases as it reaches junctions. One pending phrase is kept per traveller; ready voices take turns in round-robin order, with the selected silence between phrases. Points continue moving while waiting. Notes already ringing are allowed to decay; continuous resonances fade when another voice answers. Turning a traveller off removes its pending phrase. **Independent** restores simultaneous, freely overlapping journeys. The calm trio now includes different speeds, note spacing, levels, and stereo positions for the bowl, piano, and harp, while preserving origins and on/off choices.

In **Settings → Journey**, choose an open-ended piece or a 2-, 5-, or 10-minute performance and set the numeric journey seed. Timed pieces stop adding notes for the final few seconds and fade smoothly to silence. Pause holds the musical clock. Listen again restarts a finished piece at the saved origins. The seed controls random branching and resets on Restart; it repeats route decisions rather than promising bit-identical audio synthesis.

**Save composition** downloads a `.line-score.json` file containing the original embedded image, extraction sensitivity, exact origins, instrument and tuning choices, expression settings, effects, performance length, interaction, and seed. **Load composition** restores those settings locally without starting audio. Images are embedded rather than linked to remote URLs. Imported numeric controls are bounded, enum choices are validated, and incompatible files are rejected. If image decoding changes graph indices across browsers, origins fall back to the nearest saved image coordinates.

The rendering fixture now includes stereo and zero-volume checks, in addition to the twelve instruments and delay tests. Performance tests cover conversation fairness and spacing, the ending envelope, independent speeds, repeatable seeded routes, and composition validation/round trips. Live browser visual QA depends on the browser connection; the latest update was checked with controller smoke tests and offline Web Audio rendering when that connection was unavailable.

## Sound-quality refinement

Note synthesis now separates attack, body, and release. Flute and strings sustain a fuller body before releasing, while struck and plucked voices decay in two stages. Piano and harp have richer modal spectra; softly detuned, unequal-level unison layers add body to piano and strings without complete beat cancellation. Small deterministic attack/level variations reduce identical retriggers. Breath and short mechanical transients are band-limited, and vibrato enters gradually with a slower drift layer.

Decay varies gently with register, and upper modes decay sooner. Modes above 42% of the sample rate are removed rather than clamped to one high frequency. Notes gradually darken as they ring; curve-based brightness remains a small additional gesture. Voice stealing fades to an exact zero before stopping. Bowed resonances no longer reset their excitation to zero at every junction.

The room uses reproducible stereo early reflections and a frequency-damped diffuse tail, with filtered send/return paths to preserve the dry attack and reduce low-frequency buildup. The delay feedback loop also removes low-frequency accumulation. The master uses subtle warmth/presence EQ, gentler 2:1 compression, and a peak curve that stays linear for normal quiet signals, preserving soft dynamics instead of continuously applying saturation.

Synthesis tests cover envelope ordering, register limits, high-mode removal, bounded note variation, tonal decay, transparent quiet-signal headroom, and room impulse properties. Offline rendering checks include dense three-voice playback with long effect tails and high-register playback at maximum controls. These remain synthesized, acoustic-inspired voices rather than sampled acoustic instruments.

## Hosting and privacy

`dist/` is the complete static website. GitHub Actions runs the tests and deploys that directory to GitHub Pages on each push to `main`. No API keys, server, or accounts are needed. The original private prototype is separate from this repository.

Open the app, press **Listen**, or choose **Try a calm trio**. Upload a clear drawing with dark lines on light paper for the best results. Your uploaded images, compositions, and recordings are processed locally in your browser; they are not uploaded to a service. The bundled demonstration drawing is public as part of this repository. Google Fonts may be requested for typography. Audio starts after a user gesture; recording uses the selected MP3 or WAV format.

The internal composition identifier remains `line-resonator` so saved prototype compositions remain compatible. New downloads use the Filigrana name.

Code and demonstration artwork are published for viewing; no separate reuse license has been granted. Uploaded artwork remains its owner's work.

## Appearance

Choose **Light** or **Dark** in the header. The drawing view menu offers Luminous threads, Faint tracing, Afterimage, Resonant halos, Path waves, Dew, and Mist; the view choice is remembered in this browser. The original photograph keeps its natural colors. Changing appearance or view preserves playback, origins, and composition settings.

## Simpler listening interface

The drawing and voice buttons are visible first. No voice settings or advanced panels open by default. Still, Flowing, and Floating offer complete starting arrangements; editing musical controls marks the arrangement as custom. Appearance remains independent. The fixed playback bar includes recording, whose Save recording action downloads the whole mix. The drawing accepts mouse, pen, and touch point dragging, with select-and-click placement retained. Parameters, graph extraction, composition format, and synthesis remain compatible with earlier versions.

## Felt bell, piano, and bowl refinement

The felt bell now combines a rounded strike with quieter inharmonic modes and a subtle beating overtone. The piano uses register-dependent string stiffness, unequal detuned string layers, a short filtered hammer texture, and faster high-mode decay. The singing bowl uses several unequal mode pairs with slow, different beating rates, a soft articulated onset, and restrained bass. The three profiles also vary their upper-mode attack and brightness slightly with touch and register. These remain synthesized voices, not sampled acoustic recordings.

Upper modes end as they become inaudible, with a brief fade to zero; cleanup follows the longest-ringing oscillator. Additional rendering checks cover the refined trio together at both ends of its register with maximum output and long effects. The interface and saved-composition format are unchanged.

The opening screen keeps only the title, controls, one placement hint, and an upload privacy note. Routine readiness and voice-change messages are silent; errors, loading, recording, and file confirmations still appear. Moods change the instruments and sound balance while preserving the chosen interaction and branching rules.

## Preset dropdown and new voices

Each voice now offers 14 instruments, including glass harmonica, handpan, bass clarinet, and muted vibraphone. Glass uses a slow, noiseless onset, paired overtones, and a gentle swell. Handpan combines tuned metallic modes with a soft hand-strike texture. Bass clarinet emphasizes odd harmonics with breath and a sustained woody body. Muted vibraphone uses damped bar modes and a gentle volume tremolo. These are synthesized interpretations.

| Preset | Voices |
| --- | --- |
| Floating (default) | Flute · strings · felt bell |
| Still | Bowl · piano · harp |
| Flowing | Piano · harp · kalimba |
| Glass garden | Glass harmonica · harp · vibraphone |
| Moonwater | Handpan · bowl · glass harmonica |
| Woodland | Bass clarinet · marimba · kalimba |
| Soft focus | Piano · vibraphone · strings |
| Lanterns | Handpan · harp · felt bell |
| Dusk | Bass clarinet · glass harmonica · bowl |
| Crystal room | Glass harmonica · vibraphone · felt bell |

Presets set instruments, octaves, individual expression, pace, space, decay, and response gap. They preserve starting points, enabled/muted voices, interaction, branching, journey seed, root, overall output, duration, and delay. The dropdown shows Custom for edited arrangements and recognizes matching presets when compositions are loaded. Existing composition files remain compatible.

## Recording settings

The settings icon at the top right selects **MP3** (320 kbps stereo) or **WAV · high resolution** (24-bit stereo PCM). The engine requests 48 kHz audio; if the browser requires another native rate, the settings readout and WAV header reflect that rate. WAV captures the floating-point post-effects mix directly, without passing through a lossy recording or 16-bit PCM. The format preference is remembered separately from compositions.

An AudioWorklet transfers small PCM blocks to a background encoder. MP3 uses the separately bundled, unmodified lamejs library; WAV is packed directly as 24-bit little-endian PCM. Capture is silent on its own output and taps the existing master, so it neither duplicates monitoring nor requires microphone access. Stop flushes the final partial block before saving, and encoder preparation can be cancelled by pausing. Takes auto-save at ten minutes to bound recording memory. Both formats include all voices, volume, room, and delay.

The encoder and corresponding source package are included under `dist/vendor/`; [audio encoder credits](https://bassimatte.github.io/filigrana/licenses.html) provide the upstream acknowledgements, LGPL/GPL texts, and source download. The library stays separate and replaceable. Recording tests check 24-bit headers and precision, real 320 kbps MP3 frames, stereo separation, exact capture limits, partial-buffer flush, cleanup, and cancelled preparation.

Record can start directly from a paused or finished piece: the encoder and capture connect first, then playback begins so the opening notes are included. On an already-playing piece, Record captures the current performance without restarting it. Save recording leaves playback running; Pause saves and pauses. Listen shows Cancel while a paused recording is preparing.

## Background playback

Music runs from audio-thread clock messages rather than animation frames. Switching tabs hides visual updates without pausing the voices, piece duration, or recording. A timer driven by AudioContext time is used if audio worklets are unavailable. Pause and timed endings still stop the music explicitly; returning to the tab redraws the current traveler positions. Browser or operating-system suspension can still suspend an audio context.
