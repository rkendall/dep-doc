'use-strict';

var program = require('commander');

var config = require('./config');
var parser = require('./parser');
var updater = require('./updater');
var reporter = require('./reporter');
var prompter = require('./prompter');

var cli = {

	start: function() {
		cli.parseCommandLine();
	},

	// PRIVATE METHODS

	execute: function(reportOptions, processingOptions) {
		parser.getAll()
			.then(function(fileData) {
				console.log('');
				reporter.showReport(reporter.reportFilesChecked(fileData));
				reporter.showReport(reporter.getReport(fileData, reportOptions));
				if (processingOptions.fixBrokenReferences && processingOptions.promptToFix) {
					prompter.promptToCorrect(fileData.brokenReferences, fileData.existingFiles);
				} else {
					updater.update(fileData.brokenReferences, fileData.existingFiles)
						.then(function(namesArrayOfFilesFixed) {
							var message = reporter.reportFilesUpdated(namesArrayOfFilesFixed);
							if (message) {
								console.log(message);
							}
						});
				}
			})
			.catch(function(err) {
				console.error(err.message, err.stack);
			});
	},

	parseCommandLine: function() {

		var command = 'prompt';

		program
			.version('0.1')
			.description('Finds and repairs broken references in files.')

			// Configuration options
			.option('-m, --mode <default|html>', 'Type of references to look for, module import/require references (default) or HTML links (html)')
			.option('-d, --dir <directory>', 'The working directory in which to fix broken references recursively')
			//.option('-f, --filter-files <filename_globs>', 'Comma-separated list of globs to filter files parsed. Quotes required. (e.g., \'*.js,*.jsx\')')
			.option('-f, --filter-directories <directory_globs>', 'Comma-separated list of directories to exclude from parsing. Quotes required. (e.g., \'test,bin\')')

			// Report options
			.option('-e, --errors', 'List the files that contain broken references to other files')
			.option('-s, --sources [file_glob]', 'List the files (sources of references) that contain references to other files')
			.option('-t, --targets', 'List the files (targets of references) that are referenced by other files')

			// Processing options
			.option('-u, --unprompted', 'Don\'t prompt to fix broken references, just fix them (unless -r)')
			.option('-r, --read-only', 'Don\'t fix broken references');

		program
			.command('references')
			.description('List all references in the current working directory')
			.action(function(arg) {
				command = arg._name;
			});

		program.parse(process.argv);

		if (program.mode) {
			config.setMode(program.mode);
		}

		var options = {};
		if (program.dir) {
			options.workingDir = program.dir;
		}
		if (program.filterDirectories) {
			options.directoryFilter = program.filterDirectories.split(',');
		}
		if (typeof program.sources === 'string') {
			var fileGlobs = program.sources.split(',');
			options.referencingFileFilter = fileGlobs;
		}

		config.set(options);
		console.info(config.getMode())
		console.info(JSON.stringify(config.get()));

		var reportOptions = {
			brokenReferences: Boolean(program.errors),
			referencingFiles: Boolean(program.sources)
		};
		if (!program.sources) {
			reportOptions.brokenReferences = true;
		}

		var processingOptions = {
			fixBrokenReferences: !program.readOnly,
			promptToFix: !program.unprompted
		};

		cli.execute(reportOptions, processingOptions);

	}

};

module.exports = {
	start: cli.start
};