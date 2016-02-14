// Require our dependencies
var express = require('express');
var elasticsearch = require('elasticsearch');
var Storage = require('./Storage');
var plainApi = require('./plainApi');
var http = require('http');
var Memcached = require('memcached');

// Create an express instance and set a port variable
var app = express();
var port = process.env.PORT || 8080;

// Disable etag headers on responses
app.disable('etag');

var storage = new Storage(
  new elasticsearch.Client({
    host: (process.env.ELASTICSEARCH_HOST || "localhost") + ":" + (process.env.ELASTICSEARCH_PORT || "9200"),
    log: 'warning'
  }),
  new Memcached((process.env.MEMCACHED_HOST || "localhost") + ":" + (process.env.MEMCACHED_PORT || "11211"))
);

app.use('/api/plain/', plainApi(storage));

app.get('/', function (req, res) {
  var response = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "<title>twtxt registry</title>",
    "</head>",
    "<body>",
    "<h1>Twtxt Registry</h1>",
    'This is a hosted registry for <a href="https://github.com/buckket/twtxt">https://github.com/buckket/twtxt</a>. The registry software is developed by <a href="https://dracoblue.net">dracoblue</a> and you may find the source code at <a href="https://github.com/DracoBlue/twtxt-registry">https://github.com/DracoBlue/twtxt-registry</a>.',
    "<body>",
    "</html>"
  ];
  res.set('Content-Type', 'text/html');
  res.send(response.join("\n"));
});

var server = http.createServer(app).listen(port, function() {
  console.log('twtxt registry listening on port ' + port);
  storage.startUpdating();
});

storage.addUser("https://buckket.org/twtxt.txt", "buckket", function() {
});

storage.addUser("https://buckket.org/twtxt_news.txt", "twtxt_news", function() {
});

storage.addUser("https://dracoblue.net/twtxt.txt", "dracoblue", function() {
});