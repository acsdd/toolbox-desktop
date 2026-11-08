import packageJson from '../../package.json'

/** App version from package.json, not Electron's runtime version. */
export const APP_VERSION = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

/** User agent for outbound requests, e.g. Toolbox/0.9.3. */
export const USER_AGENT = `Toolbox/${APP_VERSION}`
