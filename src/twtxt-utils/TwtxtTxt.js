var moment = require('moment');
var urlUtils = require('url');
var md5 = require('md5');

var TwtxtTxt = function(url, body) {
  this.body = body;
  this.url = url;

  this.setTweetsByBody(this.body);
};

TwtxtTxt.prototype.getTweets = function() {
  return this.tweets;
};

TwtxtTxt.prototype.setTweetsByBody = function(body) {
  var that = this;
  this.tweets = [];

  body.split("\n").forEach(function(row) {
    row = (row || "").trim();

    if (row) {
      var match = row.match(/^([^\t]+)\t(.+)/);

      if (match && moment(match[1]).isValid()) {

        var text = match[2].trim();
        var body = text.toString();

        var hashTags = that.extractHashTagsByRow(text);
        var mentions = that.extractMentionsByRow(text);

        if (body) {
          var currentMatch = body.match(/@<([^ ]+) ([^> ]+)>/);
          while (currentMatch) {
            body = body.replace(currentMatch[0], '<a href="' + that.encodeXml(currentMatch[2]) + '" class="username">@' + that.encodeXml(currentMatch[1]) + '</a>');
            currentMatch = body.match(/@<([^ ]+) ([^> ]+)>/);
          }

          currentMatch = body.match(/@<([^> ]+)>/);
          while (currentMatch) {
            body = body.replace(currentMatch[0], '<a href="' + that.encodeXml(currentMatch[1]) + '" class="username">@' + that.encodeXml(urlUtils.parse(currentMatch[1])['hostname'] || currentMatch[1]) + '</a>');
            currentMatch = body.match(/@<([^> ]+)>/);
          }
        }


        that.tweets.push({
          id: md5(that.url + "\t" + row),
          timestamp: moment(match[1]).toISOString(),
          hashTags: hashTags,
          mentions: mentions,
          author_url: that.url,
          body: body,
          text: text
        });
      }
    }
  });
};


var xml_special_to_escaped_one_map = {
  '&': '&',
  '"': '"',
  '<': '&lt;',
  '>': '&gt;'
};

var escaped_one_to_xml_special_map = {
  '&': '&',
  '"': '"',
  '&lt;': '<',
  '&gt;': '>'
};

TwtxtTxt.prototype.encodeXml = function(string) {
  return string.replace(/([\&"<>])/g, function(str, item) {
    return xml_special_to_escaped_one_map[item];
  });
};

TwtxtTxt.prototype.decodeXml = function(string) {
  return string.replace(/("|<|>|&)/g,
    function(str, item) {
      return escaped_one_to_xml_special_map[item];
    });
};

TwtxtTxt.prototype.extractHashTagsByRow = function(string) {
  return string.match(/(#[^\s#<>'"]+)/g) || [];
};


TwtxtTxt.prototype.extractMentionsByRow = function(body) {
  var mentions = [];
  var currentMatch = body.match(/@<([^ ]+ [^> ]+)>/g);
  if (currentMatch) {
    currentMatch.forEach(function(mention) {
      var rowMatch = mention.match(/@<([^ ]+) ([^> ]+)>/);
      mentions.push(rowMatch[2]);
    })
  }

  currentMatch = body.match(/@<([^> ]+)>/g);
  if (currentMatch) {
    currentMatch.forEach(function(mention) {
      var rowMatch = mention.match(/@<([^> ]+)>/);
      mentions.push(rowMatch[1]);
    })
  }

  return mentions;
};

module.exports = TwtxtTxt;