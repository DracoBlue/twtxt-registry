var plainApi = function(storage) {
  var express = require('express');
  var api = express.Router();

  api.use(function (req, res, next) {
    res.set('Content-Type', 'text/plain');
    next();
  });

  api.get('/tag/:tag', function (req, res) {
    if (!req.params.tag) {
      res.sendStatus(400);
      res.end();
      return;
    }

    storage.getTweetsByHashTag("#" + req.params.tag, function (tweets) {
      var response = [];

      tweets.forEach(function (tweet) {
        response.push(tweet.author_url + "\t" + tweet.timestamp + "\t" + tweet.text);
      });
      res.send(response.join("\n"));
    })
  });

  api.get('/tweets', function (req, res) {
    storage.searchTweets(req.query.q || '', function (tweets) {
      var response = [];

      tweets.forEach(function (tweet) {
        response.push(tweet.author_url + "\t" + tweet.timestamp + "\t" + tweet.text);
      });
      res.send(response.join("\n"));
    })
  });

  api.get('/mentions', function (req, res) {
    if (!req.query.url) {
      res.sendStatus(400);
      res.end();
      return;
    }

    storage.getTweetsByMentions(req.query.url, function (tweets) {
      var response = [];

      tweets.forEach(function (tweet) {
        response.push(tweet.author_url + "\t" + tweet.timestamp + "\t" + tweet.text);
      });
      res.send(response.join("\n"));
    })
  });

  api.post('/users', function (req, res) {
    if (!req.query.url) {
      res.sendStatus(400);
      res.end();
      return;
    }

    storage.addUrl(req.query.url, function () {
      res.send("OK");
    });
  });

  return api;
};

module.exports = plainApi;