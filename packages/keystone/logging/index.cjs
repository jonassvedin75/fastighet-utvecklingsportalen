'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var falsey = require('falsey');
var lodash = require('lodash');
var pino = require('pino');
var serializers = require('pino-std-serializers');
var apolloErrors = require('apollo-errors');
var apolloServerErrors = require('apollo-server-errors');
var ensureError = require('ensure-error');
var graphql = require('graphql');
var conf = require('@open-condo/config');
var cuid = require('cuid');
var serializeError = require('serialize-error');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var falsey__default = /*#__PURE__*/_interopDefaultLegacy(falsey);
var lodash__default = /*#__PURE__*/_interopDefaultLegacy(lodash);
var pino__default = /*#__PURE__*/_interopDefaultLegacy(pino);
var serializers__default = /*#__PURE__*/_interopDefaultLegacy(serializers);
var ensureError__default = /*#__PURE__*/_interopDefaultLegacy(ensureError);
var conf__default = /*#__PURE__*/_interopDefaultLegacy(conf);
var cuid__default = /*#__PURE__*/_interopDefaultLegacy(cuid);

const { get: get$4, set: set$1 } = lodash__default["default"];

const HIDE_GRAPHQL_VARIABLES_KEYS = ['secret', 'password', 'data.password', 'data.secret'];

function normalizeQuery (string) {
    if (!string) return ''
    // NOTE(pahaz): https://spec.graphql.org/June2018/#sec-Insignificant-Commas
    //   Similar to white space and line terminators, commas (,) are used to improve the legibility of source text
    return string.replace(/[\s,]+/g, ' ').trim()
}

function normalizeVariables (object) {
    if (!object) return undefined
    const data = JSON.parse(JSON.stringify(object));
    for (const key of HIDE_GRAPHQL_VARIABLES_KEYS) {
        if (get$4(data, key)) {
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

const { pick, pickBy, identity, toArray, _, toString: toString$1, get: get$3, set, isArray } = lodash__default["default"];

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
    const m1 = get$3(error, 'message');
    if (m1) messages.push(m1);
    const m2 = get$3(error, 'originalError.message');
    if (m2) messages.push(m2);

    if (isArray(get$3(error, 'errors'))) {
        for (const x of error.errors) {
            const m = get$3(x, 'message');
            if (m) messages.push(m);
        }
    }
    if (isArray(get$3(error, 'originalError.errors'))) {
        for (const x of error.originalError.errors) {
            const m = get$3(x, 'message');
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
    const innerErrors = get$3(error, 'errors', []);
    return innerErrors.find(err => get$3(err, 'name') === 'GQLError')
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
        const extensions = get$3(error, 'extensions');
        if (extensions) {
            result.extensions = _(extensions).toJSON();
            // we already have more details inside originalError object and don't need this
            if (result.extensions.exception) delete result.extensions.exception;
        }
    }

    let originalError = get$3(error, 'originalError');
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
            originalError = get$3(formattedInnerError, 'originalError', formattedInnerError);
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

const { get: get$2 } = lodash__default["default"];

/**
 * Extracts useful data stored in request obtained by preprocessors and other plugins such as:
 * 1. req.ip - user ip address
 * 2. req.sessionID - id of current session
 * 3. req.id - unique request id
 * 4. req.user.id - id of user in case of authorized requests
 * 5. req.headers.cookie.userId - client-side fingerprint
 * 6. req.complexity - request complexity obtained by rate-limiting plugin
 * @param req - express request object
 * @returns {{
 *  complexity?: { total: number, mutations: number, queries: number, details: { queries: Record<string, number>, mutations: Record<string, number> } },
 *  ip?: string,
 *  fingerprint?: string,
 *  sessionId?: string,
 *  user?: {isSupport: boolean, id: string, isAdmin: boolean, type: string},
 *  reqId?: string
 *  }}
 */
function getReqLoggerContext (req) {
    const reqId = get$2(req, 'id');
    const sessionId = get$2(req, 'sessionID');
    const userId = get$2(req, 'user.id');
    const ip = get$2(req, 'ip');
    const fingerprint = get$2(req, 'headers.cookie.userId');
    const complexity = get$2(req, 'complexity');
    let user;
    if (userId) {
        user = {
            id: userId,
            type: get$2(req, 'user.type'),
            isAdmin: get$2(req, 'user.isAdmin'),
            isSupport: get$2(req, 'user.isSupport'),
        };
    }

    return { reqId, sessionId, user, ip, fingerprint, complexity }
}

const logger$1 = getLogger('http');

function getKeystonePinoOptions () {
    // NOTE(pahaz): https://github.com/pinojs/pino-http#pinohttpopts-stream
    return {
        logger: logger$1,
        autoLogging: false,
        customProps: (req, res) => {
            return getReqLoggerContext(req)
        },
    }
}

const graphqlLogger = getLogger('graphql');
const graphqlErrorLogger = getLogger('graphqlerror');
const { get: get$1 } = lodash__default["default"];

function getGraphQLReqLoggerContext (requestContext) {
    const req = get$1(requestContext, 'context.req');
    const reqContext = getReqLoggerContext(req);  // reqId, sessionId, user, ip, fingerprint, complexity

    const authedItemId = get$1(requestContext, 'context.authedItem.id');
    const operationId = get$1(requestContext, 'operationId');
    const operationName = get$1(requestContext, 'operationName');
    const queryHash = get$1(requestContext, 'queryHash');

    const graphQLOperations = get$1(requestContext, 'document.definitions', []).map(renderExecutableDefinitionNode).filter(Boolean);
    const query = normalizeQuery(get$1(requestContext, 'request.query'));
    const variables = normalizeVariables(get$1(requestContext, 'request.variables'));

    return { graphQLOperations, gql: { query, variables }, ...reqContext, authedItemId, operationId, operationName, queryHash, req }
}

/**
 * @param node {require('graphql/language/ast').ExecutableDefinitionNode}
 */
function renderExecutableDefinitionNode (node) {
    if (!node) return ''
    if (node.kind === 'OperationDefinition') {
        return `${node.operation} ${node.name ? `${node.name.value}` : ''}`
    }
    return ''
}

/**
 * Get current time in nanoseconds and return diff between
 * @param time {bigint} start time of the operation
 * @returns {number} Operation elapsed time in milliseconds
 */
function timeFrom (time) {
    const diff = process.hrtime.bigint() - time;

    return +(Number(diff) / 1000000).toFixed(4)
}

/**
 * @type {import('apollo-server-plugin-base').ApolloServerPlugin}
 */
class GraphQLLoggerPlugin {
    requestDidStart (requestContext) {
        let timeUntilExecution = null;
        const requestStartTime = process.hrtime.bigint();
        graphqlLogger.info({
            state: 'requestDidStart',
            ...getGraphQLReqLoggerContext(requestContext),
        });

        return {
            async responseForOperation (requestContext) {
                const operationId = get$1(requestContext, 'operationId') || cuid__default["default"]();
                // NOTE(pahaz): log correlation id for cases where not reqId
                requestContext.operationId = operationId;
            },
            async executionDidStart () {
                timeUntilExecution = timeFrom(requestStartTime);
            },
            async willSendResponse (requestContext) {
                graphqlLogger.info({
                    ...getGraphQLReqLoggerContext(requestContext),
                    responseTime: timeFrom(requestStartTime),
                    timeUntilExecution,
                    state: 'willSendResponse',
                });
            },

            /**
             * @param {import('apollo-server-types').GraphQLRequestContext} requestContext
             * @returns {Promise<void>}
             */
            async didEncounterErrors (requestContext) {
                const logData = getGraphQLReqLoggerContext(requestContext);
                const errors = get$1(requestContext, 'errors', []);

                try {
                    for (const error of errors) {
                        error.uid = get$1(error, 'uid') || get$1(error, 'originalError.uid') || cuid__default["default"]();
                        graphqlErrorLogger.info({ apolloFormatError: safeFormatError(error), ...logData });
                    }
                } catch (formatErrorError) {
                    // NOTE(pahaz): Something went wrong with formatting above, so we log the errors
                    graphqlErrorLogger.error({ formatErrorError: serializeError.serializeError(ensureError__default["default"](formatErrorError)), ...logData });
                    graphqlErrorLogger.error({ serializedErrors: errors.map(error => serializeError.serializeError(ensureError__default["default"](error))), ...logData });
                }
            },
        }
    }
}

const { get } = lodash__default["default"];
const logger = getLogger('expressErrorHandler');

const expressErrorHandler = (error, req, res, next) => {
    if (!error) next();
    const errId = error.uid || cuid__default["default"]();
    const reqId = get(req, ['id'], get(req, ['headers', 'X-Request-Id']));
    logger.error({ msg: 'expressErrorHandler', error, reqId, errId });
    return res.status(500).send(`Error! errId=${errId}; reqId=${reqId}`)
};

exports.GraphQLLoggerPlugin = GraphQLLoggerPlugin;
exports.expressErrorHandler = expressErrorHandler;
exports.getKeystonePinoOptions = getKeystonePinoOptions;
exports.getLogger = getLogger;
