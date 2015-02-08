// Generated by CoffeeScript 1.7.1
(function() {
  var $, Timeline, app, express, newrelic, prettyDate, request, rss2timeline, toEpoch, xml2js, _;

  express = require("express");

  xml2js = require('xml2js');

  _ = require("underscore");

  request = require("request");

  prettyDate = require("./pretty");

  $ = require("jquery");

  newrelic = require('newrelic');

  Timeline = (function() {
    function Timeline(feed) {
      this.title = feed.channel.title;
      this.link = feed.channel.link;
      this.description = feed.channel.description;
      this.bookmarks = _(feed.item).map(function(item) {
        return new Timeline.Bookmark(item);
      });
    }

    return Timeline;

  })();

  Timeline.Bookmark = (function() {
    function Bookmark(item) {
      var node, _ref;
      this.title = item.title;
      this.link = item.link;
      this.favicon_url = "http://favicon.st-hatena.com/?url=" + this.link;
      this.comment = (_ref = item.description) != null ? _ref : "";
      this.count = item['hatena:bookmarkcount'];
      this.datetime = item['dc:date'];
      this.created_at = prettyDate(item['dc:date']);
      this.user = new Timeline.User(item['dc:creator']);
      this.permalink = item['@']['rdf:about'];
      this.category = item['dc:subject'];
      if (item['content:encoded']) {
        node = $(item['content:encoded']);
        this.description = node.find('p').text();
        if (/class="entry-image"/.test(item['content:encoded'])) {
          this.thumbnail_url = node.find('.entry-image').attr('src');
        }
      }
    }

    return Bookmark;

  })();

  Timeline.User = (function() {
    function User(name) {
      this.name = name;
      if (this.name != null) {
        this.profile_image_url = "http://www.st-hatena.com/users/" + this.name.substr(0, 2) + ("/" + this.name + "/profile.gif");
      }
    }

    return User;

  })();

  app = module.exports = express.createServer();

  app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    return app.use(app.router);
  });

  app.configure("development", function() {
    return app.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
  });

  app.configure("production", function() {
    return app.use(express.errorHandler());
  });

  rss2timeline = function(url, headers, cb) {
    var parser;
    parser = new xml2js.Parser(xml2js.defaults["0.1"]);
    parser.addListener('end', function(result) {
      return cb(new Timeline(result));
    });
    return request({
      method: 'GET',
      uri: url,
      headers: headers,
      timeout: 15 * 1000
    }, function(error, response, body) {
      var e;
      if (error) {
        console.log("[error] " + error + ": " + url);
      }
      if (!error && response.statusCode === 200) {
        try {
          return parser.parseString(body);
        } catch (_error) {
          e = _error;
          return console.log(e);
        }
      }
    });
  };

  toEpoch = function(date) {
    return parseInt(date.getTime() / 1000.0);
  };

  app.get("/hotentry", function(req, res) {
    var url;
    if (req.param('category')) {
      url = "http://b.hatena.ne.jp/hotentry/" + (req.param('category')) + ".rss";
    } else {
      url = "http://b.hatena.ne.jp/hotentry.rss";
    }
    return rss2timeline(url, {}, function(timeline) {
      _(timeline.bookmarks).each(function(bookmark) {
        return bookmark.user = new Timeline.User("hatenabookmark");
      });
      return res.send(timeline);
    });
  });

  app.get("/entrylist", function(req, res) {
    var url;
    if (req.param('category')) {
      url = "http://b.hatena.ne.jp/entrylist/" + (req.param('category')) + ".rss";
    } else {
      url = "http://b.hatena.ne.jp/entrylist.rss";
    }
    return rss2timeline(url, {}, function(timeline) {
      _(timeline.bookmarks).each(function(bookmark) {
        return bookmark.user = new Timeline.User("hatenabookmark");
      });
      return res.send(timeline);
    });
  });

  app.get("/:id", function(req, res) {
    var offset, url;
    url = "http://b.hatena.ne.jp/" + req.params.id + "/favorite.rss?with_me=1";
    if (req.param('until')) {
      url += "&until=" + (req.param('until'));
    } else if (offset = req.param('of')) {
      url += "&of=" + (req.param('of'));
    }
    return rss2timeline(url, {
      "Cache-Control": "no-cache"
    }, function(timeline) {
      return res.send(timeline);
    });
  });

  app.get("/:id/bookmark", function(req, res) {
    var offset, url, _ref;
    offset = (_ref = req.param('of')) != null ? _ref : 0;
    url = "http://b.hatena.ne.jp/" + req.params.id + "/rss?of=" + offset;
    return rss2timeline(url, {
      "Cache-Control": "no-cache"
    }, function(timeline) {
      return res.send(timeline);
    });
  });

  app.listen(process.env.PORT || 3000);

  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

}).call(this);
