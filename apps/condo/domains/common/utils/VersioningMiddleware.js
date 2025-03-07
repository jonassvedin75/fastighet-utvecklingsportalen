const { performance } = require('perf_hooks')

const packageJson = require('@app/condo/package.json')
const express = require('express')
const { get } = require('lodash')

const { getLogger } = require('@open-condo/keystone/logging')

const perfLogger = getLogger('perf')



const getCurrentVersion = () => get(process.env, 'WERF_COMMIT_HASH', packageJson.version)

class VersioningMiddleware {
    async prepareMiddleware () {
        const startTime = performance.now()

        // this route can not be used for csrf attack (because no cookies and tokens are used in a public route)
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        const app = express()
        app.use('/api/version', (req, res) => {
            res.status(200).json({
                build: getCurrentVersion(),
            })
        })
        perfLogger.info({ msg: 'versioning perf', time: performance.now() - startTime })

        return app
    }
}

module.exports = {
    VersioningMiddleware,
    getCurrentVersion,
}
