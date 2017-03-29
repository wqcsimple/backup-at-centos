/**
 * Created by whis on 11/8/16.
 */
var sprintf = require('locutus/php/strings/sprintf');
var date = require('locutus/php/datetime/date');
var rand = require('locutus/php/math/rand');

function time() {
    return parseInt(new Date().getTime() / 1000, 10);
}

var Util = {
    sprintf: sprintf,
    date: date,
    rand: rand,
    time: time
};

module.exports = Util;