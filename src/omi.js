"use strict";

module.exports = function(OMiBot) {

  /* ------------ DEPENDENCIES ------------ */
  var rawbody      = require('express-rawbody'),
      xmlparser    = require('express-xml-bodyparser'),
      parseString  = require('xml2js').parseString,
      Http         = require('http'),
      Https        = require('https'),
      _            = require('lodash'),
      cookieParser = require('cookie').parse,
      config       = require('config.json')('./omi-conf.json');


  /* ------------ CONFIGURATION ------------ */
  console.log("OMiHost:", config.OMiHost);
  var OMiLogin       = config.OMiLogin,
      OMiPassword    = config.OMiPassword,
      OMiHost        = config.OMiHost,
      OMiPort        = config.OMiPort,
      OMiContextRoot = config.OMiContextRoot,
      OMiProtocol    = config.OMiProtocol;

  /* ------------ GLOBALS ------------ */
  var omiCookies        = '',
      secureModifyToken = '',
      http              = Http;


  /* ------------ CHAT HANDLERS IMPLEMENTATION ------------ */
  var chatHandlerHug = function(res) {
    return res.send("Come here and get a free hug!");
  }; // end: chatHandlerHug


  /* ------------ HTTP SERVER ROUTERS IMPLEMENTATION ------------ */
  var eventHandler = function eventHandler(req, res) {
    parseString(
      req.rawBody, function(err, event) {
  	    // console.log(event);
        var room   = req.params.channel;
        console.log("room: " + room);
        var result = '';
        var color, fallback, fields, room, title;
        event = event.event;
        color = "#808080";
        switch (event.severity[0]) {
          case 'unknown':
            color = "#808080"; break;
          case 'normal':
            color = "#00FF00"; break;
          case 'minor':
            color = "#FFFF00"; break;
          case 'warning':
            color = "#00ffff"; break;
          case 'major':
            color = "#ff9900"; break;
          case 'normal':
            color = "good"; break;
          case 'critical':
            color = "#FF0000"; break;
          default:
            color = "#808080";
        }

        var cat = "";
        if (event.category != undefined && event.category != null)
        {
          cat = event.category[0];
        }

        var node = "";
        if (event.node_ref != undefined && event.node_ref != null &&
            event.node_ref[0].node != undefined && event.node_ref[0].node != null &&
            event.node_ref[0].node[0].display_label != undefined
        	  && event.node_ref[0].node[0].display_label != null )
        {
        	node = event.node_ref[0].node[0].display_label[0]
        }

        fields = [
          {
            title: 'Receive Time',
            value: event.time_received[0],
            short: true
          }, {
            title: 'Node',
            value: node,
            short: true
          }, {
            title: 'Category',
            value: cat,
            short: true
          }, {
            title: 'Priority',
            value: event.priority[0],
            short: true
          }
        ];
        fallback = event.severity[0] + " : " + node + " : " + event.title[0];
        title = "New " + event.severity[0] + " event on " + node;
        OMiBot.emit('slack-attachment', {
          message: {
            room: room,
            username: 'omi'
          },
          content: {
            title: title,
            title_link: event.drilldown_url[0],
            text: event.title[0],
            color: color,
            pretext: '',
            fallback: fallback,
            fields: fields
          }
        });

        res.setHeader('content-type', 'application/xml');
        return res.send(req.rawBody); // Why to send that back?

      } // req.rawBody
    );  // parseString
  }; // end: eventHandler

  var eventChangeHandler = function eventChangeHandler(req, res) {
    parseString(
      req.rawBody, function(err, event) {
        var room   = req.params.channel,
            result = '';

        event = event.event_change;

        result = 'The following event changed: ' + event.id;

        OMiBot.messageRoom(room, result);
        res.setHeader('content-type', 'application/xml');
        return res.send(req.rawBody);
      }
    );
  }; // end: eventChangeHandler

  var eventConnectHandler = function eventConnectHandler(req, res) {
    // handler to allow setup as event forwarding receiver
    return res.send('OK');
  }; // end: eventConnectHandler

  /* ------------ INIT ------------ */

  function OMiAuthenticate(callback) {
    var auth = 'Basic ' + new Buffer(OMiLogin + ':' + OMiPassword).toString('base64');

    var options = {
          host: OMiHost,
          port: OMiPort,
          path: OMiContextRoot + '/opr-web/rest',
          method: 'GET',
          headers: {
            Authorization: auth
          }
        },

        request = http.request(
          options, function(res) {
            if (res.statusCode !== 200) {
              res.on(
                'data', function(chunk) {
                  console.log(
                    'Error: unable to authenticate with OMi ' + OMiHost + ':' + OMiPort + '. Status: ' + res.statusCode + '. Server reply:' + chunk
                  );
                }
              );
              if (callback instanceof Function) {
                return callback(true);
              }
              return;
            }

            _.each(
              res.headers['set-cookie'], function(cookie) {
                var c = cookieParser(cookie);

                if ('JSESSIONID' in c) {
                  omiCookies += ' JSESSIONID=' + c.JSESSIONID + ';';
                }
                if ('LWSSO_COOKIE_KEY' in c) {
                  omiCookies += ' LWSSO_COOKIE_KEY=' + c.LWSSO_COOKIE_KEY + ';';
                }
                if ('secureModifyToken' in c) {
                  secureModifyToken = c.secureModifyToken;
                }
              }
            );

            if (callback instanceof Function) {
              return callback(null, true);
            }
          }
        );
    request.on(
      'error', function(error) {
        console.log('Error: unable to authenticate with OMi ' + OMiHost + ':' + OMiPort + '. Message: ' + error);
        if (callback instanceof Function) {
          return callback(true);
        }
      }
    );
    request.end();
  } // end: OMiAuthenticate

  function OMiRestCall(options, callback) {
    var requestOptions = {
          host: OMiHost,
          port: OMiPort,
          path: OMiContextRoot + options.path,
          method: options.method,
          headers: {
            Cookie: omiCookies,
            'X-Secure-Modify-Token': secureModifyToken
          }
        },
        result         = '',
        request        = http.request(
          requestOptions, function(res) {

            switch (res.statusCode) {
              case 200:
                // everything is OK, return body request
                res.setEncoding('utf8');
                res.on(
                  'data', function(chunk) {
                    result += chunk;
                  }
                );
                res.on(
                  'end', () => {
                    if (callback instanceof Function) {
                      return callback(null, result);
                    }
                  }
                );
                break;
              case 401:
                // not authorized, authenticate and retry request
                return OMiAuthenticate(
                  function(err) {
                    if (err) {
                      if (callback instanceof Function) {
                        return callback(true);
                      }
                      return;
                    }
                    return OMiRestCall(options, callback);
                  }
                );
                break;
              default:
                // error
                res.on(
                  'data', function(chunk) {
                    console.log(
                      'Error: unable to send request to OMi ' + requestOptions.path, 'Status: ' + res.statusCode,
                      'Server reply:' + chunk, 'Body:' + options.body
                    );
                    if (callback instanceof Function) {
                      return callback(true);
                    }
                  }
                );
                break;
            }
          }
        );
    request.on(
      'error', function(error) {
        console.log(
          'Error: unable to send request to OMi ' + requestOptions.path, 'Message: ' + error,
          'Body:' + options.body
        );
        if (callback instanceof Function) {
          return callback(true);
        }
      }
    );
    if (options.body && options.method !== 'GET') {
      request.write(options.body);
    }
    request.end();
  }

  /* ------------ INIT ------------ */
  if (OMiProtocol === 'https') {
    http = Https;
  }

  /* ------------ CHAT HANDLERS ------------ */
  OMiBot.hear(/hug/i, chatHandlerHug);

  /* ------------ HTTP SERVER ROUTERS ------------ */
  OMiBot.router.post('/omibot/:channel/event', rawbody, eventHandler);
  OMiBot.router.post('/omibot/:channel/event_change/:id', rawbody, eventChangeHandler);
  OMiBot.router.post('/omibot/:channel/event_change', rawbody, eventHandler);
  OMiBot.router.get('/omibot/:channel', eventConnectHandler);

  OMiAuthenticate();
};
