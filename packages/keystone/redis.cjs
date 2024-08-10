'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var IORedis = require('ioredis');
var conf = require('@open-condo/config');
var falsey = require('falsey');
var lodash = require('lodash');
var pino = require('pino');
var serializers = require('pino-std-serializers');
var apolloErrors = require('apollo-errors');
var apolloServerErrors = require('apollo-server-errors');
var ensureError = require('ensure-error');
var graphql = require('graphql');
require('cuid');
require('serialize-error');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var IORedis__default = /*#__PURE__*/_interopDefaultLegacy(IORedis);
var conf__default = /*#__PURE__*/_interopDefaultLegacy(conf);
var falsey__default = /*#__PURE__*/_interopDefaultLegacy(falsey);
var lodash__default = /*#__PURE__*/_interopDefaultLegacy(lodash);
var pino__default = /*#__PURE__*/_interopDefaultLegacy(pino);
var serializers__default = /*#__PURE__*/_interopDefaultLegacy(serializers);
var ensureError__default = /*#__PURE__*/_interopDefaultLegacy(ensureError);

const { get: get$1, set: set$1 } = lodash__default["default"];

const HIDE_GRAPHQL_VARIABLES_KEYS = ['secret', 'password', 'data.password', 'data.secret'];

function normalizeVariables (object) {
    if (!object) return undefined
    const data = JSON.parse(JSON.stringify(object));
    for (const key of HIDE_GRAPHQL_VARIABLES_KEYS) {
        if (get$1(data, key)) {
            set$1(data, key, '***');
        }
    }
    return JSON.stringify(data)
}

/*
    What you need to know to understand what is going on here?

    Keystone.js is not so good to work with GraphQL errors.
    It use apollo-errors npm package for all their error.
    But the apollo-errors is not compatible with the common GraphQL spec.
    We need a way to fix it!

    1) you should read at least an example from GraphQL specification: http://spec.graphql.org/draft/#sec-Errors and https://github.com/graphql/graphql-js/blob/main/src/error/GraphQLError.ts
    2) you need to read the code from apollo-errors npm package: https://github.com/thebigredgeek/apollo-errors/blob/master/src/index.ts
    3) you need to look at: https://www.apollographql.com/docs/apollo-server/data/errors/ and https://github.com/apollographql/apollo-server/blob/main/packages/apollo-server-errors/src/index.ts
    4) you need to look at KeystoneJs source: https://github.com/keystonejs/keystone-5/blob/e12273f6e1ce1eaa1e7013f1feb1d158518c80c9/packages/keystone/lib/Keystone/format-error.js,
        https://github.com/keystonejs/keystone-5/blob/e12273f6e1ce1eaa1e7013f1feb1d158518c80c9/packages/keystone/lib/ListTypes/graphqlErrors.js, usage of `throwAccessDenied`, `ValidationFailureError` and `AccessDeniedError`.
        You should also check another KeystoneJs errors: LimitsExceededError and ParameterError

    We need to convert a KeystoneJS errors to friendly GraphQL format by using Apollo `formatError` function.

    Most important runtime client side errors:
     - UserInputError -- invalid value for a field argument (400)
     - AuthenticationError -- failed to authenticate (401)
     - ForbiddenError -- unauthorized to access (403)

 */

const { pick, pickBy, identity, toArray, _, toString: toString$1, get, set, isArray } = lodash__default["default"];

conf__default["default"].NODE_ENV === 'production';
const COMMON_ERROR_CASES = {};

/**
 * Takes object as argument and returns names of its class, parent's class and so on
 * @param object
 * @returns {string[]}
 * @private
 */
function _getClassList (object) {
    if (object && object.constructor && object.constructor instanceof Function) {
        let baseClass = object.constructor;
        const result = [object.constructor.name];

        while (baseClass) {
            const newBaseClass = Object.getPrototypeOf(baseClass);
            if (newBaseClass && newBaseClass !== Object && newBaseClass.name) {
                baseClass = newBaseClass;
                result.push(newBaseClass.name);
            } else {
                break
            }
        }

        return result
    }

    return []
}

function _getAllErrorMessages (error) {
    const messages = [];
    const m1 = get(error, 'message');
    if (m1) messages.push(m1);
    const m2 = get(error, 'originalError.message');
    if (m2) messages.push(m2);

    if (isArray(get(error, 'errors'))) {
        for (const x of error.errors) {
            const m = get(x, 'message');
            if (m) messages.push(m);
        }
    }
    if (isArray(get(error, 'originalError.errors'))) {
        for (const x of error.originalError.errors) {
            const m = get(x, 'message');
            if (m) messages.push(m);
        }
    }
    return messages
}

function _patchKnownErrorCases (error, result) {
    const message = _getAllErrorMessages(error).join(' -- ');
    for (const key in COMMON_ERROR_CASES) {
        if (message.includes(key)) {
            const patch = COMMON_ERROR_CASES[key];
            for (const patchKey in patch) {
                set(result, patchKey, patch[patchKey]);
            }
        }
    }
}

function _extractInnerGQLError (error) {
    const innerErrors = get(error, 'errors', []);
    return innerErrors.find(err => get(err, 'name') === 'GQLError')
}

/**
 * Use it if you need to safely prepare error for logging or ApolloServer result
 * @param {Error} error -- any error
 * @param {Boolean} hideInternals -- do you need to hide some internal error fields
 * @param {Boolean} applyPatches -- do you need to apply a common error message patches
 * @returns {import('graphql').GraphQLFormattedError}
 */
const safeFormatError = (error, hideInternals = false, applyPatches = true) => {
    const result = {};

    // error keyst: message, name, stack
    const pickKeys1 = (hideInternals) ? ['message', 'name'] : ['message', 'name', 'stack'];
    Object.assign(result, pick(ensureError__default["default"](error), pickKeys1));

    // keystoneError keys: time_thrown, message, data, internalData, locations, path
    if (apolloErrors.isInstance(error)) {
        const pickKeys2 = (hideInternals) ? ['time_thrown', 'data', 'locations', 'path'] : ['time_thrown', 'data', 'locations', 'path', 'internalData'];
        Object.assign(result, pick(error, pickKeys2));
    }

    // apolloError keys: path, locations, source, positions, nodes, extensions, originalError
    //  + 'locations', 'positions', 'source', 'nodes' -- used for printError() in human readable format!
    //  + 'path' -- GraphQL query path with aliases
    //  + 'extensions' -- some extra context
    //  + 'originalError' -- original Error instance
    // NOTE: Comparing by instances is not safe even if only minor version of package change!
    const errorClassNames = _getClassList(error);
    if (errorClassNames.includes('ApolloError') || errorClassNames.includes('GraphQLError')) {
        const pickKeys3 = ['path', 'locations'];
        Object.assign(result, pickBy(pick(error, pickKeys3), identity));
        const developerErrorMessage = graphql.printError(error);
        if (developerErrorMessage !== result.message) {
            // we want to show a developer friendly message
            result.developerMessage = graphql.printError(error);
        }
        const extensions = get(error, 'extensions');
        if (extensions) {
            result.extensions = _(extensions).toJSON();
            // we already have more details inside originalError object and don't need this
            if (result.extensions.exception) delete result.extensions.exception;
        }
    }

    let originalError = get(error, 'originalError');
    const originalErrorClassNames = originalError ?  _getClassList(originalError) : [];
    // NOTE 1: If GQLError is thrown at ASYNC field hook, it will be wrapped like following:
    // GraphQLError + Wrapper: {
    //      originalError (Error): {
    //          errors: [
    //              GQLError
    //          ]
    //      }
    // }
    // So we need to unwrap this specific scenario
    // NOTE 2: addFieldValidationError will do the same wrap, but its originalError will have a `name` prop,
    // and it also will have additional classNames on top or Error
    // We can use this info, but I've decided to be more straightforward:
    // Obtain inner GQLError. If not found - use default behaviour
    let isInnerGQLErrorFound = false;
    if (errorClassNames.includes('GraphQLError') && errorClassNames.includes('Wrapper') && originalErrorClassNames.includes('Error')) {
        const innerError = _extractInnerGQLError(originalError);
        if (innerError) {
            isInnerGQLErrorFound = true;
            const formattedInnerError = safeFormatError(innerError, hideInternals, applyPatches);
            Object.assign(result, formattedInnerError);
            // Note: Inner error extraction, if no originals -> originalError = self
            originalError = get(formattedInnerError, 'originalError', formattedInnerError);
            result.originalError = originalError === formattedInnerError ? formattedInnerError : safeFormatError(originalError, hideInternals, false);
        }
    }

    if (!isInnerGQLErrorFound && originalError) {
        result.originalError = safeFormatError(originalError, hideInternals, false);
    }



    // KeystoneJS hotfixes! Taken from KeystoneJS sources. Probably useless in a future but we already have a tests for that!
    if (originalError) {
        if (originalError.path && !result.path) {
            result.path = originalError.path;
        }
        if (apolloErrors.isInstance(error.originalError)) {
            result.name = originalError.name;
            result.data = originalError.data;
        } else if (originalError instanceof apolloServerErrors.ApolloError) {
            result.name = originalError.name;
        }
    }

    // save error uid
    if (error && error.uid) {
        result.uid = toString$1(error.uid);
    }

    // nested errors support
    if (error && error.errors) {
        const nestedErrors = toArray(error.errors).map((err) => safeFormatError(err, hideInternals, false));
        if (nestedErrors.length) result.errors = nestedErrors;
    }

    if (applyPatches) _patchKnownErrorCases(error, result);

    return result
};

// NOTE: same as keystone logger

const { toString } = lodash__default["default"];

function getLogger (name) {
    return pino__default["default"]({
        name, enabled: falsey__default["default"](process.env.DISABLE_LOGGING),
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
            'req': serializers__default["default"].req,
            'res': serializers__default["default"].req,
            'err': serializers__default["default"].err,
        },
    })
}

getLogger('http');

getLogger('graphql');
getLogger('graphqlerror');

const REDIS_CLIENTS = {};
const logger = getLogger('redis');

/**
 * If you really need to use Redis then you should use this function!
 *
 * @param {string} name -- name of redis client or the task purpose (we can use a different REDIS_URL for each name)
 * @param {string} purpose -- regular / subscriber redis client mode (read details: https://github.com/luin/ioredis#pubsub); you can also use it if you need a two redis client with different settings; For example, the Bull is required three different redis clients
 * @param {string} opts -- RedisConfig to customize some client options; But please don't use it!
 * @return {import('ioredis')}
 */
function getRedisClient (name = 'default', purpose = 'regular', opts = {}) {
    const clientKey = name + ':' + purpose;

    logger.info({ msg: 'getRedisClient', clientKey, opts });

    if (!name) throw new Error('getRedisClient() without client name')
    if (typeof name !== 'string') throw new Error('getRedisClient() name is not a string')
    if (typeof purpose !== 'string') throw new Error('getRedisClient() purpose is not a string')
    if (!REDIS_CLIENTS[clientKey]) {
        const redisEnvName = `${name.toUpperCase()}_REDIS_URL`;
        const redisUrl = conf__default["default"][redisEnvName] || conf__default["default"].REDIS_URL;
        if (!redisUrl) throw new Error(`No REDIS_URL env! You need to set ${redisEnvName} / REDIS_URL env`)
        // BUILD STEP! OR SOME CASE WITH REDIS_URL=undefined
        if (redisUrl === 'undefined') return undefined
        const client = new IORedis__default["default"](redisUrl, { connectionName: clientKey, ...opts });
        client.on('connect', () => logger.info({ msg: 'connect', clientKey }));
        client.on('close', () => logger.info({ msg: 'close', clientKey }));
        client.on('reconnecting', (waitTime) => logger.info({ msg: 'reconnecting', clientKey, waitTime }));
        client.on('error', (error) => logger.error({ msg: 'error', clientKey, error }));
        client.on('end', () => logger.error({ msg: 'end', clientKey }));
        REDIS_CLIENTS[clientKey] = client;
    }

    return REDIS_CLIENTS[clientKey]
}

exports.getRedisClient = getRedisClient;
