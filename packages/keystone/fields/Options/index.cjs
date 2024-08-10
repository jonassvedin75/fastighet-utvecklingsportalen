const { OptionsImplementation, OptionsKnexFieldAdapter, OptionsMongooseFieldAdapter, OptionsPrismaFieldAdapter } = require('./Implementation.cjs')

module.exports = {
    type: 'Options',
    implementation: OptionsImplementation,
    adapters: {
        knex: OptionsKnexFieldAdapter,
        mongoose: OptionsMongooseFieldAdapter,
        prisma: OptionsPrismaFieldAdapter,
    },
    views: {
        // Note: You cannot currently import and extend a controller
        // outside this monorepo.
        Controller: require.resolve('./views/Controller.cjs'),
        Field: require.resolve('./views/Field.cjs'),
        // Filter: Text.views.Filter,
        Cell: require.resolve('./views/Cell.cjs'),
    },
}
