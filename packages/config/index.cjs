'use strict';

var fs = require('fs');
var path = require('path');
var dotenv = require('dotenv');
var url = require('url');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var dotenv__default = /*#__PURE__*/_interopDefaultLegacy(dotenv);

const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('index.cjs', document.baseURI).href)));
const __dirname$1 = path.dirname(__filename$1);

const root = path__default["default"].resolve(path__default["default"].join(__dirname$1, '../..'));
const cwd = process.cwd();
const env0 = JSON.parse(JSON.stringify(process.env));
let namespace, env1, env2;

// load root .env
if (fs__default["default"].existsSync(path__default["default"].join(root, '.env'))) {
    env1 = dotenv__default["default"].parse(fs__default["default"].readFileSync(path__default["default"].join(root, '.env')));
    for (const k in env1) {
        if (!env0.hasOwnProperty(k)) {
            process.env[k] = env1[k];
        }
    }
}

// load app/cwd .env
if (root !== cwd) {
    const appsRoot = path__default["default"].join(root, 'apps');
    const isInsideApps = cwd.startsWith(appsRoot);
    const appName = (isInsideApps) ? cwd.substring(appsRoot.length).split(path__default["default"].sep)[1] : undefined;

    if (fs__default["default"].existsSync(path__default["default"].join(cwd, '.env'))) {
        env2 = dotenv__default["default"].parse(fs__default["default"].readFileSync(path__default["default"].join(cwd, '.env')));
        namespace = path__default["default"].basename(cwd);
    } else if (isInsideApps && appName && fs__default["default"].existsSync(path__default["default"].join(root, 'apps', appName, '.env'))) {
        env2 = dotenv__default["default"].parse(fs__default["default"].readFileSync(path__default["default"].join(root, 'apps', appName, '.env')));
        namespace = appName;
    }
    if (env2) {
        for (const k in env2) {
            if (!env0.hasOwnProperty(k)) {
                process.env[k] = env2[k];
            }
        }
    }
}

function getEnv (namespace, name, defaultValue) {
    return preprocessEnv(process.env[`${namespace}_${name}`] || process.env[`${name}`] || defaultValue)
}

function preprocessEnv (v) {
    if (!v) return v
    if (v.includes('${ROOT}')) {
        v = v.replace('${ROOT}', root);
    }
    return v
}

function getConfig (namespace) {
    namespace = namespace ? namespace.toUpperCase().replace('_', '') : '';
    namespace = namespace ? namespace + '__' : '';

    const baseConfigs = {
        NODE_ENV: getEnv(namespace, 'NODE_ENV', 'production'),
        PROJECT_NAME: getEnv(namespace, 'PROJECT_NAME', 'noname-project'),
        SERVER_URL: getEnv(namespace, 'SERVER_URL', 'http://localhost:3000'),
        DATABASE_URL: getEnv(namespace, 'DATABASE_URL'),
        // LOCAL MEDIA FILES
        MEDIA_ROOT: process.env.MEDIA_ROOT || path__default["default"].join(root, '__media'),
        MEDIA_URL: process.env.MEDIA_URL || '/media',
        DEFAULT_LOCALE: String(process.env.DEFAULT_LOCALE || 'en'),
        PROJECT_ROOT: root,
    };
    const getter = (obj, name) => {
        if (name in obj) return obj[name]
        return getEnv(namespace, name)
    };

    const setter = () => {
        throw new TypeError(
            'config object is not settable! If you want to change value, you should set ' +
                'an environment variable or change value inside .env file'
        )
    };

    return new Proxy(baseConfigs, { get: getter, set: setter })
}
var index = getConfig(namespace);
// module.exports = getConfig(namespace)

module.exports = index;
