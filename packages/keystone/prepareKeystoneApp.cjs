'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var debug = require('debug');
var express = require('express');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n["default"] = e;
    return Object.freeze(n);
}

var debug__default = /*#__PURE__*/_interopDefaultLegacy(debug);
var express__default = /*#__PURE__*/_interopDefaultLegacy(express);

async function prepareKeystoneExpressApp (entryPoint, { excludeApps } = {}) {
    debug__default["default"]('prepareKeystoneExpressApp(%s) excludeApps=%j cwd=%s', entryPoint, excludeApps, process.cwd());
    const dev = process.env.NODE_ENV === 'development';
    const {
        keystone,
        apps,
        configureExpress,
        cors,
        pinoOptions,
    } = (typeof entryPoint === 'string') ? await (function (t) { return Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require(t)); }); })(entryPoint) : entryPoint;
    const newApps = (excludeApps) ? apps.filter(x => !excludeApps.includes(x.constructor.name)) : apps;
    const { middlewares } = await keystone.prepare({ apps: newApps, dev, cors, pinoOptions });
    await keystone.connect();

    // not a csrf case: used for test & development scripts purposes
    // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
    const app = express__default["default"]();
    if (configureExpress) configureExpress(app);
    app.use(middlewares);
    return { keystone, app }
}

exports.prepareKeystoneExpressApp = prepareKeystoneExpressApp;
