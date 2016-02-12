# Twtxt Registry Server

A small registry server for twtxt, which allows to query for mentions and hash tags.

## Prerequisites

* [elasticsearch](https://www.elastic.co/downloads/elasticsearch) server
* [npm](https://nodejs.org) installed

## Installation

``` console
$ npm install
$ export PORT=8080
$ export ELASTICSEARCH_HOST=localhost
$ export ELASTICSEARCH_PORT=9200
$ node src/server.js
```

## Example API calls for the Plain-Text-Api

Add a new Twtxt User to the Registry:

``` console
$ curl -X POST http://localhost:8080/api/plain/users?url=https://dracoblue.net/twtxt.txt&nickname=dracoblue
OK
```

See latest tweets in the Registry (e.g. <https://registry.twtxt.org/api/plain/tweets>):

``` console
$ curl http://localhost:8080/api/plain/tweets
http://workspaces.local/twtxt.txt	2016-02-06T21:32:02.000Z	@erlehmann is messing with timestamps in @buckket #twtxt :)
http://workspaces.local/twtxt.txt	2016-02-06T12:14:18.000Z	Simple nodejs script to convert your twitter timeline to twtxt: https://t.co/txnWsC5jvA ( find my #twtxt at https://t.co/uN1KDXwJ8B )
```

Search for tweets in the Registry (e.g. <https://registry.twtxt.org/api/plain/tweets?q=twtxt>):

``` console
$ curl http://localhost:8080/api/plain/tweets?q=twtxt
https://buckket.org/twtxt.txt	2016-02-09T12:42:26.000Z	Do we need an IRC channel for twtxt?
https://buckket.org/twtxt.txt	2016-02-09T12:42:12.000Z	Good Morning, twtxt-world!
```

Retrieve a list of all mentions of a specific twtxt User like `https://buckket.org/twtxt.txt` (e.g. <https://registry.twtxt.org/api/plain/mentions?url=https://buckket.org/twtxt.txt>):

``` console
$ curl http://localhost:8080/api/plain/mentions?url=https://buckket.org/twtxt.txt
http://workspaces.local/twtxt.txt	2016-02-09T12:57:59.000Z	@<buckket https://buckket.org/twtxt.txt> something like https://gitter.im/ or a freenode channel?
http://workspaces.local/twtxt.txt	2016-02-08T22:51:47.000Z	@<buckket https://buckket.org/twtxt.txt> looks nice ;)
```

Retrieve a list of all tweets with a specific tag like `#twtxt` (e.g. <https://registry.twtxt.org/api/plain/tags/twtxt>):

``` console
$ curl http://localhost:8080/api/plain/tags/twtxt
http://workspaces.local/twtxt.txt	2016-02-06T21:32:02.000Z	@erlehmann is messing with timestamps in @buckket #twtxt :)
http://workspaces.local/twtxt.txt	2016-02-06T12:14:18.000Z	Simple nodejs script to convert your twitter timeline to twtxt: https://t.co/txnWsC5jvA ( find my #twtxt at https://t.co/uN1KDXwJ8B )
```

Search for users in the Registry (e.g. <https://registry.twtxt.org/api/plain/users?q=dracoblue>):

``` console
$ curl http://localhost:8080/api/plain/users?q=dracoblue
https://dracoblue.net/twtxt.txt	2016-02-09T12:42:26.000Z	dracoblue
```

## License

This work is copyright by DracoBlue (http://dracoblue.net) and licensed under the terms of MIT License.