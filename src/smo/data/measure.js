
// ## SmoMeasure - data for a measure of music
// Many rules of musical engraving are enforced at a measure level, e.g. the duration of
// notes, accidentals, etc.
// ### See Also:
// Measures contain *notes*, *tuplets*, and *beam groups*.  So see `SmoNote`, etc.
// Measures are contained in staves, see also `SystemStaff.js`
// ## SmoMeasure Methods:
class SmoMeasure {
	constructor(params) {
		this.tuplets = [];
    this.svg = {};
		this.beamGroups = [];
		this.modifiers = [];
    this.pageGap = 0;
		this.changed = true;
    this.timestamp=0;
    this.prevY = 0;
    this.prevX = 0;
    this.padLeft=0;
    this.prevFrame=0;
    this.svg.staffWidth=200;
    this.svg.staffX = 0;
    this.svg.staffY = 0;
    this.svg.history=[];
    this.svg.logicalBox={};
    this.svg.yTop = 0;

		var defaults = SmoMeasure.defaults;

		smoSerialize.serializedMerge(SmoMeasure.defaultAttributes, defaults, this);
		smoSerialize.serializedMerge(SmoMeasure.defaultAttributes, params, this);
		this.voices = params.voices ? params.voices : [];
		this.tuplets = params.tuplets ? params.tuplets : [];
		this.modifiers = params.modifiers ? params.modifiers : defaults.modifiers;

    this.setDefaultBarlines();

		if (!this['attrs']) {
			this.attrs = {
				id: VF.Element.newID(),
				type: 'SmoMeasure'
			};
		} else {
			// inherit attrs id for deserialized
		}
	}


	// ### defaultAttributes
	// attributes that are to be serialized for a measure.
	static get defaultAttributes() {
		return [
			'timeSignature', 'keySignature','systemBreak','pageBreak',
			'measureNumber',
			'activeVoice', 'clef', 'transposeIndex', 'adjX','customStretch','customProportion','padLeft', 'padRight', 'rightMargin'
    ];
	}

  static get formattingOptions() {
    return ['customStretch','customProportion'];
  }
  static get systemOptions() {
    return ['systemBreak','pageBreak'];
  }
  static get columnMappedAttributes() {
    return ['timeSignature','keySignature','tempo'];
  }
  static get serializableAttributes() {
    var rv = [];
    SmoMeasure.defaultAttributes.forEach((attr) => {
      if (SmoMeasure.columnMappedAttributes.indexOf(attr) < 0) {
        rv.push(attr);
      }
    });
      return rv;
  }

  // ### serializeColumnMapped
  // Some measure attributes that apply to the entire column are serialized
  // separately.  Serialize those attributes, but only add them to the
  // hash if they already exist for an earlier measure
  serializeColumnMapped(attrColumnHash,attrCurrentValue) {
    SmoMeasure.columnMappedAttributes.forEach((attr) => {
      if (this[attr]) {
        if (!attrColumnHash[attr]) {
          attrColumnHash[attr] = {};
          attrCurrentValue[attr] = {};
        }
        var curAttrHash  = attrColumnHash[attr];
        if (this[attr].ctor && this[attr].ctor == 'SmoTempoText') {
          if (this[attr].compare(attrCurrentValue[attr]) === false) {
            curAttrHash[this.measureNumber.measureIndex] = this[attr];
            attrCurrentValue[attr] = this[attr];
          }
        } else if (attrCurrentValue[attr] != this[attr]) {
          curAttrHash[this.measureNumber.measureIndex] = this[attr];
          attrCurrentValue[attr] = this[attr];
        }
      } // ekse attr doesn't exist in this measure
    });
  }

	// ### serialize
	// Convert this measure object to a JSON object, recursively serializing all the notes,
	// note modifiers, etc.
	serialize() {
		var params = {};
		smoSerialize.serializedMergeNonDefault(SmoMeasure.defaults,SmoMeasure.serializableAttributes, this, params);
		params.tuplets = [];
		params.voices = [];
		params.modifiers=[];

		this.tuplets.forEach((tuplet) => {
			params.tuplets.push(tuplet.serialize());
		});

		this.voices.forEach((voice) => {
			var obj = {
				notes: []
			};
			voice.notes.forEach((note) => {
				obj.notes.push(note.serialize());
			});
			params.voices.push(obj);
		});

		this.modifiers.forEach((modifier) => {
      /* don't serialize default modifiers */
      if (modifier.ctor == 'SmoBarline' && modifier.position == SmoBarline.positions.start && modifier.barline == SmoBarline.barlines.singleBar) {
          ;
      }
      else if (modifier.ctor == 'SmoBarline' && modifier.position == SmoBarline.positions.end && modifier.barline == SmoBarline.barlines.singleBar) {
          ;
      }
      // we don't save tempo text as a modifier anymore
      else if (modifier.ctor == 'SmoTempoText') {
          ;
      }
      else if (modifier.ctor == 'SmoRepeatSymbol' && modifier.position == SmoRepeatSymbol.positions.start && modifier.symbol == SmoRepeatSymbol.symbols.None) {
          ;
      } else {
        params.modifiers.push(modifier.serialize());
      }
		});
		return params;
	}

	// ### deserialize
	// restore a serialized measure object.  Usually called as part of deserializing a score,
	// but can also be used to restore a measure due to an undo operation.
	static deserialize(jsonObj) {
		var voices = [];
        var noteSum = [];
		for (var j = 0; j < jsonObj.voices.length; ++j) {
			var voice = jsonObj.voices[j];
			var notes = [];
			voices.push({
				notes: notes
			});
			for (var i = 0; i < voice.notes.length; ++i) {
				var noteParams = voice.notes[i];
				var smoNote = SmoNote.deserialize(noteParams);
				notes.push(smoNote);
                noteSum.push(smoNote);
			}
		}

		var tuplets = [];
		for (j = 0; j < jsonObj.tuplets.length; ++j) {
      var tupJson = jsonObj.tuplets[j];
      var noteAr = noteSum.filter((nn) => {
          return nn.isTuplet && nn.tuplet.id === tupJson.attrs.id;
      });

      // Bug fix:  A tuplet with no notes may be been overwritten
      // in a copy/paste operation
      if (noteAr.length > 0) {
        tupJson.notes = noteAr;
  			var tuplet = new SmoTuplet(tupJson);
  			tuplets.push(tuplet);
      }
		}

		/* var beamGroups = [];
		for (j = 0; j < jsonObj.beamGroups.length; ++j) {
			var smoBeam = new SmoBeamGroup(jsonObj.beamGroups[j]);
			beamGroups.push(smoBeam);
		}  */

		var modifiers = [];
		jsonObj.modifiers.forEach((modParams) => {
			var ctor = eval(modParams.ctor);
			var modifier = new ctor(modParams);
			modifiers.push(modifier);
		});

		var params = {
			voices: voices,
			tuplets: tuplets,
			beamGroups: [],
			modifiers:modifiers
		};

		smoSerialize.serializedMerge(SmoMeasure.defaultAttributes, jsonObj, params);
        var rv = new SmoMeasure(params);
        if (jsonObj.tempo) {
            rv.tempo = new SmoTempoText(jsonObj.tempo);
        }

        // Handle migration for measure-mapped parameters
        rv.modifiers.forEach((mod) => {
            if (mod.ctor == 'SmoTempoText') {
                rv.tempo = mod;
            }
        });

		return rv;
    }

    // ### defaultPitchForClef
	// Accessor for clef objects, which are set at a measure level.
	// #### TODO: learn what all these clefs are
	static get defaultPitchForClef() {
		return {
			'treble': {
				letter: 'b',
				accidental: 'n',
				octave: 4
			},
			'bass': {
				letter: 'd',
				accidental: 'n',
				octave: 3
			},
			'tenor': {
				letter: 'a',
				accidental: 'n',
				octave: 3
			},
			'alto': {
				letter: 'c',
				accidental: 'n',
				octave: 4
			},
			'soprano': {
				letter: 'b',
				accidental: 'n',
				octave: 4
			},
			'percussion': {
				letter: 'b',
				accidental: 'n',
				octave: 4
			},
			'mezzo-soprano': {
				letter: 'b',
				accidental: 'n',
				octave: 4
			},
			'baritone-c': {
				letter: 'b',
				accidental: 'n',
				octave: 3
			},
			'baritone-f': {
				letter: 'e',
				accidental: 'n',
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
	// ### getDefaultNotes
	// Get a measure full of default notes for a given timeSignature/clef.
	// returns 8th notes for triple-time meters, etc.
	static getDefaultNotes(params) {
		if (params == null) {
			params = {};
		}
		params.timeSignature = params.timeSignature ? params.timeSignature : '4/4';
		params.clef = params.clef ? params.clef : 'treble';
		var meterNumbers = params.timeSignature.split('/').map(number => parseInt(number, 10));
		var ticks = {
			numerator: 4096,
			denominator: 1,
			remainder: 0
		};
    var beamBeats = ticks.numerator;
		if (meterNumbers[1]  == 8) {
			ticks = {
				numerator: 2048,
				denominator: 1,
				remainder: 0
			};
      beamBeats = 2048*3;
		}
		var pitches =
     JSON.parse(JSON.stringify(SmoMeasure.defaultPitchForClef[params.clef]));
		var rv = [];
    var beats = meterNumbers[0];

    // Treat 2/2 like 4/4 time.
    if (meterNumbers[1] == 2) {
      beats = beats * 2;
    }

		for (var i = 0; i < beats; ++i) {
			var note = new SmoNote({
				clef: params.clef,
				pitches: [pitches],
				ticks: ticks,
				timeSignature: params.timeSignature,
        beamBeats:beamBeats,
        noteType:'r'
			});
			rv.push(note);
		}
		return rv;
	}

	// ### getDefaultMeasure
	// For create the initial or new measure, get a measure with notes.
	static getDefaultMeasure(params) {
		var obj = {};
		smoSerialize.serializedMerge(SmoMeasure.defaultAttributes, SmoMeasure.defaults, obj);
		smoSerialize.serializedMerge(SmoMeasure.defaultAttributes, params, obj);
		return new SmoMeasure(obj);
	}

	// ### SmoMeasure.getDefaultMeasureWithNotes
	// Get a new measure with the appropriate notes for the supplied clef, instrument
	static getDefaultMeasureWithNotes(params) {
		var measure = SmoMeasure.getDefaultMeasure(params);
		measure.voices.push({
			notes: SmoMeasure.getDefaultNotes(params)
		});
		return measure;
	}


	static get defaultVoice44() {
		return SmoMeasure.getDefaultNotes({
			clef: 'treble',
			timeSignature: '4/4'
		});
	}

    setDefaultBarlines() {
        if (!this.getStartBarline()) {
            this.modifiers.push(new SmoBarline({
    				position: SmoBarline.positions.start,
    				barline: SmoBarline.barlines.singleBar
    			}));
        }
        if (!this.getEndBarline()) {
            this.modifiers.push(new SmoBarline({
    				position: SmoBarline.positions.end,
    				barline: SmoBarline.barlines.singleBar
    			}));
        }
    }
	static get defaults() {
		// var noteDefault = SmoMeasure.defaultVoice44;
		const modifiers = [];
		modifiers.push(new SmoBarline({
				position: SmoBarline.positions.start,
				barline: SmoBarline.barlines.singleBar
			}));
		modifiers.push(new SmoBarline({
				position: SmoBarline.positions.end,
				barline: SmoBarline.barlines.singleBar
			}));
		modifiers.push(new SmoRepeatSymbol({
				position: SmoRepeatSymbol.positions.start,
				symbol: SmoRepeatSymbol.symbols.None
			}));
	    // modifiers.push(new SmoTempoText({tempoMode:SmoTempoText.tempoModes.textMode}));
		// modifiers.push(new SmoRepeatSymbol({symbol:SmoRepeatSymbol.symbols.None});
		return {
			timeSignature: '4/4',
			keySignature: "C",
			canceledKeySignature: null,
			adjX: 0,
      pageBreak:false,
      systemBreak:false,
			adjRight:0,
			padRight: 10,
      padLeft:0,
      tuplets:[],
			transposeIndex: 0,
      customStretch:0,
      customProportion:2,
			modifiers: modifiers,
      autoJustify:false,
			rightMargin: 2,
			staffY: 40,
			// bars: [1, 1], // follows enumeration in VF.Barline
			measureNumber: {
				localIndex: 0,
				systemIndex: 0,
				measureNumber: 0,
				staffId: 0
			},
			clef: 'treble',
			changed: true,
			forceClef: false,
			forceKeySignature: false,
			forceTimeSignature: false,
			voices: [],
			activeVoice: 0,
      tempo:new SmoTempoText()
		};
	}

    setForcePageBreak(val) {
        this.pageBreak = val;
    }

    setForceSystemBreak(val) {
        this.systemBreak = val;
    }

    getForceSystemBreak() {
        return this.systemBreak;
    }

    getForcePageBreak() {
        return this.pageBreak;
    }

    // ###   SVG mixins
    // We store some rendering data in the instance for UI mapping.
    get staffWidth() {
        return this.svg.staffWidth;
    }

    setWidth(width,description) {
        if (layoutDebug.flagSet('measureHistory')) {
           this.svg.history.push('setWidth '+this.staffWidth+'=> '+width + ' ' + description);
        }
        this.svg.staffWidth = width;
    }

    get staffX() {
        return this.svg.staffX;
    }

    setX(x,description) {
        layoutDebug.measureHistory(this,'staffX',x,description);
        this.svg.staffX = Math.round(x);
    }

    get staffY() {
        return this.svg.staffY;
    }

    setY(y,description) {
        layoutDebug.measureHistory(this,'staffY',y,description);
        this.svg.staffY = Math.round(y);
    }

    get logicalBox() {
        return typeof(this.svg.logicalBox['x']) == 'number'  ? this.svg.logicalBox : null;
    }

    get yTop() {
        return this.svg.yTop;
    }

    setYTop(y,description) {
        layoutDebug.measureHistory(this,'yTop',y,description);
        this.svg.yTop = y;
    }

    deleteLogicalBox(description) {
        this.svg.logicalBox = {};
        this.svg.history.push('delete box ' +description);
    }

    setBox(box,description) {
        layoutDebug.measureHistory(this,'logicalBox',box,description);
        this.svg.logicalBox = svgHelpers.smoBox(box);
    }

    saveUnjustifiedWidth() {
        this.svg.unjustifiedWidth = this.svg.staffWidth;
    }

    // ### getClassId
    // create a identifier unique to this measure index so it can be easily removed.
    getClassId() {
        return 'mm-'+this.measureNumber.staffId+'-'+this.measureNumber.measureIndex;
    }

    pickupMeasure(duration) {
        var proto = SmoMeasure.deserialize(this.serialize());
        proto.attrs.id =  VF.Element.newID();
        var note = proto.voices[0].notes[0];
        proto.voices = [];
        note.pitches = [note.pitches[0]];
        note.ticks.numerator = duration;
        note.makeRest();
        proto.voices.push({notes:[note]});
        return proto;
    }

	// ### getRenderedNote
	// The renderer puts a mapping between rendered svg groups and
	// the logical notes in SMO.  The UI needs this mapping to be interactive,
	// figure out where a note is rendered, what its bounding box is, etc.
	getRenderedNote(id) {
		for (var j = 0; j < this.voices.length; ++j) {
			var voice = this.voices[j];
			for (var i = 0; i < voice.notes.length; ++i) {
				var note = voice.notes[i];
				if (note.renderId === id) {
					return {
						smoNote: note,
						voice: j,
						tick: i
					};
				}
			}
		}
		return null;
	}

	/* set notes(val) {
		this.voices[this.activeVoice].notes = val;
	}  */

    getNotes() {
        return this.voices[this.activeVoice].notes;
    }

    getActiveVoice() {
        return this.activeVoice;
    }

    setActiveVoice(vix) {
        if (vix >= 0 && vix < this.voices.length) {
            this.activeVoice=vix;
        }
    }



    tickmapForVoice(voiceIx) {
        var tickmap = new smoTickIterator(this,{voice:voiceIx});
        tickmap.iterate(smoTickIterator.nullActor,this);
        return tickmap;
    }

    // ### createMeasureTickmaps
    // A tickmap is a map of notes to ticks for the measure.  It is speciifc per-voice
    // since each voice may have different numbers of ticks.  The accidental map is
    // overall since accidentals in one voice apply to accidentals in the other
    // voices.  So we return the tickmaps and the overall accidental map.
    createMeasureTickmaps() {
        var tickmapArray=[];
        var accidentalMap = {};
        for (var i = 0;i< this.voices.length;++i) {
            tickmapArray.push(this.tickmapForVoice(i));
        }

        for (var i = 0;i< this.voices.length;++i) {
            var voice = this.voices[i];
            var tickmap = tickmapArray[i];
            var durationKeys = Object.keys(tickmap.durationAccidentalMap)

            durationKeys.forEach((durationKey) => {
                if (!accidentalMap[durationKey]) {
                    accidentalMap[durationKey] = tickmap.durationAccidentalMap[durationKey];
                } else {
                    var amap = accidentalMap[durationKey];
                    var amapKeys = Object.keys(amap);
                    var pitchKeys = Object.keys(tickmap.durationAccidentalMap[durationKey]);
                    pitchKeys.forEach((pitchKey) => {
                        if (!amap[pitchKey]) {
                            amap[pitchKey] = tickmap.durationAccidentalMap[durationKey][pitchKey];
                        }
                    });
                }
            });
        }
        var accidentalArray = [];
        Object.keys(accidentalMap).forEach((durationKey) => {
            accidentalArray.push({duration:durationKey,pitches:accidentalMap[durationKey]});
        });
        return {
            tickmaps:tickmapArray,
            accidentalMap:accidentalMap,
            accidentalArray:accidentalArray
        };
    }

    getTicksFromVoice() {
        var ticks = 0;
        this.voices[0].notes.forEach((note) => {
            ticks += note.tickCount;
        });
        return ticks;
    }

    isPickup() {
        var ticks = this.getTicksFromVoice();
        var goal = smoMusic.timeSignatureToTicks(this.timeSignature);
        return (ticks < goal);
    }

	// ### getDynamicMap
	// ### Description:
	// returns the dynamic text for each tick index.  If
	// there are no dynamics, the empty array is returned.
	getDynamicMap() {
		var rv = [];
		var hasDynamic = false;
		this.voices.forEach((voice) => {
			voice.notes.forEach((note) => {
				if (note.dynamicText) {
					rv.push({
						note: note,
						text: note.dynamicText
					});
					hasDynamic = true;
				} else {
					rv.push({
						note: note,
						text: ''
					});
				}
			});
		});

		if (hasDynamic) {
			return rv;
		}
		return [];
	}

	clearBeamGroups() {
		this.beamGroups = [];
	}

    // ### tuplet methods.

    // #### tupletNotes
	tupletNotes(tuplet) {
		var notes = [];
		for (var j = 0; j < this.voices.length; ++j) {
			var notes = this.voices[j].notes;
			for (var i = 0; i < notes.length; ++i) {
				if (notes[i]['tuplet'] && notes[i].tuplet.id === tuplet.attrs.id) {
					notes.push(notes[i]);
				}
			}
		}
		return notes;
	}

    // #### tupletIndex
    // return the index of the given tuplet
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

    // #### getTupletForNote
    // Finds the tuplet for a given note, or null if there isn't one.
    getTupletForNote(note) {
		if (!note.isTuplet) {
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

    // ### populateVoice
    // Create a new voice in this measure, and populate it with the default note
    // for this measure/key/clef
    populateVoice(index) {
        if (index !=  this.voices.length ) {
            return;
        }
        this.voices.push({notes:SmoMeasure.getDefaultNotes(this)});
        this.activeVoice = index;
        this.changed = true;
    }

    // ### measure modifier mixins
    _addSingletonModifier(name,parameters) {
        var ctor = eval(name);
        var ar= this.modifiers.filter(obj => obj.attrs.type != name);
        this.modifiers=ar;
        this.modifiers.push(new ctor(parameters));
    }
    _removeSingletonModifier(name) {
        var ar= this.modifiers.filter(obj => obj.attrs.type != name);
        this.modifiers=ar;
    }

    _getSingletonModifier(name) {
        return this.modifiers.find(obj => obj.attrs.type == name);
    }

    addRehearsalMark(parameters) {
        this._addSingletonModifier('SmoRehearsalMark',parameters);
    }
	removeRehearsalMark() {
        this._removeSingletonModifier('SmoRehearsalMark');
    }
    getRehearsalMark() {
        return this._getSingletonModifier('SmoRehearsalMark');
    }
    getModifiersByType(type) {
        return this.modifiers.filter((mm) => {
            return type == mm.attrs.type;
        });
    }

    addTempo(params) {
        this.tempo = new SmoTempoText(params);
    }
    removeTempo(params) {
        this.tempo = new SmoTempoText();
    }
    getTempo() {
        return this.tempo;
    }
	addMeasureText(mod) {
		var added = false;
		var exist = this.modifiers.filter((mm) => {
			return mm.attrs.id === mod.attrs.id;
		});
		if (exist.length) {
			this.setChanged(); // already added but set changed===true to re-justify
			return;
		}
		this.modifiers.push(mod);
		this.setChanged();
	}

	getMeasureText() {
		return this.modifiers.filter(obj => obj.ctor === 'SmoMeasureText');
	}

	removeMeasureText(id) {
		var ar= this.modifiers.filter(obj => obj.attrs.id != id);
		this.modifiers=ar;
		this.setChanged();
	}

	setRepeatSymbol(rs) {
		var ar = [];
		var toAdd = true;
		var exSymbol = this.getRepeatSymbol();
		if (exSymbol && exSymbol.symbol === rs.symbol) {
			toAdd = false;
		}
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoRepeatSymbol') {
				ar.push(modifier);
			}
		});
		this.modifiers = ar;
		if (toAdd) {
			ar.push(rs);
		}
	}
	getRepeatSymbol() {
		var rv = this.modifiers.filter(obj => obj.ctor === 'SmoRepeatSymbol');
		return rv.length ? rv[0] : null;
	}
	clearRepeatSymbols() {
		var ar = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoRepeatSymbol') {
				ar.push(modifier);
			}
		});
		this.modifiers = ar;
	}
	setBarline(barline) {
		var ar = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoBarline' || modifier.position != barline.position) {
				ar.push(modifier);
			}
		});
		this.modifiers = ar;
		ar.push(barline);
	}

	_getBarline(pos) {
		var rv = null;
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor === 'SmoBarline' && modifier.position === pos) {
				rv = modifier;
			}
		});
		return rv;
	}
	getEndBarline() {
		return this._getBarline(SmoBarline.positions.end);
	}
	getStartBarline() {
		return this._getBarline(SmoBarline.positions.start);
	}

	addNthEnding(ending) {
		var mods = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoVolta' || modifier.startBar != ending.startBar || modifier.endBar != ending.endBar) {
				mods.push(modifier);
			}
		});
		mods.push(ending);
		this.modifiers = mods;
	}

	removeNthEnding(number) {
		var mods = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoVolta' || modifier.number != number) {
				mods.push(modifier);
			}
		});
		this.modifiers = mods;
	}

	getNthEndings() {
		var rv = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor === 'SmoVolta') {
				rv.push(modifier);
			}
		});
		return rv;
	}
	getEndEndings() {
		var rv = null;
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor === 'SmoVolta' && modifier.endBar === this.measureNumber.systemIndex
				 && modifier.startBar != this.measureNumber.systemIdnex) {
				rv.push(modifier);
			}
		});
		return rv;
	}
	getMidEndings() {
		var rv = null;
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor === 'SmoVolta' && modifier.endBar > this.measureNumber.systemIndex
				 && modifier.startBar < this.measureNumber.systemIndex) {
				rv.push(modifier);
			}
		});
		return rv;
	}



	get numBeats() {
		return this.timeSignature.split('/').map(number => parseInt(number, 10))[0];
	}
	setKeySignature(sig) {
		this.keySignature = sig;
		this.setChanged();
		this.voices.forEach((voice) => {
			voice.notes.forEach((note) => {
				note.keySignature = sig;
			});
		});
	}
    setChanged() {
        this.changed = true;
        this.prevFrame=0;
        this.timestamp = Date.now();
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
