var envs = require('envs');

module.exports = {
  host: envs('IRC_HOST', 'localhost'),
  port: envs('IRC_PORT', '6667'),
  nickname: envs('IRC_NICKNAME', 'dashiell'),
  channels: envs('IRC_CHANNELS', '#strava'),
  club: envs('STRAVA_CLUB', '0')
}
