import express from 'express'

import { featureToggleManager } from '@open-condo/featureflags/featureToggleManager'

class FeaturesMiddleware {
    async prepareMiddleware () {
        // this route can not be used for csrf attack (because no cookies and tokens are used in a public route)
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        const app = express()
        app.get('/api/features', async (req, res) => {
            const features = await featureToggleManager.fetchFeatures()
            res.status(200).json(features)
        })
        return app
    }
}

export {
    FeaturesMiddleware,
}
