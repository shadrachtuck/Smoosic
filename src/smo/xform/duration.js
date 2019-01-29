VF = Vex.Flow;
Vex.Xform = (typeof(Vex.Xform) == 'undefined' ? {}
     : Vex.Xform);
VX = Vex.Xform;

// ## VxDurationFactory:
// Create actors that change the duration of notes, or just re-create existing notes.
// Also creates tuplets.
class VxDurationFactory {
    static VexDurationToTicks(vexDuration) {
        return VF.parseNoteData(VF.parseNoteDurationString(vexDuration)).ticks;
    }
    /*
    ## Calculate the tickmap of a tuplet with respect to one of the notes.
    5
    ---------
    | | | | |
    n n n n n
    A | B | C

    ticks (normalized to tuplet):
    A= ticks before tuplet
    B= duration of new tuplet
    C= ticks after tuplet
    D= total duration of tuplet

    indices:
    index = index of note to change
    Ax=index of first tuplet note
    Bx=offset into tuplet of note to change
    Cx=offset  of first tuplet note after change
     */
    static calculateTupletTicks(tickmap, tuplet, changeIndex, changeTicks) {
        var iterator = tickmap;
        var D = tuplet.tickCount;
        var index = changeIndex;
        var Ax = tuplet.startIndex;
        var Bx = changeIndex - Ax;
        var Cx = Bx + 1;
        var B = changeTicks;
        var A = 0;

        var i;
        // calculate remaining ticks after start note and duration change
        for (i = 0; i < tuplet.notes.length; ++i) {
            var note = tuplet.notes[i];
            if (i + Ax < Bx) {
                A += VF.durationToTicks(note.duration);
            } else if (i + Ax > Bx) {
                C += VF.durationToTicks(note.duration);
            }
        }

        var C = D - (A + B);
        return {
            iterator: iterator,
            tupletInfo: tuplet,
            D: D,
            A: A,
            B: B,
            C: C,
            Ax: Ax,
            Bx: Bx,
            Cx: Cx
        };
    }
    static _createTupletActors(measure, tickmap, notes, exclude) {
        var rv = [];
        var tupletKeys = Object.keys(tickmap.tupletMap);
        for (var i = 0; i < tupletKeys.length; ++i) {
            var tupletInfo = tickmap.tupletMap[tupletKeys[i]];
            if (exclude.length === 0 || exclude.indexOf(tupletInfo.startIndex) < 0) {
                rv.push(new VxReplaceTupletActor(measure, tickmap, tupletInfo));
            }
        }
        return rv;
    }

    // ## vxCreateDurationChangeActors
    // Create actors that either replace existing notes with notes of equal duration,
    // or stretches/contracts existing notes
    static vxCreateDurationChangeActors(measure, index, newTicks) {
        var tickmap = VX.TICKMAP(measure);
        var exclusions = [];
        var actors = [];
        if (index >= 0) {
            exclusions.push(index);
        }
        var actors = VxDurationFactory._createTupletActors(measure, tickmap, measure.notes, exclusions);

        // No duration change, just return the actors to create the tuplets
        if (index < 0) {
            return actors;
        }
        var note = measure.notes[index];
        var oldDuration = (note.ticks.numerator / note.ticks.denominator);

        // Make sure the new duration is valid.
        if (!vexMusic.ticksToDuration[newTicks]) {
            return actors;
        }
        if (vexMusic.isTuplet(note)) {
            // no dotted tuplets
            if (oldDuration > newTicks) {
                if (oldDuration % newTicks !== 0) {
                    return actors;
                }
                actors.push(new VxContractTupletActor(measure, tickmap, tickmap.getTupletInfo(index), index, newTicks));
            } else if (oldDuration < newTicks) {
                // no dots on tuplets
                if (newTicks % oldDuration !== 0) {
                    return actors;
                }
                actors.push(new VxStretchTupletActor(measure, tickmap, tickmap.getTupletInfo(index), index, newTicks));
            }
        } else {
            if (oldDuration > newTicks) {
                actors.push(new VxContractNoteActor(tickmap, startIndex, newTicks));
            } else {
                var remaining = tickmap.totalDuration - tickmap.durationMap[index];
                if (newTicks + remaining > totalDuration) {
                    return actors;
                }
                actors.push(new VxStretchNoteActor(tickmap, index, newTicks));
            }
        }
        return actors;
    }

    static vxCreateMakeTupletActors(measure, index, newTicks, num_notes) {
        var actors = VxDurationFactory.vxCreateDurationChangeActors(measure, -1);
        var tickmap = VX.TICKMAP(measure);
        var note = measure.notes[index];
        var notesOccupied = 4096 / newTicks;
        // TODO: validity checks here
        actors.push(new VxMakeTupletActor(measure, tickmap, index, num_notes, notes_occupied));
        return actors;
    }
    static vxCreateUnmakeTupletActors(measure, index) {
        var actors = VxDurationFactory.vxCreateDurationChangeActors(measure, index);
        var tickmap = VX.TICKMAP(measure);
        var note = measure.notes[index];
        if (!vexMusic.isTuplet(note)) {
            return actors;
        }
        var tupletInfo = tickmap.getTupletInfo(index);
        actors.push(new VxUnmakeTupletActor(tickmap, tupletInfo));
        return actors;
    }
}

// ## VxContractActor
// Contract the duration of a note, filling in the space with another note
// or rest.
//
class VxContractActor extends NoteTransformBase {
    constructor(params) {
        super();
        Vex.Merge(this, params);
    }
    transformNote(note, iterator, accidentalMap) {
        if (iterator.index == this.startIndex) {
            var notes = [];
            var noteCount = Math.floor(note.ticks.numerator / this.newTicks);
            var nextIndex = this.tickmap.durationMap.indexOf(iterator.totalDuration + noteCount * this.newTicks - iterator.delta);
            var notes = [];
            var vexDuration = vexMusic.ticksToDuration[this.newTicks];
            if (nextIndex >= 0) {
                /**
                 *  Replace 1 note with noteCOunt notes of newTIcks duration
                 *      old map:
                 *     d  .  d  .  .
                 *     new map:
                 *     d  d  d  .  .
                 */
                for (var i = 0; i < noteCount; ++i) {
                    notes.push(new SmoNote({
                            clef: note.clef,
                            keys: note.keys,
                            duration: vexDuration
                        }));
                }
                return notes;
            } else {
                /**
                 *  Contract does not meet the next note.  Insert a gap in the rest
                 *      old map:
                 *     d  .  .  .  d
                 *     new map:
                 *     d  .  .  r  d
                 */
                var gap = this.tickmap.durationMap[this.startIndex + 1] -
                    (iterator.totalDuration + noteCount * this.newTicks);
                var vexGapDuration = vexMusic.ticksToDuration[this.newTicks];
                notes.push(new SmoNote({
                        clef: note.clef,
                        keys: note.keys,
                        duration: vexDuration
                    }));
                notes.push(new SmoNote({
                        clef: note.clef,
                        keys: note.keys,
                        duration: vexGapDuration,
                        noteType: 'r'
                    }));
                return notes;
            }
        }
        return null;
    }
}
// ## VxStretchTupletActor
// Stretch a note in a tuplet, removing or shortening other notes in the tuplet
// ## Parameters:
//   {changeIndex:changeIndex, multiplier:multiplier,measure:measure}
//
class VxStretchTupletActor extends NoteTransformBase {
    constructor(params) {
        super();
        Vex.Merge(this, params);
        this.tuplet = this.measure.getTupletForNote(this.measure.notes[this.changeIndex]);
        this.oldLength = this.tuplet.notes.length;
        this.tupletIndex = this.measure.tupletIndex(this.tuplet);

        this.tuplet.combine(this.startIndex, this.endIndex);
        this.durationMap = this.tuplet.durationMap;
    }
    transformNote(note, iterator, accidentalMap) {

        /*
        ## Strategy:
        Before A, after C, leave alone
        At A, send all notes of the tuplet
        Between A+1 and C, return empty array for removed note

        5
        ---------
        | | | | |
        n n n n n
        A | B | C
         */

        if (iterator.index < this.tupletIndex)
            return note;
        if (iterator.index >= this.tupletIndex + this.oldLength)
            return note;
        if (iterator.index === this.tupletIndex) {
            return this.tuplet.notes;
        }
        return [];

    }

}

// ## VxContractActor
// Contract the duration of a note in a tuplet by duplicate
// notes of fractional length
//
class VxContractTupletActor extends NoteTransformBase {
    constructor(params) {
        super();
        Vex.Merge(this, params);
        this.tuplet = this.measure.getTupletForNote(this.measure.notes[this.changeIndex]);
        this.oldLength = this.tuplet.notes.length;
        this.tupletIndex = this.measure.tupletIndex(this.tuplet);
		this.splitIndex = this.changeIndex-this.tupletIndex;
        this.tuplet.split(this.splitIndex);
    }
    transformNote(note, iterator, accidentalMap) {
        if (iterator.index < this.tupletIndex)
            return note;
        if (iterator.index >= this.tupletIndex + this.oldLength)
            return note;
        if (iterator.index == this.changeIndex) {
            return this.tuplet.notes;
        }
        return [];
    }
}

// ## VxUnmakeTupletActor
// Turn a tuplet into a non-tuplet of the same length
// ## Parameters:
// startIndex: start index of tuplet
// endIndex: end index of tuplet
// measure: Smo measure that the tuplet is contained in.
class VxUnmakeTupletActor extends NoteTransformBase {
    constructor(parameters) {
        super();
        Vex.Merge(this, parameters);		
    }
    transformNote(note, iterator, accidentalMap) {
        if (iterator.index < this.startIndex || iterator.index > this.endIndex) {
            return null;
        }
        if (iterator.index == this.startIndex) {
            var tuplet = this.measure.getTupletForNote(note);
            var ticks = tuplet.totalTicks;
            var vexDuration = vexMusic.ticksToDuration[ticks];
            var nn = new SmoNote({
                    clef: note.clef,
                    keys: note.keys,
                    duration: vexDuration
                });
            this.measure.removeTupletForNote(note);
            return [nn];
        }
        return [];
    }
}

// ## VxUnmakeTupletActor
// Turn a tuplet into a non-tuplet of the same length
// parameters:
//  {tickmap:tickmap,ticks:ticks,
class VxMakeTupletActor extends NoteTransformBase {
    constructor(params) {
        super();
        Vex.Merge(this, params);
		this.durationMap=[];
		var sum=0.0;// 819.2
		for (var i=0;i<this.numNotes;++i) {
			this.durationMap.push(1.0);
			sum += 1.0;
		}
        var stemValue = this.totalTicks/this.numNotes;
		var stemTicks=this.totalTicks;
		while (stemValue < stemTicks) {
			stemTicks = stemTicks/2;
		}
		this.stemTicks=stemTicks*2;
		this.vexDuration=vexMusic.ticksToDuration[this.stemTicks];
        this.tuplet = [];

    }
    transformNote(note, iterator, accidentalMap) {
        if (iterator.index != this.index) {
            return null;
        }
        for (var i = 0; i < this.numNotes; ++i) {
            note = new SmoNote({
                    clef: note.clef,
                    keys: note.keys,
                    duration: this.vexDuration
                });
            this.tuplet.push(note);
        }
        var tuplet = new SmoTuplet({
                notes: this.tuplet,
                stemTicks: this.stemTicks,
                totalTicks: this.totalTicks,
                ratioed: false,
                bracketed: true,
                startIndex: iterator.index,
				durationMap:this.durationMap,
                location: 1
            });
        this.measure.tuplets.push(tuplet);
        return this.tuplet;
    }
}

class VxStretchNoteActor extends NoteTransformBase {
    constructor(parameters) {
        super();
        Vex.Merge(this, parameters);
        this.vexDuration = vexMusic.ticksToDuration[this.newTicks];
        this.endIndex = this.index + 1;
        this.startTick = this.tickmap.durationMap[this.startIndex];

        var endTick = this.tickmap.durationMap[this.startIndex] + this.newTicks;
        this.divisor = -1;
        this.durationMap = [];
        this.skipFromStart = this.startIndex + 1;
        this.skipFromEnd = this.startIndex + 1;
        this.durationMap.push(this.newTicks);

        var mapIx = this.tickmap.durationMap.indexOf(endTick);
        // If there is no tickable at the end point, try to split the next note
        /**
         *      old map:
         *     d  . d  .
         *     split map:
         *     d  .  d  d
         *     new map:
         *     d .   .  d
         */
        if (mapIx < 0) {
            var npos = this.tickmap.durationMap[this.startIndex + 1];
            var ndelta = this.tickmap.deltaMap[this.startIndex + 1];
            if (ndelta / 2 + this.startTick + this.newTicks === npos) {
                this.durationMap.push(ndelta / 2);
            } else {
                // there is no way to do this...
                this.durationMap = [];

            }
        } else {
            // If this note now takes up the space of other notes, remove those notes
            for (var i = this.startIndex + 1; i < mapIx; ++i) {
                this.durationMap.push(0);
            }
        }
    }
    transformNote(note, iterator, accidentalMap) {
        if (this.durationMap.length == 0) {
            return null;
        }
        if (iterator.index >= this.startIndex && iterator.index < this.startIndex + this.durationMap.length) {
            var mapIndex = iterator.index - this.startIndex;
            var ticks = this.durationMap[mapIndex];
            if (ticks == 0) {
                return [];
            }
            var vexDuration = vexMusic.ticksToDuration[ticks];
            var note = new SmoNote({
                    clef: note.clef,
                    keys: note.keys,
                    duration: vexDuration
                });
            return [note];
        }
        return null;
    }
}