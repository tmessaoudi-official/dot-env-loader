const dotEnvLoaderRun = function (source = null) {
	const init = function (source = null) {
		if (typeof source !== `string` || source === ``) {
			source = `process`;
		}
		if (source !== `process`) {
			throw new Error(
				` - DotEnvLoader : Unknown execution source '${source}' provided`
			);
		}
		return source;
	};

	return {
		source: init(source),
		fs: require(`fs`),
		config: { garbage: [], files: [] },
		tmp: { garbage: [] },
		fileExists: function (filePath, error) {
			if (!this.fs.existsSync(filePath)) {
				if (error.error === true) {
					throw new Error(error.message);
				}

				if (this.doDebug()) {
					console.warn(error.message);
				}
				return false;
			}
			return true;
		},
		run: function (
			encoding = `utf8`,
			envConfigPath = `./.app.env/.env.configuration`
		) {
			if (typeof envConfigPath !== `string` || envConfigPath === ``) {
				envConfigPath = `./.app.env/.env.configuration`;
			}
			if (typeof encoding !== `string` || encoding === ``) {
				encoding = `utf8`;
			}
			this.fileExists(envConfigPath, {
				message: `envConfigFile '${envConfigPath}' not found !!`,
				error: true
			});

			this.load({ current: envConfigPath }, encoding, true);

			this.config.APP_ENV_CONFIG_HANDLERS_OVERRIDE.split(this.config.APP_ENV_CONFIG_HANDLERS_OVERRIDE_SEPARATOR).map(
				function (item) {
					return item.split(this.config.APP_ENV_CONFIG_HANDLERS_OVERRIDE_PREFIX_SEPARATOR);
				}, this).forEach(function (item) {
				if (typeof this.environment[item.handler] === `undefined`) {
					this.environment[item.handler] = {};
				}
				this.environment[item[0]][item[1]] = require(`${process.cwd()}/${item[2]}`).default;
			}, this);

			delete this.config.garbage;
			this.load(
				{
					current: this.config.APP_ENV_CONFIG_DIST_FILE_PATH
				},
				this.config.APP_ENV_CONFIG_ENCODING
			);
			delete this.tmp.garbage;

			process.env.NODE_ENV = this.tmp.NODE_ENV;
			process.env.NODE_DEBUG = this.doDebug();
			process.env.APP_ENV = this.tmp.APP_ENV;

			Object.keys(this.config).forEach(function (item) {
				delete this.tmp[item];
			}, this);

			this.evalProcessItems();
			this.evalAppItems();
			this.handleValues();

			if (this.tmp.APP_DEBUG) {
				console.log(this.tmp);
				console.log(this.config.files);
			}

			if (
				typeof process.env.APP_ENV_RUN_BUILD === `string` &&
				process.env.APP_ENV_RUN_BUILD === `true`
			) {
				const envBuildPath = this.config.APP_ENV_CONFIG_BUILD_FILE_PATH;
				try {
					this.fs.unlinkSync(envBuildPath);
				} catch (err) {}
				let data = ``;
				Object.keys(this.tmp).forEach(function (item) {
					data += item + `=${this.tmp[item]}\n`;
				}, this);
				Object.keys(this.config).forEach(function (item) {
					if (item === `files`) {
						return;
					}
					data += item + `=${this.config[item]}\n`;
				}, this);
				try {
					this.fs.writeFileSync(envBuildPath, data);
				} catch (exception) {
					console.log(
						`there was an error when creating ${envBuildPath}`
					);
				}
			}

			return this.tmp;
		},
		load: function (filePath, encoding = `utf8`, isConfig = false) {
			if (typeof isConfig !== `boolean`) {
				isConfig = false;
			}
			if (this.config && this.config.APP_ENV_CONFIG_ENCODING) {
				encoding = this.config.APP_ENV_CONFIG_ENCODING;
			}
			const debug = this.doDebug(isConfig);
			if (debug) {
				console.log(
					`${
						!filePath.from ? `**root**` : `        `
					}--- Starting import of '${
						filePath.current +
						`'${!filePath.from ? `` : ` !! from ${filePath.from}`}`
					} as ${
						isConfig ? `Config` : `Env`
					} file with encoding '${encoding}'`
				);
			}
			this.fs
				.readFileSync(filePath.current, {
					encoding: encoding
				})
				.split(/\r?\n/)
				.forEach(function (line, index) {
					const regex = new RegExp(
						`^(?<key>[A-Z][A-Z0-9${
							!this.config ||
							!this.config.APP_ENV_CONFIG_VAR_WORD_SEPARATOR
								? `_`
								: this.config.APP_ENV_CONFIG_VAR_WORD_SEPARATOR
						}]*)\=(?<value>.*)$`,
						`g`
					);
					const matches = regex.exec(line);
					if (matches && matches.groups) {
						this.tmp[matches.groups.key] = matches.groups.value;
					} else {
						this.tmp.garbage.push({
							content: line,
							line: index + 1
						});
					}
				}, this);
			if (isConfig) {
				Object.keys(this.tmp).forEach(function (item) {
					if (item !== `garbage`) {
						this.config[item] = this.tmp[item];
					}
				}, this);
			}
			this.config.files.push(filePath);
			this.treatGarbage(filePath, encoding, debug, isConfig);
			this.tmp.garbage = [];
		},
		treatGarbage: function (filePath, encoding, debug, isConfig) {
			const garbage = this.tmp.garbage;
			this.tmp.garbage = [];
			if (garbage.length > 0) {
				garbage.forEach(function (item) {
					if (item.content.startsWith(`#`) || item.content === ``) {
						if (debug) {
							console.warn(
								// eslint-disable-next-line max-len
								`           -- DotEnv : ignoring line (empty|comment) '${
									item.line
								}' ** '${item.content}' in file '${
									filePath.current
								}' ${
									!filePath.from
										? ``
										: ` !! included by ${filePath.from}`
								}`
							);
						}
					} else {
						if (
							item.content.startsWith(
								this.config.APP_ENV_CONFIG_FILE_INCLUDES_KEY
							)
						) {
							item.content
								.replace(
									this.config
										.APP_ENV_CONFIG_FILE_INCLUDES_KEY + `=`,
									``
								)
								.split(
									this.config
										.APP_ENV_CONFIG_INCLUDES_SEPARATOR
								)
								.forEach(function (item) {
									if (debug) {
										console.log(
											`     --- Including '${item}' as ${
												isConfig ? `Config` : `Env`
											} file with encoding '${encoding}' by '${
												filePath.current
											}'`
										);
									}
									item = item
										.replace(
											`\${app.env::NODE_ENV}`,
											this.config.NODE_ENV
										)
										.replace(
											`\${app.env::APP_ENV}`,
											this.tmp.APP_ENV
										)
										.replace(
											`\${process.env::${this.config.APP_ENV_CONFIG_NODE_ENV_INCLUDE}}`,
											process.env[
												this.config
													.APP_ENV_CONFIG_NODE_ENV_INCLUDE
												]
										)
										.replace(
											`\${process.env::${this.config.APP_ENV_CONFIG_PROCESS_FILE_INCLUDES_KEY}}`,
											process.env[
												this.config
													.APP_ENV_CONFIG_PROCESS_FILE_INCLUDES_KEY
												]
										);
									if (
										item.includes(
											this.config
												.APP_ENV_CONFIG_INCLUDES_SEPARATOR
										)
									) {
										item.split(
											this.config
												.APP_ENV_CONFIG_INCLUDES_SEPARATOR
										).forEach(function (item) {
											if (
												this.fileExists(item, {
													message: `${
														!filePath.from
															? ``
															: `      `
													} -- File ${item} ${
														!filePath.from
															? ``
															: ` !! included by ${filePath.from}`
													} does not exists !!`
												})
											) {
												this.load(
													{
														current: item,
														from: filePath.current
													},
													encoding,
													isConfig
												);
											}
										}, this);
									} else {
										if (
											this.fileExists(item, {
												message: `${
													!filePath.from
														? ``
														: `      `
												} -- File ${item} ${
													!filePath.from
														? ``
														: ` !! included by ${filePath.from}`
												} does not exists !!`
											})
										) {
											this.load(
												{
													current: item,
													from: filePath.current
												},
												encoding,
												isConfig
											);
										}
									}
								}, this);
						} else {
							if (debug) {
								console.warn(
									`           //// Unformatted line '${item.line}' !! : '${item.content}' in file '${filePath.current}'`
								);
							}
						}
					}
				}, this);
			}
		},
		doDebug: function (isConfig = false) {
			return typeof process.env.NODE_DEBUG_FORCE === `string` &&
			process.env.NODE_DEBUG_FORCE !== ``
				? process.env.NODE_DEBUG_FORCE === `true`
				: this.config && typeof this.config.NODE_DEBUG !== `undefined`
					? this.config.NODE_DEBUG === `true` ||
					this.config.NODE_DEBUG === true
					: this.tmp && typeof this.tmp.NODE_DEBUG !== `undefined`
						? this.tmp.NODE_DEBUG === `true` || this.tmp.NODE_DEBUG === true
						: isConfig;
		},
		evalProcessItems: function () {
			Object.keys(this.tmp).forEach(function (item) {
				this.tmp[item] = this.evalProcessItem(this.tmp[item], item);
			}, this);
		},
		evalProcessItem: function (itemValue, item = null) {
			const regex = new RegExp(
				// eslint-disable-next-line max-len
				`(?<placeHolder>\\\$\{${this.config.APP_ENV_CONFIG_PROCESS_ENV_EVAL_PREFIX}${this.config.APP_ENV_CONFIG_ENV_EVAL_SEPARATOR}(?<varName>[^${this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX}\}]*)(${this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX}?(?<default>[^\}]*)?)?\})`
			);
			let doWhile = true;
			while (doWhile) {
				const matches = (item ? this.tmp[item] : itemValue).match(
					regex
				);

				if (!matches || !matches.groups || !matches.groups.varName) {
					doWhile = false;
					break;
				}

				let value = process.env[matches.groups.varName];
				let empty = false;
				if (typeof value === `undefined`) {
					value = this.formatUndefined(value, matches.groups.varName);
					empty = true;
				}
				if (value === null) {
					value = this.formatNull(value, matches.groups.varName);
					empty = true;
				}
				if (empty) {
					if (matches.groups.default) {
						if (this.tmp[matches.groups.default]) {
							value = this.tmp[matches.groups.default];
						} else if (process.env[matches.groups.default]) {
							value = process.env[matches.groups.default];
						} else if (this.config[matches.groups.default]) {
							value = this.config[matches.groups.default];
						} else {
							value = matches.groups.default;
						}
					}
				}

				if (itemValue !== matches.groups.placeHolder) {
					value = this.handleValue(value);
					if (typeof value !== `string`) {
						if (
							this.config.APP_ENV_CONFIG_EVAL_EMBED_NON_STRING ===
							`error`
						) {
							console.warn(value);
							throw new Error(
								`     ---- DotEnv : ${item} is trying to include a non string value`
							);
						} else {
							if (
								this.config
									.APP_ENV_CONFIG_EVAL_EMBED_NON_STRING ===
								`empty`
							) {
								value = ``;
							}
							if (
								this.config
									.APP_ENV_CONFIG_EVAL_EMBED_NON_STRING ===
								`null`
							) {
								value = null;
							}
							if (
								this.config
									.APP_ENV_CONFIG_EVAL_EMBED_NON_STRING ===
								`undefined`
							) {
								value = undefined;
							}
						}
					}
				}
				itemValue = itemValue.replace(
					matches.groups.placeHolder,
					value
				);
				if (item) {
					this.tmp[item] = itemValue;
				}
			}
			return itemValue;
		},
		evalAppItems: function () {
			Object.keys(this.tmp).forEach(function (item) {
				this.tmp[item] = this.evalAppItem(this.tmp[item], item);
			}, this);
		},
		evalAppItem: function (itemValue, item = null) {
			const regex = new RegExp(
				// eslint-disable-next-line max-len
				`(?<placeHolder>\\\$\{${this.config.APP_ENV_CONFIG_APP_ENV_EVAL_PREFIX}${this.config.APP_ENV_CONFIG_ENV_EVAL_SEPARATOR}(?<varName>[^${this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX}\}]*)(${this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX}?(?<default>[^\}]*)?)?\})`
			);
			let doWhile = true;
			while (doWhile) {
				const matches = (item ? this.tmp[item] : itemValue).match(
					regex
				);

				if (!matches || !matches.groups || !matches.groups.varName) {
					doWhile = false;
					break;
				}

				let value = this.tmp[matches.groups.varName];
				if (!value && this.config[matches.groups.varName]) {
					value = this.config[matches.groups.varName];
				}
				let empty = false;
				if (typeof value === `undefined`) {
					value = this.formatUndefined(value, matches.groups.varName);
					empty = true;
				}
				if (value === null) {
					value = this.formatNull(value, matches.groups.varName);
					empty = true;
				}
				if (empty) {
					if (matches.groups.default) {
						if (this.tmp[matches.groups.default]) {
							value = this.tmp[matches.groups.default];
						} else if (process.env[matches.groups.default]) {
							value = process.env[matches.groups.default];
						} else if (this.config[matches.groups.default]) {
							value = this.config[matches.groups.default];
						} else {
							value = matches.groups.default;
						}
					}
				}

				if (itemValue !== matches.groups.placeHolder) {
					value = this.handleValue(value);
					if (typeof value !== `string`) {
						if (
							this.config.APP_ENV_CONFIG_EVAL_EMBED_NON_STRING ===
							`error`
						) {
							console.warn(value);
							throw new Error(
								`     ---- DotEnv : ${item} is trying to include a non string value`
							);
						} else {
							if (
								this.config
									.APP_ENV_CONFIG_EVAL_EMBED_NON_STRING ===
								`empty`
							) {
								value = ``;
							}
							if (
								this.config
									.APP_ENV_CONFIG_EVAL_EMBED_NON_STRING ===
								`null`
							) {
								value = null;
							}
							if (
								this.config
									.APP_ENV_CONFIG_EVAL_EMBED_NON_STRING ===
								`undefined`
							) {
								value = undefined;
							}
						}
					}
				}
				itemValue = itemValue.replace(
					matches.groups.placeHolder,
					value
				);
				if (item) {
					this.tmp[item] = itemValue;
				}
			}
			return itemValue;
		},
		handleValues: function () {
			Object.keys(this.tmp).forEach(function (item) {
				this.tmp[item] = this.handleValue(this.tmp[item], item);
			}, this);
		},
		// eslint-disable-next-line no-unused-vars
		handleValue: function (value, item = null) {
			value = this.evalProcessItem(value);
			value = this.evalAppItem(value);
			if (value === this.config.APP_ENV_CONFIG_NULL) {
				value = null;
			}
			if (value === this.config.APP_ENV_CONFIG_UNDEFINED) {
				value = undefined;
			}
			if (value === ``) {
				if (this.config.APP_ENV_CONFIG_EMPTY_BEHAVIOUR === `empty`) {
					value = ``;
				}
				if (this.config.APP_ENV_CONFIG_EMPTY_BEHAVIOUR === `null`) {
					value = null;
				}
				if (
					this.config.APP_ENV_CONFIG_EMPTY_BEHAVIOUR === `undefined`
				) {
					value = undefined;
				}
			}
			if (value === `true`) {
				value = true;
			}
			if (value === `false`) {
				value = false;
			}

			let doWhile = true;
			while (doWhile) {
				const embededHandlers = this.getHandlers(value, `embedded`);

				if (
					!embededHandlers ||
					!embededHandlers.groups ||
					!embededHandlers.groups.placeHolder
				) {
					doWhile = false;
					break;
				}

				if (
					typeof this.tmp[embededHandlers.groups.value] !==
					`undefined`
				) {
					value = this.tmp[embededHandlers.groups.value];
				} else if (
					typeof this.config[embededHandlers.groups.value] !==
					`undefined`
				) {
					value = this.config[embededHandlers.groups.value];
				} else if (
					typeof process.env[embededHandlers.groups.value] !==
					`undefined`
				) {
					value = process.env[embededHandlers.groups.value];
				}

				value = this.evalProcessItem(value);
				value = this.evalAppItem(value);

				let environmentHandlers = embededHandlers.groups.environmentHandlers.split(
					this.config.APP_ENV_CONFIG_HANDLER_SEPARATOR
				);
				environmentHandlers = environmentHandlers.map(function (item) {
					const splitted = item.split(
						this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX
					);
					item = {
						handler: splitted[0],
						options: splitted.splice(1)
					};
					value = value.replace(
						embededHandlers.groups.placeHolder,
						this.handle(
							item,
							embededHandlers.groups.value,
							embededHandlers.groups.default
						)
					);
					return item;
				}, this);
			}
			const standaloneHandlers = this.getHandlers(value);
			if (
				standaloneHandlers &&
				standaloneHandlers.groups &&
				standaloneHandlers.groups.placeHolder
			) {
				if (
					typeof this.tmp[standaloneHandlers.groups.value] !==
					`undefined`
				) {
					value = this.tmp[standaloneHandlers.groups.value];
				} else if (
					typeof this.config[standaloneHandlers.groups.value] !==
					`undefined`
				) {
					value = this.config[standaloneHandlers.groups.value];
				} else if (
					typeof process.env[standaloneHandlers.groups.value] !==
					`undefined`
				) {
					value = process.env[standaloneHandlers.groups.value];
				}

				value = this.evalProcessItem(value);
				value = this.evalAppItem(value);

				let environmentHandlers = standaloneHandlers.groups.environmentHandlers.split(
					this.config.APP_ENV_CONFIG_HANDLER_SEPARATOR
				);
				environmentHandlers = environmentHandlers.map(function (item) {
					const splitted = item.split(
						this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX
					);
					item = {
						handler: splitted[0],
						options: splitted.splice(1)
					};
					value = this.handle(
						item,
						standaloneHandlers.groups.value,
						standaloneHandlers.groups.default
					);
					return item;
				}, this);
			}
			return value;
		},
		handle: function (item, value, defaultValue) {
			const splittedHandler = item.handler
				.split(this.config.APP_ENV_CONFIG_APP_ENV_HANDLER_PREFIX)[1]
				.split(`.`);
			return this.environment[splittedHandler[0]][splittedHandler[1]](
				value,
				defaultValue,
				item.options
			);
		},
		environment: {
			processor: {
				// eslint-disable-next-line no-unused-vars
				none: function (value, defaultValue, options) {
					return value;
				},
				json: function (value, defaultValue, options) {
					try {
						return JSON.parse(value);
					} catch (exception) {
						options.forEach(function (item) {
							console.error(
								`   -- DotEnv : Invalid json '${value}'`
							);
							if (item === `fail` || item === `fail=true`) {
								throw new Error(
									`   -- DotEnv : Invalid json '${value}'`
								);
							}
						});
					}
					if (defaultValue !== undefined && defaultValue !== null) {
						return JSON.parse(defaultValue);
					}
				}
			},
			validator: {
				// eslint-disable-next-line no-unused-vars
				none: function (value, defaultValue, options) {
					return value;
				}
			},
			formatter: {
				// eslint-disable-next-line no-unused-vars
				none: function (value, defaultValue, options) {
					return value;
				}
			}
		},
		getHandlers: function (value, position = `standalone`) {
			const regex = new RegExp(
				// eslint-disable-next-line max-len
				`${
					position === `embedded`
						? `(?<placeHolder>\\$\{`
						: `^(?<placeHolder>`
				}(?<environmentHandlers>${
					this.config.APP_ENV_CONFIG_APP_ENV_HANDLER_PREFIX
				}[^${this.config.APP_ENV_CONFIG_ENV_EVAL_SEPARATOR}]*)${
					this.config.APP_ENV_CONFIG_ENV_EVAL_SEPARATOR
				}(?<value>${
					position === `embedded`
						? `[^\}${this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX}]*`
						: `[^${this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX}]*`
				})${
					position === `embedded`
						? `(${this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX}?(?<default>[^\}]*)?)?\})`
						: `(${this.config.APP_ENV_CONFIG_EVAL_CONFIG_PREFIX}?(?<default>(.*)*)?)?)$`
				}`,
				`ig`
			);
			return regex.exec(value);
		},
		formatUndefined: function (value, varName) {
			if (this.doDebug()) {
				console.warn(
					`     ---- DotEnv : ${varName} is not defined in process.env !!`
				);
			}
			if (this.config.APP_ENV_CONFIG_UNDEFINED_BEHAVIOUR === `empty`) {
				return ``;
			}
			if (this.config.APP_ENV_CONFIG_UNDEFINED_BEHAVIOUR === `null`) {
				return null;
			}
			if (
				this.config.APP_ENV_CONFIG_UNDEFINED_BEHAVIOUR === `undefined`
			) {
				return undefined;
			}

			return value;
		},
		webpackify: function (data) {
			const APP_ENV = {};
			Object.keys(data).forEach(function (item) {
				if (typeof data[item] === `boolean`) {
					APP_ENV[item] = data[item];
				} else if (typeof data[item] === `string`) {
					APP_ENV[item] = `\`` + data[item] + `\``;
				} else if (typeof data[item] === `undefined`) {
					APP_ENV[item] = data[item];
				} else if (data[item] === null) {
					APP_ENV[item] = data[item];
				} else {
					APP_ENV[item] = JSON.stringify(data[item]);
				}
			});

			return APP_ENV;
		},
		formatNull: function (value, varName) {
			if (this.doDebug()) {
				console.warn(
					`     ---- DotEnv : ${varName} is equal to null in process.env !!`
				);
			}
			if (this.config.APP_ENV_CONFIG_NULL_BEHAVIOUR === `empty`) {
				return ``;
			}
			if (this.config.APP_ENV_CONFIG_NULL_BEHAVIOUR === `null`) {
				return null;
			}
			if (this.config.APP_ENV_CONFIG_NULL_BEHAVIOUR === `undefined`) {
				return undefined;
			}

			return value;
		}
	};
};
exports.default = dotEnvLoaderRun;

if (process.env.APP_ENV_RUN === `true`) {
	new dotEnvLoaderRun(`process`).run();
}
