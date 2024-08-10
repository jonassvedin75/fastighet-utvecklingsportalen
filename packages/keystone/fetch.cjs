'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var nodeFetch = require('node-fetch');
var node_async_hooks = require('node:async_hooks');
var uuid = require('uuid');
var falsey = require('falsey');
var lodash = require('lodash');
var pino = require('pino');
var serializers = require('pino-std-serializers');
var apolloErrors = require('apollo-errors');
var apolloServerErrors = require('apollo-server-errors');
var ensureError = require('ensure-error');
var graphql = require('graphql');
var conf = require('@open-condo/config');
require('cuid');
require('serialize-error');
var os = require('os');
var StatsD = require('hot-shots');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var nodeFetch__default = /*#__PURE__*/_interopDefaultLegacy(nodeFetch);
var falsey__default = /*#__PURE__*/_interopDefaultLegacy(falsey);
var lodash__default = /*#__PURE__*/_interopDefaultLegacy(lodash);
var pino__default = /*#__PURE__*/_interopDefaultLegacy(pino);
var serializers__default = /*#__PURE__*/_interopDefaultLegacy(serializers);
var ensureError__default = /*#__PURE__*/_interopDefaultLegacy(ensureError);
var conf__default = /*#__PURE__*/_interopDefaultLegacy(conf);
var os__default = /*#__PURE__*/_interopDefaultLegacy(os);
var StatsD__default = /*#__PURE__*/_interopDefaultLegacy(StatsD);

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

/**
 * This module implements features needed for global execution context tracking.
 *
 * If you want to solve your task using Async Local Storage, this module should be extended.
 */


const ASYNC_LOCAL_STORAGES = {};
const logger$1 = getLogger('asyncLocalStorage');

_internalGetExecutionContextAsyncLocalStorage().enterWith( { execId: uuid.v4(), execProcessArgv: process.argv });

/**
 * Return current execution context
 *
 * @returns {object}
 */
function getExecutionContext () {
    return _internalGetExecutionContextAsyncLocalStorage().getStore()
}

/**
 * This function is intended to be used in internal modules only, like prepareKeystone.js
 * Use this function if you need asyncLocalStorage dedicated to executionContext instance
 *
 * @returns {import('node:async_hooks').AsyncLocalStorage}
 * @deprecated for any external usage!
 */
function _internalGetExecutionContextAsyncLocalStorage () {
    return _internalGetAsyncLocalStorage('executionCtx')
}

/**
 * This function is intended to be used in internal modules only, like prepareKeystone.js
 * Use this function if you need a specific asyncLocalStorage instance in project
 *
 * @param {string} name -- name of storage
 * @returns {import('node:async_hooks').AsyncLocalStorage}
 * @deprecated for any external usage!
 */
function _internalGetAsyncLocalStorage (name = 'default') {
    if (!name) throw new Error('getAsyncLocalStorage() without client name')
    if (typeof name !== 'string') throw new Error('getAsyncLocalStorage() name is not a string')
    if (!ASYNC_LOCAL_STORAGES[name]) {
        logger$1.info({ msg: 'getAsyncLocalStorage new storage to be created:', name });
        ASYNC_LOCAL_STORAGES[name] = new node_async_hooks.AsyncLocalStorage();
    }

    return ASYNC_LOCAL_STORAGES[name]
}

/**
 * This module allows user to send custom metrics to any system, that supports statsd (Datadog, Grafana, Etc)
 *
 * To use this module you need to add two environment variables:
 * STATSD_PORT: Port used by statsd daemon in your system
 * STATSD_METRIC_PREFIX: Metric prefix
 *
 * After these environment variables are set, you can use supplied functions.
 * To learn more about differences between gauge, histogram and count type metrics, please refer to the datadog documentation
 * https://docs.datadoghq.com/metrics/custom_metrics/dogstatsd_metrics_submission/
 */

getLogger('metrics');

const STATSD_METRIC_PREFIX = conf__default["default"]['STATSD_METRIC_PREFIX'] || 'condo.';
const STATSD_PORT = conf__default["default"]['STATSD_PORT'] || 8125;
const HOSTNAME = os__default["default"].hostname();

/**
 * Name should contain only alphanumeric characters (A-z, 0-9) and dot delimiter
 * Best practice to use this template:
 *
 * <domain>.<file>.<metric-name>
 *
 * Examples:
 * - billing.registerBillingReceipts.totalCreatedReceipts
 * - billing.allResidentBillingReceipts.executionTime
 * - adapterCache.hitrate
 * - adapterCache.size
 *
 * @param name
 */
const validateName = (name) => {
    if (!nameChecker.test(name)) { throw new Error(`You metric ${name} is badly named! PLease check metric.js module for explanations`) }
};

const nameChecker = new RegExp('^[a-zA-Z0-9]+(\\.[a-zA-Z0-9]+)*\\.?$');
if (!nameChecker.test(STATSD_METRIC_PREFIX)) { throw new Error(`You prefix ${STATSD_METRIC_PREFIX} is badly named! PLease check metric.js module for explanations`) }

const StatsDClient = new StatsD__default["default"]({
    port: STATSD_PORT,
    prefix: STATSD_METRIC_PREFIX,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    errorHandler: () => {},
    globalTags: { hostname: HOSTNAME, command: process.argv[1] },
});

const gauge = ({ name, value, tags }) => {
    validateName(name);
    StatsDClient.gauge(name, value, tags);
};

const increment = ({ name, value, tags }) => {
    validateName(name);
    StatsDClient.increment(name, value, tags);
};

const logger = getLogger('fetch');

const FETCH_COUNT_METRIC_NAME = 'fetch.count';
const FETCH_TIME_METRIC_NAME = 'fetch.time';

async function fetchWithLogger (url, options, extraAttrs) {

    const urlObject = new URL(url);
    const hostname = urlObject.hostname;
    const path = urlObject.pathname;

    const executionContext = getExecutionContext();
    const parentReqId = executionContext.reqId;
    const parentTaskId = executionContext.taskId;

    const { setTracingHeaders } = extraAttrs;

    if (setTracingHeaders) {
        // We want to set special headers to track requests across the microservices:
        // Client --reqId-> Condo --reqId-> AddressService
        //                    ^                   ^
        //                    |                   |
        //               log reqId            log reqId
        //
        if (!options.headers) {
            options.headers = {};
        }

        options.headers['X-Request-Id'] = parentReqId || parentTaskId || null;
        options.headers['reqId'] = parentReqId ? parentReqId : null;
        options.headers['taskId'] = parentTaskId ? parentTaskId : null;
    }

    const startTime = Date.now();

    try {
        const response = await nodeFetch__default["default"](url, options);

        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        logger.info({ msg: 'fetch: request successful', url, reqId: parentReqId, taskId: parentTaskId, path, hostname, status: response.status, elapsedTime });

        increment({ name: FETCH_COUNT_METRIC_NAME, value: 1, tags: { status: response.status, hostname, path } });
        gauge({ name: FETCH_TIME_METRIC_NAME, value: elapsedTime, tags: { status: response.status, hostname, path } });

        return response
    } catch (error) {
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        logger.error({ msg: 'fetch: failed with error', url, path, hostname, reqId: parentReqId, taskId: parentTaskId, error, elapsedTime });

        increment({ name: FETCH_COUNT_METRIC_NAME, value: 1, tags: { status: 'failed', hostname, path } });
        gauge({ name: FETCH_TIME_METRIC_NAME, value: elapsedTime, tags: { status: 'failed', hostname, path } });

        throw error
    }
}

const sleep = (timeout) => new Promise(resolve => setTimeout(resolve, timeout));

/**
 * Asynchronous function to fetch data from a URL with customizable options and retries.
 * Default behavior is similar to fetchWithLogger only limits the time for request to be completed in 1 minute
 * @param {string} url - The URL to fetch data from.
 * @param {Object} [options] - Optional parameters for configuring the fetch request.
 * @param {number} [options.maxRetries=0] - Maximum number of retries before giving up.
 * @param {number} [options.abortRequestTimeout=60000] - Time in milliseconds to wait before aborting a request.
 * @param {number} [options.timeoutBetweenRequests=0] - Time in milliseconds to wait between retry attempts. Will be multiplied by the attempt number
 * @param {boolean} [options.skipTracingHeaders] - Sets X-Request-ID, reqId, taskId headers based on local execution context
 * @returns {Promise<Response>} - A Promise resolving to the Response object representing the fetched data.
 * @throws {Error} - If the maximum number of retries is reached or if an error occurs during the fetch operation.
 */
const fetchWithRetriesAndLogger = async (url, options = {}) => {
    const {
        maxRetries = 0,
        abortRequestTimeout = 60 * 1000,
        timeoutBetweenRequests = 0,
        setTracingHeaders = false,
        ...fetchOptions
    } = options;
    let retries = 0;
    let lastError;
    let lastResponse;
    // At least one request on maxRetries = 0
    do {
        try {
            const controller = new AbortController();
            const signal = controller.signal;
            const response = await Promise.race([
                fetchWithLogger(url, { ... fetchOptions, signal }, { setTracingHeaders }),
                new Promise((_, reject) =>
                    setTimeout(() => {
                        controller.abort();
                        reject(new Error('Abort request by timeout'));
                    }, abortRequestTimeout)
                ),
            ]);
            if (response && response.ok) {
                return response
            }
            lastResponse = response;
        } catch (error) {
            lastError = error;
        }
        retries++;
        if (timeoutBetweenRequests) {
            await sleep(retries * timeoutBetweenRequests);
        }
    }  while (retries < maxRetries)
    if (lastError) {
        throw new Error(lastError)
    }
    return lastResponse
};

exports.fetch = fetchWithRetriesAndLogger;
