Project Name Blue1 – AI-Driven Proactive Urban Mobility

Problem Statement Explain clearly what problem your project is solving.

Urban areas like Kochi and Trivandrum face serious traffic congestion
and safety issues. Current navigation systems only show real-time
traffic but do not predict future congestion.

This leads to:
1.Unexpected traffic jams 
2.Increased travel time 
3.Higher accident risks in certain zones 
4.Poor route planning during peak hours

The problem this project solves is: How to predict traffic conditions in
advance and guide users through safer and more efficient routes.

Project Description Describe your solution, how it works, and what makes
it useful.

Blue1 is a web-based application built using Django that helps users
avoid traffic congestion before it happens.

How it works: 
1.User enters a destination 
2.The system fetches real-time traffic data using Google Maps API 
3.This data is sent to Google Gemini AI 
4.AI analyzes and predicts traffic conditions for the next 30 minutes 
5.The system suggests the best route

Key Features: 
1.Smart route prediction (not just current traffic) 
2.Interactive map with color-coded traffic (Green/Red) 
3.Safety alerts for high-risk accident zones 
4.AI-generated route suggestions

Why it is useful: 
1.Saves time by avoiding future traffic 
2.Improves road safety 
3.Helps better decision-making for commuters

Google AI Usage

Tools / Models Used 
1. Google AI Studio 
2. Gemini 1.5 Flash Model

How Google AI Was Used Explain clearly how AI is integrated into your
project.

1.  Real-time traffic data is collected from Google Maps API
2.  The data along with current time is sent to Gemini AI
3.  Gemini processes the data and predicts:
    a.  Whether traffic will become congested
    b.  Suggested alternative routes
4.  The response is displayed to the user as:
    a.  Traffic prediction (Green/Red)
    b.  Text recommendation

Proof of Google AI Usage

AI Proof Attach screenshots in a /proof folder:

1.  Screenshot of Gemini API request
2.  Screenshot of Gemini API response
3.  Screenshot of prompt used: “You are a Traffic Logistics Expert”

Screenshots Add project screenshots:

1.  Screenshot1: Search Interface
2.  Screenshot2: Predictive Map with traffic colors
3.  Screenshot3: Safety Alert popup
4.  Screenshot4: AI recommendation text

Demo Video Upload your demo video to Google Drive and paste the
shareable link here (max 3 minutes).

Watch Demo:

Installation Steps

Clone the repository

git clone github.com/frk3232/blue12

Go to project folder

cd project-name blue12

Install dependencies

npm install

Run the project

npm start
