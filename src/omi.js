/*
 * Copyright 2016 Hewlett-Packard Development Company, L.P.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * Software distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and limitations under the License.
 */


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
  var OMiLogin       = config.OMiLogin,
      OMiPassword    = config.OMiPassword,
      OMiHost        = config.OMiHost,
      OMiPort        = config.OMiPort,
      OMiContextRoot = config.OMiContextRoot,
      OMiProtocol    = config.OMiProtocol,
      RunCmdsChannels = config.RunCmdsChannels,
      ServiceManagerName = config.ServiceManagerName;

  /* ------------ GLOBALS ------------ */
  var omiCookies        = '',
      secureModifyToken = '',
      http              = Http,
      eventIDs          = [],  // cache for event IDs
      maxIDs            = 100;


  /* ------------ CHAT HANDLERS IMPLEMENTATION ------------ */

  var chatHandlerEscal = function(res) {
    var eventID = res.match[1];
    var foundIDs = [];

    // first check ii an ID was submitted, if not try to use last.
    if (eventID == null || eventID == "")  { // No ID in command
      if (eventIDs.length > 0) { // some ID in cache
        OMiBot.logger.info('No eventID'+ JSON.stringify(res.match + " .. try use last EventID "));
        eventID = eventIDs[eventIDs.length-1].id;
      } else { // no ID is the cache .. too bad
        OMiBot.logger.info('No eventID submitted '+ JSON.stringify(res.match + " .. and no last event "));
        res.reply("No last event ID found. Please enter the full ID");
      }
    } else { // some 'short' ID, was submitted ... good.
      OMiBot.logger.info('ID:'+ JSON.stringify(res.match));
      foundIDs = [];
      // Search for the right full ID
      var index, len;
      for (index = 0, len = eventIDs.length; index < len; ++index) {
        if (eventIDs[index].id != undefined) {
          if (eventID === eventIDs[index].id.substring(0,eventID.length)) {
            OMiBot.logger.info("ID:" + index + " found " + eventIDs[index].id);
            foundIDs.push(eventIDs[index].id);
          }
        }
      }

      if (foundIDs.length == 0  ) {
        // OMiBot.logger.info("No full ID found for the short ID. Please try to use the full ID");
        res.reply("No full ID found for the short ID. Please try to use the full ID");
      } else if (foundIDs.length > 1 ) {
        // OMiBot.logger.info("Duplicate long IDs found for the short ID. Please enter the full ID");
        res.reply("Duplicate long IDs found for the short ID. Please enter the full ID");
      } else {
        OMiBot.logger.info("Found ID: " + foundIDs[0]);
        eventID = foundIDs[0];
      }
    }

    // Call the OMi REST WS for transfer control if thwere is a eventID
    if (eventID != null && eventID != "") {
      var body = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?> \
          <event xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" \
          xmlns="http://www.hp.com/2009/software/opr/data_model" relationships_included="true" \
          type="urn:x-hp:2009:software:data_model:opr:type:event" version="1.3"> \
          <control_transferred_to type="urn:x-hp:2009:software:data_model:opr:type:control_transfer_info" version="1.2">\
            <name>' +  ServiceManagerName +  '</name>\
          </control_transferred_to>\
          </event>';

      OMiRestCall(
        {path: '/opr-web/rest/event_list/'+eventID, method: 'PUT', body: body}, function(err, result) {
          if (err) {
            res.reply('Could not esaclate event ' + eventID);
          } else {
            res.reply("Event escalated to " + ServiceManagerName);
          }
        }
      );
    } else {
      OMiBot.logger.info("No valid ID found in cache");
    }
  }; // end: chatHandlerEscal


  /* ------------ HTTP SERVER ROUTERS IMPLEMENTATION ------------ */
  var eventHandler = function eventHandler(req, res) {
    parseString(
      req.rawBody, function(err, event) {
  	    // OMiBot.logger.info(event);
        // Save the event ID for further commands
        event = event.event;
        if (event.id != undefined && event.id != null)
        {
          // Use an array because we might want to keep other attributes
          eventIDs.push({ 'id': event.id[0] });
          OMiBot.logger.info("Added event ID to chache" + event.id[0]);
          if (eventIDs.length > maxIDs) eventIDs.shift();
        }

        var room   = req.params.channel;
        OMiBot.logger.info("room: " + room);
        var result = '';
        var color, fallback, fields, room, title;

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
          }, {
            title: 'Short ID',
            value: event.id[0].substring(0,4),
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


  var chatHandlerTool = function(res) {

    // Check if it is allowed to use run command in this room/channel
    // If RunCmdsChannels not defined, allow all
    if (undefined !== config.RunCmdsChannels && config.RunCmdsChannels.length > 0) {
      var matchFound = false;
      for (var i = 0, l = config.RunCmdsChannels.length; i < l; i++) {
        OMiBot.logger.debug("Check restrictedChannel"+ config.RunCmdsChannels[i])

        if (res.message.room.match(config.RunCmdsChannels[i])) {
          OMiBot.logger.debug("Match:" +  config.RunCmdsChannels[i]);
          matchFound = true;
          break;
        } else {
          OMiBot.logger.debug("NO Match:" +  config.RunCmdsChannels[i]);
          matchFound = false;
        }
      }
      if ( ! matchFound ) {
        res.send('run command not allowed in this channel: ' + res.message.room);
        return;
      }
    }

    // Slack creates URL from hostname. Remove these here
    var nodeName = res.match[1].trim().replace('http://', '').replace('https://', '');
    var toolName = res.match[2].trim().replace(/\"/g , '');
    var toolParameters = [];

    if ( res.match.length >= 3 ) {
      toolParameters = res.match[3].trim().split(/\s+/);
    }

    OMiBot.logger.debug('MATCH:' + JSON.stringify(res.match));
    res.send('Executing tool on ' + nodeName + ' ...');

    function getConvertNodeToCiID() {
      OMiRestCall(
        {path: '/opr-config-server/rest/node?nodeNames=' + nodeName, method: 'GET'}, function(err, result) {
          parseString(
            result, {explicitArray: false}, function(err, response) {
              OMiBot.logger.debug('NODES:' + JSON.stringify(response.list_nodes.nodes.node.id));
              var testCiId = response.list_nodes.nodes.node.id;
              // res.send('CI has following ID: ' + testCiId);
              getTools({ciId: testCiId});
            }
          );
        }
      );
    }

    function getTools(options) {
      var body = '<tool_query xmlns="http://www.hp.com/2009/software/opr/data_model" xmlns:xs="http://www.w3.org/2001/XMLSchema">\                                                                                                                        \
        <ci_ids>\
        <ci_id>' + options.ciId + '</ci_id>\
        </ci_ids>\
      </tool_query>';
      OMiRestCall(
        {path: '/opr-web/rest/10.11/tool_execution/', method: 'POST', body: body}, function(err, result) {
          /*
           <tool_list xmlns="http://www.hp.com/2009/software/opr/data_model" xmlns:xs="http://www.w3.org/2001/XMLSchema">
           <id>ce027607-8e8b-4a59-99f8-e84f57a70fcb</id>
           <tools_for_ci>
           <tool_ref>
           <id>8f417085-260d-467f-b714-b88bc0196263</id>
           <target_id>8f417085-260d-467f-b714-b88bc0196263</target_id>
           <label>ping</label>
           <description></description>
           <tool_type>om_agent_command</tool_type>
           <has_user_parameter>false</has_user_parameter>
           <requires_run_as_user>false</requires_run_as_user>
           <name>ping</name>
           <ci_type>configuration_item</ci_type>
           </tool_ref>
           </tools_for_ci>
           </tool_list>

           NODES:{"tool_list":{"$":{"xmlns":"http://www.hp.com/2009/software/opr/data_model","xmlns:xs":"http://www.w3.org/2001/XMLSchema"},"id":"ce027607-8e8b-4
           a59-99f8-e84f57a70fcb","tools_for_ci":{"tool_ref":{"id":"8f417085-260d-467f-b714-b88bc0196263","target_id":"8f417085-260d-467f-b714-b88bc0196263","lab
           el":"ping","description":"","tool_type":"om_agent_command","has_user_parameter":"false","requires_run_as_user":"false","name":"ping","ci_type":"config
           uration_item"}}}}

           */
          parseString(
            result, {explicitArray: false}, function(err, response) {
              if (!Array.isArray(response.tool_list.tools_for_ci.tool_ref)) {
                response.tool_list.tools_for_ci.tool_ref = [response.tool_list.tools_for_ci.tool_ref];
              }
              var toolId, toolNames = [];

              _.each(
                response.tool_list.tools_for_ci.tool_ref, function(tool) {
                  if (tool.label === toolName) {
                    toolId = tool.id;
                  }
                  toolNames.push(tool.label);
                }
              );

              if (!toolId) {
                return res.send(
                  'I\'m sorry, but it looks like "' + nodeName + '" has no tool called "' + toolName + '".\nAvailable tools are: ' + toolNames.join(
                    '\n'
                  )
                );
              }

              //res.send('Found following: ' + response.tool_list.tools_for_ci.tool_ref[0].label);
              prepare({ciId: options.ciId, toolId: toolId})
            }
          );
        }
      );
    }

    function prepare(options) {

      var body = '<tool_preparation xmlns="http://www.hp.com/2009/software/opr/data_model" xmlns:xs="http://www.w3.org/2001/XMLSchema">\ \
         <tool_id>' + options.toolId + '</tool_id>\
        <ci_ids>\
        <ci_id>' + options.ciId + '</ci_id>\
        </ci_ids>\
        <ci_origin>ci</ci_origin></tool_preparation>';


      OMiRestCall(
        {path: '/opr-web/rest/10.11/tool_execution/preparation', method: 'POST', body: body}, function(err, result) {
          /*
           BODY: <tool_execution_context xmlns="http://www.hp.com/2009/software/opr/data_model" xmlns:xs="http://www.w3.org/2001/XM
           LSchema">
           <id>ed80dbc8-feca-4130-8521-d504604d34e6</id>
           <tool_ref>
           <id>43ba90bc-eec6-43d1-9987-54b848c182be</id>
           <target_id>43ba90bc-eec6-43d1-9987-54b848c182be</target_id>
           <label>ping</label>
           <description></description>
           <tool_type>om_agent_command</tool_type>
           <has_user_parameter>false</has_user_parameter>
           <requires_run_as_user>false</requires_run_as_user>
           <name>ping</name>
           <ci_type>unix</ci_type>
           </tool_ref>
           <user_parameters/>
           <tool_execution_result_ref>
           <id>89dad455-90d4-40f2-b75c-9a17251489d4</id>
           <execution_host>srv1.example.com</execution_host>
           <tool_command>ping mambo8.mambo.net</tool_command>
           <tool_execution_state>not_started</tool_execution_state>
           </tool_execution_result_ref>
           </tool_execution_context>
           */
          parseString(
            result, {explicitArray: false}, function(err, response) {
              OMiBot.logger.debug('CONTEXT1:' + JSON.stringify(response));
              var executionContextId = response.tool_execution_context.id,
                  parameters         = [];
              //res.send('Tool execution has the context id: ' + executionContextId);
              if (response.tool_execution_context.user_parameters) {
                if (!Array.isArray(response.tool_execution_context.user_parameters)) {
                  response.tool_execution_context.user_parameters = [response.tool_execution_context.user_parameters];
                }
                parameters = response.tool_execution_context.user_parameters;
              }
              execute({executionContextId: executionContextId, parameters: parameters})
            }
          );

        }
      );
    }

    function execute(options) {

      // Squeeze in the parameters from the chat command as ${1}, ${2}, ... regardless what is define in the tool.
      var toolParametersXML = '<has_user_parameter>false</has_user_parameter>';
      if (toolParameters.length > 0) {
       toolParametersXML = '<has_user_parameter>true</has_user_parameter><user_parameters>';
       var i,l;
       for (i = 0, l = toolParameters.length; i < l; ++i) {
         var k = i+1;
         toolParametersXML = toolParametersXML + '<entry><key>' + k  + '</key><value>'
         + toolParameters[i].trim().replace('http://', '').replace('https://', '') + '</value></entry>';
      }
        toolParametersXML = toolParametersXML + '</user_parameters>';
      }

      var body = '<tool_execution xmlns="http://www.hp.com/2009/software/opr/data_model" xmlns:xs="http://www.w3.org/2001/XMLSchema">'
                 + toolParametersXML + '</tool_execution>';

      options.method = options.method || 'POST';
      OMiRestCall(
        {
          path: '/opr-web/rest/10.11/tool_execution/execution/' + options.executionContextId,
          method: options.method,
          body: body
        }, function(err, result) {
          /*
           BODY: <tool_execution_context xmlns="http://www.hp.com/2009/software/opr/data_model" xmlns:xs="http://www.w3.org/2001/XM
           LSchema">
           <id>1a58b455-36b6-4649-ac94-d108938e193f</id>
           <tool_ref>
           <id>43ba90bc-eec6-43d1-9987-54b848c182be</id>
           <target_id>43ba90bc-eec6-43d1-9987-54b848c182be</target_id>
           <label>ping</label>
           <description></description>
           <tool_type>om_agent_command</tool_type>
           <has_user_parameter>false</has_user_parameter>
           <requires_run_as_user>false</requires_run_as_user>
           <name>ping</name>
           <ci_type>unix</ci_type>
           </tool_ref>
           <user_parameters/>
           <run_as_username>$AGENT_USER</run_as_username>
           <tool_execution_result_ref>
           <id>8b106e9a-b445-4cb4-aa44-c0c6c55c45a1</id>
           <execution_host>srv1.example.com</execution_host>
           <tool_command>ping mambo8.mambo.net</tool_command>
           <tool_execution_state>pending</tool_execution_state>
           </tool_execution_result_ref>
           </tool_execution_context>
           */
          parseString(
            result, {explicitArray: false}, function(err, response) {
              OMiBot.logger.debug('CONTEXT2:' + JSON.stringify(response));
              var state = response.tool_execution_context.tool_execution_result_ref.tool_execution_state;
              //res.send('Execution state: ' + state);
              switch (state) {
                case 'pending':
                case 'running':
                  options.method = 'GET';
                  setTimeout(
                    function() {
                      execute(options)
                    }, 2000
                  );
                  break;
                case 'finished':
                case 'failed':
                  return results(
                    {
                      executionContextId: options.executionContextId,
                      resultId: response.tool_execution_context.tool_execution_result_ref.id
                    }
                  );
                  break;
                default:
                  res.send(
                    'Execution returned the status "' + state + '". I don\'t know how to handle it!'
                  );
                  break;
              }
            }
          );

        }
      );
    }

    function results(options) {
      OMiRestCall(
        {
          path: '/opr-web/rest/10.11/tool_execution/execution/' + options.executionContextId + '/' + options.resultId,
          method: 'GET',
        }, function(err, result) {
          /*
           <tool_execution_result xmlns="http://www.hp.com/2009/software/opr/data_model" xmlns:xs="http://www.w3.org/2001/XMLSchema">
           <id>5b887350-be71-48b1-8026-a04a38202c6c</id>
           <tool_ref>
           <id>d00a4cdd-4ab6-4279-a438-809fff33c565</id>
           <target_id>d00a4cdd-4ab6-4279-a438-809fff33c565</target_id>
           <label>ping</label>
           <description></description>
           <tool_type>om_agent_command</tool_type>
           <has_user_parameter>false</has_user_parameter>
           <requires_run_as_user>false</requires_run_as_user>
           <name>ping</name>
           <ci_type>configuration_item</ci_type>
           </tool_ref>
           <execution_host>mambo8.mambo.net</execution_host>
           <tool_command>ping -n 4</tool_command>
           <user_parameters/>
           <run_as_username>$AGENT_USER</run_as_username>
           <tool_execution_state>failed</tool_execution_state>
           <started>2016-05-20T13:29:58.362+02:00</started>
           <started_text>01:29:58 PM</started_text>
           <finished>2016-05-20T13:30:00.364+02:00</finished>
           <finished_text>01:30:00 PM</finished_text>
           <executed_in_context_of>
           <entry>
           <key>7477f30628adb33cc4e7074d6397a645</key>
           <value>mambo8</value>
           </entry>
           </executed_in_context_of>
           <output>IP address must be specified.
           </output>
           <result_code>1</result_code>
           </tool_execution_result>
           */
          parseString(
            result, {explicitArray: false}, function(err, response) {
              OMiBot.logger.debug('RESULT:' + JSON.stringify(response));
              var result = 'Your request ';
              if (response.tool_execution_result.tool_execution_state === 'failed') {
                result += 'failed with code ' + response.tool_execution_result.result_code + '.';
              } else {
                result += 'finished successfully.';
              }
              result += '\nResult:\n```' + response.tool_execution_result.output + '```';
              res.send(result);
            }
          );
        }
      );
    }
    getConvertNodeToCiID();
  }; // end: chatHandlerTool


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
                  OMiBot.logger.info(
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
        OMiBot.logger.info('Error: unable to authenticate with OMi ' + OMiHost + ':' + OMiPort + '. Message: ' + error);
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
        };
    if (options.body && options.method !== 'GET') {
      requestOptions.headers['Content-Type'] = 'text/xml';
      requestOptions.headers['Content-Length'] =  Buffer.byteLength(options.body);
    }
    var  result         = '',
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
                    OMiBot.logger.info(
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
        OMiBot.logger.info(
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

  OMiBot.respond(/omi\s+escalate\s+event\s*(\S*)/i, chatHandlerEscal);

  OMiBot.respond(/omi\s+run\s+(\S+)\s+(".*")+(.*)$/i, chatHandlerTool);
  OMiBot.respond(/omi\s+run\s+(\S+)\s+([a-zA-Z]+)(.*)$/i, chatHandlerTool);


  /* ------------ HTTP SERVER ROUTERS ------------ */
  OMiBot.router.post('/omibot/:channel/event', rawbody, eventHandler);
  OMiBot.router.post('/omibot/:channel/event_change/:id', rawbody, eventChangeHandler);
  OMiBot.router.post('/omibot/:channel/event_change', rawbody, eventHandler);
  OMiBot.router.get('/omibot/:channel', eventConnectHandler);

  OMiAuthenticate();
};
