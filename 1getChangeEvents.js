/* Dependancies:
npm install open
npm install axios
npm install readline-sync
*/

const open = require('open');
const fs = require('fs');
const axios = require('axios');

var site_root = 'https://api.procore.com/';
var auth_endpoint = 'oauth/authorize';
var token_endpoint = 'oauth/token';
var client_id = 'xxxxxxxxxxxxxxx1234567890ndfkjnvdfjnvdscvsdsdc'; // Update with your ID
var client_secret = 'xxxxxxxxxxxxxxx1234567890ndfkjnvdfjnvdscvsdsdc'; // Update with your Secret
var companyName = "My Company Name"; // Update with your companies name
var companyID;
var dateTime = new Date().toISOString();
var date = new Date().toISOString().slice(0, 10);
var accessToken;
var remainingTime;
var refToken;
var timecards;
var oldDateTime;
var oldDate;

if (!fs.existsSync('appData.json')) { // If there are no old dates stored create 30 day old dates
    var ourDateTime = new Date();
    var pastDateTime = ourDateTime.getDate() - 30;
    ourDateTime.setDate(pastDateTime);
    oldDateTime = ourDateTime;
    oldDate = oldDateTime.toISOString().slice(0, 10);
} else { // Read old date and set variables
    var appData = fs.readFileSync('appData.json');
    let appSettings = JSON.parse(appData);
    oldDateTime = appSettings.lastRunDates.dateTime;
    oldDate = appSettings.lastRunDates.date;
}

function tokenVariables() {
    // Open file and save access token as variable
    var rawdata = fs.readFileSync('token.json');
    let tokenFileData = JSON.parse(rawdata);
    accessToken = tokenFileData.access_token;
    refToken = tokenFileData.refresh_token;
    var expiresIn = tokenFileData.expires_in;
    var createdAt = tokenFileData.created_at;
    var unixTime = Math.floor(new Date() / 1000);
    remainingTime = (createdAt + expiresIn - unixTime);

    if (!fs.existsSync('exports')) { //Create exports folder if doesn't exist
        fs.mkdirSync('exports');
    }
}

// Check time left on access token and refresh if too low
function runQueries() {
    if (remainingTime < 1000) {
        refreshToken();
    } else {
        console.log('Token still has ' + remainingTime + ' seconds until it expires so no need to refresh yet.');
        getCompanies();
    }
}

// Post request to refresh access token
function refreshToken() {
    console.log('Token only has ' + remainingTime + ' seconds left so it will be refreshed.');
    axios.post(site_root + token_endpoint, {
        client_id: client_id,
        client_secret: client_secret,
        refresh_token: refToken,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        grant_type: 'refresh_token'
    })
        .then((res) => {
            //console.log(res.data);
            fs.writeFile("token.json", JSON.stringify(res.data, null, 2), function (err) {
                if (err) {
                    return console.log(err);
                }
                console.log("Token updated and the file was saved succesfully!");
            });
            accessToken = res.data.access_token;
            getCompanies();
        })
        .catch((error) => {
            console.error(error)
        });
}

// Get the company id for the company listed below
function getCompanies() {
    let config = { headers: { 'Authorization': "Bearer " + accessToken } };
    axios.get(site_root + 'vapid/companies', config, {})
        .then((res) => {
            //console.log(res.data);
            var resCompanies = res.data.filter(function (item) {
                return item.name === companyName;
            });
            console.log(resCompanies[0].name + "'s company id is " + resCompanies[0].id);
            companyID = resCompanies[0].id;
            getProjects();
        })
        .catch((error) => {
            console.error(error);
        });
}

// Get the list of all the projects then go through that list getting all the associated Timecards and Change Events
function getProjects() {
    let config = { headers: { 'Authorization': "Bearer " + accessToken } };
    axios.get(site_root + 'vapid/projects?company_id=' + companyID, config, {})
        .then((res) => {
            //console.log(res.data);
            var projData = res.data;
            var i;
            timecards = [];
            for (i = 0; i < projData.length; i++) {
                listTimecards(projData[i], projData.length);
            }
            changeEvents = [];
            for (i = 0; i < projData.length; i++) {
                listChangeEvents(projData[i], projData.length);
            }
        })
        .catch((error) => {
            console.error(error);
        });
}

// Function to get the Timecards for a project and write them to an array. Once all the projects have been queried write to file. 
function listTimecards(projData, projectLength) {
    var projectData = JSON.parse(JSON.stringify(projData));
    var projectID = projData.id;
    let config = { headers: { 'Authorization': "Bearer " + accessToken } };
    axios.get(site_root + 'vapid/timecard_entries?project_id=' + projectID + '&start_date=' + oldDate + '&end_date=' + date, config, {})
        .then((res) => {
            //console.log(res.data);
            projectData.timecards = res.data;
            timecards.push(projectData); // Add to end of array

            if (timecards.length == projectLength) {
                fs.writeFile("exports/TimeCards_" + date + ".json", JSON.stringify(timecards, null, 2), function (err) {
                    if (err) {
                        return console.log(err);
                    }
                    console.log("Timecards file was saved succesfully!");
                });
            }
        })
        .catch((error) => {
            console.error(error);
        });
}

// Function to get the Change Events for a project and write them to an array. Once all the projects have been queried write to file. 
function listChangeEvents(projData, projectLength) {
    var projectData = JSON.parse(JSON.stringify(projData));
    var projectID = projData.id;
    let config = { headers: { 'Authorization': "Bearer " + accessToken } };
    axios.get(site_root + 'vapid/change_events?project_id=' + projectID + '&filters[updated_at]=\"' + oldDateTime + '...' + dateTime + '\"', config, {})
        .then((res) => {
            //console.log(res.data);
            projectData.changeEvents = res.data;
            changeEvents.push(projectData);

            if (changeEvents.length == projectLength) {
                fs.writeFile("exports/ChangeEvents_" + date + ".json", JSON.stringify(changeEvents, null, 2), function (err) {
                    if (err) {
                        return console.log(err);
                    }
                    console.log("ChangeEvents file was saved succesfully!");
                    appDataFile(); // This should be the last thing to run
                });
            }
        })
        .catch((error) => {
            console.error(error);
        });
}

// Updates the app's settings and run data. Must run last. 
function appDataFile() {
    var settingsToAdd;
    settingsToAdd = {
        "lastRunDates": {
            "date": date,
            "dateTime": dateTime
        }
    };

    fs.writeFile("appData.json", JSON.stringify(settingsToAdd, null, 2), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("AppData was saved succesfully!");
    });
}

// Checks to see if we already have the access token data we need. If it doesn't opens up the browser window to get auth code. 
try {
    if (fs.existsSync('token.json')) {
        tokenVariables();
        runQueries();
    } else {
        // Opens up the page that you need to sign into to get the authentication code
        (async () => {
            await open(site_root + auth_endpoint + '?client_id=' + client_id + '&response_type=code&redirect_uri=urn:ietf:wg:oauth:2.0:oob', { app: 'chrome' }); //Update app to match your browser
        })();

        // Asks user to input the displayed authentication code
        var readlineSync = require('readline-sync');
        var AUTH_CODE = readlineSync.question('Enter Code displayed in browser: ');
        //console.log('This is the authentication code: ' + AUTH_CODE);

        // Make post request to get access token
        axios.post(site_root + token_endpoint, {
            client_id: client_id,
            client_secret: client_secret,
            code: AUTH_CODE,
            redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
            grant_type: 'authorization_code'
        })
            .then((res) => {
                console.log(res.data)
                fs.writeFile("token.json", JSON.stringify(res.data, null, 2), function (err) {
                    if (err) {
                        return console.log(err);
                    }
                    console.log("The file was saved!");
                    tokenVariables();
                    runQueries();
                });
            })
            .catch((error) => {
                console.error(error)
            })
    }
} catch (err) {
    console.error(err)
}