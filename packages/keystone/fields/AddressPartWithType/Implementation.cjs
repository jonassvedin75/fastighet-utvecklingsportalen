const { JsonImplementation } = require('../Json/Implementation.cjs')

class AddressPartWithTypeImplementation extends JsonImplementation {
    constructor (path, ref) {
        super(...arguments)
        this.allowedValues = ref.allowedValues
    }

    extendAdminMeta (meta) {
        const { allowedValues } = this

        return super.extendAdminMeta({ ...meta, allowedValues })
    }
}

module.exports = { AddressPartWithTypeImplementation }
