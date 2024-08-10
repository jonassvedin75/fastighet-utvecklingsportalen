const { Webhook } = require('./models/Webhook.cjs')
const { getWebhookSubscriptionModel } = require('./models/WebhookSubscription.cjs')

function getWebhookModels (schemaPath) {
    return {
        Webhook,
        WebhookSubscription: getWebhookSubscriptionModel(schemaPath),
    }
}

module.exports = {
    getWebhookModels,
    Webhook,
}
