const { TELEGRAM_IDP_TYPE } = require('@condo/domains/user/constants/common')
const { ERROR_MESSAGES } = require('@condo/domains/user/integration/telegram/utils/errors')
const {
    UserExternalIdentity,
} = require('@condo/domains/user/utils/serverSchema')

const dv = 1
const sender = { dv, fingerprint: 'user-external-identity-router' }

const linkUser = async (context, user, tgAuthData) => {
    await UserExternalIdentity.create(context, {
        dv,
        sender,
        user: { connect: { id: user.id } },
        identityId: tgAuthData.id,
        identityType: TELEGRAM_IDP_TYPE,
        meta: tgAuthData,
    })

    return user
}

const registerUser = async (context, userInfo, userType) => {
    throw new Error('YOU CAN\'T REGISTER USER USING TELEGRAM ')
}

const syncUser = async ({ authenticatedUser, context, userInfo, userType }) => {
    // try to find linked identities
    const userIdentities = await UserExternalIdentity.getAll(context, {
        identityType: TELEGRAM_IDP_TYPE,
        identityId: userInfo.id,
        // TODO DOMA-5239 remove this parameter. We should by default have only not deleted objects
        deletedAt: null,
        user: {
            deletedAt: null,
            type: userType,
        },
    }, 'id user { id }')

    // now we have the following cases:
    // 1. user already registered and have linked identity
    // 2. user already registered and have no linked identity
    // 3. user not registered

    // case 1: user already registered and have linked identity
    if (userIdentities.length > 0) {
        const [identity] = userIdentities
        const { user: { id } } = identity
        return { id }
    }

    // case 2: user is not registered, and we can't register account for him with telegram
    if (!authenticatedUser) {
        return { id: '', error: ERROR_MESSAGES.USER_IS_NOT_REGISTERED }
    }

    // case 3: user already registered and have no linked identity
    if (authenticatedUser.type !== userType) {
        return { id: '', error: ERROR_MESSAGES.NOT_SUPPORTED_USER_TYPE }
    }
    if (authenticatedUser.isAdmin || authenticatedUser.isSupport) {
        return { id: '', error: ERROR_MESSAGES.SUPER_USERS_NOT_ALLOWED }
    }
    // proceed link & auth
    return await linkUser(context, authenticatedUser, userInfo)
}

module.exports = {
    syncUser,
}