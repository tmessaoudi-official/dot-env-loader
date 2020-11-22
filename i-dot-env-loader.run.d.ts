// eslint-disable-next-line no-unused-vars
declare interface IDotEnvLoaderRun {
	source: EDotEnvLoaderSource;
	fs: never | null;
	config: Array<string | Array<Array<string>>> | null;
	tmp: Array<
		string | Array<Array<string>> | Array<Array<never>> | never
	> | null;
	// by default it is ./.app.env/.config it should be encoded with utf8
	run(
		// eslint-disable-next-line no-unused-vars
		envConfigPath?: string,
		// eslint-disable-next-line no-unused-vars
		encoding?: string
	): Array<string | Array<string>> | [];
	fileExists(
		// eslint-disable-next-line no-unused-vars
		filePath: string,
		// eslint-disable-next-line no-unused-vars
		error: { message: string; error?: boolean }
	): boolean;
	load(
		// eslint-disable-next-line no-unused-vars
		filePath: string | { current?: string; from?: string },
		// eslint-disable-next-line no-unused-vars
		encoding?: string,
		// eslint-disable-next-line no-unused-vars
		isConfig?: boolean
	): void;
	treatGarbage(
		// eslint-disable-next-line no-unused-vars
		filePath: string | { current?: string; from?: string },
		// eslint-disable-next-line no-unused-vars
		encoding?: string,
		// eslint-disable-next-line no-unused-vars
		debug?: boolean,
		// eslint-disable-next-line no-unused-vars
		isConfig?: boolean
	): void;
	// eslint-disable-next-line no-unused-vars
	evalProcessItems(): void;
	// eslint-disable-next-line no-unused-vars
	evalProcessItem(itemValue: never, item: string): never;
	// eslint-disable-next-line no-unused-vars
	evalAppItems(): void;
	// eslint-disable-next-line no-unused-vars
	evalAppItem(itemValue: never, item: string): never;
	// eslint-disable-next-line no-unused-vars
	handleValues(): void;
	// eslint-disable-next-line no-unused-vars
	handleValue(value: never, item: string | null): never;
	// eslint-disable-next-line no-unused-vars
	handle(
		item: never,
		value: string | null,
		defaultValue: string | null
	): never;
	// eslint-disable-next-line no-unused-vars
	getHandlers(value: never, position: string | null): RegExpExecArray | null;
	// eslint-disable-next-line no-unused-vars
	doDebug(isConfig: boolean): boolean;
	// eslint-disable-next-line no-unused-vars
	formatUndefined(
		// eslint-disable-next-line no-unused-vars
		value: undefined,
		// eslint-disable-next-line no-unused-vars
		varName: string
	): string | null | undefined;
	// eslint-disable-next-line no-unused-vars
	formatNull(
		// eslint-disable-next-line no-unused-vars
		value: undefined,
		// eslint-disable-next-line no-unused-vars
		varName: string
	): string | null | undefined;
}
