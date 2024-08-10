const { FakeDatabaseAdapter } = require('./FakeDatabaseAdapter.cjs')
const { ScalableDatabaseAdapter } = require('./ScalableDatabaseAdapter.cjs')
const { wrapToCheckOnlyPublicApi } = require('./wrapToCheckOnlyPublicApi.cjs')

module.exports = { ScalableDatabaseAdapter, FakeDatabaseAdapter, wrapToCheckOnlyPublicApi }
