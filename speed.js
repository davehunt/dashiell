"use strict";

var sprintf = require("sprintf-js").sprintf;

var KMM = 0.621371192;

var Pace = require('./pace').Pace;

class Speed {
  constructor ({min, sec, unit}) {
    var minutes = sec / 60 + min;
    switch (unit) {
      case 'km':
        this.kmPerHour = 60 / minutes;
        break;
      // miles
      case 'mi':
        this.kmPerHour = 60 / (minutes * KMM)
        break;
      default:
        throw new Error(sprintf("invalid unit: %s", unit))
    }
    function format (speed) {
      return sprintf('%f1', speed)
    }

    this.kmPerHour = this.kmPerHour.toFixed(2);
    this.milePerHour = (this.kmPerHour * KMM).toFixed(2)
  }
}

exports.Speed = Speed;

if (require.main === module) {
  function fail(...args) {
    console.error(...args);
    process.exit(1)
  }

  var paceString = process.argv.splice(2).join(" ");
  if (!paceString) fail("no string given");

  var parsed = Pace.parsePace(paceString);
  if (!parsed) fail("Unable to parse: %s", paceString);
  var p = new Pace(parsed);
  console.log(p.kmPerHour, "km/hour", p.milePerHour, "mi/hour");
}
