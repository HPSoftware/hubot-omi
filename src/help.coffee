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
  msgData =
    channel: msg.message.room
    text:'*Available OMi Commands*'
    attachments:supportCommandsResult
  robot.emit 'slack.attachment', msgData
