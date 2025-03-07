const { performance } = require('perf_hooks')

const bodyParser = require('body-parser')
const express = require('express')

const { getLogger } = require('@open-condo/keystone/logging')
const { expressErrorHandler } = require('@open-condo/keystone/logging/expressErrorHandler')

const { SbbolRoutes } = require('@condo/domains/organization/integrations/sbbol/routes')
const { AppleIdRoutes } = require('@condo/domains/user/integration/appleid/routes')
const { SberIdRoutes } = require('@condo/domains/user/integration/sberid/routes')

const perfLogger = getLogger('perf')


class UserExternalIdentityMiddleware {
    async prepareMiddleware ({ keystone }) {
        const startTime = performance.now()

        // all bellow routes are handling csrf properly
        // and controlling start/end authorization sources (browsers, mobile clients, etc)
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        const app = express()

        // sbbol route
        const sbbolRoutes = new SbbolRoutes()
        app.get('/api/sbbol/auth', sbbolRoutes.startAuth.bind(sbbolRoutes))
        app.get('/api/sbbol/auth/callback', sbbolRoutes.completeAuth.bind(sbbolRoutes))

        // apple_id route
        const appleIdRoutes = new AppleIdRoutes()
        app.get('/api/apple_id/auth', appleIdRoutes.startAuth.bind(appleIdRoutes))
        app.get('/api/apple_id/auth/callback', appleIdRoutes.completeAuth.bind(appleIdRoutes))
        app.post('/api/apple_id/auth/callback', appleIdRoutes.completeAuth.bind(appleIdRoutes))

        // sber_id route
        const sberIdRoutes = new SberIdRoutes()
        app.get('/api/sber_id/auth', sberIdRoutes.startAuth.bind(sberIdRoutes))
        app.get('/api/sber_id/auth/callback', sberIdRoutes.completeAuth.bind(sberIdRoutes))

        // error handler
        app.use(expressErrorHandler)

        perfLogger.info({ msg: 'user external identity perf', time: performance.now() - startTime })

        return app
    }
}

module.exports = {
    UserExternalIdentityMiddleware,
}
