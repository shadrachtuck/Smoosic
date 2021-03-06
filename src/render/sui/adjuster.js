
// ## suiAdjuster
// Perform adjustments on the score based on the rendered components so we can re-render it more legibly.
class suiLayoutAdjuster {

	static estimateMusicWidth(smoMeasure) {
		var widths = [];
    var voiceIx = 0;
    var tmObj = smoMeasure.createMeasureTickmaps();
		smoMeasure.voices.forEach((voice) => {
			var tickIndex = 0;
      var width = 0;
      var duration = 0;
      var tm = tmObj.tickmaps[voiceIx];

			voice.notes.forEach((note) => {
        var tuplet = smoMeasure.getTupletForNote(note);
        if (tuplet && tuplet.notes[0].attrs.id === note.attrs.id) {
          // width += vexGlyph.tupletBeam.width + vexGlyph.tupletBeam.spacingRight;
        }
        var noteWidth = 0;
        var dots = (note.dots ? note.dots : 0);
				noteWidth += vexGlyph.dimensions.noteHead.width + vexGlyph.dimensions.noteHead.spacingRight;
				noteWidth += vexGlyph.dimensions.dot.width * dots + vexGlyph.dimensions.dot.spacingRight * dots;
				note.pitches.forEach((pitch) => {
          var keyAccidental = smoMusic.getAccidentalForKeySignature(pitch,smoMeasure.keySignature);
          var accidentals = tmObj.accidentalArray.filter((ar) =>
              ar.duration < duration && ar.pitches[pitch.letter]);
          var acLen = accidentals.length;
          var declared = acLen > 0 ?
              accidentals[acLen - 1].pitches[pitch.letter].pitch.accidental: keyAccidental;

          if (declared != pitch.accidental
              || pitch.cautionary) {
					noteWidth += vexGlyph.accidental(pitch.accidental).width;
				}
			});

      var verse = 0;
      var lyric;
      while (lyric = note.getLyricForVerse(verse,SmoLyric.parsers.lyric)) {
          // TODO: kerning and all that...
          if (!lyric.length) {
              break;
          }
          // why did I make this return an array?
          // oh...because of voices
          var lyricWidth = 7*lyric[0].getText().length + 10;
          noteWidth = Math.max(lyricWidth,noteWidth);
          verse += 1;
        }

  			tickIndex += 1;
        duration += note.tickCount;
        width += noteWidth;
		  });
      voiceIx += 1;
      widths.push(width);
		});
    widths.sort((a,b) => a > b ? -1 : 1);
		return widths[0];
	}

	static estimateStartSymbolWidth(smoMeasure) {
		var width = 0;
		if (smoMeasure.forceKeySignature) {
			if ( smoMeasure.canceledKeySignature) {
			    width += vexGlyph.keySignatureLength(smoMeasure.canceledKeySignature);
			}
            width += vexGlyph.keySignatureLength(smoMeasure.keySignature);
		}
		if (smoMeasure.forceClef) {
			width += vexGlyph.clef(smoMeasure.clef).width + vexGlyph.clef(smoMeasure.clef).spacingRight;
		}
		if (smoMeasure.forceTimeSignature) {
            var digits = smoMeasure.timeSignature.split('/')[0].length;
			width += vexGlyph.dimensions.timeSignature.width*digits + vexGlyph.dimensions.timeSignature.spacingRight;
		}
		var starts = smoMeasure.getStartBarline();
		if (starts) {
			width += vexGlyph.barWidth(starts);
		}
		return width;
	}

	static estimateEndSymbolWidth(smoMeasure) {
		var width = 0;
		var ends  = smoMeasure.getEndBarline();
		if (ends) {
			width += vexGlyph.barWidth(ends);
		}
		return width;
	}


	static estimateTextOffset(renderer,smoMeasure) {
		var leftText = smoMeasure.modifiers.filter((mm) => mm.ctor==='SmoMeasureText' && mm.position === SmoMeasureText.positions.left);
		var rightText = smoMeasure.modifiers.filter((mm) => mm.ctor==='SmoMeasureText' && mm.position === SmoMeasureText.positions.right);
		var svg = renderer.getContext().svg;
		var xoff=0;
		var width=0;
		leftText.forEach((tt) => {
    		var testText = new SmoScoreText({text:tt.text});
    		var box = svgHelpers.getTextBox(svg,testText.toSvgAttributes(),testText.classes,testText.text);
			xoff += box.width;
		});
		rightText.forEach((tt) => {
    		var testText = new SmoScoreText({text:tt.text});
			var box = svgHelpers.getTextBox(svg,testText.toSvgAttributes(),testText.classes,testText.text);
			width += box.width;
		});
		return svgHelpers.boxPoints(xoff,0,width,0);
	}

	static estimateMeasureWidth(measure) {

		// Calculate the existing staff width, based on the notes and what we expect to be rendered.
  var gravity = false;
  var prevWidth = measure.staffWidth;
	var measureWidth = suiLayoutAdjuster.estimateMusicWidth(measure);
	measure.adjX = suiLayoutAdjuster.estimateStartSymbolWidth(measure);
	measure.adjRight = suiLayoutAdjuster.estimateEndSymbolWidth(measure);
	measureWidth += measure.adjX + measure.adjRight + measure.customStretch;
  if (measure.changed == false && measure.logicalBox && measure.staffWidth < prevWidth) {
    measureWidth = Math.round((measure.staffWidth + prevWidth)/2);
    gravity = true;
  }
  var y = measure.logicalBox ? measure.logicalBox.y : measure.staffY;
  measure.setWidth(measureWidth,'estimateMeasureWidth adjX adjRight gravity: '+gravity);

		// Calculate the space for left/right text which displaces the measure.
		// var textOffsetBox=suiLayoutAdjuster.estimateTextOffset(renderer,measure);
		// measure.setX(measure.staffX  + textOffsetBox.x,'estimateMeasureWidth');
    measure.setBox(svgHelpers.boxPoints(measure.staffX,y,measure.staffWidth,measure.logicalBox.height),
       'estimate measure width');
	}
  static _beamGroupForNote(measure,note) {
    var rv = null;
    if (!note.beam_group) {
      return null;
    }
    measure.beamGroups.forEach((bg) => {
      if (!rv) {
        if (bg.notes.findIndex((nn) => note.beam_group && note.beam_group.id == bg.attrs.id) >= 0) {
          rv = bg;
        }
      }
    });
    return rv;
  }

    // ### _highestLowestHead
    // highest value is actually the one lowest on the page
    static _highestLowestHead(measure,note) {
        var hilo = {hi:0,lo:9999999};
        note.pitches.forEach((pitch) => {
            // 10 pixels per line
            var px = 10*smoMusic.pitchToLedgerLine(measure.clef,pitch);
            hilo.lo = Math.min(hilo.lo,px);
            hilo.hi = Math.max(hilo.hi,px);
        });
        return hilo;
    }

  // ### estimateMeasureHeight
  // The baseline is the top line of the staff.  aboveBaseline is a negative number
  // that indicates how high above the baseline the measure goes.  belowBaseline
  // is a positive number that indicates how far below the baseline the measure goes.
  // the height of the measure is below-above.  Vex always renders a staff such that
  // the y coordinate passed in for the stave is on the baseline.
  static estimateMeasureHeight(measure,layout) {
    var heightOffset = 50;  // assume 5 lines, todo is non-5-line staffs
    var yOffset = 0;
    if (measure.forceClef) {
      heightOffset += vexGlyph.clef(measure.clef).yTop + vexGlyph.clef(measure.clef).yBottom;
      yOffset = yOffset - vexGlyph.clef(measure.clef).yTop;
    }

    if (measure.forceTempo) {
      yOffset = Math.min(-1*vexGlyph.tempo.yTop,yOffset);
    }
    var hasDynamic = false;

    measure.voices.forEach((voice) => {
      voice.notes.forEach((note) => {
        var bg = suiLayoutAdjuster._beamGroupForNote(measure,note);
        var flag = SmoNote.flagStates.auto;
        if (bg && note.noteType == 'n') {
          flag = bg.notes[0].flagState;
          // an  auto-flag note is up if the 1st note is middle line
          if (flag == SmoNote.flagStates.auto) {
            var pitch = bg.notes[0].pitches[0];
            flag = smoMusic.pitchToLedgerLine(measure.clef,pitch)
               >= 2 ? SmoNote.flagStates.up : SmoNote.flagStates.down;
          }
        }  else {
          var flag = note.flagState;
          // an  auto-flag note is up if the 1st note is middle line
          if (flag == SmoNote.flagStates.auto) {
            var pitch = note.pitches[0];
            flag = smoMusic.pitchToLedgerLine(measure.clef,pitch)
             >= 2 ? SmoNote.flagStates.up : SmoNote.flagStates.down;
          }
        }
        var hiloHead = suiLayoutAdjuster._highestLowestHead(measure,note);
        if (flag == SmoNote.flagStates.down) {
          yOffset = Math.min(hiloHead.lo,yOffset);
          heightOffset = Math.max(hiloHead.hi + vexGlyph.stem.height,heightOffset);
        } else {
          yOffset = Math.min(hiloHead.lo - vexGlyph.stem.height,yOffset);
          heightOffset = Math.max(hiloHead.hi,heightOffset);
        }
        var dynamics = note.getModifiers('SmoDynamicText');
        dynamics.forEach((dyn) => {
          heightOffset = Math.max((10*dyn.yOffsetLine - 50) + 11,heightOffset);
          yOffset = Math.min(10*dyn.yOffsetLine - 50,yOffset)
        });
      });
    });
    return {belowBaseline:heightOffset,aboveBaseline:yOffset};
  }
}
