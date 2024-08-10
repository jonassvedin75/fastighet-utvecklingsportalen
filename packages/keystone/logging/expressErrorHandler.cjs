'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var cuid = require('cuid');
var lodash = require('lodash');
var logging = require('@open-condo/keystone/logging');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var cuid__default = /*#__PURE__*/_interopDefaultLegacy(cuid);
var lodash__default = /*#__PURE__*/_interopDefaultLegacy(lodash);

const { get } = lodash__default["default"];
const logger = logging.getLogger('expressErrorHandler');

const expressErrorHandler = (error, req, res, next) => {
    if (!error) next();
    const errId = error.uid || cuid__default["default"]();
    const reqId = get(req, ['id'], get(req, ['headers', 'X-Request-Id']));
    logger.error({ msg: 'expressErrorHandler', error, reqId, errId });
    return res.status(500).send(`Error! errId=${errId}; reqId=${reqId}`)
};

exports.expressErrorHandler = expressErrorHandler;
