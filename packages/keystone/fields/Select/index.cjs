const { Select: KSSelect } = require('@keystonejs/fields')

const { Select } = require('./implementation.cjs')

module.exports = {
    type: 'Select',
    implementation: Select,
    views: KSSelect.views,
    adapters: KSSelect.adapters,
}
