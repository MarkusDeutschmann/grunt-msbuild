import * as async from "async";
import { execSync, spawn } from "child_process";
import * as path from "path";

enum EVerbosityLevel {
	quiet = "quiet",
	minimal = "minimal",
	normal = "normal",
	detailed = "detailed",
	diagnostic = "diagnostic"
}

interface IMSBuildOptions {
	msbuildPath: string;
	projectConfiguration: string;
	targets: string[];
	buildParameters: { [key: string]: string };
	customArgs: string[];
	failOnError: boolean;
	verbosity: EVerbosityLevel;
	nologo: boolean;
	nodeReuse: boolean;
	maxCpuCount: number;
	platform: string;
	consoleLoggerParameters: string;
	visualStudioVersion: string;
	inferMsbuildPath: boolean;
	vswhereProducts: string | string[];
	vswhereVersion: string;
}

module.exports = (grunt: IGrunt): void => {
	grunt.registerMultiTask(
		"msbuild",
		"Run MSBuild tasks",
		// tslint:disable-next-line:only-arrow-functions
		async function run(this: grunt.task.IMultiTask<object>): Promise<void> {

			const asyncCallback = this.async();

			const options: IMSBuildOptions = this.options({
				buildParameters: {},
				consoleLoggerParameters: undefined,
				customArgs: [],
				failOnError: true,
				inferMsbuildPath: false,
				maxCpuCount: 1,
				msbuildPath: "",
				nodeReuse: true,
				nologo: true,
				platform: undefined,
				projectConfiguration: "Release",
				targets: ["Build"],
				verbosity: EVerbosityLevel.normal,
				visualStudioVersion: undefined,
				vswhereProducts: undefined,
				vswhereVersion: undefined
			});

			grunt.log.verbose.writeln(`Using Options: ${ JSON.stringify(options, undefined, 4).cyan }`);

			const projectFunctions: unknown[] = [];
			const files = this.files;
			let fileExists = false;

			if (files.length === 0) {
				files.push({ src: [""] });
			}

			files.forEach((filePair) => {
				grunt.log.verbose.writeln(`File ${ JSON.stringify(filePair, undefined, 4)}`);
				filePair.src.forEach((src: string) => {
					fileExists = true;
					projectFunctions.push((callback: () => {}) => {
						build(src, options, callback);
					});

					projectFunctions.push((callback: () => {}) => {
						callback();
					});
				});
			});

			if (!fileExists) {
				grunt.warn("No project or solution files found");
			}

			async.series(projectFunctions as async.AsyncFunction<unknown, Error>[], () => {
				asyncCallback();
			});

		});

	// tslint:disable-next-line:only-arrow-functions
	function build(src: string, options: IMSBuildOptions, cb: () => {}): void {

		const projName = src || path.basename(process.cwd());

		grunt.log.writeln(`Building ${ projName.cyan }`);

		if (!options.msbuildPath && !options.inferMsbuildPath) {
			grunt.fail.warn("options.msbuildPath not set. Either set the path, or set inferMsbuildPath to true");
		}

		if (!options.inferMsbuildPath) {
			if (options.vswhereProducts !== "*") {
				grunt.log.writeln("options.msbuildPath not set. So options.vswhereProducts is ignored");
			}
			if (options.vswhereVersion) {
				grunt.log.writeln("options.msbuildPath not set. So options.vswhereVersion is ignored");
			}
		}

		let cmd = options.msbuildPath;
		if (options.inferMsbuildPath) {
			cmd = inferMSBuildPathViaVSWhere(options.vswhereProducts, options.vswhereVersion);
		}
		const args = createCommandArgs(src, options);

		grunt.log.verbose.writeln(`Using cmd: ${ cmd }`);
		grunt.log.verbose.writeln(`Using args: ${ args }`);

		if (!cmd) {
			return;
		}

		const cp = spawn(cmd, args, {
			stdio: "inherit"
		});

		cp.on("close", (code: number): void => {
			const success = code === 0;
			grunt.log.verbose.writeln(`close received - code: ${ success }`);

			if (code === 0) {
				grunt.log.writeln(`Build complete ${ projName.cyan }`);
			} else {
				grunt.log.writeln(`${ (`MSBuild failed with code: ${ code }`).cyan }${ projName }`);
				if (options.failOnError) {
					grunt.warn(`MSBuild exited with a failure code: ${ code }`);
				}
			}
			cb();
		});

	}

	// tslint:disable-next-line:only-arrow-functions
	function prepareParam(param: string | string[]): string[] {
		let ret = param as string[];
		if (param && !Array.isArray(param)) {
			ret = [param];
		}
		return ret;
	}

	// tslint:disable-next-line:only-arrow-functions
	function setParams(vswhereProducts: string | string[], vswhereVersion: string): string[] {
		const params: string[] = [
			"-latest",
			"-requires Microsoft.Component.MSBuild",
			"-find MSBuild\\**\\MSBuild.exe"
		];

		if (vswhereVersion) {
			params.push(` -version ${ vswhereVersion }`);
		}
		if (!vswhereProducts && !vswhereVersion) {
			params.push(` -products *`);
		} else if (vswhereProducts) {
			params.push(`-products ${ prepareParam(vswhereProducts).join(" ") }`);
		}
		return params;
	}

	// tslint:disable-next-line:only-arrow-functions
	function inferMSBuildPathViaVSWhere(inferBuildPathProducts: string | string[], inferBuildPathVersion: string): string {

		grunt.log.verbose.writeln("Using vswhere.exe to infer path for msbuild");

		const exePath = path.resolve(__dirname, "../bin/vswhere.exe");
		const quotedExePath = `"${ exePath }"`;

		const quotedExePathWithArgs = `${ quotedExePath } ${ setParams(inferBuildPathProducts, inferBuildPathVersion).join(" ") }`;

		grunt.log.verbose.writeln(`using quoted exe path: ${ quotedExePathWithArgs }`);

		const resultString = execSync(quotedExePathWithArgs).toString();
		grunt.log.verbose.writeln("vswhere results start");
		grunt.log.verbose.writeln(resultString);
		grunt.log.verbose.writeln("vswhere results end");

		const results = resultString.split("\r");
		grunt.log.verbose.writeln("vswhere first result:");
		grunt.log.verbose.writeln(results[0]);

		const normalisedPath = path.normalize(results[0]);
		grunt.log.verbose.writeln("vswhere result normalised path: ");
		grunt.log.verbose.writeln(normalisedPath);

		return normalisedPath;
	}

	// tslint:disable-next-line:only-arrow-functions
	function createCommandArgs(src: string, options: IMSBuildOptions): string[] {

		const args: string[] = [];

		if (src) {
			const projectPath = path.normalize(src);

			args.push(projectPath);
		}

		args.push(`/target:${ options.targets }`);
		args.push(`/verbosity:${ options.verbosity }`);

		if (options.nologo) {
			args.push("/nologo");
		}

		if (options.maxCpuCount) {
			// maxcpucount is not supported by xbuild
			if (process.platform === "win32") {
				grunt.log.verbose.writeln(`Using maxcpucount:${ options.maxCpuCount }`);
				args.push(`/maxcpucount:${ options.maxCpuCount }`);
			}
		}

		if (options.consoleLoggerParameters) {
			grunt.log.verbose.writeln(`Using clp:${ options.consoleLoggerParameters }`);
			args.push(`/clp:${ options.consoleLoggerParameters }`);
		}

		args.push(`/property:Configuration=${ options.projectConfiguration }`);

		if (options.platform) {
			args.push(`/p:Platform=${ options.platform }`);
		}

		if (!options.nodeReuse) {
			args.push("/nodeReuse:false");
		}

		if (options.visualStudioVersion) {
			args.push(`/p:VisualStudioVersion=${ options.visualStudioVersion }.0`);
		}

		for (const buildArg in options.buildParameters) {
			const p = `/property:${ buildArg }=${ options.buildParameters[buildArg] }`;
			grunt.log.verbose.writeln(`setting property: ${ p }`);
			args.push(p);
		}

		options.customArgs.forEach(( a: string ): void => {
			grunt.log.verbose.writeln(`setting customArg: ${ a }`);
			args.push(a);
		});

		return args;
	}

};
