

// ## suiController
// ## Description:
// Manages DOM events and binds keyboard and mouse events
// to editor and menu commands, tracker and layout manager.
class suiController {

	constructor(params) {
		Vex.Merge(this, suiController.defaults);
		Vex.Merge(this, params);
		this.undoBuffer = new UndoBuffer();
		this.pasteBuffer = this.tracker.pasteBuffer;
		this.editor.undoBuffer = this.undoBuffer;
		this.editor.pasteBuffer = this.pasteBuffer;
		this.resizing = false;

		this.ribbon = new RibbonButtons({
				ribbons: defaultRibbonLayout.ribbons,
				ribbonButtons: defaultRibbonLayout.ribbonButtons,
				menus: this.menus,
				editor: this.editor,
				tracker: this.tracker,
				score: this.score,
				controller: this
			});

		this.bindEvents();
		this.bindResize();
	}

	resizeEvent() {
		var self = this;
		var remap = function () {
			return self.tracker.updateMap();
		}
		if (this.resizing)
			return;
		this.resizing = true;
		setTimeout(function () {
			console.log('resizing');
			self.resizing = false;
			self.layout.setViewport();
			self.layout.render().then(remap);
		}, 500);
	}

	bindResize() {
		var self = this;
		window.addEventListener('resize', function () {
			self.resizeEvent();
		});
	}

	// ## createUi
	// ### Description:
	// Convenience constructor, taking a renderElement and a score.
	static createUi(renderElement, score) {
		var params = suiController.keyBindingDefaults;
		params.layout = suiSimpleLayout.createScoreLayout(renderElement, score);
		params.tracker = new suiTracker(params.layout);
		params.score = score;
		params.editor = new suiEditor(params);
		params.menus = new suiMenuManager(params);
		var controller = new suiController(params);
		return controller;
	}

	static start() {
		var score = SmoScore.getEmptyScore();
		score.addDefaultMeasureWithNotes(0, {});
		score.addDefaultMeasureWithNotes(1, {});
		score.addDefaultMeasureWithNotes(2, {});
		score.addDefaultMeasureWithNotes(3, {});
		score.addDefaultMeasureWithNotes(4, {});
		score.addStaff();

		var controller = suiController.createUi(document.getElementById("boo"), score);
		var remap = function () {
			return controller.tracker.updateMap();
		}
		controller.layout.render().then(remap);

	}

	// ### renderElement
	// return render element that is the DOM parent of the svg
	get renderElement() {
		return this.layout.renderElement;
	}

	// ## keyBindingDefaults
	// ### Description:
	// Different applications can create their own key bindings, these are the defaults.
	// Many editor commands can be reached by a single keystroke.  For more advanced things there
	// are menus.
	static get keyBindingDefaults() {
		var editorKeys = suiController.editorKeyBindingDefaults;
		editorKeys.forEach((key) => {
			key.module = 'editor'
		});
		var trackerKeys = suiController.trackerKeyBindingDefaults;
		trackerKeys.forEach((key) => {
			key.module = 'tracker'
		});
		return trackerKeys.concat(editorKeys);
	}

	// ## editorKeyBindingDefaults
	// ## Description:
	// execute a simple command on the editor, based on a keystroke.
	static get editorKeyBindingDefaults() {
		return defaultEditorKeys.keys;
	}

	// ## trackerKeyBindingDefaults
	// ### Description:
	// Key bindings for the tracker.  The tracker is the 'cursor' in the music
	// that lets you select and edit notes.
	static get trackerKeyBindingDefaults() {
		return defaultTrackerKeys.keys;
	}

	helpControls() {
		var self = this;
		var rebind = function () {
			self.render();
			self.bindEvents();
		}
		/* SmoHelp.helpControls();
		$('.controls-left button.help-button').off('click').on('click', function () {
		window.removeEventListener("keydown", self.keydownHandler, true);
		SmoHelp.displayHelp();
		htmlHelpers.closeDialogPromise().then(rebind);
		});   */
	}
	static set reentry(value) {
		suiController._reentry = value;
	}
	static get reentry() {
		if (typeof(suiController['_reentry']) == 'undefined') {
			suiController._reentry = false;
		}
		return suiController._reentry;
	}

	exceptionHandler(e) {
		var self = this;
		if (suiController.reentry) {
			return;
		}
		suiController.reentry = true;
		var scoreString = 'Could not serialize score.';
		try {
			scoreString = this.score.serialize();
		} catch (e) {
			scoreString += ' ' + e.message;
		}
		var message = e.message;
		var stack = 'No stack trace available';

		try {
			if (e.error && e.error.stack) {
				stack = e.error.stack;
			}
		} catch (e) {
			stack = 'Error with stack: ' + e.message;
		}
		var doing = 'Last operation not available.';

		var lastOp = this.undoBuffer.peek();
		if (lastOp) {
			doing = lastOp.title;
		}
		var url = 'https://github.com/AaronDavidNewman/Smoosic/issues';
		var bodyObject = JSON.stringify({
				message: message,
				stack: stack,
				lastOperation: doing,
				scoreString: scoreString
			}, null, ' ');

		var b = htmlHelpers.buildDom;
		var r = b('div').classes('bug-modal').append(
				b('img').attr('src', '../styles/images/logo.png').classes('bug-logo'))
			.append(b('button').classes('icon icon-cross bug-dismiss-button'))
			.append(b('span').classes('bug-title').text('oh nooooo!  You\'ve found a bug'))
			.append(b('p').text('It would be helpful if you would submit a bug report, and copy the data below into an issue'))
			.append(b('div')
				.append(b('textarea').attr('id', 'bug-text-area').text(bodyObject))
				.append(
					b('div').classes('button-container').append(b('button').classes('bug-submit-button').text('Submit Report'))));

		$('.bugDialog').html('');
		$('.bugDialog').append(r.dom());

		$('.bug-dismiss-button').off('click').on('click', function () {
			$('body').removeClass('bugReport');
			if (lastOp) {
				self.undoBuffer.undo(self.score);
				self.layout.render();
			}
		});
		$('.bug-submit-button').off('click').on('click', function () {
			var data = {
				title: "automated bug report",
				body: encodeURIComponent(bodyObject)
			};
			$('#bug-text-area').select();
			document.execCommand('copy');
			window.open(url,'Report Smoosic issues');
		});
		$('body').addClass('bugReport');

	}

	menuHelp() {
		SmoHelp.modeControls();
	}

	static get defaults() {
		return {
			keyBind: suiController.keyBindingDefaults
		};
	}

	showModifierDialog(modSelection) {
		return SuiDialogFactory.createDialog(modSelection, this.tracker.context, this.tracker, this.layout)
	}

	handleKeydown(evdata) {
		var self = this;
		var rebind = function () {
			self.render();
			self.bindEvents();
		}
		console.log("KeyboardEvent: key='" + event.key + "' | code='" +
			event.code + "'"
			 + " shift='" + event.shiftKey + "' control='" + event.ctrlKey + "'" + " alt='" + event.altKey + "'");
		event.preventDefault();

		if (evdata.key == '?') {
			SmoHelp.displayHelp();
		}

		if (evdata.key == '/') {
			window.removeEventListener("keydown", this.keydownHandler, true);
			this.menuHelp();
			this.menuPromise = this.menus.slashMenuMode().then(rebind);
		}

		// TODO:  work dialogs into the scheme of things
		if (evdata.key == 'p') {
			var modSelection = this.tracker.getSelectedModifier();
			if (modSelection) {
				window.removeEventListener("keydown", this.keydownHandler, true);
				var dialog = this.showModifierDialog(modSelection);
				dialog.closeDialogPromise.then(rebind);
			}
			return;
		}

		var binding = this.keyBind.find((ev) =>
				ev.event === 'keydown' && ev.key === evdata.key && ev.ctrlKey === evdata.ctrlKey &&
				ev.altKey === evdata.altKey && evdata.shiftKey === ev.shiftKey);

		if (binding) {
			this[binding.module][binding.action](evdata);
		}
	}

	detach() {
		window.removeEventListener("keydown", this.keydownHandler, true);
		/* this.layout = null;
		this.tracker = null;
		this.editor = null;  */
	}

	render() {
		var controller = this;
		var remap = function () {
			return controller.tracker.updateMap();
		}
		this.layout.render().then(remap)
	}

	bindEvents() {
		var self = this;
		var tracker = this.tracker;
		$(this.renderElement).off('mousemove').on('mousemove', function (ev) {
			tracker.intersectingArtifact({
				x: ev.clientX,
				y: ev.clientY
			});
		});

		$(this.renderElement).off('click').on('click', function (ev) {
			tracker.selectSuggestion();
		});

		this.keydownHandler = this.handleKeydown.bind(this);

		this.helpControls();

		window.addEventListener("keydown", this.keydownHandler, true);
		this.ribbon.display();

		window.addEventListener('error', function (e) {
			self.exceptionHandler(e);
		});
	}

}
