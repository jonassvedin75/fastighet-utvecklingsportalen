const {canManageWebhooks, canReadWebhooks} = require('./Webhook.cjs')
const {canManageWebhookSubscriptions, canReadWebhookSubscriptions} = require('./WebhookSubscription.cjs')

module.exports = {
    canManageWebhooks, canReadWebhooks, canReadWebhookSubscriptions, canManageWebhookSubscriptions
}
