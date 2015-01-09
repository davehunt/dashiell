var irc = require('irc');
var strava = require('strava-v3');
var strftime = require('strftime');
var util = require('util');
var settings = require('./configuration.js');
var sprintf = require("sprintf-js").sprintf;

var leaderboardMetrics = new Array('achievements', 'activities', 'distance', 'elevation');
var help = {'help' : 'Show this help text',
            'activity': 'Mention activity xxxxx to show a summary of the activity',
            'leaderboard [metric]': 'Show club leaderboard. Valid metrics are: ' + leaderboardMetrics.join([separator = ', ']) + '. Defaults to distance.',
            'source': 'Share link to source code.'};

for (var item in settings) {
  util.log(item + ': ' + settings[item]);
}

var client = new irc.Client(settings.host, settings.nickname, {
  port: settings.port,
  channels: settings.channels
});
util.log('connected to IRC');

client.addListener('message', function(from, to, message) {
  util.log(from + ' => ' + to + ': "' + message + '"');

  var privateMessage = (to === settings.nickname);
  var command = null;
  var nameSearch = new RegExp('^' + settings.nickname + '[;:,]{0,1}\\s+(.*)');
  var respondTo = (privateMessage) ? from : to;
  var addressee = (privateMessage) ? '' : ' ' + from;

  if (message.search(nameSearch) !== -1) {
    command = message.match(nameSearch)[1].toLowerCase();
  } else if (privateMessage) {
    command = message.toLowerCase();
  }

  if (command !== null) {
    util.log('command found: ' + command);

    switch (command.split(' ')[0]) {
      case 'help':
        if (!privateMessage) {
          client.say(to, 'Hey' + addressee + ', I\'ll send you a private message with the commands I understand.');
        }
        // always send help as a private message
        client.say(from, 'Hey! Here are the commands I understand:');
        for (var item in help) {
          client.say(from, item + ': ' + help[item]);
        }
        break;
      case 'leaderboard':
        strava.clubs.get({'id': settings.club}, function(err, club) {
          util.log('club: ' + util.inspect(club));
          strava.clubs.listActivities({'id': settings.club, 'per_page': 200}, function(err, activities) {
            buildLeaderboard(activities, command.split(' ')[1]);
          });
        });
        break;
      case 'source':
        client.say(respondTo, 'Hey' + addressee + ', you can find my source code here: https://github.com/davehunt/dashiell');
        break;
      default:
        client.say(respondTo, 'Sorry' + addressee + ', I don\'t recognise that command. Try \'help\' to find out what I can do.');
    }
    return;
  }

  var activitySearch = new RegExp('activit(ies\/|y\\s+)(\\d+)');
  if (message.search(activitySearch) !== -1) {
    var activityID = message.match(activitySearch)[2];
    util.log('activity ' + activityID + ' mentioned');
    strava.activities.get({'id': activityID}, function(err, activity) {
      processActivity(activity);
    });
  }

  function calculatePace(meters, seconds) {
    var secondsPerKm = seconds / (meters / 1000);
    var minutesPerKm = Math.floor(secondsPerKm / 60);
    var pacePerKm = sprintf('%d:%02d', minutesPerKm, Math.round(secondsPerKm - minutesPerKm * 60));
    var secondsPerMile = secondsPerKm / 0.621371192;
    var minutesPerMile = Math.floor(secondsPerMile / 60);
    var pacePerMile = sprintf('%d:%02d', minutesPerMile, Math.round(secondsPerMile - minutesPerMile * 60));
    return util.format('%s/km (%s/mi)', pacePerKm, pacePerMile);
  }

  function calculateDistance(meters) {
    kilometers = meters / 1000;
    miles = kilometers * 0.621371192;
    return util.format('%s km (%s mi)', Math.round(kilometers * 10) / 10, Math.round(miles * 10) / 10);
  }

  function buildLeaderboard(activities, metric) {
    metric = (typeof metric !== 'undefined') ? metric : 'distance';
    if (leaderboardMetrics.indexOf(metric) === -1) {
      client.say(respondTo, 'Sorry' + addressee + ', but I don\'t recognise that leaderboard metric. Try one of: ' + leaderboardMetrics.join([separator = ', ']) + '.');
      return;
    }
    var metrics = {};
    var description;
    activities.forEach(function(activity) {
      util.log(util.inspect(activity));
      if (!activityInLeaderboardRange(activity)) {
        return;
      }
      var value;
      switch (metric) {
        case 'achievements':
          description = 'total achievements';
          value = activity.achievement_count;
          break;
        case 'activities':
          description = 'total activities';
          value = 1;
          break;
        case 'distance':
          description = 'total distance';
          value = activity.distance;
          break;
        case 'elevation':
          description = 'total elevation gain';
          value = activity.total_elevation_gain;
          break;
      }
      var athleteName = activity.athlete.firstname + ' ' + activity.athlete.lastname;
      metrics[athleteName] = (metrics[athleteName] || 0) + value;
    });
    if (metrics.length === 0) {
      client.say('Sorry' + addressee + ', but there are no activities for the club in the last ' + settings.leaderboardDays + ' days.');
    }

    var sortedMetrics = [];
    for (var athlete in metrics) {
      sortedMetrics.push([athlete, metrics[athlete]]);
    }
    sortedMetrics.sort(function(a, b) { return b[1] - a[1]; });

    client.say(respondTo, util.format('\00307(leaderboard)\017 for \002%s\002 in the last %s days:', description, settings.leaderboardDays));
    sortedMetrics.slice(0, 5).forEach(function(distance, i) {
      var score = distance[1];
      switch (metric) {
        case 'distance':
          score = calculateDistance(score);
          break;
        case 'elevation':
          score = score + 'm';
          break;
      }
      client.say(respondTo, util.format('%s. %s - %s', i + 1, distance[0], score));
    });
  }

  function activityInLeaderboardRange(activity) {
    var startDate = Date.parse(activity.start_date);
    var timeSinceActivity = Date.now() - startDate;
    return (timeSinceActivity <= settings.leaderboardDays * 24 * 60 * 60 * 1000);
  }

  function processActivity(activity) {
    util.log('activity: ' + util.inspect(activity));
    if (activity.resource_state !== 2) {
      strava.athletes.get({'id': activity.athlete.id}, function(err, athlete) {
        util.log('athlete: ' + util.inspect(athlete));
        reportActivity(activity, athlete);
      });
    } else {
      reportActivity(activity);
    }
  }

  function reportActivity(activity, athlete) {
    athlete = (typeof athlete !== 'undefined') ? athlete : activity.athlete;
    var athleteName = athlete.firstname + ' ' + athlete.lastname;
    var start = strftime('%a %d, %b %Y %T', new Date(activity.start_date_local)) + ' ' + activity.timezone.split(' ')[0];
    var activityName = activity.name;
    var distance = activity.distance;
    var movingTime = activity.moving_time;
    var pace = calculatePace(distance, movingTime);
    var elevation = activity.total_elevation_gain;
    var message = util.format('\00307(activity)\017 \002%s\002 - %s - \00307distance\017 %s, \00307pace\017 %s, \00307climb\017 %sm - %s', athleteName, activityName, calculateDistance(distance), pace, elevation, start);
    client.say(respondTo, message);
  }

});
