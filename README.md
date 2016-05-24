# ChatOps Bot for HPE Operations Manager i (OMi)

This is a project to enable OMi practitioners to connect OMi to Slack. This project contains the source code of a NPM package for a Hubot integration.
Currently the integration cover two use cases:

1.	Automatically posting selected OMi events into Slack channels. Users can work on events via chat commands. E.g. escalating events to a trouble ticket system.
2.	Starting custom OMi tools from the chat to investigate or correct failure situations.

Note, this is an open source project. Feel free to fork, contribute or submit issues.

## Installation and setup

### Install a node, npm and generate a hubot 

Download and install node and npm on a Linux system that shall run the OMi bot. Install also the hubot generator:

`npm install -g generator-hubot`

Generate a hubot in a directory of your choice:

`mkdir hubot; cd hubot/`

`yo hubot --owner="you@all.org" --name="omi" --description="OMi bot" --adapter="slack"`

### Install and configure the OMi bot

Download the `github.hpe.com/ChatOps/hubot-integrations` repo on your system. For example into /tmp/

Within the `hubot` directory, add the OMi hubot NPM package:

`npm install /tmp/hubot-integrations/hubot-omi --save`

Then add **hubot-omi** to your `external-scripts.json`:

```json
[
  "hubot-omi"
]
```

Configure the OMi bot. Copy the fesh configuration file into you `hubot directory`

`cp ./node_modules/hubot-omi/omi-conf.json .`

Edit `omi-conf.json` in the `hubot` directory. Ensure that you use an OMi user with little privileges.

```json
{
   "OMiLogin": "chatops_integration_user" ,
   "OMiPassword": "chatops_integration_passwd",
   "OMiHost":  "my.omi.server.fqdn",
   "OMiPort":   80,
   "OMiContextRoot":  "",
   "OMiProtocol": "http",
  "ServiceManagerName": "Service_Manager_Connected_Server_Name_in_OMi"
}
```

### Configure OMi 

Setup event forwarding to your hubot. Create a new connected server in OMi:

•	Target Server: The hubot system FQDN or locahost if your hubot run on your OMi system.

•	CI Type: Management system

•	Integration type: Call external Event Web Service. 

•	URL Pat: /omi/general (this is the bot name and channel)

•	User Name: admin 

•	Port: 8080 – the hubot port is set in an environment variable before starting the bot

Additionally, create an event forwarding rule of your choice.


## Start the OMi bot

If not already done, add a new Hubot integration to your slack team and name it omi, save the TOKEN 

Back on the hubot system. In the hubot directory,

```
export HUBOT_SLACK_TOKEN=xoxb-…
export EXPRESS_PORT=8088
HUBOT_LOG_LEVEL=debug SLACK_LOG_LEVEL=debug  bin/hubot --name omi --adapter slack
```

## Setup tools in OMi 

Create a new tool category for ChatOps so that it is simple to give the ChatOps integration user only access to these tools.

Tool parameter must be named `${1} ${2}` etc. E.g. `ping -c 3 ${1}` 

Here an example for using a ping tool:


**Stefan:** `@omi: omi run putput.deu.hp.com ping devbox.deu.hp.com`

**omi:** `Result:`
```
PING devbox.deu.hp.com (16.57.35.247) 56(84) bytes of data.
64 bytes from devbox.deu.hp.com (16.57.35.247): icmp_seq=1 ttl=64 time=1.98 ms
64 bytes from devbox.deu.hp.com (16.57.35.247): icmp_seq=2 ttl=64 time=0.678 ms
64 bytes from devbox.deu.hp.com (16.57.35.247): icmp_seq=3 ttl=64 time=0.961 ms
64 bytes from devbox.deu.hp.com (16.57.35.247): icmp_seq=4 ttl=64 time=1.72 ms
```

## Usage

`@omi: omi help`

**Escalate an event to the pre-configured incident manager**

Syntax: `omi escalate event [short|long event id]`

Examples:
```
omi escalate event
omi escalate event e1dc
omi escalate event iaa1bde62-e1a4-4676-89b0-0a236fdcb6f8
```

**Run an OMi tool**

Syntax: `omi run [node] [tool] [parameters]`

Examples:
```
omi run db-srv-hr1 df 
omi run batch-srv-hr1 ping db-srv-hr1
```

