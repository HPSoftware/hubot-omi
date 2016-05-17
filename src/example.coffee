# Description
#   A hubot script that connects HPE OMi
#
# Configuration:
#   LIST_OF_ENV_VARS_TO_SET
#
# Commands:
#   hubot hello - <what the respond trigger does>
#   orly - <what the hear trigger does>
#
# Notes:
#   <optional notes required for the script>
#
# Author:
#   Stefan Bergstein <stefan.bergstein@hpe.com>

module.exports = (robot) ->
  robot.respond /hello/, (res) ->
    res.reply "Hello, how are you?"
