'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var growthbook = require('@growthbook/growthbook');
var lodash = require('lodash');
var conf = require('@open-condo/config');
var fetch = require('@open-condo/keystone/fetch');
var logging = require('@open-condo/keystone/logging');
var redis = require('@open-condo/keystone/redis');
var test_utils = require('@open-condo/keystone/test.utils');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var lodash__default = /*#__PURE__*/_interopDefaultLegacy(lodash);
var conf__default = /*#__PURE__*/_interopDefaultLegacy(conf);

const logger = logging.getLogger('featureToggleManager');

const FEATURE_TOGGLE_CONFIG = (conf__default["default"].FEATURE_TOGGLE_CONFIG) ? JSON.parse(conf__default["default"].FEATURE_TOGGLE_CONFIG) : {};

const REDIS_FEATURES_KEY = 'features';
const FEATURES_EXPIRED_IN_SECONDS = 60;
const { get } = lodash__default["default"];

class FeatureToggleManager {
    get redis () {
        if (!this._redis) this._redis = redis.getRedisClient('features');
        return this._redis
    }

    constructor () {
        if (FEATURE_TOGGLE_CONFIG.url && FEATURE_TOGGLE_CONFIG.apiKey) {
            this._url = `${FEATURE_TOGGLE_CONFIG.url}/${FEATURE_TOGGLE_CONFIG.apiKey}`;
            this._static = null;
        } else if (FEATURE_TOGGLE_CONFIG.static) {
            // NOTE(pahaz): value example: {"sms-after-ticket-creation":{"defaultValue":false,"rules":[{"condition":{"organization":{"$in":[]}},"force":true}]},"refetch-tickets-in-control-room":{"defaultValue":false,"rules":[{"force":true}]},"ticket-import":{"defaultValue":false,"rules":[{"condition":{"isSupport":true},"force":true}]},"send-billing-receipts-notifications-task":{"defaultValue":true},"max-count-completed-ticket-to-close-for-organization-task":{"defaultValue":100}}
            this._url = null;
            this._static = FEATURE_TOGGLE_CONFIG.static;
        } else {
            this._url = null;
            this._static = {};
            logger.warn('No FEATURE_TOGGLE_CONFIG! Every features and values will be false!');
        }
        this._redisKey = REDIS_FEATURES_KEY;
        this._redisExpires = FEATURES_EXPIRED_IN_SECONDS;
    }

    async fetchFeatures () {
        try {
            if (this._url) {
                const cachedFeatureFlags = await this.redis.get(this._redisKey);
                if (cachedFeatureFlags) return JSON.parse(cachedFeatureFlags)

                const result = await fetch.fetch(this._url);
                const parsedResult = await result.json();
                const features = parsedResult.features;

                await this.redis.set(this._redisKey, JSON.stringify(features), 'EX', this._redisExpires);

                return features
            } else if (this._static) {
                return JSON.parse(JSON.stringify(this._static))
            }

            throw new Error('FeatureToggleManager config error!')
        } catch (err) {
            logger.error({ msg: 'fetchFeatures error', err });
        }
    }

    async _getFeaturesFromKeystoneContext (keystoneContext) {
        const req = get(keystoneContext, 'req');
        let features = get(req, 'features');

        // Note: fetch features if needed! And save it in `req` if in request context
        if (!features) {
            features = await this.fetchFeatures();
            if (req) req.features = features;
        }

        return features
    }

    async _getGrowthBookInstance (keystoneContext, featuresContext) {
        const features = await this._getFeaturesFromKeystoneContext(keystoneContext);
        const growthbook$1 = new growthbook.GrowthBook();
        growthbook$1.setFeatures(features);
        if (featuresContext) growthbook$1.setAttributes(featuresContext);
        return growthbook$1
    }

    async isFeatureEnabled (keystoneContext, featureName, featuresContext) {
        // Note: if you want to override the flag value by tests you can use setFeatureFlag() from test.utils! (TESTS ONLY)
        if (conf__default["default"].USE_LOCAL_FEATURE_FLAGS) {
            return test_utils.getFeatureFlag(keystoneContext, featureName)
        }

        const growthbook = await this._getGrowthBookInstance(keystoneContext, featuresContext);
        return growthbook.isOn(featureName)
    }

    async getFeatureValue (keystoneContext, featureName, defaultValue, featuresContext) {
        // Note: if you want to override the flag value by tests you use setFeatureFlag() from test.utils! (TESTS ONLY)
        if (conf__default["default"].USE_LOCAL_FEATURE_FLAGS) {
            return test_utils.getFeatureFlag(keystoneContext, featureName) || defaultValue
        }

        const growthbook = await this._getGrowthBookInstance(keystoneContext, featuresContext);
        return growthbook.getFeatureValue(featureName, defaultValue)
    }
}

const featureToggleManager = new FeatureToggleManager();

exports.featureToggleManager = featureToggleManager;
