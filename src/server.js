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

process.env.ELASTICSEARCH_HOST = process.env.ELASTICSEARCH_HOST || "http://localhost:9200";
process.env.MEMCACHED_HOST = process.env.MEMCACHED_HOST || "localhost:11211";

var storage = new Storage(
  new elasticsearch.Client({
    host: process.env.ELASTICSEARCH_HOST,
    log: 'warning'
  }),
  new Memcached(process.env.MEMCACHED_HOST)
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
    '<p>This is a hosted registry for <a href="https://github.com/buckket/twtxt">https://github.com/buckket/twtxt</a>. The registry software is developed by <a href="https://dracoblue.net">dracoblue</a> and you may find the source code at <a href="https://github.com/DracoBlue/twtxt-registry">https://github.com/DracoBlue/twtxt-registry</a>.</p>',
    '<p>The api doc can be found at <a href="/swagger-ui/">/swagger-ui/</a>.</p>',
    "<body>",
    "</html>"
  ];
  res.set('Content-Type', 'text/html');
  res.send(response.join("\n"));
});

var renderSwaggerHtml = function(req, res) {
  var fs = require('fs');
  var response = fs.readFileSync(__dirname + '/../node_modules/swagger-ui/dist/index.html').toString();
  response = response.replace("http://petstore.swagger.io/v2/swagger.json", "/api/swagger.json");

  res.set('Content-Type', 'text/html');
  res.send(response);
};

app.get("/swagger-ui/index.html", renderSwaggerHtml);
app.get("/swagger-ui/", renderSwaggerHtml);

app.get("/api/swagger.json", function(req, res) {
  var fs = require('fs');
  res.set('Content-Type', 'application/json');
  var response = JSON.parse(fs.readFileSync(__dirname + '/swagger.json').toString());
  var info = JSON.parse(fs.readFileSync(__dirname + '/../package.json'));
  response.info.version = info.version || 'dev';
  res.send(JSON.stringify(response));
});

// Set /public as our static content dir
app.use("/swagger-ui/", express.static(__dirname + "/../node_modules/swagger-ui/dist/"));

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
