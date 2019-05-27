
// # SmoMeasure - data for a measure of music
// # Description:
// Many rules of musical engraving are enforced at a measure level, e.g. the duration of 
// notes, accidentals, etc.  
// # See Also:
// Measures contain notes, tuplets, and beam groups.  So see SmoNote, etc.
// Measures are contained in staves, see also SystemStaff.js
class SmoMeasure {
    constructor(params) {
        this.tuplets = [];
        this.beamGroups = [];
		this.changed=true;

        Vex.Merge(this, SmoMeasure.defaults);
        Vex.Merge(this, params);
        if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: 'SmoMeasure'
            };
        } else {
            // inherit attrs id for deserialized 
        }		
    }
    get notes() {
        return this.voices[this.activeVoice].notes;
    }
	getRenderedNote(id) {
        for (var j = 0; j < this.voices.length; ++j) {
            var voice = this.voices[j];
            for (var i = 0; i < voice.notes.length; ++i) {
				var note = voice.notes[i];
				if (note.renderId === id) {
					return {smoNote:note,voice:j,tick:i};
				}
			}
		}
		return null;		
	}
    set notes(val) {
        this.voices[this.activeVoice].notes = val;
    }
    get stemDirection() {
        return this.activeVoice % 2 ? -1 : 1;
    }
	static get defaultAttributes() {
		return [
            'timeSignature', 'keySignature', 'staffX', 'staffY', 'customModifiers',
             'measureNumber', 'staffWidth', 'modifierOptions',
            'activeVoice'];
	}
    static deserialize(jsonString) {
        var jsonObj = JSON.parse(jsonString);
        var voices = [];
        for (var j = 0; j < jsonObj.voices.length; ++j) {
            var voice = jsonObj.voices[j];
            var notes = [];
            voices.push({
                notes: notes
            });
            for (var i = 0; i < voice.notes.length; ++i) {
                var noteParams = voice.notes[i];
                var smoNote = new SmoNote(noteParams);
                notes.push(smoNote);
            }
        }

        var tuplets = [];
        for (j = 0; j < jsonObj.tuplets.length; ++j) {
            var tuplet = new SmoTuplet(jsonObj.tuplets[j]);
            tuplets.push(tuplet);
        }

        var beamGroups = [];
        for (j = 0; j < jsonObj.beamGroups.length; ++j) {
            var smoBeam = new SmoBeamGroup(jsonObj.beamGroups[j]);
            beamGroups.push(smoBeam);
        }

        var params = {
            voices: voices,
            tuplets: tuplets,
            beamGroups: beamGroups
        };

        smoMusic.filteredMerge(SmoMeasure.defaultAttributes, jsonObj, params);

        return new SmoMeasure(params);
    }

    // TODO: learn what all these clefs are
    static get defaultKeyForClef() {
        return {
            'treble': {
                letter: 'b',
                accidental: '',
                octave: 4
            },
            'bass': {
                letter: 'd',
                accidental: '',
                octave: 3
            },
            'tenor': {
                letter: 'a',
                accidental: '',
                octave: 4
            },
            'alto': {
                letter: 'a',
                accidental: '',
                octave: 3
            },
            'soprano': {
                letter: 'b',
                accidental: '',
                octave: 4
            },
            'percussion': {
                letter: 'b',
                accidental: '',
                octave: 4
            },
            'mezzo-soprano': {
                letter: 'b',
                accidental: '',
                octave: 4
            },
            'baritone-c': {
                letter: 'b',
                accidental: '',
                octave: 3
            },
            'baritone-f': {
                letter: 'e',
                accidental: '',
                octave: 3
            },
            'subbass': {
                letter: 'd',
                accidental: '',
                octave: 2
            },
            'french': {
                letter: 'b',
                accidental: '',
                octave: 4
            } // no idea
        }
    }
	// Get a measure full of default notes for a given timeSignature/clef
    static getDefaultNotes(params) {
		if (params == null) {
			params={};
		}
		params.timeSignature = params.timeSignature ? params.timeSignature : '4/4';
		params.clef = params.clef ? params.clef : 'treble';
        var meterNumbers = params.timeSignature.split('/').map(number => parseInt(number, 10));
        var duration = '4';
        if (meterNumbers[0] % 3 == 0) {
            duration = '8';
        }
        var pitches = SmoMeasure.defaultKeyForClef[params.clef];
		var rv = [];

        for (var i = 0; i < meterNumbers[0]; ++i) {
            var note = new SmoNote({
                    clef: params.clef,
                    pitches: [pitches],
                    duration: duration,
					timeSignature:params.timeSignature
                });
            rv.push(note);
        }
        return rv;
    }
	
	static getDefaultMeasure(params) {
		var obj={};
		Vex.Merge(obj,SmoMeasure.defaults);
		obj.keySignature = params.keySignature ? params.keySignature : obj.keySignature;
		obj.timeSignature = params.timeSignature ? params.timeSignature : obj.timeSignature;
		return new SmoMeasure(obj);
	}
	
	static getDefaultMeasureWithNotes(params) {
		var measure = SmoMeasure.getDefaultMeasure(params);
		measure.voices.push({notes:SmoMeasure.getDefaultNotes(params)});
		return measure;
	}
	
	static _cloneParameters(measure) {
        var keys = Object.keys(measure);
        var clone = {};
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            clone[key] = measure[key];
        }
		return clone;
	}
	

    static get defaultVoice44() {
		return SmoMeasure.getDefaultNotes({clef:'treble',timeSignature:'4/4'});
    }
    static get defaults() {
        // var noteDefault = SmoMeasure.defaultVoice44;
        return {
            timeSignature: '4/4',
            keySignature: "C",
            staffX: 10,
			adjX:0,
			rightMargin:2,
            customModifiers: [],
            staffY: 40,
            bars: [1, 1], // follows enumeration in VF.Barline
            measureNumber: {
                localIndex: 0,
                systemIndex: 0,
                measureNumber: 0
            },
            staffWidth: 200,
            modifierOptions: {},
            clef: 'treble',            
            forceClef: false,
			forceKeySignature:false,
			forceTimeSignature:false,
            voices: [  ],
            activeVoice: 0
        };
    }
    tickmap() {
        return VX.TICKMAP(this);
    }
	
	// ## getDynamicMap
	// ## Description:
	// returns the dynamic text for each tick index.  If 
	// there are no dynamics, the empty array is returned.
	getDynamicMap() {
		var rv = [];
		var hasDynamic=false;
		this.voices.forEach((voice) => {
			voice.notes.forEach((note) => { 
			if (note.dynamicText) {
				rv.push({note:note,text:note.dynamicText});
				hasDynamic=true;
			} else {
				rv.push({note:note,text:''});
			}
			});
		});
		
		if (hasDynamic) {
			return rv;
		}
		return [];
	}
	
	// {index:1,value:{symbol:'#',cautionary:false}}
	setAccidental(voice,tick,pitch,value) {
		var target = this.getSelection(voice,tick,[pitch]);
		if (target) {
			target.note.addAccidental(value);
		}
	}
	
    clearBeamGroups() {
        this.beamGroups = [];
    }

    clearAccidentals() {
        for (var j = 0; j < this.voices.length; ++j) {
            var notes = this.voices[j].notes;
            for (var i = 0; i < notes.length; ++i) {
                notes[i].accidentals = [];
            }
        }
    }
    tupletIndex(tuplet) {
        for (var j = 0; j < this.voices.length; ++j) {
            var notes = this.voices[j].notes;
            for (var i = 0; i < notes.length; ++i) {
                if (notes[i]['tuplet'] && notes[i].tuplet.id === tuplet.attrs.id) {
                    return i;
                }
            }
        }
        return -1;
    }
	
    getTupletForNote(note) {
        if (!note.isTuplet()) {
            return null;
        }
        for (var i = 0; i < this.tuplets.length; ++i) {
            var tuplet = this.tuplets[i];
            if (tuplet.attrs.id === note.tuplet.id) {
                return tuplet;
            }
        }
		return null;
    }
    removeTupletForNote(note) {
        var tuplets = [];
        for (var i = 0; i < this.tuplets.length; ++i) {
            var tuplet = this.tuplets[i];
            if (note.tuplet.id !== tuplet.attrs.id) {
                tuplets.push(tuplet);
            }
        }
        this.tuplets = tuplets;
    }
    addCustomModifier(ctor, parameters) {
        this.customModifiers.push({
            ctor: ctor,
            parameters: parameters
        });
    }
	get numBeats() {
		return this.timeSignature.split('/').map(number => parseInt(number, 10))[0];
	}
	setKeySignature(sig) {
		this.keySignature = sig;
		this.voices.forEach((voice) => {
			voice.notes.forEach((note) => {
				note.keySignature=sig;
			});
		});
	}
	get beatValue() {
		return this.timeSignature.split('/').map(number => parseInt(number, 10))[1];
	}

    setMeasureNumber(num) {
        this.measureNumber = num;
    }
  
    getBeamGroupForNote(note) {
        for (var i = 0; i < this.beamGroups.length; ++i) {
            var bg = this.beamGroups[i];
            for (var j = 0; j < bg.notes.length; ++j) {
                if (bg.notes[j].attrs.id === note.attrs.id) {
                    return bg;
                }
            }
        }
        return null;
    }
}
