const { adminDocPreprocessor } = require('./adminDoc.cjs')
const { customAccessPostProcessor } = require('./customAccess.cjs')
const { escapeSearchPreprocessor } = require('./escapeSearch.cjs')
const { schemaDocPreprocessor } = require('./schemaDoc.cjs')

module.exports = {
    adminDocPreprocessor,
    customAccessPostProcessor,
    escapeSearchPreprocessor,
    schemaDocPreprocessor,
}
