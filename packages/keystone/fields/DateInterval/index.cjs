const { Text } = require('@keystonejs/fields')

const { DateInterval } = require('./Implementation.cjs')

module.exports = {
    type: 'DateInterval',
    implementation: DateInterval,
    views: Text.views,
    adapters: Text.adapters,
}
