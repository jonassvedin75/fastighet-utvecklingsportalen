const { performance } = require('perf_hooks')

const express = require('express')


const { getLogger } = require('@open-condo/keystone/logging')

const { PAYMENT_LINK_PATH } = require('@condo/domains/acquiring/constants/links')
const { PaymentLinkRouter } = require('@condo/domains/acquiring/routes/paymentLinkRouter')

const perfLogger = getLogger('perf')


class PaymentLinkMiddleware {
    async prepareMiddleware () {
        const startTime = performance.now()

        // this route can not be used for csrf attack (because no cookies and tokens are used in a public route)
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        const app = express()

        const router = new PaymentLinkRouter()
        await router.init()
        app.get(PAYMENT_LINK_PATH, router.handleRequest.bind(router))
        perfLogger.info({ msg: 'payment link perf', time: performance.now() - startTime })

        return app
    }
}

module.exports = {
    PaymentLinkMiddleware,
}
