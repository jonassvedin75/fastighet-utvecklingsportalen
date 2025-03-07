const { performance } = require('perf_hooks')

const express = require('express')

const { featureToggleManager } = require('@open-condo/featureflags/featureToggleManager')
const { getLogger } = require('@open-condo/keystone/logging')

const perfLogger = getLogger('perf')

class FeaturesMiddleware {
    async prepareMiddleware () {
        const startTime = performance.now()

        // this route can not be used for csrf attack (because no cookies and tokens are used in a public route)
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        const app = express()
        app.get('/api/features', async (req, res) => {
            const features = await featureToggleManager.fetchFeatures()
            res.status(200).json(features)
        })
        perfLogger.info({ msg: 'features perf', time: performance.now() - startTime })

        return app
    }
}

module.exports = {
    FeaturesMiddleware,
}
