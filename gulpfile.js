var gulp = require("gulp");
var watch = require('gulp-watch');
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
var run = require('run-sequence');
var _ = require('lodash');

/**
 * Paths
 *
 * @type       {Object}
 */
var paths = {
	scripts: {
		combine: [
			'./node_modules/socket.io-client/dist/socket.io.min.js',
			'./node_modules/jquery/dist/jquery.min.js',
			'./node_modules/vue/dist/vue.min.js',
			'./node_modules/jquery-smooth-scroll/jquery.smooth-scroll.min.js',
			'./node_modules/jquery-simple-upload/simpleUpload.min.js',
			'./node_modules/jquery-contextmenu/dist/jquery.contextMenu.min.js',
			'./node_modules/sticky-js/dist/sticky.min.js',
			'./node_modules/simplemde/dist/simplemde.min.js',
			'./node_modules/ace-builds/src-min-noconflict/ace.js',
			'./node_modules/ace-builds/src-min-noconflict/ext-modelist.js',
			'./node_modules/ace-builds/src-min-noconflict/mode-markdown.js',
			'./node_modules/ace-builds/src-min-noconflict/theme-tomorrow_night.js',
			'./node_modules/filesize.js/dist/filesize.min.js',
			'./node_modules/lodash/lodash.min.js'
		],
		ace: [
			'./node_modules/ace-builds/src-min-noconflict/mode-*.js',
			'!./node_modules/ace-builds/src-min-noconflict/mode-markdown.js'
		],
		compile: [
			'./client/js/*.js'
		],
		watch: [
			'./client/js/**/*.js'
		]
	},
	css: {
		combine: [
			'./node_modules/font-awesome/css/font-awesome.min.css',
			'./node_modules/highlight.js/styles/tomorrow.css',
			'./node_modules/simplemde/dist/simplemde.min.css'
		],
		compile: [
			'./client/scss/*.scss'
		],
		includes: [
			'./node_modules/requarks-core' //! MUST BE LAST
		],
		watch: [
			'./client/scss/**/*.scss',
			'../core/core-client/scss/**/*.scss'
		]
	},
	fonts: [
		'./node_modules/font-awesome/fonts/*-webfont.*',
		'!./node_modules/font-awesome/fonts/*-webfont.svg',
		'../node_modules/requarks-core/core-client/fonts/**/*' //! MUST BE LAST
	],
	deploy: [
		'./**/*',
		'!node_modules', '!node_modules/**',
		'!coverage', '!coverage/**',
		'!client/js', '!client/js/**',
		'!client/scss', '!client/scss/**',
		'!dist', '!dist/**',
		'!tests', '!tests/**',
		'!data', '!data/**',
		'!repo', '!repo/**',
		'!.babelrc', '!.gitattributes', '!.gitignore', '!.snyk', '!.travis.yml',
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

	return merge(

		gulp.src(paths.scripts.combine)
		.pipe(concat('libs.js', {newLine: ';\n'}))
		.pipe(uglify({ mangle: false }))
		.pipe(gulp.dest("./assets/js")),

		gulp.src(paths.scripts.ace)
		.pipe(gulp.dest("./assets/js/ace"))

	);

});

/**
 * TASK - Combine, make compatible and compress js app scripts
 */
gulp.task("scripts-app", function () {

	return gulp.src(paths.scripts.compile)
	.pipe(plumber())
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
	return gulp.src(paths.css.combine)
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
	return gulp.src(paths.css.compile)
	.pipe(plumber())
	.pipe(sass.sync({ includePaths: paths.css.includes }))
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
	return merge(
		watch(paths.scripts.watch, {base: './'}, function() { return gulp.start('scripts-app'); }),
		watch(paths.css.watch, {base: './'}, function() { return gulp.start('css-app'); })
	);
});

/**
 * TASK - Starts development server with watchers
 */
gulp.task('default', ['watch', 'server']);

gulp.task('dev', function() {

	paths.css.includes.pop();
	paths.css.includes.push('../core');

	paths.fonts.pop();
	paths.fonts.push('../core/core-client/fonts/**/*');

	return run('default');

})

/**
 * TASK - Creates deployment packages
 */
gulp.task('deploy', ['scripts', 'css', 'fonts'], function() {
	var zipStream = gulp.src(paths.deploy)
		.pipe(zip('wiki-js.zip'))
		.pipe(gulp.dest('dist'));

	var targzStream = gulp.src(paths.deploy)
		.pipe(tar('wiki-js.tar'))
		.pipe(gzip())
		.pipe(gulp.dest('dist'));

	return merge(zipStream, targzStream);
});
