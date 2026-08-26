# NBSC Timetable

## General Overview

This is a custom timetable website I made to make viewing my school timetable easier and more useful than using the standard school timetable interface.

The main reason I made it was because I wanted more control over how my timetable looked and worked. I wanted things like subject colours, a cleaner layout, dark mode, mobile support and information about the current and upcoming lessons.

Rather than manually creating the timetable, the website pulls my actual timetable data from the school's system and turns it into the custom interface.

The website is split into two parts:

```text
GitHub Pages / Frontend
        ↓
     Vercel
        ↓
School API
```

The frontend is hosted on GitHub Pages, while Vercel is used as a secure server-side layer for authentication and obtaining a fresh JWT.

---

# What It Can Do

Currently, the website can:

* Display my school timetable in a custom layout
* Automatically pull timetable information from the school's API
* Authenticate with the school API without exposing my school password
* Automatically obtain a fresh JWT when the existing JWT expires
* Show subjects, teachers, rooms and lesson times
* Organise lessons into the correct days and periods
* Highlight the current/upcoming lesson
* Use different colours for each subject
* Display coloured outlines around timetable cards
* Switch between light and dark mode
* Work on both desktop and mobile
* Adjust the layout depending on the screen size
* Provide settings for changing parts of the interface
* Store and use custom subject colour settings

The main idea is that the school system handles the actual timetable data, Vercel handles authentication, and the frontend controls how the timetable is presented.

---

# How Authentication Works

The school API requires a JWT (JSON Web Token) to access timetable information.

The JWT should **not** be hard-coded permanently into the public GitHub Pages website because JWTs expire.

Instead, the authentication process is handled through Vercel.

The overall process is:

```text
User opens website
        ↓
Frontend requests timetable data
        ↓
Frontend contacts Vercel endpoint
        ↓
Vercel checks whether its JWT is still valid
        ↓
        ├── JWT valid
        │      ↓
        │   Use existing JWT
        │
        └── JWT expired
               ↓
        Vercel authenticates with school API
               ↓
        School API returns new JWT
               ↓
        Vercel uses new JWT
        ↓
Vercel requests timetable data
        ↓
Timetable JSON returned to frontend
        ↓
Website displays timetable
```

This means the frontend does not need to know my school password.

---

# Vercel Authentication Endpoint

Vercel provides a server-side endpoint that contains the school authentication details as environment variables.

The important values are stored on Vercel rather than inside the public GitHub repository:

```text
SCHOOL_EMAIL
SCHOOL_PASSWORD
SCHOOL_API_BASE
```

The server uses these values to authenticate with the school's API.

Conceptually, the authentication request looks like:

```http
POST /token

Content-Type: application/json
Accept: application/json
```

with:

```json
{
    "emailAddress": "MY_SCHOOL_EMAIL",
    "password": "MY_SCHOOL_PASSWORD"
}
```

The school API returns a JWT.

The server then uses that JWT when requesting the timetable information.

---

# JWT Expiration

The JWT contains an `iat` (issued-at) timestamp and an `exp` (expiration) timestamp.

For example, a decoded JWT payload can contain:

```json
{
    "iat": 1787046417,
    "exp": 1788256017,
    "emailAddress": "my-school-email",
    "firstname": "Andre",
    "lastname": "Kwok",
    "groups": [
        "student",
        "yr11"
    ]
}
```

The important value for refreshing the token is:

```text
exp
```

This is a Unix timestamp representing when the JWT expires.

The server can decode the JWT payload and determine whether the token is still usable.

It does **not** need to verify the JWT signature just to determine its expiration time. The school API still validates the token when it is actually used.

---

# Automatic JWT Refreshing

The website does not need to manually replace the JWT every week.

Instead, the Vercel server can automatically detect when the current JWT has expired.

The process is:

```text
Request timetable
       ↓
Is stored JWT still valid?
       ↓
   ┌───┴───┐
   │       │
  YES      NO
   │       │
   ↓       ↓
Use JWT   Login to school API
           ↓
       Receive new JWT
           ↓
       Use new JWT
           ↓
      Request timetable
```

This means a JWT can be kept temporarily on the server and replaced when necessary.

Because the JWT lifetime is limited, the system does not rely on an old token indefinitely.

---

# Why Refresh on Expiration?

A JWT may last longer than one week, but it does not need to be refreshed every time the website is opened.

For example:

```text
Week 1
JWT is valid
↓
Use existing JWT

Week 2
JWT is still valid
↓
Use existing JWT

JWT expires
↓
Authenticate again
↓
Receive new JWT
↓
Continue normally
```

This avoids unnecessary authentication requests while still ensuring the website can continue working after the JWT expires.

The important part is that the refresh is based on the JWT's `exp` value rather than assuming a fixed lifetime.

---

# Why Vercel Is Used

GitHub Pages only hosts static files such as:

```text
HTML
CSS
JavaScript
Images
```

It cannot safely store my school password or perform server-side authentication.

Vercel provides the server-side functionality required for this.

The architecture is therefore:

```text
                    ┌─────────────────────┐
                    │    GitHub Pages     │
                    │                     │
                    │ HTML / CSS / JS     │
                    │ Timetable UI        │
                    └──────────┬──────────┘
                               │
                               │ HTTPS
                               ↓
                    ┌─────────────────────┐
                    │       Vercel        │
                    │                     │
                    │ Authentication      │
                    │ JWT handling        │
                    │ API requests        │
                    └──────────┬──────────┘
                               │
                               │ JWT
                               ↓
                    ┌─────────────────────┐
                    │    School API       │
                    │                     │
                    │ Timetable data      │
                    │ Bell times          │
                    │ Start date          │
                    │ User profile        │
                    └─────────────────────┘
```

The public GitHub repository therefore does not need to contain the school password.

---

# Getting the Timetable From the School's API

The most important part of the website is getting the timetable data from the school's timetable system.

Instead of having the timetable hard-coded into the website, the website retrieves the information from the school's API.

The basic process is:

```text
School timetable system
          ↓
       School API
          ↓
     Authentication
          ↓
        JWT
          ↓
    API requests
          ↓
     JSON response
          ↓
   JavaScript processes data
          ↓
     Timetable objects
          ↓
      Website displays it
```

---

# API Requests

Once Vercel has a valid JWT, it can request the timetable information.

The JWT is supplied using:

```http
Authorization: Bearer YOUR_TOKEN
```

The server can request multiple pieces of information from the API, including:

```text
Timetable
Bell times
School timetable start date
User profile
```

These requests can be made at the same time so the website does not have to wait for each request individually.

---

# Getting the API Response

The API returns the timetable information as JSON.

The response contains the information needed to build the timetable, such as:

```text
Subject
Teacher
Room
Date
Start time
End time
Period
```

The API data isn't necessarily formatted in a way that can just be placed directly onto the webpage, so the website processes it first.

---

# Converting the API Data Into a Timetable

The JavaScript takes the raw API response and converts it into information that the website can actually use.

For example, the API might provide a lesson containing:

```text
Physics
Teacher: Example Teacher
Room: B201
Start: 9:00 AM
End: 10:00 AM
```

The JavaScript can turn this into an object conceptually similar to:

```javascript
{
    subject: "Physics",
    teacher: "Example Teacher",
    room: "B201",
    start: "09:00",
    end: "10:00"
}
```

The website then takes these entries and places them into the correct position in the timetable.

For example:

```text
        Monday
────────────────────────
Period 1   Mathematics
           Room A101

Period 2   Physics
           Room B201

Period 3   Engineering
           Room E003
```

This means I don't have to manually enter every lesson.

If the timetable data changes in the school's system, the website can pull the updated information the next time it requests the API.

---

# Why I Used the API

Using the API was much better than manually creating a timetable because the timetable can change.

For example, if a room changes from:

```text
B201 → C104
```

I don't need to edit the website.

The API provides the updated information and the website processes it automatically.

The same applies to things like:

* Room changes
* Teacher changes
* Different lessons
* Timetable changes
* Different days
* Period times

The website is therefore essentially a custom frontend for the timetable data that already exists in the school's system.

---

# Security

The public frontend should not contain:

```text
School email password
```

or other long-term authentication credentials.

The school password is stored as a Vercel environment variable and is only accessed by the server-side authentication code.

The JWT is also temporary and expires according to the `exp` timestamp supplied by the school API.

The GitHub repository may contain frontend code, but sensitive authentication credentials should remain on Vercel.

---

# Overall Request Flow

The complete system can be simplified to:

```text
1. User opens the website
              ↓
2. Frontend requests timetable data
              ↓
3. Request reaches Vercel
              ↓
4. Vercel checks the current JWT
              ↓
5. If valid, the JWT is reused
              ↓
6. If expired, Vercel logs in again
              ↓
7. School API returns a new JWT
              ↓
8. Vercel requests timetable information
              ↓
9. School API returns JSON
              ↓
10. Vercel returns the timetable data
              ↓
11. Frontend processes the JSON
              ↓
12. Lessons are sorted into days/periods
              ↓
13. Subject, teacher, room and time are extracted
              ↓
14. Subject colours are applied
              ↓
15. HTML timetable is generated
              ↓
16. User sees the finished timetable
```

The school system handles the actual timetable data, Vercel handles authentication and JWT management, and the frontend handles the presentation.

---

# Project Architecture

```text
GitHub Repository
│
├── index.html
├── favicon.png
└── other frontend assets
        │
        │
        ↓
   GitHub Pages
        │
        │ API request
        ↓
      Vercel
        │
        ├── SCHOOL_EMAIL
        ├── SCHOOL_PASSWORD
        ├── SCHOOL_API_BASE
        │
        ├── Check JWT expiration
        │
        ├── Authenticate when required
        │
        └── Request timetable data
                │
                ↓
           School API
```

This separation allows the website to remain publicly accessible while keeping the school authentication credentials on the server side.
