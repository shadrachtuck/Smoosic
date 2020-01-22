
class BeamModifierBase {
    constructor() {}
    beamNote(note, iterator, accidentalMap) {}
}

class smoBeamerFactory {
    static applyBeams(measure) {
        for (var i = 0;i < measure.voices.length;++i) {
            var beamer = new smoBeamModifier(measure);
            var apply = new smoBeamerIterator(measure, [beamer],i);
            apply.run();
        }
    }
}

class smoBeamerIterator {
    constructor(measure, actors,i) {
        this.actors = actors;
        this.measure = measure;
        this.voice = i;
    }

    get iterator() {
        return this._iterator;
    }

    //  ### run
    //  ###  Description:  start the iteration on this set of notes
    run() {
        var self = this;
        var iterator = new smoTickIterator(this.measure,{voice:this.voice});
        iterator.iterate((iterator, note, accidentalMap) => {
            for (var i = 0; i < self.actors.length; ++i) {
                self.actors[i].beamNote(iterator, note, accidentalMap);
            }
        });
    }
}

class smoBeamModifier extends BeamModifierBase {
    constructor(measure) {
        super();
        this.measure = measure;
        this.measure.beamGroups = [];
        this.duration = 0;
        this.timeSignature = measure.timeSignature;
        this.meterNumbers = this.timeSignature.split('/').map(number => parseInt(number, 10));

        this.duration = 0;
        // beam on 1/4 notes in most meter, triple time dotted quarter
        this.beamBeats = 2 * 2048;
        if (this.meterNumbers[0] % 3 == 0) {
            this.beamBeats = 3 * 2048;
        }
        this.skipNext = 0;
        this.currentGroup = [];
    }

    get beamGroups() {
        return this.measure.beamGroups;
    }

    _completeGroup(voice) {
        // don't beam groups of 1
        if (this.currentGroup.length > 1) {
            this.measure.beamGroups.push(new SmoBeamGroup({
                    notes: this.currentGroup,
                    voice:voice
                }));
        }
    }

    _advanceGroup() {
        this.currentGroup = [];
        this.duration = 0;
    }
    beamNote(iterator, note, accidentalMap) {
        this.beamBeats = note.beamBeats;

        this.duration += iterator.delta;

        // beam tuplets
        if (note.isTuplet) {
            var tuplet = this.measure.getTupletForNote(note);
            var ult = tuplet.notes[tuplet.notes.length - 1];
            var first = tuplet.notes[0];

            if (first.endBeam) {
                this._advanceGroup();
                return note;
            }

            // is this beamable length-wise
            var vexDuration = smoMusic.closestVexDuration(note.tickCount);
            var stemTicks = VF.durationToTicks.durations[vexDuration];
            if (stemTicks < 4096) {
                this.currentGroup.push(note);
            }
            // Ultimate note in tuplet
            if (ult.attrs.id === note.attrs.id) {
                this._completeGroup(iterator.voice);
                this._advanceGroup();
            }
            return note;
        }

        // don't beam > 1/4 note in 4/4 time
        if (iterator.delta >= 4096) {
			this._completeGroup(iterator.voice);
            this._advanceGroup();
            return note;
        }

        this.currentGroup.push(note);
        if (note.endBeam) {
            this._completeGroup(iterator.voice);
            this._advanceGroup();
        }

        if (this.duration == this.beamBeats) {
            this._completeGroup(iterator.voice);
            this._advanceGroup();
            return note;
        }

        // If this does not align on a beat, don't beam it
        if (this.duration > this.beamBeats) {
			// ||            ((iterator.totalDuration - this.duration) % this.beamBeats != 0)) {
            this._advanceGroup()
            return note;
        }
    }
}
