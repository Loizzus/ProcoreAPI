## Introduction

This is a connector that connects to the Procore API, authenticates and pulls the required data. 
You will need to [create an account here](https://developers.procore.com/) and get a ClientID and Client Secret. 

## Files

* 1getChangeEvents.js 
    * Gets all the Change Events and Timecards for every project and saves them to JSON files

## How to run

This code is written for node.js. 
First you need to [download and install to your server from here](https://nodejs.org/en/download/).
Then you need to open a Command Prompt / Terminal window and install the dependancies using the following commands:
```console
npm install open
npm install axios
npm install readline-sync
```

Then to run the program navigate to your file and enter the command: 
```console
node 1getChangeEvents.js
```