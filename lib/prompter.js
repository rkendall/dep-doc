'use strict';

var inquirer = require('inquirer');
var clc = require('cli-color');
var Q = require('q');

var config = require('./config').default;
var parser = require('./parser');
var updater = require('./updater');
var reporter = require('./reporter');

var prompter = {

	start: function(options) {
		var self = this;
		config.set(options);
		var settings = config.get();
		console.log('\n' + clc.blue.bold('Looking for broken references in ') + clc.blue(settings.workingDirectory));
		parser.getAll()
			.then(function(references) {
				console.log(clc.blue.bold('Searching ' + Object.keys(references.existingFiles).length + ' files\n'));
				console.log(parser.getReport(references.brokenReferences));
				self.promptToCorrect(references.brokenReferences);
			})
			.handleError();
	},

	promptToCorrect: function(brokenReferences) {
		var self = this;
		var numberOfFilesToFix = parser.getNumberOfFilesToFix(brokenReferences);
		var referencesWithMultiplePossibleCorrections = parser.getReferencesWithMultiplePossibleCorrections(brokenReferences);
		if (numberOfFilesToFix || Object.keys(referencesWithMultiplePossibleCorrections).length) {
			Q(inquirer.prompt({
				type: 'confirm',
				name: 'correct',
				message: 'Update files to correct references?'
			}))
			.then(function(confirmed) {
				if (confirmed.correct) {
					return self.correctAndReport(brokenReferences);
				}
				return false;
			})
			.then(function(promptToFix) {
				if (promptToFix) {
					self.promptToSelectCorrectPath(brokenReferences);
				}
			})
			.handleError();
		}

	},

	// PRIVATE METHODS

	correctAndReport: function(brokenReferences) {
		return updater.update(brokenReferences)
			.then(function(namesArrayOfFilesFixed) {
				reporter.showReport(reporter.reportFilesUpdated(namesArrayOfFilesFixed));
				return true;
			})
			.handleError();
	},

	promptToSelectCorrectPath: function(brokenReferences) {
		var self = this;
		var referencesWithMultiplePossibleCorrections = parser.getReferencesWithMultiplePossibleCorrections(brokenReferences);
		if (!referencesWithMultiplePossibleCorrections.length) {
			return;
		}
		var questions = [];
		referencesWithMultiplePossibleCorrections.forEach(function(referenceWithMultipleOptions) {
			var newQuestions = self.setPromptQuestionForEachFile(referenceWithMultipleOptions);
			questions = questions.concat(newQuestions);
		});
		console.log('\n');
		Q(inquirer.prompt(questions))
			.then(function(answers) {
				var fixedReferences = [];
				for (var referenceToCorrect in answers) {
					var brokenReference = brokenReferences.find(function(reference) {
						return reference.referencedFile === referenceToCorrect;
					});
					brokenReference.correctPath = answers[referenceToCorrect];
					fixedReferences.push(brokenReference);
				}
				self.correctAndReport(fixedReferences);
			})
			.handleError();
	},

	setPromptQuestionForEachFile: function(referenceWithMultipleOptions) {
		var questions = [];
		referenceWithMultipleOptions.referencingFiles.forEach(function(referencingFile) {
			questions.push({
				type: 'list',
				name: referenceWithMultipleOptions.referencedFile,
				message: clc.blue('\nChoose the correct path for this broken reference: ') + referenceWithMultipleOptions.referencedFile + clc.blue('\nwhich is contained in this file: ') + referencingFile + clc.blue('\nSelect one of the following paths:\n'),
				choices: referenceWithMultipleOptions.possibleCorrectPaths
			});
		});
		return questions;
	}

};

module.exports = {
	start: prompter.start.bind(prompter),
	promptToCorrect: prompter.promptToCorrect.bind(prompter)
};