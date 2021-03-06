express = require "express"
xml2js  = require 'xml2js'
_       = require "underscore"
request = require "request"
prettyDate = require "./pretty"
jsdom   = require 'jsdom'
window  = jsdom.jsdom().parentWindow
$       = require("jquery/dist/jquery")(window)

class Timeline
  constructor: (feed)->
    @title       = feed.channel.title
    @link        = feed.channel.link
    @description = feed.channel.description
    @bookmarks   = _.map feed.item, (item) ->
      new Timeline.Bookmark (item)

class Timeline.Bookmark
  constructor: (item)->
    @title       = item.title
    @link        = item.link
    @favicon_url = "http://favicon.st-hatena.com/?url=#{@link}"
    @comment     = item.description ? ""
    @count       = item['hatena:bookmarkcount']
    @datetime    = item['dc:date']
    @created_at  = prettyDate item['dc:date']
    @user        = new Timeline.User item['dc:creator']
    @permalink   = item['@']['rdf:about']
    @category    = item['dc:subject']

    if item['content:encoded']
      element = $(item['content:encoded'])

      ## favorite.rss は description が comment のため
      @description = element.find('p').text()
      
      if /class="entry-image"/.test(item['content:encoded'])
        @thumbnail_url =
          element.find('.entry-image').attr('src')

class Timeline.User
  constructor: (@name) ->
    if @name?
      @profile_image_url =
        "http://www.st-hatena.com/users/" +
        @name.substr(0, 2) +
        "/#{@name}/profile.gif"

app = module.exports = express.createServer()
app.configure ->
  app.use express.bodyParser()
  app.use express.methodOverride()
  app.use app.router

app.configure "development", ->
  app.use express.errorHandler
    dumpExceptions: true
    showStack: true

app.configure "production", ->
  app.use express.errorHandler()

rss2timeline = (url, headers, cb) ->
  parser = new xml2js.Parser(xml2js.defaults["0.1"])
  parser.addListener 'end', (result) ->
    timeline = new Timeline(result)
    return cb(timeline)

  request
    method:'GET',
    uri:url,
    headers:_.extend(headers, 'User-Agent': 'HBFav/0.0.1'),
    timeout:20 * 1000 # 20 sec
    (error, response, body) ->
      if error
        console.log "[error] #{error}: #{url}"
        
      if not error and response.statusCode is 200
        try
          parser.parseString body
        catch e
          console.log e

toEpoch = (date) ->
  parseInt date.getTime() / 1000.0

app.get "/hotentry", (req, res) ->
  if req.param('category')
    url = "http://b.hatena.ne.jp/hotentry/#{req.param('category')}.rss"
  else
    url = "http://b.hatena.ne.jp/hotentry.rss"
  rss2timeline url, {}, (timeline) ->
    "callback: #{url}"
    _(timeline.bookmarks).each (bookmark) ->
      bookmark.user = new Timeline.User "hatenabookmark"
    res.send timeline

app.get "/entrylist", (req, res) ->
  if req.param('category')
    url = "http://b.hatena.ne.jp/entrylist/#{req.param('category')}.rss"
  else
    url = "http://b.hatena.ne.jp/entrylist.rss"
  rss2timeline url, {}, (timeline) ->
    _(timeline.bookmarks).each (bookmark) ->
      bookmark.user = new Timeline.User "hatenabookmark"
    res.send timeline

app.get "/:id", (req, res) ->
  url = "http://b.hatena.ne.jp/#{req.params.id}/favorite.rss?with_me=1"
  
  if req.param('until')
    url += "&until=#{req.param('until')}"
  else if offset = req.param('of')
    url += "&of=#{req.param('of')}"

  rss2timeline url, { "Cache-Control" : "no-cache" }, (timeline) ->
    res.send timeline

app.get "/:id/bookmark", (req, res) ->
  offset = req.param('of') ? 0
  # epoch = toEpoch new Date()
  url = "http://b.hatena.ne.jp/#{req.params.id}/rss?of=#{offset}"
  rss2timeline url, { "Cache-Control" : "no-cache" }, (timeline) ->
    res.send timeline

app.listen process.env.PORT || 3000
console.log "Express server listening on port %d in %s mode", app.address().port, app.settings.env
