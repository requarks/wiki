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
	scriptlibs: [
		'./node_modules/jquery/dist/jquery.min.js',
		'./node_modules/vue/dist/vue.min.js',
		'./node_modules/jquery-smooth-scroll/jquery.smooth-scroll.min.js',
		'./node_modules/sticky-js/dist/sticky.min.js',
		'./node_modules/simplemde/dist/simplemde.min.js',
		'./node_modules/ace-builds/src-min-noconflict/ace.js',
		'./node_modules/ace-builds/src-min-noconflict/mode-markdown.js',
		'./node_modules/ace-builds/src-min-noconflict/theme-tomorrow_night.js',
		'./node_modules/lodash/lodash.min.js'
	],
	scriptapps: [
		'./client/js/components/*.js',
		'./client/js/app.js'
	],
	scriptapps_watch: [
		'./client/js/**/*.js'
	],
	csslibs: [
		'./node_modules/font-awesome/css/font-awesome.min.css',
		'./node_modules/highlight.js/styles/default.css',
		'./node_modules/simplemde/dist/simplemde.min.css'
	],
	cssapps: [
		'./client/scss/app.scss'
	],
	cssapps_watch: [
		'./client/scss/**/*.scss'
	],
	cssapps_imports: [
		'./node_modules/bulma/'
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
		'!gulpfile.js', '!inch.json', '!config.yml', '!wiki.sublime-project'
	]
};

/**
 * TASK - Starts server in development mode
 */
gulp.task('server', ['scripts', 'css', 'fonts'], function() {
	nodemon({
		script: './server',
		ignore: ['assets/', 'client/', 'data/', 'repo/', 'tests/'],
		ext: 'js json',
		env: { 'NODE_ENV': 'development' }
	});
});

/**
 * TASK - Process all scripts processes
 */
gulp.task("scripts", ['scripts-libs', 'scripts-app']);

/**
 * TASK - Combine js libraries
 */
gulp.task("scripts-libs", function () {

	return gulp.src(paths.scriptlibs)
	.pipe(plumber())
	.pipe(concat('libs.js'))
	.pipe(uglify({ mangle: false }))
	.pipe(plumber.stop())
	.pipe(gulp.dest("./assets/js"));

});

/**
 * TASK - Combine, make compatible and compress js app scripts
 */
gulp.task("scripts-app", function () {

	return gulp.src(paths.scriptapps)
	.pipe(plumber())
	.pipe(concat('app.js'))
	.pipe(include({ extensions: "js" }))
	.pipe(babel())
	.pipe(uglify())
	.pipe(plumber.stop())
	.pipe(gulp.dest("./assets/js"));

});

/**
 * TASK - Process all css processes
 */
gulp.task("css", ['css-libs', 'css-app']);

/**
 * TASK - Combine css libraries
 */
gulp.task("css-libs", function () {
	return gulp.src(paths.csslibs)
	.pipe(plumber())
	.pipe(concat('libs.css'))
	.pipe(cleanCSS({ keepSpecialComments: 0 }))
	.pipe(plumber.stop())
	.pipe(gulp.dest("./assets/css"));
});

/**
 * TASK - Combine app css
 */
gulp.task("css-app", function () {
	return gulp.src(paths.cssapps)
	.pipe(plumber())
	.pipe(sass({
		includePaths: paths.cssapps_imports
	}))
	.pipe(concat('app.css'))
	.pipe(cleanCSS({ keepSpecialComments: 0 }))
	.pipe(plumber.stop())
	.pipe(gulp.dest("./assets/css"));
});

/**
 * TASK - Copy web fonts
 */
gulp.task("fonts", function () {
	return gulp.src(paths.fonts)
	.pipe(gulp.dest("./assets/fonts"));
});

/**
 * TASK - Start dev watchers
 */
gulp.task('watch', function() {
	gulp.watch([paths.scriptapps_watch], ['scripts-app']);
	gulp.watch([paths.cssapps_watch], ['css-app']);
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