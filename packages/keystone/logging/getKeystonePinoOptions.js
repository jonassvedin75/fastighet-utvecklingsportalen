import { getLogger } from './getLogger.js'
import { getReqLoggerContext } from './getReqLoggerContext.js'

const logger = getLogger('http')

function getKeystonePinoOptions () {
    // NOTE(pahaz): https://github.com/pinojs/pino-http#pinohttpopts-stream
    return {
        logger,
        autoLogging: false,
        customProps: (req, res) => {
            return getReqLoggerContext(req)
        },
    }
}

export {
    getKeystonePinoOptions,
}
