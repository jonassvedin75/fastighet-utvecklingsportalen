'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var express = require('express');
var featureToggleManager = require('@open-condo/featureflags/featureToggleManager');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var express__default = /*#__PURE__*/_interopDefaultLegacy(express);

class FeaturesMiddleware {
    async prepareMiddleware () {
        // this route can not be used for csrf attack (because no cookies and tokens are used in a public route)
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        const app = express__default["default"]();
        app.get('/api/features', async (req, res) => {
            const features = await featureToggleManager.featureToggleManager.fetchFeatures();
            res.status(200).json(features);
        });
        return app
    }
}

exports.FeaturesMiddleware = FeaturesMiddleware;
