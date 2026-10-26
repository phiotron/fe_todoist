const {
  CMAKE_OBJECT_PATH_MAX_ARG,
  GRADLE_NETWORK_TIMEOUT_MS,
  addCmakeObjectPathMax,
  setGradleNetworkTimeout,
} = require('../androidBuildFixes');

const BUILD_GRADLE = `android {
    defaultConfig {
        applicationId 'com.taskly.app'
        versionName "1.0.0"
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
    }
}
`;

const WRAPPER = `distributionBase=GRADLE_USER_HOME
distributionUrl=https\\://services.gradle.org/distributions/gradle-9.4.1-bin.zip
networkTimeout=10000
validateDistributionUrl=true
`;

describe('addCmakeObjectPathMax', () => {
  it('adds the CMake argument inside defaultConfig', () => {
    const out = addCmakeObjectPathMax(BUILD_GRADLE);
    const defaultConfig = out.slice(out.indexOf('defaultConfig {'), out.indexOf('buildTypes {'));
    expect(defaultConfig).toContain('externalNativeBuild {');
    expect(defaultConfig).toContain(`arguments "${CMAKE_OBJECT_PATH_MAX_ARG}"`);
  });

  it('is idempotent', () => {
    const once = addCmakeObjectPathMax(BUILD_GRADLE);
    expect(addCmakeObjectPathMax(once)).toBe(once);
  });

  it('throws when defaultConfig is missing, so a template change is noticed', () => {
    expect(() => addCmakeObjectPathMax('android {\n}\n')).toThrow(/defaultConfig/);
  });
});

describe('setGradleNetworkTimeout', () => {
  it('raises an existing networkTimeout', () => {
    const out = setGradleNetworkTimeout(WRAPPER);
    expect(out).toContain(`networkTimeout=${GRADLE_NETWORK_TIMEOUT_MS}`);
    expect(out).not.toContain('networkTimeout=10000');
  });

  it('appends networkTimeout when absent', () => {
    const out = setGradleNetworkTimeout('distributionBase=GRADLE_USER_HOME\n');
    expect(out).toBe(`distributionBase=GRADLE_USER_HOME\nnetworkTimeout=${GRADLE_NETWORK_TIMEOUT_MS}\n`);
  });

  it('is idempotent', () => {
    const once = setGradleNetworkTimeout(WRAPPER);
    expect(setGradleNetworkTimeout(once)).toBe(once);
  });
});
