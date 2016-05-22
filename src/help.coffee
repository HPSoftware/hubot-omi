###
Copyright 2016 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
Software distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License. 
###


supportCommandsResult = []

OMihelp = {
    "help_commands":{
        "Escalate event": {
                "Description": "Escalate an event to the pre-configured incident manager. ",
                "Syntax": "omi escalate event [short|long event id]",
                "Examples": "omi escalate event\nomi escalate event e1dc\nomi escalate event iaa1bde62-e1a4-4676-89b0-0a236fdcb6f8"
        },
        "Run tool": {
                "Description": "Run an OMi tool",
                "Syntax": "omi run [node] [tool] [parameters]",
                "Examples":"omi run db-srv-hr1 df \nomi run batch-srv-hr1 ping db-srv-hr1"
        }
    }
}

module.exports = (robot) ->
  loadOMiSupportCommands robot

  #   Generates OMi support comands.
  robot.respond /omi\s+help/i, (msg) ->
    getOMiHelpSupport robot,msg

########################################################################################
#  Load OMi Support Commands
########################################################################################

loadOMiSupportCommands = (robot) ->
  allHelpCommands = OMihelp["help_commands"]

  fieldsResult = []
  supportCommandsResult = []
  for key of allHelpCommands
    commandObi = allHelpCommands[key]
    Description = {}
    Description['title'] = "Description :"
    Description['value']=commandObi["Description"]
    fieldsResult.push Description

    Syntax = {}
    Syntax['title'] = "Syntax :"
    Syntax['value']=commandObi["Syntax"]
    fieldsResult.push Syntax

    Examples = {}
    Examples['title'] = "Examples :"
    Examples['value']=commandObi["Examples"]
    fieldsResult.push Examples

    attachment =
      color:'#0000FF'
      fields: fieldsResult
    fieldsResult = []
    supportCommandsResult.push(attachment)

########################################################################################
#  get OMi Help Support
########################################################################################

getOMiHelpSupport = (robot,msg) ->
  if robot.adapterName is 'slack'
    msgData =
      channel: msg.message.room
      text:'*Available OMiii Commands*'
      attachments:supportCommandsResult
    robot.emit 'slack.attachment', msgData
  else
    robot.reply "Sorry. No help for this adapter"
