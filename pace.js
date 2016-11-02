var sprintf = require("sprintf-js").sprintf;

var KMM = 0.621371192;

class Pace {
  constructor ({min, sec, unit}) {
    var seconds = min * 60 + sec;
    switch (unit) {
      case 'km':
        this.secondsPerKm = seconds;
        break;
      // miles
      case 'mi':
        this.secondsPerKm = seconds * KMM
        break;
      default:
        throw new Error(sprintf("invalid unit: %s", unit))
    }
    function format (sec) {
      var m_km = Math.floor(sec/60);
      var s_km = sec % 60;
      return sprintf('%d:%02d', m_km, s_km)
    }

    this.pacePerKm = format(this.secondsPerKm);
    this.pacePer400m = format(this.secondsPerKm * 0.4)
    this.pacePerMile = format(this.secondsPerKm / KMM)
  }

  static parsePace (aString) {
    var re = /(([0-9]+):([0-9]+).*\/ *(km|mi))/ ;
    var parsed = re.exec(aString);
    if (parsed) {
      return {
        min: Number(parsed[2],10),
        sec: Number(parsed[3],10),
        unit: parsed[4]
      }
    }
  }
}

exports.Pace = Pace;

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
  console.log(p.pacePerKm, "/km", p.pacePerMile, "/mi");
}
