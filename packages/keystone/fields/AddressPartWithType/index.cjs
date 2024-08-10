const { AddressPartWithTypeImplementation } = require('./Implementation.cjs')

const Json = require('../Json/index.cjs')

// This is a Json field but with custom editor and custom cell view
module.exports = {
    ...Json,
    implementation: AddressPartWithTypeImplementation,
    type: 'AddressPartWithType',
    views: {
        ...Json.views,
        Controller: require.resolve('./views/Controller.cjs'),
        Cell: require.resolve('./views/Cell.cjs'),
        Field: require.resolve('./views/Field.cjs'),
    },
}
