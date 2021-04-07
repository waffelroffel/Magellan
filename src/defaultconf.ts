import { LoggerConfig } from "./interfaces"

const DEFAULT_LOGGER: LoggerConfig = {
	init: true,
	ready: true,
	update: true,
	send: true,
	local: true,
	remote: true,
	error: true,
	online: true,
	vanish: true,
}

export function checkLoggerConfig(conf?: LoggerConfig): LoggerConfig {
	return {
		init: conf?.init ?? DEFAULT_LOGGER.init,
		ready: conf?.ready ?? DEFAULT_LOGGER.ready,
		update: conf?.update ?? DEFAULT_LOGGER.update,
		send: conf?.send ?? DEFAULT_LOGGER.send,
		local: conf?.local ?? DEFAULT_LOGGER.local,
		remote: conf?.remote ?? DEFAULT_LOGGER.remote,
		error: conf?.error ?? DEFAULT_LOGGER.error,
		online: conf?.online ?? DEFAULT_LOGGER.online,
		vanish: conf?.vanish ?? DEFAULT_LOGGER.vanish,
	}
}
