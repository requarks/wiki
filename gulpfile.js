var gulp = require("gulp");
var merge = require('merge-stream');
var babel = require("gulp-babel");
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var nodemon = require('gulp-nodemon');
var plumber = require('gulp-plumber');
var zip = require('gulp-zip');
var tar = require('gulp-tar');
var gzip = require('gulp-gzip');
var sass = require('gulp-sass');
var cleanCSS = require('gulp-clean-css');
var include = require("gulp-include");

/**
 * Paths
 *
 * @type       {Object}
 */
var paths = {
	scriptlibs: {

	},
	scriptapps: [
		'./client/js/components/*.js',
		'./client/js/app.js'
	],
	scriptappswatch: [
		'./client/js/**/*.js'
	],
	csslibs: [

	],
	cssapps: [
		'./client/css/app.scss'
	],
	cssappswatch: [
		'./client/css/**/*.scss'
	],
	fonts: [
		'./node_modules/font-awesome/fonts/*-webfont.*',
		'!./node_modules/font-awesome/fonts/*-webfont.svg'
	],
	deploypackage: [
		'./**/*',
		'!node_modules', '!node_modules/**',
		'!coverage', '!coverage/**',
		'!client/js', '!client/js/**',
		'!dist', '!dist/**',
		'!tests', '!tests/**',
		'!gulpfile.js', '!inch.json', '!config.json', '!wiki.sublime-project'
	]
};

/**
 * TASK - Starts server in development mode
 */
gulp.task('server', ['scripts', 'css', 'fonts'], function() {
	nodemon({
		script: './server',
		ignore: ['public/', 'client/', 'tests/'],
		ext: 'js json',
		env: { 'NODE_ENV': 'development' }
	});
});

/**
 * TASK - Start dev watchers
 */
gulp.task('watch', function() {
	gulp.watch([paths.scriptappswatch], ['scripts-app']);
	gulp.watch([paths.cssappswatch], ['css-app']);
});

/**
 * TASK - Starts development server with watchers
 */
gulp.task('default', ['watch', 'server']);

/**
 * TASK - Creates deployment packages
 */
gulp.task('deploy', ['scripts', 'css', 'fonts'], function() {
	var zipStream = gulp.src(paths.deploypackage)
		.pipe(zip('requarks-wiki.zip'))
		.pipe(gulp.dest('dist'));

	var targzStream = gulp.src(paths.deploypackage)
		.pipe(tar('requarks-wiki.tar'))
		.pipe(gzip())
		.pipe(gulp.dest('dist'));

	return merge(zipStream, targzStream);
});