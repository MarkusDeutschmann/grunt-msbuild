var PATH = require("path");

module.exports = function(grunt) {
	"use strict";

	grunt.initConfig({
		modulename: grunt.file.readJSON("package.json").name,
		filename: "msbuild",
		shell: {
			tsc: {
				command: PATH.join("node_modules", ".bin", "tsc"),
				options: {
					execOptions: {
						cwd: "."
					}
				}
			},
			tslint: {
				command: `${PATH.join("node_modules", ".bin", "tslint")} --project tsconfig.json --format verbose`,
				options: {},
				files: {
					src: ["src/**/*.ts"]
				}
			}
		},
		compress: {
			npmpackage: {
				options: {
					archive: "<%= modulename %>.tar",
					mode: "tar"
				},
				files: [
					{
						src: [
							"package.json",
							"tasks/<%= filename %>.js",
							"tasks/class/*.js",
							"tasks/class/*.d.ts",
							"*.md",
							"bin/*",
							"!tasks/**/*.spec.js",
							"!tasks/**/*.spec.d.ts",
							"!tasks/**/specData/**",
							"!tasks/specHelpers/**",
							"!tasks/**/*.js.map"
						],
						dest: "<%= modulename %>/"
					}
				]
			}
		}
	});

	grunt.loadNpmTasks("grunt-shell");
	grunt.loadNpmTasks("grunt-contrib-compress");

	grunt.registerTask("default", "Lints and builds the module.", [
		"shell:tslint",
		"shell:tsc",
		"compress:npmpackage"
	]);

	grunt.registerTask("test", ["shell:tslint", "shell:tsc"]);

};
