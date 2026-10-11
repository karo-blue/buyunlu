const config = require('./services/config');

App({
  globalData: {
    appId: config.appId,
    rewardedAdUnitId: config.rewardedAdUnitId,
  },
});
