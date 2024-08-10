// NOTE: same as keystone logger
import falsey from 'falsey'
import lodash from 'lodash'
import pino from 'pino'
import serializers from 'pino-std-serializers'

import { normalizeVariables } from './normalize.js'

import { safeFormatError } from '../apolloErrorFormatter.js'

const { toString } = lodash

function getLogger (name) {
    return pino({
        name, enabled: falsey(process.env.DISABLE_LOGGING),
        serializers: {
            'data': normalizeVariables,
            'args': normalizeVariables,
            'opts': normalizeVariables,
            'result': normalizeVariables,
            'statusCode': toString,
            'status': toString,
            'path': toString,
            'method': toString,
            'ip': toString,
            'reqId': toString,
            'errId': toString,
            'taskId': toString,
            'message': toString,
            'error': safeFormatError,
            'req': serializers.req,
            'res': serializers.req,
            'err': serializers.err,
        },
    })
}

export {
    getLogger,
}
