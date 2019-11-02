'use strict';


const fetch = require("node-fetch");
const {
  dialogflow,
  BasicCard,
  BrowseCarousel,
  BrowseCarouselItem,
  Button,
  Carousel,
  Image,
  LinkOutSuggestion,
  List,
  MediaObject,
  Suggestions,
  SimpleResponse,
  actionsOnGoogle
 } = require('actions-on-google');
 
const functions = require('firebase-functions');
const app = dialogflow({debug: true});
const foundEvents = [];
const eventDateTime = "2019-11-02";

function getFormattedTime(time) {
	let t = new Date(time);
  	let hours = t.getHours() < 12 ? t.getHours() : 12 - t.getHours();
    let tt = t.getHours() <= 12 ? " AM" : " PM";
    return Math.abs(hours) + tt;
}

function createBasicCard(cardModel) {
  return new BasicCard({
    text: cardModel.text,
    subtitle: cardModel.subtitle,
    title: cardModel.title,
    buttons: new Button({
      title: cardModel.buttonTitle,
      url: cardModel.buttonUrl,
    }),
    image: new Image({
      url: cardModel.imageUrl,
      alt: cardModel.imageAlt,
    }),
    display: 'CROPPED',
  });
}

app.intent('welcomeIntent', (conv) => {
    conv.ask(`Welcome to Granite State Code Camp. I'd be glad to give you information on any of the sessions for today, speakers, venue, sponsors. Just ask!`);
});

app.intent('eventLocationIntent', (conv) => {
  
    return fetch("https://granitestatecodecamp-api.azurewebsites.net/api/eventInfo")
    .then((response) => response.json())
    .then((eventInfo) => {
      
      conv.ask("Here's the location of the event");
      conv.ask(createBasicCard({
        text: "www.mcc.edu",
        subtitle: "1066 Front St. Manchester, NH 03102",
        title: "Manchester Community College",
        buttonTitle: "Click to go Map",
        buttonUrl: "http://granitestatecodecamp.org",
        imageUrl: "https://maps.googleapis.com/maps/api/staticmap?center=1066%20Front%20St.%20Manchester,%20NH,%2003102&zoom=15&size=400x400&markers=color:blue%7Clabel:S%7C11211%7C11206%7C11222&key=AIzaSyDBZUFT6BR8N-E3bNOITwD1Oq0LEDViVhY",
        imageAlt: "event map"
      }));
    });
});

app.intent('currentSessionIntent', (conv) => {
  
    return fetch("https://granitestatecodecamp-api.azurewebsites.net/api/schedule")
    .then((response) => response.json())
    .then((sessionsList) => {

        foundEvents = sessionsList.scheduleEvents;
        
        if (foundEvents.length === 0) {
            conv.ask('There are no sessions going on at this hour.'); 
        }
        else {
            if (foundEvents.length == 1) {
                conv.ask(`There is only one session currently going on. Here's the information`);
                const singleSession = foundEvents[0];

                conv.ask(createBasicCard({
                    text: getFormattedTime(singleSession.startTime) +  " / " + singleSession.roomInfo,
                    subtitle: 'by ' + speakerName,
                    title: singleSession.title,
                    buttonTitle: "Click to go to the website",
                    buttonUrl: "http://granitestatecodecamp.org/sessions",
                    imageUrl: singleSession.presenter.pic,
                    imageAlt: speakerName
                }));
            }
            else {
                conv.ask(`There are ${foundEvents.length} sessions going on right now. Here is some info about them.`);
                conv.ask(new List({
                    title: 'Ongoing Sessions',
                    items: getSessionsListItems(foundEvents[1].events)
                }));
            }
        }
    });
});

app.intent('sessionFromSpeaker', (conv, {speakerName}) => {
    return fetch("https://granitestatecodecamp-api.azurewebsites.net/api/schedule")
    .then((response) => response.json())
    .then((sessionsList) => {

        let sessionsCount = [];
        foundEvents = sessionsList.scheduleEvents;
        
        foundEvents.forEach((scheduledEvent) => {
            scheduledEvent.events.forEach((event) => {
                if (event.eventType !== "serviceSession"){
                    if (event.presenter.name === speakerName) {
                        sessionsCount.push(event);
                    }
                }
            });
        });

      	if (sessionsCount.length === 0) {
          conv.ask(`I couldn't find a session from ${speakerName}. Want to check for sessions from another speaker?`);
        }
      	else if (sessionsCount.length === 1) {
            const singleSession = sessionsCount[0];

            conv.ask(`There is one session from ${speakerName}. Here's the information`);
            conv.ask(createBasicCard({
                text: getFormattedTime(singleSession.startTime) +  " / " + singleSession.roomInfo,
                subtitle: 'by ' + speakerName,
                title: singleSession.title,
                buttonTitle: "Click to go to the website",
                buttonUrl: "http://granitestatecodecamp.org/sessions",
                imageUrl: singleSession.presenter.pic,
                imageAlt: speakerName
            }));
        }
      	else {
          conv.ask(`There are ${sessionsCount.length} sessions from ${speakerName}`);
          conv.ask(new List({
                      title: 'Sessions from ' + speakerName,
                      items: getSessionsListItems(sessionsCount)
                  }));
        }
    });
});

app.intent('hourlySessionsIntent', (conv) => {
    let t = conv.parameters.time;
    let time = eventDateTime;
    let hours = t.split("T")[1].split("-")[0];
    let reformattedDate = time + " " + hours;

    return fetch("https://granitestatecodecamp-api.azurewebsites.net/api/schedule")
    .then((response) => response.json())
    .then((sessionsList) => {

        let sessionsCount = [];
        foundEvents = sessionsList.scheduleEvents;
        
        foundEvents.forEach((scheduledEvent) => {

            if (scheduledEvent.time === reformattedDate) {
                sessionsCount = scheduledEvent.events;
            }
        });

      	const formattedTime = getFormattedTime(reformattedDate);
      	if (sessionsCount.length === 0) {
          conv.ask(`I couldn't find a session at ${formattedTime}. Want to check for sessions in another time slot?`);
        }
      	else if (sessionsCount.length === 1) {
          conv.ask(`There is only one single session at ${formattedTime}. Here's the information`);
        }
      	else {
          conv.ask(`There are ${sessionsCount.length} sessions at ${getFormattedTime(reformattedDate)}`);
          conv.ask(new List({
                      title: 'Sessions at ' + formattedTime,
                      items: getSessionsListItems(sessionsCount)
                  }));
        }
    });
});

function getSessionsListItems(events) {

    let eventItems = {};
    events.forEach((item, index) => {
      	if (item.eventType !== "serviceSession") {
          eventItems[item.id] = {
            title: item.title,
            description: 'by ' + item.presenter.name + " / " + item.presenter.title + getFormattedTime(item.startTime) + " / " + item.roomInfo,
            image: new Image({
              url: item.presenter.pic,
              alt: item.presenter.name,
            }),
          };
    	}
    });

    return eventItems;
}

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);